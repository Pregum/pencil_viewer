/**
 * エディタツールバーの「Commit」ボタン。
 *
 * 戦略 (b) の心臓部: ユーザー自身の GitHub リポジトリに .pen を
 * git-backed で蓄積する導線。2 モードを持つ:
 *  - update : 既に GitHub から開いたファイル → 同じパスへ上書きコミット（sha 付き）
 *  - saveAs : 新規 / GitHub 由来でない doc → リポジトリ+ブランチ+パスを選んで新規作成
 *
 * EditorProvider 配下に置くこと（編集済み rawDoc を読むため）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../pen/state/EditorContext';
import { useGitHub } from './GitHubContext';
import {
  GitHubError,
  commitPenFile,
  getPenFile,
  listBranches,
  listRepos,
  type GitHubRepo,
} from './githubApi';

export function CommitButton() {
  const { state } = useEditor();
  const {
    token,
    connected,
    currentFile,
    setCurrentFile,
    updateCurrentFileSha,
    openPanel,
    setBaselineJson,
    setForceDirty,
    reloadLatest,
  } = useGitHub();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [flash, setFlash] = useState(false);

  // saveAs 用
  /** 未取得は null。読み込み中かどうかはここから導く（state を増やさない） */
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [repoFullName, setRepoFullName] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('');
  const [path, setPath] = useState('');

  const popRef = useRef<HTMLDivElement>(null);

  const mode: 'update' | 'saveAs' = currentFile ? 'update' : 'saveAs';

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectRepoForSaveAs = useCallback(
    async (fullName: string, repoList?: GitHubRepo[]) => {
      const list = repoList ?? repos ?? [];
      const repo = list.find((r) => r.fullName === fullName);
      if (!repo || !token) return;
      setRepoFullName(fullName);
      setBranches([]);
      try {
        const bs = await listBranches(token, repo.owner, repo.name);
        const names = bs.map((b) => b.name);
        setBranches(names);
        setBranch(names.includes(repo.defaultBranch) ? repo.defaultBranch : (names[0] ?? repo.defaultBranch));
      } catch (e) {
        setError(describeError(e));
      }
    },
    [repos, token],
  );

  const shouldLoadRepos = open && mode === 'saveAs' && !!token && repos === null;
  // 「まだ結果もエラーも無い」= 読み込み中。effect の本体で setState(true) すると
  // 描画が 1 往復余計に走る (react-hooks/set-state-in-effect, #78)。
  const loadingRepos = shouldLoadRepos && error === null;

  // saveAs モードでポップオーバーを開いたらリポジトリ一覧をロード
  useEffect(() => {
    if (!shouldLoadRepos || !token) return;
    let cancelled = false;
    listRepos(token)
      .then((r) => {
        if (cancelled) return;
        setRepos(r);
        if (r[0]) void selectRepoForSaveAs(r[0].fullName, r);
      })
      .catch((e) => !cancelled && setError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, [shouldLoadRepos, token, selectRepoForSaveAs]);

  const handleButtonClick = useCallback(() => {
    if (!connected) {
      openPanel(); // まず接続させる
      return;
    }
    setError(null);
    if (mode === 'update' && currentFile) {
      setMessage(`Update ${currentFile.path}`);
    } else {
      setMessage('Add design');
      if (!path) setPath('designs/untitled.pen');
    }
    setOpen((v) => !v);
  }, [connected, openPanel, mode, currentFile, path]);

  const penJson = useCallback(() => JSON.stringify(state.rawDoc, null, 2), [state.rawDoc]);

  /** コミット成功後の共通後処理: dirty 解消・フラッシュ表示。 */
  const onCommitted = useCallback(
    (committedJson: string) => {
      setBaselineJson(committedJson);
      setForceDirty(false);
      setOpen(false);
      setConflict(false);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2000);
    },
    [setBaselineJson, setForceDirty],
  );

  const doCommit = useCallback(async () => {
    if (!token) return;
    setCommitting(true);
    setError(null);
    setConflict(false);
    const committed = penJson();
    try {
      if (mode === 'update' && currentFile) {
        const { sha } = await commitPenFile(token, {
          owner: currentFile.owner,
          repo: currentFile.repo,
          branch: currentFile.branch,
          path: currentFile.path,
          content: committed,
          message: message.trim() || `Update ${currentFile.path}`,
          sha: currentFile.sha,
        });
        updateCurrentFileSha(sha);
      } else {
        const repo = repos?.find((r) => r.fullName === repoFullName);
        if (!repo) {
          setError('リポジトリを選択してください。');
          setCommitting(false);
          return;
        }
        let cleanPath = path.trim().replace(/^\/+/, '');
        if (!cleanPath) {
          setError('保存先パスを入力してください。');
          setCommitting(false);
          return;
        }
        if (!/\.pen$/i.test(cleanPath)) cleanPath += '.pen';
        const { sha } = await commitPenFile(token, {
          owner: repo.owner,
          repo: repo.name,
          branch,
          path: cleanPath,
          content: committed,
          message: message.trim() || `Add ${cleanPath}`,
          sha: null,
        });
        // 以後はこのファイルを「開いている」状態にする → 次回からは update
        setCurrentFile({ owner: repo.owner, repo: repo.name, branch, path: cleanPath, sha });
      }
      onCommitted(committed);
    } catch (e) {
      // sha 不一致 = リモートが先に更新されている → 競合 UI へ
      if (e instanceof GitHubError && (e.status === 409 || e.status === 422)) {
        setConflict(true);
      } else {
        setError(describeError(e));
      }
    } finally {
      setCommitting(false);
    }
  }, [
    token,
    mode,
    currentFile,
    penJson,
    message,
    repos,
    repoFullName,
    path,
    branch,
    setCurrentFile,
    updateCurrentFileSha,
    onCommitted,
  ]);

  /** 競合解決: 自分の変更でリモートを上書き（最新 sha を取り直して再コミット）。 */
  const forcePush = useCallback(async () => {
    if (!token || !currentFile) return;
    setCommitting(true);
    setError(null);
    const committed = penJson();
    try {
      const latest = await getPenFile(
        token,
        currentFile.owner,
        currentFile.repo,
        currentFile.path,
        currentFile.branch,
      );
      const { sha } = await commitPenFile(token, {
        owner: currentFile.owner,
        repo: currentFile.repo,
        branch: currentFile.branch,
        path: currentFile.path,
        content: committed,
        message: message.trim() || `Update ${currentFile.path}`,
        sha: latest.sha,
      });
      updateCurrentFileSha(sha);
      onCommitted(committed);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setCommitting(false);
    }
  }, [token, currentFile, penJson, message, updateCurrentFileSha, onCommitted]);

  /** 競合解決: 自分の変更を捨ててリモート最新を読み込む。 */
  const takeRemote = useCallback(async () => {
    setCommitting(true);
    setError(null);
    try {
      await reloadLatest();
      setOpen(false);
      setConflict(false);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setCommitting(false);
    }
  }, [reloadLatest]);

  const label = flash
    ? '✓ Committed'
    : connected
      ? mode === 'update'
        ? 'Commit'
        : 'Save to GitHub'
      : 'Save to GitHub';

  return (
    <div ref={popRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="viewer__zoom-btn gh-commit-btn"
        title={connected ? 'Commit .pen to GitHub' : 'Connect GitHub to save'}
        onClick={handleButtonClick}
        style={{ width: 'auto', padding: '0 8px', fontSize: 12 }}
      >
        <span style={{ marginRight: 4 }}>⬆</span>
        {label}
      </button>

      {open && connected && (
        <div className="gh-commit-pop" onMouseDown={(e) => e.stopPropagation()}>
          {conflict ? (
            <div className="gh-conflict">
              <p className="gh-conflict__title">⚠️ リモートが更新されています</p>
              <p className="gh-hint gh-hint--small">
                編集中に {currentFile?.path} が GitHub 側で変更されました。どう解決しますか?
              </p>
              {error && <p className="gh-error">{error}</p>}
              <button
                type="button"
                className="button button--primary"
                onClick={() => void forcePush()}
                disabled={committing}
                style={{ marginTop: 8, width: '100%' }}
              >
                {committing ? '処理中…' : '自分の変更で上書き（force）'}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => void takeRemote()}
                disabled={committing}
                style={{ marginTop: 6, width: '100%' }}
              >
                最新を取得（自分の変更は破棄）
              </button>
            </div>
          ) : (
            <>
              {mode === 'update' && currentFile ? (
                <>
                  <div className="gh-commit-pop__target">
                    <span className="gh-commit-pop__repo">
                      {currentFile.owner}/{currentFile.repo}
                    </span>
                    <span className="gh-commit-pop__path">
                      {currentFile.path} @ {currentFile.branch}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {loadingRepos ? (
                    <p className="gh-hint">リポジトリを読み込み中…</p>
                  ) : (
                    <>
                      <label className="gh-label">リポジトリ</label>
                      <select
                        className="gh-select gh-select--full"
                        value={repoFullName}
                        onChange={(e) => void selectRepoForSaveAs(e.target.value)}
                      >
                        {(repos ?? []).map((r) => (
                          <option key={r.fullName} value={r.fullName}>
                            {r.fullName}
                          </option>
                        ))}
                      </select>
                      <div className="gh-branch-row">
                        <label className="gh-label" style={{ margin: 0 }}>
                          ブランチ
                        </label>
                        <select
                          className="gh-select"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                        >
                          {branches.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="gh-label">保存先パス</label>
                      <input
                        className="gh-input"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="designs/untitled.pen"
                      />
                    </>
                  )}
                </>
              )}

              <label className="gh-label">コミットメッセージ</label>
              <input
                className="gh-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !committing) void doCommit();
                }}
                autoFocus
              />

              {error && <p className="gh-error">{error}</p>}

              <button
                type="button"
                className="button button--primary"
                onClick={() => void doCommit()}
                disabled={committing}
                style={{ marginTop: 8, width: '100%' }}
              >
                {committing ? 'コミット中…' : mode === 'update' ? 'Commit' : 'Create & Commit'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function describeError(e: unknown): string {
  if (e instanceof GitHubError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
