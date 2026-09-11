/**
 * githubApi.ts の API 呼び出し層のテスト。
 *
 * api.github.com へ実際には出ない。fetch を差し替え、
 * 「送ったリクエスト」と「返ってきた JSON をどう畳んだか」の両方を見る。
 * 認証ヘッダ・パスの encode・エラーの日本語化はユーザーに直接見える挙動なので
 * ここで固定しておく。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GitHubError,
  getUser,
  listRepos,
  listBranches,
  listPenFiles,
  getPenFile,
  listCommits,
  commitPenFile,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  utf8ToBase64,
} from '../src/github/githubApi';

const TOKEN = 'ghp_dummy_token';

/** fetch の呼び出し記録 */
interface Call {
  url: string;
  init: RequestInit | undefined;
}

let calls: Call[] = [];

/** 次の fetch が返すレスポンスを積む */
function mockJson(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      } as unknown as Response);
    }),
  );
}

/** JSON にならないエラーレスポンス（HTML のエラーページ等） */
function mockNonJsonError(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: false,
        status,
        json: () => Promise.reject(new Error('not json')),
      } as unknown as Response);
    }),
  );
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ghFetch (共通のリクエスト整形とエラー変換)', () => {
  it('Bearer トークンと API バージョンヘッダを付ける', async () => {
    mockJson({ login: 'octocat', name: 'The Octocat', avatar_url: 'https://x/a.png' });
    await getUser(TOKEN);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.github.com/user');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    // body が無いときは Content-Type を付けない
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('body があるときだけ Content-Type: application/json を付ける', async () => {
    mockJson({ content: { sha: 'new-sha' } });
    await commitPenFile(TOKEN, {
      owner: 'o',
      repo: 'r',
      branch: 'main',
      path: 'a.pen',
      content: '{}',
      message: 'm',
    });
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it.each([
    [401, 'トークンが無効か期限切れです。再接続してください。'],
    [404, '見つかりません（パス/権限を確認してください）。'],
    [409, '競合が発生しました。リポジトリ側が更新されています。最新を取得し直してください。'],
  ])('HTTP %i を日本語メッセージの GitHubError にする', async (status, message) => {
    mockJson({ message: 'Bad credentials' }, status);
    await expect(getUser(TOKEN)).rejects.toMatchObject({
      name: 'GitHubError',
      status,
      message,
    });
  });

  it('403 は GitHub 側のメッセージを添えて返す', async () => {
    mockJson({ message: 'API rate limit exceeded' }, 403);
    await expect(getUser(TOKEN)).rejects.toThrow(/API rate limit exceeded/);
    await expect(getUser(TOKEN)).rejects.toThrow(/権限不足 or レート制限/);
  });

  it('上記以外は GitHub の message をそのまま使う', async () => {
    mockJson({ message: 'Validation Failed' }, 422);
    await expect(getUser(TOKEN)).rejects.toMatchObject({
      status: 422,
      message: 'Validation Failed',
    });
  });

  it('JSON で返らないエラーは HTTP <status> にフォールバックする', async () => {
    mockNonJsonError(500);
    await expect(getUser(TOKEN)).rejects.toMatchObject({
      status: 500,
      message: 'HTTP 500',
    });
  });

  it('GitHubError は Error のサブクラス', () => {
    const e = new GitHubError(418, 'teapot');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('GitHubError');
    expect(e.status).toBe(418);
  });
});

describe('getUser', () => {
  it('avatar_url を avatarUrl に畳む', async () => {
    mockJson({ login: 'octocat', name: null, avatar_url: 'https://x/a.png' });
    await expect(getUser(TOKEN)).resolves.toEqual({
      login: 'octocat',
      name: null,
      avatarUrl: 'https://x/a.png',
    });
  });
});

describe('listRepos', () => {
  const raw = (over: Record<string, unknown> = {}) => ({
    full_name: 'octocat/design',
    name: 'design',
    owner: { login: 'octocat' },
    default_branch: 'main',
    private: false,
    pushed_at: '2026-01-01T00:00:00Z',
    ...over,
  });

  it('push できないリポジトリを落とす', async () => {
    mockJson([
      raw({ full_name: 'octocat/writable', name: 'writable', permissions: { push: true } }),
      raw({ full_name: 'other/readonly', name: 'readonly', permissions: { push: false } }),
      // permissions 自体が無い場合は残す（自分の repo は省略されることがある）
      raw({ full_name: 'octocat/nopermfield', name: 'nopermfield' }),
    ]);
    const repos = await listRepos(TOKEN);
    expect(repos.map((r) => r.fullName)).toEqual(['octocat/writable', 'octocat/nopermfield']);
  });

  it('スネークケースをキャメルケースへ畳む', async () => {
    mockJson([raw({ private: true, pushed_at: null })]);
    const [r] = await listRepos(TOKEN);
    expect(r).toEqual({
      fullName: 'octocat/design',
      name: 'design',
      owner: 'octocat',
      defaultBranch: 'main',
      private: true,
      pushedAt: null,
    });
  });

  it('push 新しい順・100 件でリクエストする', async () => {
    mockJson([]);
    await listRepos(TOKEN);
    expect(calls[0].url).toContain('/user/repos?per_page=100&sort=pushed');
    expect(calls[0].url).toContain('affiliation=owner,collaborator,organization_member');
  });
});

describe('listBranches', () => {
  it('name だけを取り出す', async () => {
    mockJson([
      { name: 'main', commit: {} },
      { name: 'feat/x', commit: {} },
    ]);
    await expect(listBranches(TOKEN, 'octocat', 'design')).resolves.toEqual([
      { name: 'main' },
      { name: 'feat/x' },
    ]);
    expect(calls[0].url).toBe('https://api.github.com/repos/octocat/design/branches?per_page=100');
  });
});

describe('listPenFiles', () => {
  it('tree を再帰取得して .pen blob だけ返す', async () => {
    mockJson({
      tree: [
        { path: 'docs/spec.pen', type: 'blob', sha: 'b1' },
        { path: 'README.md', type: 'blob', sha: 'b2' },
        { path: 'docs', type: 'tree', sha: 't1' },
      ],
    });
    await expect(listPenFiles(TOKEN, 'o', 'r', 'main')).resolves.toEqual([
      { path: 'docs/spec.pen', sha: 'b1' },
    ]);
    expect(calls[0].url).toBe('https://api.github.com/repos/o/r/git/trees/main?recursive=1');
  });

  it('ブランチ名の / を encode する（feat/x が壊れない）', async () => {
    mockJson({ tree: [] });
    await listPenFiles(TOKEN, 'o', 'r', 'feat/new ui');
    expect(calls[0].url).toContain('/git/trees/feat%2Fnew%20ui?recursive=1');
  });

  it('tree キーが無いレスポンスでも落ちない', async () => {
    mockJson({});
    await expect(listPenFiles(TOKEN, 'o', 'r', 'main')).resolves.toEqual([]);
  });
});

describe('getPenFile', () => {
  it('base64 をデコードして sha と一緒に返す', async () => {
    const text = '{"version":"1.0","children":[],"note":"日本語 🎨"}';
    mockJson({ content: utf8ToBase64(text), encoding: 'base64', sha: 'blob-sha' });
    await expect(getPenFile(TOKEN, 'o', 'r', 'designs/a.pen', 'main')).resolves.toEqual({
      text,
      sha: 'blob-sha',
    });
  });

  it('パスの各セグメントを encode し、/ は残す', async () => {
    mockJson({ content: utf8ToBase64('{}'), encoding: 'base64', sha: 's' });
    await getPenFile(TOKEN, 'o', 'r', 'design docs/画面 A.pen', 'main');
    const url = calls[0].url;
    expect(url).toContain('/contents/design%20docs/%E7%94%BB%E9%9D%A2%20A.pen');
    expect(url).toContain('?ref=main');
  });

  it('base64 で返らない（大きすぎる）ときは 422 で弾く', async () => {
    mockJson({ content: undefined, encoding: 'none', sha: 's' });
    await expect(getPenFile(TOKEN, 'o', 'r', 'a.pen', 'main')).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('listCommits', () => {
  it('コミットを表示用の形に畳む', async () => {
    mockJson([
      {
        sha: 'c1',
        commit: { message: 'feat: ボタン追加', author: { name: 'Octo Cat', date: '2026-02-01T10:00:00Z' } },
        author: { login: 'octocat' },
      },
      // bot コミット等で author が null になることがある
      { sha: 'c2', commit: { message: 'init' }, author: null },
    ]);
    await expect(listCommits(TOKEN, 'o', 'r', 'a.pen', 'main')).resolves.toEqual([
      {
        sha: 'c1',
        message: 'feat: ボタン追加',
        date: '2026-02-01T10:00:00Z',
        authorLogin: 'octocat',
        authorName: 'Octo Cat',
      },
      { sha: 'c2', message: 'init', date: null, authorLogin: null, authorName: null },
    ]);
  });

  it('path / branch を query に載せ、per_page は既定 30', async () => {
    mockJson([]);
    await listCommits(TOKEN, 'o', 'r', 'design docs/a.pen', 'feat/x');
    expect(calls[0].url).toContain('path=design%20docs%2Fa.pen');
    expect(calls[0].url).toContain('sha=feat%2Fx');
    expect(calls[0].url).toContain('per_page=30');
  });

  it('per_page を指定できる', async () => {
    mockJson([]);
    await listCommits(TOKEN, 'o', 'r', 'a.pen', 'main', 5);
    expect(calls[0].url).toContain('per_page=5');
  });
});

describe('commitPenFile', () => {
  it('新規作成では sha を送らない', async () => {
    mockJson({ content: { sha: 'created' } });
    const res = await commitPenFile(TOKEN, {
      owner: 'o',
      repo: 'r',
      branch: 'main',
      path: 'new.pen',
      content: '{"a":1}',
      message: 'add',
    });
    expect(res).toEqual({ sha: 'created' });
    expect(calls[0].init?.method).toBe('PUT');
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body).toEqual({ message: 'add', content: utf8ToBase64('{"a":1}'), branch: 'main' });
    expect(body.sha).toBeUndefined();
  });

  it('更新では既存 blob の sha を送る（これが競合検出の鍵）', async () => {
    mockJson({ content: { sha: 'updated' } });
    await commitPenFile(TOKEN, {
      owner: 'o',
      repo: 'r',
      branch: 'main',
      path: 'a.pen',
      content: '{}',
      message: 'update',
      sha: 'old-sha',
    });
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.sha).toBe('old-sha');
  });

  it('sha が返らないレスポンスは 500 として扱う', async () => {
    mockJson({});
    await expect(
      commitPenFile(TOKEN, {
        owner: 'o',
        repo: 'r',
        branch: 'main',
        path: 'a.pen',
        content: '{}',
        message: 'm',
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('409 競合はそのまま呼び出し側へ伝わる', async () => {
    mockJson({ message: 'conflict' }, 409);
    await expect(
      commitPenFile(TOKEN, {
        owner: 'o',
        repo: 'r',
        branch: 'main',
        path: 'a.pen',
        content: '{}',
        message: 'm',
        sha: 'stale',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('トークンの保持', () => {
  it('保存 → 取得 → 破棄', () => {
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
    setStoredToken(TOKEN);
    expect(getStoredToken()).toBe(TOKEN);
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });

  it('localStorage が使えない環境でも throw しない', () => {
    const boom = () => {
      throw new Error('SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    expect(getStoredToken()).toBeNull();
    expect(() => setStoredToken('x')).not.toThrow();
    expect(() => clearStoredToken()).not.toThrow();
  });
});
