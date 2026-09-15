/**
 * GitHub セッションを App 全体で共有するコンテキスト。
 *
 * なぜ Context か:
 * - 「開く」導線は App 層（useDocument.loadFile）に属する
 * - 「コミット」導線は Editor 層（EditorContext の編集済み rawDoc）に属する
 * この 2 つを跨いで「接続中のユーザー」と「今開いている GitHub 上のファイル参照」を
 * 共有する必要があるため、最上位に Provider を置く。
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  clearStoredToken,
  getStoredToken,
  getUser,
  setStoredToken,
  type GitHubFileRef,
  type GitHubUser,
} from './githubApi';

interface GitHubContextValue {
  /** 接続済みトークン（未接続なら null） */
  token: string | null;
  /** 接続中のユーザー（未接続なら null） */
  user: GitHubUser | null;
  /** 今エディタで開いている GitHub 上のファイル参照（無ければ null） */
  currentFile: GitHubFileRef | null;
  connected: boolean;
  /** トークンを検証して接続。失敗時は throw（呼び出し側で表示）。 */
  connect: (token: string) => Promise<GitHubUser>;
  /** 切断（トークン破棄）。 */
  disconnect: () => void;
  /** 開いているファイル参照を設定。 */
  setCurrentFile: (ref: GitHubFileRef | null) => void;
  /** コミット後など、現在ファイルの sha を更新。 */
  updateCurrentFileSha: (sha: string) => void;
  /** 接続/ブラウズ用モーダルの開閉状態（どこからでも開ける）。 */
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;

  // --- 未コミット差分インジケータ用 ---
  /** 最後に load/commit した時点の rawDoc JSON（dirty 判定の基準） */
  baselineJson: string | null;
  setBaselineJson: (json: string | null) => void;
  /** 編集差分 or 復元保留があり、未コミットの変更がある状態か */
  dirty: boolean;
  /** DirtyTracker が編集差分の有無を報告する。 */
  setDirty: (dirty: boolean) => void;
  /**
   * 復元など「エディタ内容＝旧版だが repo tip は別」の保留状態を立てる。
   * editor の正規化 JSON は on-disk テキストと一致しないため、差分計算では
   * 表現できない「コミットすべき保留」をこのフラグで表す。
   */
  setForceDirty: (force: boolean) => void;

  // --- 競合時の「最新を取得して再読込」用（App 層が実体を登録） ---
  registerReloadHandler: (fn: (() => Promise<void>) | null) => void;
  reloadLatest: () => Promise<void>;

  // --- コミット履歴モーダル ---
  historyOpen: boolean;
  openHistory: () => void;
  closeHistory: () => void;
}

const GitHubContext = createContext<GitHubContextValue | null>(null);

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [currentFile, setCurrentFileState] = useState<GitHubFileRef | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [baselineJson, setBaselineJson] = useState<string | null>(null);
  const [contentDirty, setDirty] = useState(false);
  const [forceDirty, setForceDirty] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const dirty = contentDirty || forceDirty;
  const reloadHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const connect = useCallback(async (newToken: string): Promise<GitHubUser> => {
    const u = await getUser(newToken); // 無効なら throw
    setStoredToken(newToken);
    setToken(newToken);
    setUser(u);
    return u;
  }, []);

  const disconnect = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setCurrentFileState(null);
    setBaselineJson(null);
    setDirty(false);
    setForceDirty(false);
  }, []);

  const setCurrentFile = useCallback((ref: GitHubFileRef | null) => {
    setCurrentFileState(ref);
  }, []);

  const updateCurrentFileSha = useCallback((sha: string) => {
    setCurrentFileState((prev) => (prev ? { ...prev, sha } : prev));
  }, []);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  const registerReloadHandler = useCallback((fn: (() => Promise<void>) | null) => {
    reloadHandlerRef.current = fn;
  }, []);
  const reloadLatest = useCallback(async () => {
    if (reloadHandlerRef.current) await reloadHandlerRef.current();
  }, []);

  const value = useMemo<GitHubContextValue>(
    () => ({
      token,
      user,
      currentFile,
      connected: !!token,
      connect,
      disconnect,
      setCurrentFile,
      updateCurrentFileSha,
      panelOpen,
      openPanel,
      closePanel,
      baselineJson,
      setBaselineJson,
      dirty,
      setDirty,
      setForceDirty,
      registerReloadHandler,
      reloadLatest,
      historyOpen,
      openHistory,
      closeHistory,
    }),
    [token, user, currentFile, connect, disconnect, setCurrentFile, updateCurrentFileSha, panelOpen, openPanel, closePanel, baselineJson, dirty, setForceDirty, registerReloadHandler, reloadLatest, historyOpen, openHistory, closeHistory],
  );

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
}

export function useGitHub(): GitHubContextValue {
  const ctx = useContext(GitHubContext);
  if (!ctx) throw new Error('useGitHub must be used within a GitHubProvider');
  return ctx;
}
