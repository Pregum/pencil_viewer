/**
 * GitHub REST API クライアント（完全クライアントサイド・$0）。
 *
 * 思想: pencil_viewer はストレージを 1 バイトも持たない。.pen 資産は
 * ユーザー自身の GitHub リポジトリに git-backed で蓄積される（BYO ストレージ）。
 * api.github.com は CORS 対応なのでブラウザから直接叩ける = サーバー不要。
 *
 * 認証は Personal Access Token (PAT)。`Contents` 読み書き権限があればよい。
 * トークンは localStorage に保持する（端末ローカル、外部に送らない）。
 */

const API_BASE = 'https://api.github.com';
const TOKEN_KEY = 'pencil_github_token';

/** GitHub API エラー。status とメッセージを保持する。 */
export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GitHubRepo {
  /** "owner/repo" 形式 */
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  /** 最終 push 時刻（ソート用 ISO 文字列） */
  pushedAt: string | null;
}

export interface GitHubBranch {
  name: string;
}

/** リポジトリ内の 1 つの .pen ファイル */
export interface PenEntry {
  /** リポジトリルートからの相対パス */
  path: string;
  /** blob sha（更新時の競合検出に使う） */
  sha: string;
}

/** 取得した .pen ファイルの中身 */
export interface PenFileContent {
  text: string;
  /** Contents API が返す blob sha。更新時に必須。 */
  sha: string;
}

/** コミット履歴の 1 エントリ */
export interface CommitInfo {
  /** コミット sha（このファイルのその時点の中身を取得する ref に使う） */
  sha: string;
  message: string;
  /** ISO 日時 */
  date: string | null;
  authorLogin: string | null;
  authorName: string | null;
}

/** 現在開いている GitHub 上の .pen ファイルへの参照 */
export interface GitHubFileRef {
  owner: string;
  repo: string;
  /** ブランチ名 */
  branch: string;
  /** リポジトリルートからの相対パス */
  path: string;
  /** 最新の blob sha（コミットのたびに更新する） */
  sha: string | null;
}

// ---------------------------------------------------------------------------
// トークンの種類判定
// ---------------------------------------------------------------------------

export type TokenKind = 'fine-grained' | 'classic' | 'unknown';

/**
 * 貼られたトークンが fine-grained か classic かを前置きから判定する。
 *
 * 漏えい時の影響が大きく違うので、UI で警告を出すために使う。
 * classic の `repo` スコープは対象を選べず、アクセスできる全リポジトリ
 * （private を含む）の読み書きに及ぶ。fine-grained ならリポジトリ単位で
 * 絞れるので、万一漏れても被害がその範囲に留まる。
 *
 * 判定は前置きだけで、GitHub には問い合わせない。実際の権限までは
 * 分からないので、あくまで注意喚起に使う。
 */
