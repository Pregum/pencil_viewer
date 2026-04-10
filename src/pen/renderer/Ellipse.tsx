import type { EllipseNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFill,
  resolveStroke,
  resolveFilter,
  resolveStrokeWidth,
} from './paint';

export function Ellipse({ node }: { node: EllipseNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const cx = (node.x ?? 0) + width / 2;
  const cy = (node.y ?? 0) + height / 2;
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={width / 2}
      ry={height / 2}
      fill={resolveFill(node.fill, ctx)}
      stroke={resolveStroke(node.stroke, ctx)}
      strokeWidth={resolveStrokeWidth(node.stroke)}
      filter={resolveFilter(ctx)}
    />
  );
}
