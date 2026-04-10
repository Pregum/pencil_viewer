/**
 * vim h/j/k/l でのノードピクセル移動をハンドルする。
 * EditorProvider 内に配置して updateNode を呼ぶ。
 */

import { useEffect } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

const NUDGE_PX = 1; // 1回あたりの移動量(px)

export function NudgeHandler() {
  const { state, updateNode, pushUndoCheckpoint } = useEditor();

  useEffect(() => {
    const handler = (e: Event) => {
      const { direction, count } = (e as CustomEvent).detail as { direction: string; count: number };
      const nodeId = state.selectedNodeId;
      if (!nodeId) return;

      pushUndoCheckpoint();

      const delta = NUDGE_PX * count;
      let dx = 0, dy = 0;
      switch (direction) {
        case 'h': dx = -delta; break;
        case 'l': dx = delta; break;
        case 'k': dy = -delta; break;
        case 'j': dy = delta; break;
      }

      // Find current node position from doc
      const node = findNode(state.doc.children, nodeId);
      if (!node) return;
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      updateNode(nodeId, { x: x + dx, y: y + dy } as Partial<PenNode>);
    };

    window.addEventListener('pencil-nudge', handler);
    return () => window.removeEventListener('pencil-nudge', handler);
  }, [state.selectedNodeId, state.doc, updateNode, pushUndoCheckpoint]);

  return null;
}

function findNode(nodes: PenNode[], id: string): PenNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const found = findNode((n as { children: PenNode[] }).children, id);
      if (found) return found;
    }
  }
  return null;
}
