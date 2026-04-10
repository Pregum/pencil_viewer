import type { PathNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFill,
  resolveStroke,
  resolveFilter,
  resolveStrokeWidth,
} from './paint';

export function Path({ node }: { node: PathNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  if (!node.geometry) return null;
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const translated = x === 0 && y === 0 ? undefined : `translate(${x} ${y})`;
  return (
    <g transform={translated} filter={resolveFilter(ctx)}>
      <path
        d={node.geometry}
        fill={resolveFill(node.fill, ctx)}
        stroke={resolveStroke(node.stroke, ctx)}
        strokeWidth={resolveStrokeWidth(node.stroke)}
        fillRule={node.fillRule ?? 'nonzero'}
      />
    </g>
  );
}
