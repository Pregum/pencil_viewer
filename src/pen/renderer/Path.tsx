import type { PathNode } from '../types';
import { resolveSolidFill, resolveStrokeColor, resolveStrokeWidth } from './paint';

export function Path({ node }: { node: PathNode }) {
  if (!node.geometry) return null;
  // Pencil の geometry は SVG path 互換の文字列想定。
  // 独自拡張があれば後続で src/pen/paint/path.ts にコンバータを追加する。
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const translated = x === 0 && y === 0 ? undefined : `translate(${x} ${y})`;
  return (
    <g transform={translated}>
      <path
        d={node.geometry}
        fill={resolveSolidFill(node.fill)}
        stroke={resolveStrokeColor(node.stroke)}
        strokeWidth={resolveStrokeWidth(node.stroke)}
        fillRule={node.fillRule ?? 'nonzero'}
      />
    </g>
  );
}
