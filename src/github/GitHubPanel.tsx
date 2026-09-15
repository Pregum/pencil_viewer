/**
 * GitHub 接続 & .pen ブラウズ/オープンのモーダル。
 *
 * App 層に置かれ、ファイルを開くときは onOpenFile で App の loadFile 経由に流す。
 * （コミットはエディタ層の CommitButton が担当する。役割分担はこの 2 つ。）
 */

import { useCallback, useEffect, useState } from 'react';
import { useGitHub } from './GitHubContext';
import {
  GitHubError,
  classifyToken,
  getPenFile,
  listBranches,
  listPenFiles,
  listRepos,
  type GitHubFileRef,
  type GitHubRepo,
  type PenEntry,
} from './githubApi';

interface Props {
  open: boolean;
  onClose: () => void;
  /** ファイルを開く: テキスト本体 + GitHub 参照 + 表示用ファイル名 */
  onOpenFile: (text: string, ref: GitHubFileRef, fileName: string) => void;
}

export function GitHubPanel({ open, onClose, onOpenFile }: Props) {
  const { token, user, connected, connect, disconnect } = useGitHub();

  const [tokenInput, setTokenInput] = useState('');
  // 入力中のトークンが classic なら注意書きを出す。判定は前置きだけで完結する
  const tokenKind = classifyToken(tokenInput);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoFilter, setRepoFilter] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [penFiles, setPenFiles] = useState<PenEntry[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  // 接続済みになったらリポジトリ一覧をロード
  useEffect(() => {
    if (!open || !connected || !token) return;
    let cancelled = false;
    setLoadingRepos(true);
    setError(null);
    listRepos(token)
      .then((r) => {
        if (!cancelled) setRepos(r);
      })
      .catch((e) => {
        if (!cancelled) setError(describeError(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingRepos(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, connected, token]);

  // リポジトリ選択 → ブランチ + .pen 一覧ロード
  const selectRepo = useCallback(
    async (repo: GitHubRepo) => {
      if (!token) return;
      setSelectedRepo(repo);
      setBranches([]);
      setPenFiles([]);
      setSelectedBranch('');
      setError(null);
      setLoadingFiles(true);
      try {
        const bs = await listBranches(token, repo.owner, repo.name);
        const names = bs.map((b) => b.name);
        setBranches(names);
        const branch = names.includes(repo.defaultBranch) ? repo.defaultBranch : names[0] ?? repo.defaultBranch;
        setSelectedBranch(branch);
        const files = await listPenFiles(token, repo.owner, repo.name, branch);
        setPenFiles(files);
      } catch (e) {
        setError(describeError(e));
      } finally {
        setLoadingFiles(false);
      }
    },
    [token],
  );

  // ブランチ切り替え → .pen 再取得
  const changeBranch = useCallback(
    async (branch: string) => {
      if (!token || !selectedRepo) return;
      setSelectedBranch(branch);
      setPenFiles([]);
      setError(null);
      setLoadingFiles(true);
      try {
        const files = await listPenFiles(token, selectedRepo.owner, selectedRepo.name, branch);
        setPenFiles(files);
      } catch (e) {
        setError(describeError(e));
      } finally {
        setLoadingFiles(false);
      }
    },
    [token, selectedRepo],
  );

  const handleConnect = useCallback(async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setConnecting(true);
    setError(null);
    try {
      await connect(t);
      setTokenInput('');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setConnecting(false);
    }
  }, [tokenInput, connect]);

  const handleOpen = useCallback(
    async (entry: PenEntry) => {
      if (!token || !selectedRepo) return;
      setOpeningPath(entry.path);
      setError(null);
      try {
        const file = await getPenFile(token, selectedRepo.owner, selectedRepo.name, entry.path, selectedBranch);
        const ref: GitHubFileRef = {
          owner: selectedRepo.owner,
          repo: selectedRepo.name,
          branch: selectedBranch,
          path: entry.path,
          sha: file.sha,
        };
        const fileName = entry.path.split('/').pop() ?? entry.path;
        onOpenFile(file.text, ref, fileName);
        onClose();
      } catch (e) {
        setError(describeError(e));
      } finally {
        setOpeningPath(null);
      }
    },
    [token, selectedRepo, selectedBranch, onOpenFile, onClose],
  );

  if (!open) return null;

  const filteredRepos = repoFilter.trim()
    ? repos.filter((r) => r.fullName.toLowerCase().includes(repoFilter.trim().toLowerCase()))
    : repos;

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog gh-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <span className="dialog__title">
            <span style={{ marginRight: 8 }}>🗂️</span>
            GitHub — .pen を開く
          </span>
          <button type="button" className="dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="dialog__body">
          {!connected ? (
            <div className="gh-connect">
              <p className="gh-hint">
                あなたの GitHub リポジトリに .pen を git-backed で読み書きします。
                サーバーは介在しません — トークンはこの端末にだけ保存され、通信は GitHub と直接行われます。
              </p>
              <label className="gh-label" htmlFor="gh-token">
                Personal Access Token
              </label>
              <input
                id="gh-token"
                type="password"
                className="gh-input"
                placeholder="github_pat_..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleConnect();
                }}
                autoFocus
              />
              <p className="gh-hint gh-hint--small">
                必要な権限は <code>Contents</code>（Read &amp; Write）だけです。対象リポジトリは使うものだけを選び、有効期限は短めにしてください。
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {' '}
                  Fine-grained token を作成 ↗
                </a>
              </p>
              {tokenKind === 'classic' && (
                <p className="gh-warn" role="status">
                  classic トークンのようです。classic の <code>repo</code> スコープは対象を選べず、あなたがアクセスできる private を含む全リポジトリの読み書きに及びます。漏れたときの範囲を狭めるため、リポジトリを限定できる fine-grained token を薦めます。
                </p>
              )}
              {error && <p className="gh-error">{error}</p>}
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleConnect()}
                disabled={connecting || !tokenInput.trim()}
                style={{ marginTop: 4 }}
              >
                {connecting ? '接続中…' : '接続する'}
              </button>
            </div>
          ) : (
            <div className="gh-browse">
              <div className="gh-account">
                {user?.avatarUrl && <img className="gh-avatar" src={user.avatarUrl} alt="" width={20} height={20} />}
                <span className="gh-account__name">{user?.login}</span>
                <span style={{ flex: 1 }} />
                <button type="button" className="button button--ghost button--sm" onClick={disconnect}>
                  切断
                </button>
              </div>

              {/* リポジトリ選択 */}
              <label className="gh-label">リポジトリ</label>
              {loadingRepos ? (
                <p className="gh-hint">リポジトリを読み込み中…</p>
              ) : (
                <>
                  <input
                    type="text"
                    className="gh-input"
                    placeholder="リポジトリを検索…"
                    value={repoFilter}
                    onChange={(e) => setRepoFilter(e.target.value)}
                  />
                  <div className="gh-list gh-list--repos">
                    {filteredRepos.length === 0 && <p className="gh-hint">該当なし</p>}
                    {filteredRepos.map((r) => (
                      <button
                        key={r.fullName}
                        type="button"
                        className={`gh-list__item${selectedRepo?.fullName === r.fullName ? ' gh-list__item--active' : ''}`}
                        onClick={() => void selectRepo(r)}
                      >
                        <span className="gh-list__name">{r.fullName}</span>
                        {r.private && <span className="gh-badge">private</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ブランチ + ファイル */}
              {selectedRepo && (
                <>
                  <div className="gh-branch-row">
                    <label className="gh-label" style={{ margin: 0 }}>
                      ブランチ
                    </label>
                    <select
                      className="gh-select"
                      value={selectedBranch}
                      onChange={(e) => void changeBranch(e.target.value)}
                    >
                      {branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="gh-label">.pen ファイル</label>
                  {loadingFiles ? (
                    <p className="gh-hint">読み込み中…</p>
                  ) : penFiles.length === 0 ? (
                    <p className="gh-hint">
                      このブランチに .pen はありません。エディタで作成して「Commit」すると、ここに貯まっていきます。
                    </p>
                  ) : (
                    <div className="gh-list gh-list--files">
                      {penFiles.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          className="gh-list__item"
                          onClick={() => void handleOpen(f)}
                          disabled={openingPath !== null}
                        >
                          <span className="gh-list__icon">📄</span>
                          <span className="gh-list__name">{f.path}</span>
                          {openingPath === f.path && <span className="gh-hint--small">開いています…</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {error && <p className="gh-error">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function describeError(e: unknown): string {
  if (e instanceof GitHubError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
