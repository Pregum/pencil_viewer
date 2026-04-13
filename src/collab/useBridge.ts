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

export function useBridge() {
  const [state, setState] = useState<BridgeState>({ connected: false, url: DEFAULT_URL });
  const wsRef = useRef<WebSocket | null>(null);
  const onDocUpdateRef = useRef<((doc: PenDocument) => void) | null>(null);

  const connect = useCallback((url: string, doc: PenDocument, onDocUpdate: (doc: PenDocument) => void) => {
    disconnect();

    onDocUpdateRef.current = onDocUpdate;

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
          onDocUpdateRef.current?.(msg.doc);
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
