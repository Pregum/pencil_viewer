import type { PolygonNode } from '../types';
import { resolveSolidFill, resolveStrokeColor, resolveStrokeWidth } from './paint';

export function Polygon({ node }: { node: PolygonNode }) {
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const sides = node.polygonCount ?? 3;
  const cx = (node.x ?? 0) + width / 2;
  const cy = (node.y ?? 0) + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  // 正多角形の頂点(-90度 start = 上向き)
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / sides;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    points.push(`${px.toFixed(3)},${py.toFixed(3)}`);
  }

  return (
    <polygon
      points={points.join(' ')}
      fill={resolveSolidFill(node.fill)}
      stroke={resolveStrokeColor(node.stroke)}
      strokeWidth={resolveStrokeWidth(node.stroke)}
    />
  );
}
