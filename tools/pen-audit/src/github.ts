/**
 * GitHub API との通信。判断ロジックは純粋関数に切り出してテストする。
 */

import { COMMENT_MARKER } from './report';

export interface IssueComment {
  id: number;
  body?: string | null;
  user?: { login?: string; type?: string } | null;
}

/**
 * 前回 pen-audit が書いたコメントを選ぶ。
 *
 * 本文先頭の隠しマーカーだけで判定する。投稿者で絞らないのは、
 * `GITHUB_TOKEN` と PAT でアクターが変わってもコメントを増やさないため。
 */
export function selectExistingComment(
  comments: IssueComment[],
  marker: string = COMMENT_MARKER,
): IssueComment | null {
  return comments.find((c) => (c.body ?? '').includes(marker)) ?? null;
}

export interface GitHubClientOptions {
  token: string;
  repo: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}

export class GitHubClient {
  private readonly token: string;
  private readonly repo: string;
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitHubClientOptions) {
    this.token = options.token;
    this.repo = options.repo;
    this.apiUrl = (options.apiUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    return this.fetchImpl(`${this.apiUrl}${path}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  /** PR で変更された `.pen` ファイルのパスを返す。削除されたものは除く。 */
  async listChangedFiles(prNumber: number): Promise<string[]> {
    const paths: string[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const res = await this.request(
        'GET',
        `/repos/${this.repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      );
      if (!res.ok) throw new Error(`listChangedFiles failed: ${res.status} ${await res.text()}`);
      const batch = (await res.json()) as Array<{ filename: string; status: string }>;
      paths.push(...batch.filter((f) => f.status !== 'removed').map((f) => f.filename));
      if (batch.length < 100) break;
    }
    return paths;
  }

  /** 既存コメントを全ページ走査してマーカー付きのものを探す。 */
  private async findExistingComment(prNumber: number): Promise<IssueComment | null | 'forbidden'> {
    for (let page = 1; page <= 10; page += 1) {
      const res = await this.request(
        'GET',
        `/repos/${this.repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
      );
      if (res.status === 403 || res.status === 404) return 'forbidden';
      if (!res.ok) throw new Error(`list comments failed: ${res.status}`);
      const batch = (await res.json()) as IssueComment[];
      const hit = selectExistingComment(batch);
      if (hit) return hit;
      if (batch.length < 100) break;
    }
    return null;
  }

  /**
   * pen-audit のコメントを 1 件だけ保つ。既にあれば書き換え、無ければ新規投稿。
   *
   * fork からの PR ではトークンが読み取り専用なので 403 が返る。その場合は
   * 例外にせず null を返し、ジョブサマリーだけで完結させる。
   * `createIfMissing` を false にすると、既存が無いときは何もしない。
   */
  async upsertComment(
    prNumber: number,
    body: string,
    options: { createIfMissing?: boolean } = {},
  ): Promise<'created' | 'updated' | 'skipped' | null> {
    const existing = await this.findExistingComment(prNumber);
    if (existing === 'forbidden') return null;
    if (!existing && options.createIfMissing === false) return 'skipped';

    const res = existing
      ? await this.request('PATCH', `/repos/${this.repo}/issues/comments/${existing.id}`, { body })
      : await this.request('POST', `/repos/${this.repo}/issues/${prNumber}/comments`, { body });
    if (res.status === 403) return null;
    if (!res.ok) throw new Error(`comment failed: ${res.status} ${await res.text()}`);
    return existing ? 'updated' : 'created';
  }
}
