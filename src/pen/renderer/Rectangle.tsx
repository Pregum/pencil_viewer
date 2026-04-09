import type { RectangleNode } from '../types';
import { resolveSolidFill, resolveStrokeColor, resolveStrokeWidth } from './paint';

export function Rectangle({ node }: { node: RectangleNode }) {
  const rx = typeof node.cornerRadius === 'number' ? node.cornerRadius : undefined;
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  return (
    <rect
      x={node.x ?? 0}
      y={node.y ?? 0}
      width={width}
      height={height}
      rx={rx}
      ry={rx}
      fill={resolveSolidFill(node.fill)}
      stroke={resolveStrokeColor(node.stroke)}
      strokeWidth={resolveStrokeWidth(node.stroke)}
    />
  );
}
