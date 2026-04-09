import type { EllipseNode } from '../types';
import { resolveSolidFill, resolveStrokeColor, resolveStrokeWidth } from './paint';

export function Ellipse({ node }: { node: EllipseNode }) {
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
      fill={resolveSolidFill(node.fill)}
      stroke={resolveStrokeColor(node.stroke)}
      strokeWidth={resolveStrokeWidth(node.stroke)}
    />
  );
}
