/**
 * 他ユーザーのカーソルと選択を SVG キャンバス上に描画する。
 *
 * <svg> の内側 (= ノードと同じ座標系) に置くため、ズーム/パンに
 * 自然に追従する。カーソルアイコンとラベルは 1/scale で逆スケールして
 * 画面上では常に一定サイズに見せる。
 */

import { useEditor } from '../pen/state/EditorContext';
import type { CollabPeer } from './useCollab';
import type { PenNode } from '../pen/types';

interface Props {
  peers: CollabPeer[];
  /** 現在のズーム倍率 (SVG 単位 → 画面 px) */
  scale: number;
}

/** ノードを ID で探し、絶対座標のバウンディングボックスを返す */
function findAbsBounds(
  nodes: PenNode[],
  id: string,
  offsetX: number,
  offsetY: number,
): { x: number; y: number; w: number; h: number } | null {
  for (const n of nodes) {
    const nx = offsetX + (typeof (n as { x?: number }).x === 'number' ? (n as { x: number }).x : 0);
    const ny = offsetY + (typeof (n as { y?: number }).y === 'number' ? (n as { y: number }).y : 0);
    if (n.id === id) {
      const w = typeof (n as { width?: number }).width === 'number' ? (n as { width: number }).width : 0;
      const h = typeof (n as { height?: number }).height === 'number' ? (n as { height: number }).height : 0;
      return { x: nx, y: ny, w, h };
    }
    const kids = (n as { children?: PenNode[] }).children;
    if (Array.isArray(kids)) {
      const found = findAbsBounds(kids, id, nx, ny);
      if (found) return found;
    }
  }
  return null;
}

export function RemoteCursors({ peers, scale }: Props) {
  const { state } = useEditor();
  if (peers.length === 0) return null;

  const inv = 1 / Math.max(scale, 0.001);

  return (
    <g className="collab-cursors" pointerEvents="none" aria-hidden>
      {/* リモート選択ハイライト */}
      {peers.flatMap((p) =>
        (p.selection ?? []).map((id) => {
          const b = findAbsBounds(state.doc.children, id, 0, 0);
          if (!b || (b.w === 0 && b.h === 0)) return null;
          return (
            <rect
              key={`sel-${p.id}-${id}`}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke={p.color}
              strokeWidth={1.5 * inv}
              rx={2 * inv}
            />
          );
        }),
      )}

      {/* リモートカーソル */}
      {peers.map((p) =>
        p.cursor ? (
          <g
            key={`cur-${p.id}`}
            transform={`translate(${p.cursor.x} ${p.cursor.y}) scale(${inv})`}
          >
            <path
              d="M0 0 L0 17 L4.6 12.8 L7.4 18.6 L10 17.4 L7.2 11.7 L13 11.2 Z"
              fill={p.color}
              stroke="#ffffff"
              strokeWidth={1}
              strokeLinejoin="round"
            />
            <g transform="translate(14 12)">
              <rect
                x={0}
                y={0}
                width={p.name.length * 7 + 14}
                height={19}
                rx={9.5}
                fill={p.color}
              />
              <text
                x={7}
                y={13.5}
                fontSize={11}
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight={600}
                fill="#ffffff"
              >
                {p.name}
              </text>
            </g>
          </g>
        ) : null,
      )}
    </g>
  );
}
