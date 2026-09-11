/**
 * GitHub パネル（接続 → repo/branch 選択 → .pen を開く）の UI テスト。
 *
 * githubApi はモックする。ここで見たいのは通信ではなく、
 * 「どの状態のとき画面に何が出て、押すと何が起きるか」の方。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { GitHubProvider } from '../src/github/GitHubContext';
import { GitHubPanel } from '../src/github/GitHubPanel';
import { GitHubError } from '../src/github/githubApi';

vi.mock('../src/github/githubApi', async () => {
  const actual = await vi.importActual<typeof import('../src/github/githubApi')>('../src/github/githubApi');
  return {
    ...actual,
    getUser: vi.fn(),
    listRepos: vi.fn(),
    listBranches: vi.fn(),
    listPenFiles: vi.fn(),
    getPenFile: vi.fn(),
  };
});

const api = await import('../src/github/githubApi');
const getUser = vi.mocked(api.getUser);
const listRepos = vi.mocked(api.listRepos);
const listBranches = vi.mocked(api.listBranches);
const listPenFiles = vi.mocked(api.listPenFiles);
const getPenFile = vi.mocked(api.getPenFile);

const USER = { login: 'octocat', name: 'The Octocat', avatarUrl: 'https://x/a.png' };
const REPO = {
  fullName: 'octocat/design',
  name: 'design',
  owner: 'octocat',
  defaultBranch: 'main',
  private: false,
  pushedAt: '2026-01-01T00:00:00Z',
};

function renderPanel(onOpenFile = vi.fn(), onClose = vi.fn()) {
  render(
    <GitHubProvider>
      <GitHubPanel open onClose={onClose} onOpenFile={onOpenFile} />
    </GitHubProvider>,
  );
  return { onOpenFile, onClose };
}

/** 制御された input に値を入れる */
function typeInto(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

/** 接続済みの状態まで進める */
async function connect(token = 'ghp_test') {
  typeInto(screen.getByLabelText('Personal Access Token'), token);
  fireEvent.click(screen.getByRole('button', { name: '接続する' }));
  await screen.findByText('octocat');
}

beforeEach(() => {
  localStorage.clear();
  getUser.mockResolvedValue(USER);
  listRepos.mockResolvedValue([REPO]);
  listBranches.mockResolvedValue([{ name: 'main' }, { name: 'feat/x' }]);
  listPenFiles.mockResolvedValue([{ path: 'design/checkout.pen', sha: 'blob1' }]);
  getPenFile.mockResolvedValue({ text: '{"version":"1.0","children":[]}', sha: 'blob1' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GitHubPanel', () => {
  it('open が false なら何も描かない', () => {
    const { container } = render(
      <GitHubProvider>
        <GitHubPanel open={false} onClose={vi.fn()} onOpenFile={vi.fn()} />
      </GitHubProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  describe('未接続のとき', () => {
    it('トークン入力を出し、空の間は接続ボタンを押せない', () => {
      renderPanel();
      expect(screen.getByLabelText('Personal Access Token')).toBeTruthy();
      expect(screen.getByRole('button', { name: '接続する' })).toHaveProperty('disabled', true);
    });

    it('トークンを入れて接続すると、ユーザー名が出てリポジトリを取りに行く', async () => {
      renderPanel();
      await connect();

      expect(getUser).toHaveBeenCalledWith('ghp_test');
      await waitFor(() => expect(listRepos).toHaveBeenCalledWith('ghp_test'));
      expect(await screen.findByText('octocat/design')).toBeTruthy();
    });

    it('接続したトークンは localStorage に残る（次回この端末で再入力しないで済む）', async () => {
      renderPanel();
      await connect();
      expect(localStorage.getItem('pencil_github_token')).toBe('ghp_test');
    });

    it('トークンが無効ならエラーを出し、接続しない', async () => {
      getUser.mockRejectedValueOnce(new GitHubError(401, 'トークンが無効か期限切れです。'));
      renderPanel();

      typeInto(screen.getByLabelText('Personal Access Token'), 'bad');
      fireEvent.click(screen.getByRole('button', { name: '接続する' }));

      expect(await screen.findByText('トークンが無効か期限切れです。')).toBeTruthy();
      expect(listRepos).not.toHaveBeenCalled();
      expect(localStorage.getItem('pencil_github_token')).toBeNull();
    });
  });

  describe('接続したあと', () => {
    it('リポジトリを選ぶとブランチと .pen 一覧が出る', async () => {
      renderPanel();
      await connect();

      fireEvent.click(await screen.findByText('octocat/design'));

      await waitFor(() => expect(listBranches).toHaveBeenCalledWith('ghp_test', 'octocat', 'design'));
      expect(await screen.findByText('design/checkout.pen')).toBeTruthy();
      // ブランチは既定ブランチが選ばれている
      expect(screen.getByRole('combobox')).toHaveProperty('value', 'main');
    });

    it('ブランチを切り替えると、そのブランチの .pen を取り直す', async () => {
      renderPanel();
      await connect();
      fireEvent.click(await screen.findByText('octocat/design'));
      await screen.findByText('design/checkout.pen');

      listPenFiles.mockResolvedValueOnce([{ path: 'wip/draft.pen', sha: 'blob2' }]);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'feat/x' } });

      expect(await screen.findByText('wip/draft.pen')).toBeTruthy();
      expect(listPenFiles).toHaveBeenLastCalledWith('ghp_test', 'octocat', 'design', 'feat/x');
    });

    it('ファイルを押すと中身と参照を渡してパネルを閉じる', async () => {
      const onOpenFile = vi.fn();
      const onClose = vi.fn();
      renderPanel(onOpenFile, onClose);
      await connect();
      fireEvent.click(await screen.findByText('octocat/design'));
      fireEvent.click(await screen.findByText('design/checkout.pen'));

      await waitFor(() => expect(onOpenFile).toHaveBeenCalled());
      const [text, ref, fileName] = onOpenFile.mock.calls[0];
      expect(text).toBe('{"version":"1.0","children":[]}');
      expect(ref).toEqual({
        owner: 'octocat',
        repo: 'design',
        branch: 'main',
        path: 'design/checkout.pen',
        sha: 'blob1',
      });
      // 表示用の名前はパスの末尾だけ
      expect(fileName).toBe('checkout.pen');
      expect(onClose).toHaveBeenCalled();
    });

    it('.pen が 1 つも無いブランチでは、作り方を案内する', async () => {
      listPenFiles.mockResolvedValue([]);
      renderPanel();
      await connect();
      fireEvent.click(await screen.findByText('octocat/design'));

      expect(await screen.findByText(/このブランチに \.pen/)).toBeTruthy();
    });

    it('リポジトリ名で絞り込める', async () => {
      listRepos.mockResolvedValue([REPO, { ...REPO, fullName: 'octocat/other', name: 'other' }]);
      renderPanel();
      await connect();
      await screen.findByText('octocat/design');

      typeInto(screen.getByPlaceholderText('リポジトリを検索…'), 'other');

      expect(screen.queryByText('octocat/design')).toBeNull();
      expect(screen.getByText('octocat/other')).toBeTruthy();
    });

    it('絞り込みで 0 件なら「該当なし」', async () => {
      renderPanel();
      await connect();
      await screen.findByText('octocat/design');

      typeInto(screen.getByPlaceholderText('リポジトリを検索…'), 'zzz');
      expect(screen.getByText('該当なし')).toBeTruthy();
    });

    it('切断するとトークンを捨ててトークン入力に戻る', async () => {
      renderPanel();
      await connect();

      fireEvent.click(screen.getByRole('button', { name: '切断' }));

      expect(screen.getByLabelText('Personal Access Token')).toBeTruthy();
      expect(localStorage.getItem('pencil_github_token')).toBeNull();
    });

    it('一覧の取得に失敗したらエラーを出す', async () => {
      listRepos.mockRejectedValueOnce(new GitHubError(403, 'レート制限'));
      renderPanel();
      await connect();

      expect(await screen.findByText('レート制限')).toBeTruthy();
    });
  });

  it('保存済みトークンがあれば、開いた時点でリポジトリを取りに行く', async () => {
    localStorage.setItem('pencil_github_token', 'ghp_saved');
    renderPanel();
    // token はあるが user 情報が無い状態。接続済み扱いで一覧を取る。
    await waitFor(() => expect(listRepos).toHaveBeenCalledWith('ghp_saved'));
  });

  it('× で閉じられる', async () => {
    const onClose = vi.fn();
    renderPanel(vi.fn(), onClose);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
