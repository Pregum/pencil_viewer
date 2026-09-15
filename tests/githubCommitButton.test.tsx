/**
 * Commit ボタンの UI テスト。git-backed 保管庫の書き込み側。
 *
 * 落としたくない性質:
 * - update は「開いたときの sha」を添えて送る（これが競合検出の唯一の手段）
 * - 409 / 422 は失敗ではなく競合。上書きか取り直しかをユーザーに選ばせる
 * - force は「最新 sha を取り直してから」送る。取り直さないと必ずまた弾かれる
 * - Save As のパスは正規化する（先頭の / を落とし、拡張子を補う）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import { useEffect } from 'react';
import { GitHubProvider, useGitHub } from '../src/github/GitHubContext';
import { CommitButton } from '../src/github/CommitButton';
import { EditorProvider } from '../src/pen/state/EditorContext';
import { GitHubError, type GitHubFileRef } from '../src/github/githubApi';
import type { PenDocument } from '../src/pen/types';

vi.mock('../src/github/githubApi', async () => {
  const actual = await vi.importActual<typeof import('../src/github/githubApi')>('../src/github/githubApi');
  return {
    ...actual,
    commitPenFile: vi.fn(),
    getPenFile: vi.fn(),
    listRepos: vi.fn(),
    listBranches: vi.fn(),
  };
});

const api = await import('../src/github/githubApi');
const commitPenFile = vi.mocked(api.commitPenFile);
const getPenFile = vi.mocked(api.getPenFile);
const listRepos = vi.mocked(api.listRepos);
const listBranches = vi.mocked(api.listBranches);

const DOC: PenDocument = { version: '1.0', children: [] };

const FILE: GitHubFileRef = {
  owner: 'octocat',
  repo: 'design',
  branch: 'main',
  path: 'design/checkout.pen',
  sha: 'sha-at-open',
};

const REPO = {
  fullName: 'octocat/design',
  name: 'design',
  owner: 'octocat',
  defaultBranch: 'main',
  private: false,
  pushedAt: null,
};

function SetCurrentFile({ file }: { file: GitHubFileRef | null }) {
  const { setCurrentFile } = useGitHub();
  useEffect(() => {
    setCurrentFile(file);
  }, [file, setCurrentFile]);
  return null;
}

function renderButton(file: GitHubFileRef | null = FILE) {
  render(
    <GitHubProvider>
      <SetCurrentFile file={file} />
      <EditorProvider doc={DOC} rawDoc={DOC}>
        <CommitButton />
      </EditorProvider>
    </GitHubProvider>,
  );
}

const openPopover = async (name: RegExp) => {
  const button = await screen.findByRole('button', { name });
  // クリックで走り出す fetch の解決まで act の中で流す
  await act(async () => {
    fireEvent.click(button);
  });
};

/** Save As のポップオーバーが repo と branch を取り終えるまで待つ */
async function saveAsReady() {
  await screen.findByText('octocat/design');
  // repo を選ぶと branch を取りに行く。ここまで待たないと act 警告が出る
  await screen.findByRole('option', { name: 'feat/x' });
}

beforeEach(() => {
  localStorage.setItem('pencil_github_token', 'ghp_test');
  commitPenFile.mockResolvedValue({ sha: 'new-sha' });
  getPenFile.mockResolvedValue({ text: '{}', sha: 'latest-sha' });
  listRepos.mockResolvedValue([REPO]);
  listBranches.mockResolvedValue([{ name: 'main' }, { name: 'feat/x' }]);
});

