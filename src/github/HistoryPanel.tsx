/**
 * コミット履歴モーダル。現在開いている GitHub ファイルの履歴を一覧し、
 * 過去の版を「復元」する（= 旧版の中身をエディタに読み込む）。
 *
 * 復元はあくまでエディタへの読み込みで、repo tip はまだ旧版ではない。
 * そのため復元後は forceDirty が立ち、ユーザーが Commit して初めて
 * 「その版に戻す」コミットが作られる。
 */

import { useCallback, useEffect, useState } from 'react';
import { useGitHub } from './GitHubContext';
import { GitHubError, getPenFile, listCommits, type CommitInfo, type GitHubFileRef } from './githubApi';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 旧版を読み込む: 中身 + 参照（sha は tip のまま）+ 表示名 */
  onRestore: (text: string, ref: GitHubFileRef, fileName: string) => void;
}

export function HistoryPanel({ open, onClose, onRestore }: Props) {
  const { token, currentFile } = useGitHub();
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringSha, setRestoringSha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token || !currentFile) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCommits(token, currentFile.owner, currentFile.repo, currentFile.path, currentFile.branch)
      .then((cs) => !cancelled && setCommits(cs))
      .catch((e) => !cancelled && setError(describeError(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, token, currentFile]);

  const handleRestore = useCallback(
    async (commit: CommitInfo) => {
      if (!token || !currentFile) return;
      setRestoringSha(commit.sha);
      setError(null);
      try {
        // その commit 時点の中身を取得（ref = commit sha）
        const file = await getPenFile(token, currentFile.owner, currentFile.repo, currentFile.path, commit.sha);
        const fileName = currentFile.path.split('/').pop() ?? currentFile.path;
        // sha は現在の tip を維持（次の Commit が tip を正しく更新できるように）
        onRestore(file.text, { ...currentFile }, fileName);
        onClose();
      } catch (e) {
        setError(describeError(e));
      } finally {
        setRestoringSha(null);
      }
    },
    [token, currentFile, onRestore, onClose],
  );

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog gh-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <span className="dialog__title">
            <span style={{ marginRight: 8 }}>🕑</span>
            履歴 — {currentFile?.path}
          </span>
          <button type="button" className="dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dialog__body">
          {!currentFile ? (
            <p className="gh-hint">GitHub から開いたファイルがありません。</p>
          ) : loading ? (
            <p className="gh-hint">履歴を読み込み中…</p>
          ) : commits.length === 0 ? (
            <p className="gh-hint">このファイルのコミットはまだありません。</p>
          ) : (
            <div className="gh-history">
              {commits.map((c, i) => (
                <div key={c.sha} className="gh-history__item">
                  <div className="gh-history__main">
                    <span className="gh-history__msg">{firstLine(c.message)}</span>
                    <span className="gh-history__meta">
                      {c.authorLogin ?? c.authorName ?? 'unknown'} · {formatDate(c.date)} · <code>{c.sha.slice(0, 7)}</code>
                      {i === 0 && <span className="gh-badge" style={{ marginLeft: 6 }}>latest</span>}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost button--sm"
                    onClick={() => void handleRestore(c)}
                    disabled={restoringSha !== null}
                  >
                    {restoringSha === c.sha ? '復元中…' : 'この版を復元'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="gh-error">{error}</p>}
          {currentFile && commits.length > 0 && (
            <p className="gh-hint gh-hint--small" style={{ marginTop: 10 }}>
              「復元」は旧版をエディタに読み込みます。<strong>Commit</strong> して初めて repo に反映されます。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function firstLine(msg: string): string {
  return msg.split('\n')[0];
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  // YYYY-MM-DD HH:mm（ローカル）。Date.now は使わず文字列パースのみ。
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describeError(e: unknown): string {
  if (e instanceof GitHubError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
