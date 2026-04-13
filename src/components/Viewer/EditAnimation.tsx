/**
 * MCP/Bridge 経由の編集時にスキャナー + パルスグローアニメーションを表示。
 *
 * カスタムイベント 'pencil-edit-animate' でノード ID を受け取り、
 * そのノードの位置にアニメーションを再生する。
 */

import { useCallback, useEffect, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

interface AnimTarget {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  key: number; // re-trigger key
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

export function EditAnimation() {
  const { state } = useEditor();
  const [targets, setTargets] = useState<AnimTarget[]>([]);

  const triggerAnimation = useCallback(
    (nodeIds: string[]) => {
      const now = Date.now();
      const newTargets: AnimTarget[] = [];
      for (const id of nodeIds) {
        const node = findNode(state.doc.children, id);
        if (!node) continue;
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const w = typeof (node as { width?: unknown }).width === 'number'
          ? (node as { width: number }).width : 0;
        const h = typeof (node as { height?: unknown }).height === 'number'
          ? (node as { height: number }).height : 0;
        if (w > 0 && h > 0) {
          newTargets.push({ id, x, y, width: w, height: h, key: now });
        }
      }
      if (newTargets.length > 0) {
        setTargets(newTargets);
        // Clear after animation
        setTimeout(() => setTargets([]), 1200);
      }
    },
    [state.doc],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const ids = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(ids)) triggerAnimation(ids);
    };
    window.addEventListener('pencil-edit-animate', handler);
    return () => window.removeEventListener('pencil-edit-animate', handler);
  }, [triggerAnimation]);

  if (targets.length === 0) return null;

  return (
    <g pointerEvents="none">
      {targets.map((t) => (
        <g key={`${t.id}-${t.key}`}>
          {/* Scanner line: horizontal line sweeping top → bottom */}
          <rect
            x={t.x}
            y={t.y}
            width={t.width}
            height={2}
            fill="#6366f1"
            opacity={0.8}
          >
            <animate
              attributeName="y"
              from={t.y}
              to={t.y + t.height}
              dur="0.4s"
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="0.8;0.8;0"
              keyTimes="0;0.7;1"
              dur="0.5s"
              fill="freeze"
            />
          </rect>

          {/* Pulse glow: outline that fades */}
          <rect
            x={t.x - 2}
            y={t.y - 2}
            width={t.width + 4}
            height={t.height + 4}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2}
            rx={4}
            opacity={0}
          >
            <animate
              attributeName="opacity"
              values="0;0;0.8;0"
              keyTimes="0;0.3;0.5;1"
              dur="1s"
              fill="freeze"
            />
            <animate
              attributeName="stroke-width"
              values="2;2;3;1"
              keyTimes="0;0.3;0.5;1"
              dur="1s"
              fill="freeze"
            />
          </rect>

          {/* Inner scan fill: semi-transparent overlay that sweeps down */}
          <clipPath id={`scan-clip-${t.id}-${t.key}`}>
            <rect x={t.x} y={t.y} width={t.width} height={0}>
              <animate
                attributeName="height"
                from={0}
                to={t.height}
                dur="0.4s"
                fill="freeze"
              />
            </rect>
          </clipPath>
          <rect
            x={t.x}
            y={t.y}
            width={t.width}
            height={t.height}
            fill="#6366f1"
            opacity={0}
            clipPath={`url(#scan-clip-${t.id}-${t.key})`}
          >
            <animate
              attributeName="opacity"
              values="0;0.06;0.06;0"
              keyTimes="0;0.1;0.5;1"
              dur="1s"
              fill="freeze"
            />
          </rect>
        </g>
      ))}
    </g>
  );
}