afterEach(async () => {
  // コミット後の後処理など、まだ解決していない promise を act の中で流し切ってから
  // unmount する。そうしないと "not wrapped in act" が大量に出る。
  await act(async () => {});
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('CommitButton', () => {
  it('未接続なら GitHub 接続を促すラベルを出す', () => {
    localStorage.clear();
    renderButton(null);
    expect(screen.getByRole('button', { name: /Save to GitHub/ })).toBeTruthy();
  });

  describe('update モード（GitHub から開いたファイル）', () => {
    it('コミット先のリポジトリとパスを見せる', async () => {
      renderButton();
      await openPopover(/Commit/);
      expect(await screen.findByText('octocat/design')).toBeTruthy();
      expect(screen.getByText('design/checkout.pen @ main')).toBeTruthy();
    });

    it('開いたときの sha を添えて送る（これが競合検出の鍵）', async () => {
      renderButton();
      await openPopover(/Commit/);
      fireEvent.click(await screen.findByRole('button', { name: 'Commit' }));

      await waitFor(() => expect(commitPenFile).toHaveBeenCalled());
      const [, params] = commitPenFile.mock.calls[0];
      expect(params.sha).toBe('sha-at-open');
      expect(params.owner).toBe('octocat');
      expect(params.repo).toBe('design');
      expect(params.branch).toBe('main');
      expect(params.path).toBe('design/checkout.pen');
      expect(JSON.parse(params.content)).toEqual(DOC);
    });

    it('メッセージが空なら既定文を使う', async () => {
      renderButton();
      await openPopover(/Commit/);
      fireEvent.click(await screen.findByRole('button', { name: 'Commit' }));
      await waitFor(() => expect(commitPenFile).toHaveBeenCalled());
      expect(commitPenFile.mock.calls[0][1].message).toBe('Update design/checkout.pen');
    });

    it('入力したメッセージをそのまま使う', async () => {
      renderButton();
      await openPopover(/Commit/);
      // label と input は for で結ばれていないので、最後の textbox を拾う
      const inputs = await screen.findAllByRole('textbox');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: '  空状態を追加  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

      await waitFor(() => expect(commitPenFile).toHaveBeenCalled());
      expect(commitPenFile.mock.calls[0][1].message).toBe('空状態を追加');
    });

    it('成功するとポップオーバーを閉じて完了を示す', async () => {
      renderButton();
      await openPopover(/Commit/);
      fireEvent.click(await screen.findByRole('button', { name: 'Commit' }));
      expect(await screen.findByRole('button', { name: /Committed/ })).toBeTruthy();
    });

    it('通常のエラーはそのまま表示する', async () => {
      commitPenFile.mockRejectedValueOnce(new GitHubError(403, 'アクセスが拒否されました'));
      renderButton();
      await openPopover(/Commit/);
      fireEvent.click(await screen.findByRole('button', { name: 'Commit' }));
      expect(await screen.findByText('アクセスが拒否されました')).toBeTruthy();
    });
  });

  describe('競合したとき', () => {
    it.each([409, 422])('HTTP %i は失敗ではなく競合として扱う', async (status) => {
      commitPenFile.mockRejectedValueOnce(new GitHubError(status, 'conflict'));
      renderButton();
      await openPopover(/Commit/);
      fireEvent.click(await screen.findByRole('button', { name: 'Commit' }));

      expect(await screen.findByText('⚠️ リモートが更新されています')).toBeTruthy();
      expect(screen.getByRole('button', { name: /自分の変更で上書き/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /最新を取得/ })).toBeTruthy();
    });

    it('force は最新 sha を取り直してから送る', async () => {
      commitPenFile.mockRejectedValueOnce(new GitHubError(409, 'conflict'));
      renderButton();
      await openPopover(/Commit/);
      fireEvent.click(await screen.findByRole('button', { name: 'Commit' }));
      await screen.findByText('⚠️ リモートが更新されています');

      fireEvent.click(screen.getByRole('button', { name: /自分の変更で上書き/ }));

      await waitFor(() => expect(commitPenFile).toHaveBeenCalledTimes(2));
      expect(getPenFile).toHaveBeenCalledWith('ghp_test', 'octocat', 'design', 'design/checkout.pen', 'main');
      // 2 回目は取り直した sha を使う（古い sha のままだと必ずまた弾かれる）
      expect(commitPenFile.mock.calls[1][1].sha).toBe('latest-sha');
    });

    it('force に失敗したらエラーを出す', async () => {
      commitPenFile.mockRejectedValueOnce(new GitHubError(409, 'conflict'));
      getPenFile.mockRejectedValueOnce(new GitHubError(404, '見つかりません。'));
      renderButton();
      await openPopover(/Commit/);
      fireEvent.click(await screen.findByRole('button', { name: 'Commit' }));
      await screen.findByText('⚠️ リモートが更新されています');

      fireEvent.click(screen.getByRole('button', { name: /自分の変更で上書き/ }));
      expect(await screen.findByText('見つかりません。')).toBeTruthy();
    });
  });

  describe('Save As モード（GitHub 由来でない doc）', () => {
    it('開くとリポジトリ一覧を取りに行く', async () => {
      renderButton(null);
      await openPopover(/Save to GitHub/);
      await waitFor(() => expect(listRepos).toHaveBeenCalledWith('ghp_test'));
      await saveAsReady();
      expect(screen.getByText('octocat/design')).toBeTruthy();
    });

    it('パスの先頭の / を落とし、.pen を補って新規作成する', async () => {
      renderButton(null);
      await openPopover(/Save to GitHub/);
      await saveAsReady();

      const pathInput = screen.getByPlaceholderText('designs/untitled.pen');
      fireEvent.change(pathInput, { target: { value: '/designs/new-screen' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create & Commit' }));

      await waitFor(() => expect(commitPenFile).toHaveBeenCalled());
      const [, params] = commitPenFile.mock.calls[0];
      expect(params.path).toBe('designs/new-screen.pen');
      // 新規作成なので sha は送らない
      expect(params.sha).toBeNull();
      // Save As を開いた時点でメッセージ欄に既定文が入っている
      expect(params.message).toBe('Add design');
    });

    it('メッセージを空にすると、保存先パスから既定文を組み立てる', async () => {
      renderButton(null);
      await openPopover(/Save to GitHub/);
      await saveAsReady();

      fireEvent.change(screen.getByPlaceholderText('designs/untitled.pen'), {
        target: { value: 'designs/new-screen.pen' },
      });
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[inputs.length - 1], { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create & Commit' }));

      await waitFor(() => expect(commitPenFile).toHaveBeenCalled());
      expect(commitPenFile.mock.calls[0][1].message).toBe('Add designs/new-screen.pen');
    });

    it('パスが空なら送らずに促す', async () => {
      renderButton(null);
      await openPopover(/Save to GitHub/);
      await saveAsReady();

      fireEvent.change(screen.getByPlaceholderText('designs/untitled.pen'), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create & Commit' }));

      expect(await screen.findByText('保存先パスを入力してください。')).toBeTruthy();
      expect(commitPenFile).not.toHaveBeenCalled();
    });

    it('作成後は update モードに切り替わる（次からは同じパスへ上書き）', async () => {
      renderButton(null);
      await openPopover(/Save to GitHub/);
      await saveAsReady();

      fireEvent.change(screen.getByPlaceholderText('designs/untitled.pen'), {
        target: { value: 'a.pen' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create & Commit' }));

      await waitFor(() => expect(commitPenFile).toHaveBeenCalled());
      // ラベルが Commit（update モード）に変わる
      await waitFor(() => expect(screen.getByRole('button', { name: /Commit/ })).toBeTruthy());
    });
  });
});
