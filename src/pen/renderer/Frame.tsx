/**
 * Frame レンダラ。layout 計算は layout/flex.ts 側で済んでいる前提。
 * ここでは: 背景 fill の描画、clipPath、子の再帰描画を担う。
 */

import type { FrameNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFill,
  resolveStroke,
  resolveStrokeWidth,
  resolveFilter,
} from './paint';
import { PenNodeView } from './PenNode';

export function Frame({ node }: { node: FrameNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : undefined;
  const height = typeof node.height === 'number' ? node.height : undefined;
  const opacity = node.opacity ?? 1;
  const clipId = node.clip ? `clip-${node.id}` : undefined;
  const transform = x === 0 && y === 0 ? undefined : `translate(${x} ${y})`;

  const bgFill = resolveFill(node.fill, ctx);
  const strokeColor = resolveStroke(node.stroke, ctx);
  const strokeWidth = resolveStrokeWidth(node.stroke);
  const filter = resolveFilter(ctx);
  const rx = typeof node.cornerRadius === 'number' ? node.cornerRadius : undefined;

  return (
    <g
      transform={transform}
      opacity={opacity}
      clipPath={clipId ? `url(#${clipId})` : undefined}
      filter={filter}
    >
      {clipId && width != null && height != null && (
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={width} height={height} rx={rx} ry={rx} />
          </clipPath>
        </defs>
      )}
      {width != null && height != null && bgFill !== 'none' && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={rx}
          ry={rx}
          fill={bgFill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}
      {node.children?.map((child) => <PenNodeView key={child.id} node={child} />)}
    </g>
  );
}
