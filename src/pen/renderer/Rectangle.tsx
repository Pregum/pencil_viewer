import type { RectangleNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFill,
  resolveStroke,
  resolveFilter,
  resolveStrokeWidth,
} from './paint';

export function Rectangle({ node }: { node: RectangleNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const rawRx = typeof node.cornerRadius === 'number' ? node.cornerRadius : undefined;
  const rx = rawRx != null ? Math.min(rawRx, width / 2, height / 2) : rawRx;
  return (
    <rect
      x={node.x ?? 0}
      y={node.y ?? 0}
      width={width}
      height={height}
      rx={rx}
      ry={rx}
      fill={resolveFill(node.fill, ctx)}
      stroke={resolveStroke(node.stroke, ctx)}
      strokeWidth={resolveStrokeWidth(node.stroke)}
      filter={resolveFilter(ctx)}
    />
  );
}
