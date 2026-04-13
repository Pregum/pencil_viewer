/**
 * MCP Bridge 接続フック。
 * ローカルの collab-bridge (WebSocket) に接続し、
 * Claude Code からのリアルタイム編集を受信/送信する。
 *
 * [BETA] 実験的機能
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PenDocument } from '../pen/types';

const DEFAULT_URL = 'ws://localhost:4567';

export interface BridgeState {
  connected: boolean;
  url: string;
}

/** 2つのドキュメントの children を浅く比較し、変更されたノードIDを返す */
function detectChangedNodes(oldDoc: PenDocument | null, newDoc: PenDocument): string[] {
  if (!oldDoc) return [];
  const oldStr = JSON.stringify(oldDoc.children);
  const newStr = JSON.stringify(newDoc.children);
  if (oldStr === newStr) return [];

  // 簡易比較: 各トップレベルノードの JSON を比較
  const changed: string[] = [];
  const oldMap = new Map(oldDoc.children.map((n) => [n.id, JSON.stringify(n)]));
  for (const n of newDoc.children) {
    const oldJson = oldMap.get(n.id);
    if (oldJson !== JSON.stringify(n)) {
      changed.push(n.id);
    }
  }
  return changed;
}

export function useBridge() {
  const [state, setState] = useState<BridgeState>({ connected: false, url: DEFAULT_URL });
  const wsRef = useRef<WebSocket | null>(null);
  const onDocUpdateRef = useRef<((doc: PenDocument) => void) | null>(null);
  const currentDocRef = useRef<PenDocument | null>(null);

  const connect = useCallback((url: string, doc: PenDocument, onDocUpdate: (doc: PenDocument) => void) => {
    disconnect();

    onDocUpdateRef.current = onDocUpdate;
    currentDocRef.current = doc;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState({ connected: true, url });
      // Send current document
      ws.send(JSON.stringify({ type: 'pen-doc', doc }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'pen-doc' && msg.doc) {
          // Detect which nodes changed for animation
          const changedIds = detectChangedNodes(currentDocRef.current, msg.doc);
          currentDocRef.current = msg.doc;
          onDocUpdateRef.current?.(msg.doc);
          // Trigger edit animation
          if (changedIds.length > 0) {
            window.dispatchEvent(new CustomEvent('pencil-edit-animate', { detail: changedIds }));
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setState({ connected: false, url });
      wsRef.current = null;
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setState((prev) => ({ ...prev, connected: false }));
  }, []);

  const syncDoc = useCallback((doc: PenDocument) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'pen-doc', doc }));
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { bridge: state, connectBridge: connect, disconnectBridge: disconnect, syncBridgeDoc: syncDoc };
}
