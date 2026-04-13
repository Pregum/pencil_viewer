/**
 * 共同編集バー。ツールバーに表示するコラボレーション状態UI。
 *
 * - 未接続: 「Collab」ボタン
 * - 接続中: ピアアバター + ルームURL コピー + 切断ボタン
 */

import { useState } from 'react';
import type { CollabState } from '../../collab/useCollab';

interface Props {
  collab: CollabState;
  onStartCollab: () => void;
  onDisconnect: () => void;
  roomUrl: string;
}

export function CollabBar({ collab, onStartCollab, onDisconnect, roomUrl }: Props) {
  const [copied, setCopied] = useState(false);

  if (!collab.connected) {
    return (
      <button
        type="button"
        className="collab-btn"
        onClick={onStartCollab}
        title="Start collaborative session (P2P)"
      >
        <span className="collab-btn__icon">●</span>
        Collab
      </button>
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
