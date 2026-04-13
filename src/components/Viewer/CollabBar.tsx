/**
 * 共同編集バー。ツールバーに表示するコラボレーション状態UI。
 *
 * - 未接続: 「Collab」ボタン
 * - 接続中: ピアアバター + ルームURL コピー + 切断ボタン
 */

import { useState } from 'react';
import type { CollabState } from '../../collab/useCollab';
import type { BridgeState } from '../../collab/useBridge';

interface Props {
  collab: CollabState;
  bridge: BridgeState;
  onStartCollab: () => void;
  onDisconnect: () => void;
  onToggleBridge: () => void;
  roomUrl: string;
}

export function CollabBar({ collab, bridge, onStartCollab, onDisconnect, onToggleBridge, roomUrl }: Props) {
  const [copied, setCopied] = useState(false);

  if (!collab.connected) {
    return (
      <div className="collab-bar">
        <button
          type="button"
          className="collab-btn"
          onClick={onStartCollab}
          title="Start collaborative session (P2P)"
        >
          <span className="collab-btn__icon">●</span>
          Collab
        </button>
        <button
          type="button"
          className={`collab-btn ${bridge.connected ? 'collab-btn--active' : ''}`}
          onClick={onToggleBridge}
          title={bridge.connected ? 'MCP Bridge connected (click to disconnect)' : 'Connect MCP Bridge (localhost:4567)'}
        >
          <span className="collab-btn__icon">{bridge.connected ? '⚡' : '🔌'}</span>
          {bridge.connected ? 'Bridge' : 'MCP'}
        </button>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      prompt('Share this URL:', roomUrl);
    }
  };

  return (
    <div className="collab-bar">
      <span className="collab-bar__status" title={`Room: ${collab.roomId}`}>
        <span className="collab-bar__dot" />
        Live
      </span>

      {/* Peer avatars */}
      <div className="collab-bar__peers">
        {/* Self */}
        <span
          className="collab-bar__avatar"
          style={{ background: '#4f46e5' }}
          title={`${collab.userName} (you)`}
        >
          {collab.userName[0]}
        </span>
        {collab.peers.map((p) => (
          <span
            key={p.id}
            className="collab-bar__avatar"
            style={{ background: p.color }}
            title={p.name}
          >
            {p.name[0]}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="collab-bar__copy"
        onClick={() => void handleCopy()}
        title="Copy room URL"
      >
        {copied ? '✓ Copied' : '🔗 Invite'}
      </button>

      <button
        type="button"
        className="collab-bar__leave"
        onClick={onDisconnect}
        title="Leave session"
      >
        ✕
      </button>
    </div>
  );
}
