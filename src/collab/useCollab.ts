/**
 * P2P 共同編集フック。
 * Yjs (CRDT) + y-webrtc で WebRTC 経由のリアルタイム同期を実現。
 *
 * "No trace, no server, no cost."
 * - 全員が離れたらデータは消える
 * - サーバーにデータは保存されない
 * - シグナリングのみ公開サーバーを使用
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import type { PenDocument } from '../pen/types';

export interface CollabPeer {
  id: string;
  name: string;
  color: string;
}

export interface CollabState {
  connected: boolean;
  roomId: string | null;
  peers: CollabPeer[];
  /** 自分のユーザー名 */
  userName: string;
}

const PEER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateUserName(): string {
  const names = ['Monet', 'Renoir', 'Degas', 'Cézanne', 'Pissarro', 'Sisley', 'Morisot', 'Cassatt'];
  return names[Math.floor(Math.random() * names.length)];
}

export function useCollab() {
  const [state, setState] = useState<CollabState>({
    connected: false,
    roomId: null,
    peers: [],
    userName: generateUserName(),
  });

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const onDocUpdateRef = useRef<((doc: PenDocument) => void) | null>(null);

  /** ルームを作成して接続 */
  const createRoom = useCallback((doc: PenDocument, onDocUpdate: (doc: PenDocument) => void) => {
    const roomId = generateRoomId();
    joinRoom(roomId, doc, onDocUpdate);
    return roomId;
  }, []);

  /** 既存ルームに接続 */
  const joinRoom = useCallback((roomId: string, initialDoc: PenDocument | null, onDocUpdate: (doc: PenDocument) => void) => {
    // Cleanup previous connection
    disconnect();

    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap('pen-document');

    // 初期ドキュメントをセット（ルーム作成者のみ）
    if (initialDoc && ymap.size === 0) {
      ydoc.transact(() => {
        ymap.set('version', initialDoc.version);
        ymap.set('children', JSON.stringify(initialDoc.children));
        if (initialDoc.variables) ymap.set('variables', JSON.stringify(initialDoc.variables));
        if (initialDoc.themes) ymap.set('themes', JSON.stringify(initialDoc.themes));
      });
    }

    onDocUpdateRef.current = onDocUpdate;

    // Y.Map の変更を監視
    ymap.observe(() => {
      const version = ymap.get('version') as string ?? '1.0';
      const childrenStr = ymap.get('children') as string;
      const variablesStr = ymap.get('variables') as string | undefined;
      const themesStr = ymap.get('themes') as string | undefined;

      if (!childrenStr) return;

      try {
        const doc: PenDocument = {
          version,
          children: JSON.parse(childrenStr),
          variables: variablesStr ? JSON.parse(variablesStr) : undefined,
          themes: themesStr ? JSON.parse(themesStr) : undefined,
        };
        onDocUpdateRef.current?.(doc);
      } catch {
        // ignore parse errors
      }
    });

    // WebRTC Provider
    const provider = new WebrtcProvider(`pencil-viewer-${roomId}`, ydoc, {
      signaling: ['wss://signaling.yjs.dev'],
    });

    // Awareness (ユーザーのプレゼンス)
    const colorIdx = Math.floor(Math.random() * PEER_COLORS.length);
    provider.awareness.setLocalStateField('user', {
      name: state.userName,
      color: PEER_COLORS[colorIdx],
    });

    // Peers の監視
    const updatePeers = () => {
      const peers: CollabPeer[] = [];
      provider.awareness.getStates().forEach((s, clientId) => {
        if (clientId === ydoc.clientID) return;
        const user = (s as { user?: { name: string; color: string } }).user;
        if (user) {
          peers.push({ id: String(clientId), name: user.name, color: user.color });
        }
      });
      setState((prev) => ({ ...prev, peers }));
    };
    provider.awareness.on('change', updatePeers);

    ydocRef.current = ydoc;
    providerRef.current = provider;

    setState((prev) => ({ ...prev, connected: true, roomId }));
  }, [state.userName]);

  /** ドキュメントの変更を Y.Doc に反映 */
  const syncDoc = useCallback((doc: PenDocument) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const ymap = ydoc.getMap('pen-document');
    ydoc.transact(() => {
      ymap.set('version', doc.version);
      ymap.set('children', JSON.stringify(doc.children));
      if (doc.variables) ymap.set('variables', JSON.stringify(doc.variables));
    });
  }, []);

  /** 切断 */
  const disconnect = useCallback(() => {
    providerRef.current?.destroy();
    ydocRef.current?.destroy();
    providerRef.current = null;
    ydocRef.current = null;
    setState((prev) => ({ ...prev, connected: false, roomId: null, peers: [] }));
  }, []);

  /** URL にルーム ID を付与 */
  const getRoomUrl = useCallback(() => {
    if (!state.roomId) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('room', state.roomId);
    url.searchParams.delete('src');
    url.searchParams.delete('id');
    return url.toString();
  }, [state.roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, []);

  return {
    collab: state,
    createRoom,
    joinRoom,
    syncDoc,
    disconnect,
    getRoomUrl,
    setUserName: (name: string) => setState((prev) => ({ ...prev, userName: name })),
  };
}
