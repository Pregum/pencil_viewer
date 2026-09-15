/**
 * コミット履歴モーダルの UI テスト。
 *
 * ここで一番落としたくないのは「復元は repo をまだ書き換えていない」という約束。
 * 復元は旧版をエディタに読み込むだけで、tip の sha は保ったまま返す必要がある。
 * これを取り違えると次の Commit が競合するか、履歴を壊す。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { GitHubProvider, useGitHub } from '../src/github/GitHubContext';
import { HistoryPanel } from '../src/github/HistoryPanel';
import { GitHubError, type GitHubFileRef } from '../src/github/githubApi';
import { useEffect } from 'react';

vi.mock('../src/github/githubApi', async () => {
  const actual = await vi.importActual<typeof import('../src/github/githubApi')>('../src/github/githubApi');
  return { ...actual, listCommits: vi.fn(), getPenFile: vi.fn() };
});

const api = await import('../src/github/githubApi');
const listCommits = vi.mocked(api.listCommits);
const getPenFile = vi.mocked(api.getPenFile);

const FILE: GitHubFileRef = {
  owner: 'octocat',
  repo: 'design',
  branch: 'main',
  path: 'design/checkout.pen',
  sha: 'tip-sha',
};

const COMMITS = [
  {
    sha: 'aaaaaaa1111',
    message: 'feat: カート画面に空状態を追加\n\n詳細な本文',
    date: '2026-02-03T10:00:00Z',
    authorLogin: 'octocat',
    authorName: 'The Octocat',
  },
  {
    sha: 'bbbbbbb2222',
    message: '商品行の余白を揃える',
    date: '2026-02-01T09:00:00Z',
    authorLogin: null,
    authorName: 'Someone',
  },
];

/** 現在ファイルを差し込むための小道具 */
function SetCurrentFile({ file }: { file: GitHubFileRef | null }) {
  const { setCurrentFile } = useGitHub();
  useEffect(() => {
    setCurrentFile(file);
  }, [file, setCurrentFile]);
  return null;
}

function renderHistory(opts: { file?: GitHubFileRef | null; onRestore?: ReturnType<typeof vi.fn> } = {}) {
  const onRestore = opts.onRestore ?? vi.fn();
  const onClose = vi.fn();
  render(
    <GitHubProvider>
      <SetCurrentFile file={opts.file === undefined ? FILE : opts.file} />
      <HistoryPanel open onClose={onClose} onRestore={onRestore} />
    </GitHubProvider>,
  );
  return { onRestore, onClose };
}

beforeEach(() => {
  localStorage.setItem('pencil_github_token', 'ghp_test');
  listCommits.mockResolvedValue(COMMITS);
  getPenFile.mockResolvedValue({ text: '{"version":"1.0","children":[]}', sha: 'old-blob' });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('HistoryPanel', () => {
  it('open が false なら何も描かない', () => {
    const { container } = render(
      <GitHubProvider>
        <HistoryPanel open={false} onClose={vi.fn()} onRestore={vi.fn()} />
      </GitHubProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('GitHub 由来のファイルが無いときは履歴を取りに行かない', async () => {
    renderHistory({ file: null });
    expect(await screen.findByText('GitHub から開いたファイルがありません。')).toBeTruthy();
    expect(listCommits).not.toHaveBeenCalled();
  });

  it('現在ファイルの履歴を新しい順に出す', async () => {
    renderHistory();
    expect(await screen.findByText('feat: カート画面に空状態を追加')).toBeTruthy();
    expect(screen.getByText('商品行の余白を揃える')).toBeTruthy();
    await waitFor(() =>
      expect(listCommits).toHaveBeenCalledWith(
        'ghp_test',
        'octocat',
        'design',
        'design/checkout.pen',
        'main',
      ),
    );
  });

  it('コミットメッセージは 1 行目だけを見出しに使う', async () => {
    renderHistory();
    await screen.findByText('feat: カート画面に空状態を追加');
    expect(screen.queryByText(/詳細な本文/)).toBeNull();
  });

  it('先頭のコミットにだけ latest の印を付ける', async () => {
    renderHistory();
    await screen.findByText('feat: カート画面に空状態を追加');
    expect(screen.getAllByText('latest')).toHaveLength(1);
  });

  it('sha は短縮して出す', async () => {
    renderHistory();
    await screen.findByText('feat: カート画面に空状態を追加');
    expect(screen.getByText('aaaaaaa')).toBeTruthy();
    expect(screen.queryByText('aaaaaaa1111')).toBeNull();
  });

  it('author は login を優先し、無ければ commit の名前を使う', async () => {
    renderHistory();
    await screen.findByText('feat: カート画面に空状態を追加');
    expect(screen.getByText(/octocat/)).toBeTruthy();
    expect(screen.getByText(/Someone/)).toBeTruthy();
  });

  it('コミットが 1 件も無ければその旨を出す', async () => {
    listCommits.mockResolvedValue([]);
    renderHistory();
    expect(await screen.findByText('このファイルのコミットはまだありません。')).toBeTruthy();
  });

  it('復元は旧版の中身を読み、tip の sha は保ったまま返す', async () => {
    const onRestore = vi.fn();
    const { onClose } = renderHistory({ onRestore });
    await screen.findByText('商品行の余白を揃える');

    fireEvent.click(screen.getAllByRole('button', { name: 'この版を復元' })[1]);

    await waitFor(() => expect(onRestore).toHaveBeenCalled());
    // 旧版の中身は commit sha を ref にして取る
    expect(getPenFile).toHaveBeenCalledWith(
      'ghp_test',
      'octocat',
      'design',
      'design/checkout.pen',
      'bbbbbbb2222',
    );
    const [text, ref, fileName] = onRestore.mock.calls[0];
    expect(text).toBe('{"version":"1.0","children":[]}');
    // repo はまだ書き換わっていないので sha は tip のまま
    expect(ref).toEqual(FILE);
    expect(ref.sha).toBe('tip-sha');
    expect(fileName).toBe('checkout.pen');
    expect(onClose).toHaveBeenCalled();
  });

  it('復元に失敗したらエラーを出し、復元はしない', async () => {
    getPenFile.mockRejectedValueOnce(new GitHubError(404, '見つかりません。'));
    const onRestore = vi.fn();
    renderHistory({ onRestore });
    await screen.findByText('商品行の余白を揃える');

    fireEvent.click(screen.getAllByRole('button', { name: 'この版を復元' })[0]);

    expect(await screen.findByText('見つかりません。')).toBeTruthy();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('履歴の取得に失敗したらエラーを出す', async () => {
    listCommits.mockRejectedValueOnce(new GitHubError(403, 'レート制限'));
    renderHistory();
    expect(await screen.findByText('レート制限')).toBeTruthy();
  });

  it('復元がまだ repo に反映されないことを画面で断っている', async () => {
    renderHistory();
    await screen.findByText('feat: カート画面に空状態を追加');
    expect(screen.getByText(/して初めて repo に反映されます/)).toBeTruthy();
  });

  it('× で閉じられる', async () => {
    const { onClose } = renderHistory();
    await screen.findByText('feat: カート画面に空状態を追加');
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
