import type { ConnectionNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import { resolveStroke, resolveStrokeWidth } from './paint';

/**
 * ノード間のコネクション線。
 * MVP: source/target の座標解決は行わず、ノード自身の x/y と
 * サイズから直線を描画する。実際には source.path/target.path から
 * 対象ノードの位置を参照する必要があるが、ビュワーでは
 * 概形を示すだけにとどめる。
 */
export function Connection({ node }: { node: ConnectionNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const strokeColor = resolveStroke(node.stroke, ctx);
  const strokeWidth = resolveStrokeWidth(node.stroke) || 1;
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  // コネクション線は座標情報が不完全な場合が多い(source/target path 解決が必要)。
  // placeholder として短い線 + ラベルを描画。
  return (
    <g opacity={0.4}>
      <line
        x1={x}
        y1={y}
        x2={x + 100}
        y2={y}
        stroke={strokeColor !== 'none' ? strokeColor : '#6B7280'}
        strokeWidth={strokeWidth}
        strokeDasharray="4 4"
        markerEnd="none"
      />
      <text
        x={x + 50}
        y={y - 6}
        fontSize={9}
        fill="#6B7280"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        connection
      </text>
    </g>
  );
}
