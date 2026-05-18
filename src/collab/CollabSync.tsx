/**
 * 共同編集のドキュメント同期ブリッジ。
 *
 * EditorProvider の内側に置くことで useEditor() にアクセスし、
 * ローカル編集 ⇄ リモート編集 を双方向に橋渡しする。表示は持たない。
 *
 * - リモート → ローカル: 受信した children を replaceDocChildren で適用
 * - ローカル → リモート: state.rawDoc.children を debounce して syncDoc
 * - 選択ノードを awareness へ送信 (他ユーザーのハイライト用)
 *
 * エコー (自分の編集が往復して再適用される) は lastSyncedRef による
 * JSON 一致チェックで防ぐ。
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEditor } from '../pen/state/EditorContext';
import { computeViewBox } from '../pen/renderer/viewBox';
import type { PenDocument } from '../pen/types';

interface Props {
  /** ルーム接続中か */
  connected: boolean;
  /** 招待リンク経由の参加者なら true (= 初回 doc 受信までローカルを送信しない) */
  joining: boolean;
  syncDoc: (doc: PenDocument) => void;
  setRemoteHandler: (cb: ((doc: PenDocument) => void) | null) => void;
  setLocalSelection: (ids: string[]) => void;
}

export function CollabSync({ connected, joining, syncDoc, setRemoteHandler, setLocalSelection }: Props) {
  const { state, replaceDocChildren } = useEditor();

  /** 最後に同期した children の JSON。往復エコーの判定に使う */
  const lastSyncedRef = useRef<string>('');
  /** ローカル → リモート送信の debounce タイマー */
  const syncTimerRef = useRef<number | null>(null);
  /**
   * ローカル編集をリモートへ送ってよいか。
   * 参加者は空ドキュメントで入室するため、初回のリモート doc を
   * 受け取るまで送信を止めて相手の doc を空で潰さないようにする。
   */
  const readyRef = useRef(!joining);

  // --- リモート → ローカル ---
  const handleRemote = useCallback((doc: PenDocument) => {
    const json = JSON.stringify(doc.children);
    if (json === lastSyncedRef.current) return;
    lastSyncedRef.current = json;

    // 保留中のローカル送信は破棄 (古い state でリモートを潰さない)
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const wasJoining = !readyRef.current;
    readyRef.current = true;
    replaceDocChildren(doc.children);

    // 参加者は初回受信時に受け取った doc 全体へカメラを合わせる
    if (wasJoining) {
      const vb = computeViewBox({ version: doc.version, children: doc.children });
      window.dispatchEvent(new CustomEvent('pencil-collab-fit', { detail: vb }));
    }
  }, [replaceDocChildren]);

  useEffect(() => {
    if (!connected) {
      setRemoteHandler(null);
      return;
    }
    setRemoteHandler(handleRemote);
    return () => setRemoteHandler(null);
  }, [connected, handleRemote, setRemoteHandler]);

  // --- ローカル → リモート (debounce) ---
  useEffect(() => {
    if (!connected || !readyRef.current) return;
    const children = state.rawDoc.children;
    const json = JSON.stringify(children);
    if (json === lastSyncedRef.current) return;

    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      lastSyncedRef.current = json;
      syncDoc({ version: state.rawDoc.version, children });
    }, 120);
  }, [connected, state.rawDoc, syncDoc]);

  // --- 選択ノードを awareness へ ---
  useEffect(() => {
    if (!connected) return;
    const ids = state.selectedNodeIds.size > 0
      ? Array.from(state.selectedNodeIds)
      : state.selectedNodeId
        ? [state.selectedNodeId]
        : [];
    setLocalSelection(ids);
  }, [connected, state.selectedNodeId, state.selectedNodeIds, setLocalSelection]);

  // 切断時に状態をリセット
  useEffect(() => {
    if (connected) return;
    lastSyncedRef.current = '';
    readyRef.current = !joining;
  }, [connected, joining]);

  return null;
}