export function classifyToken(token: string): TokenKind {
  const t = token.trim();
  if (t.startsWith('github_pat_')) return 'fine-grained';
  // ghp_ = classic PAT, gho_ = OAuth, ghu_/ghs_ = GitHub App, ghr_ = refresh
  if (/^gh[pousr]_/.test(t)) return 'classic';
  // 2021 年以前に発行された 40 桁の 16 進。今も有効なものが残っている
  if (/^[0-9a-f]{40}$/i.test(t)) return 'classic';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// トークン保持（localStorage）
// ---------------------------------------------------------------------------

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* localStorage 不可環境では何もしない */
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// 純粋ヘルパー（テスト対象）
// ---------------------------------------------------------------------------

/** UTF-8 文字列を base64 へ。GitHub Contents API は base64 を要求する。 */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** GitHub が返す base64（改行入り）を UTF-8 文字列へ。 */
export function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** ファイル名/パスが .pen かどうか（大文字小文字無視） */
export function isPenPath(path: string): boolean {
  return /\.pen$/i.test(path);
}

interface RawTreeEntry {
  path?: string;
  type?: string;
  sha?: string;
}

/** git tree のレスポンスから .pen の blob だけを抜き出してパス順にソート。 */
export function filterPenEntries(tree: RawTreeEntry[]): PenEntry[] {
  return tree
    .filter(
      (e) =>
        e.type === 'blob' && typeof e.path === 'string' && isPenPath(e.path) && typeof e.sha === 'string',
    )
    .map((e) => ({ path: e.path as string, sha: e.sha as string }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// ---------------------------------------------------------------------------
// API 呼び出し
// ---------------------------------------------------------------------------

async function ghFetch(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* JSON でないレスポンスはそのまま */
    }
    if (res.status === 401) message = 'トークンが無効か期限切れです。再接続してください。';
    else if (res.status === 403) message = `アクセスが拒否されました（権限不足 or レート制限）: ${message}`;
    else if (res.status === 404) message = '見つかりません（パス/権限を確認してください）。';
    else if (res.status === 409)
      message = '競合が発生しました。リポジトリ側が更新されています。最新を取得し直してください。';
    throw new GitHubError(res.status, message);
  }

  // 204 No Content 等
  if (res.status === 204) return null;
  return res.json();
}

/** トークンを検証しユーザー情報を返す。失敗時は GitHubError。 */
export async function getUser(token: string): Promise<GitHubUser> {
  const u = (await ghFetch(token, '/user')) as {
    login: string;
    name: string | null;
    avatar_url: string;
  };
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url };
}

/** 書き込み可能なリポジトリ一覧（push 新しい順）。 */
export async function listRepos(token: string): Promise<GitHubRepo[]> {
  const repos = (await ghFetch(
    token,
    '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member',
  )) as Array<{
    full_name: string;
    name: string;
    owner: { login: string };
    default_branch: string;
    private: boolean;
    pushed_at: string | null;
    permissions?: { push?: boolean };
  }>;
  return (
    repos
      // push 権限のあるリポジトリのみ（資産を書き込めるものだけ見せる）
      .filter((r) => r.permissions?.push !== false)
      .map((r) => ({
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        defaultBranch: r.default_branch,
        private: r.private,
        pushedAt: r.pushed_at,
      }))
  );
}

/** リポジトリのブランチ一覧。 */
export async function listBranches(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  const branches = (await ghFetch(token, `/repos/${owner}/${repo}/branches?per_page=100`)) as Array<{
    name: string;
  }>;
  return branches.map((b) => ({ name: b.name }));
}

/** ブランチ内の .pen ファイルを再帰的に列挙。 */
export async function listPenFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<PenEntry[]> {
  const tree = (await ghFetch(
    token,
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  )) as { tree?: RawTreeEntry[]; truncated?: boolean };
  return filterPenEntries(tree.tree ?? []);
}

/** 1 つの .pen ファイルを取得（テキスト + sha）。 */
export async function getPenFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<PenFileContent> {
  const file = (await ghFetch(
    token,
    `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
  )) as { content?: string; encoding?: string; sha: string };
  if (typeof file.content !== 'string' || file.encoding !== 'base64') {
    throw new GitHubError(422, 'ファイルが大きすぎるか、テキストとして取得できません。');
  }
  return { text: base64ToUtf8(file.content), sha: file.sha };
}

export interface CommitParams {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
  /** 既存ファイル更新時は必須。新規作成時は null/undefined。 */
  sha?: string | null;
}

/** あるファイルのコミット履歴（新しい順）。 */
export async function listCommits(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  perPage = 30,
): Promise<CommitInfo[]> {
  const commits = (await ghFetch(
    token,
    `/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=${perPage}`,
  )) as Array<{
    sha: string;
    commit: { message: string; author?: { name?: string; date?: string } };
    author: { login: string } | null;
  }>;
  return commits.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.author?.date ?? null,
    authorLogin: c.author?.login ?? null,
    authorName: c.commit.author?.name ?? null,
  }));
}

/** .pen ファイルを作成 or 更新（= コミット）。新しい blob sha を返す。 */
export async function commitPenFile(token: string, params: CommitParams): Promise<{ sha: string }> {
  const body: Record<string, unknown> = {
    message: params.message,
    content: utf8ToBase64(params.content),
    branch: params.branch,
  };
  if (params.sha) body.sha = params.sha;

  const res = (await ghFetch(
    token,
    `/repos/${params.owner}/${params.repo}/contents/${encodePath(params.path)}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  )) as { content?: { sha: string } };

  if (!res.content?.sha) {
    throw new GitHubError(500, 'コミットは成功しましたが新しい sha を取得できませんでした。');
  }
  return { sha: res.content.sha };
}

/** パスの各セグメントを encode（スラッシュは保持）。 */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}
