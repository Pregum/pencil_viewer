/**
 * Frame レンダラ(Step 5: レイアウト計算なし版)
 *
 * - MVP では Pencil の flexbox 風 layout は未対応(Step 6 で layout/flex.ts を追加)
 * - `layout: "none"` のフレームはこのまま正しく描画される
 * - layout が "horizontal" / "vertical" のフレームは子の x/y が無視される仕様だが、
 *   ここでは絶対座標モードとして子をそのまま描く。見た目が崩れるフレームが出るのは
 *   layout 実装までの一時的な妥協
 */

import type { FrameNode } from '../types';
import { resolveSolidFill, resolveStrokeColor, resolveStrokeWidth } from './paint';
import { PenNodeView } from './PenNode';

export function Frame({ node }: { node: FrameNode }) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : undefined;
  const height = typeof node.height === 'number' ? node.height : undefined;
  const opacity = node.opacity ?? 1;
  const clipId = node.clip ? `clip-${node.id}` : undefined;
  const transform = x === 0 && y === 0 ? undefined : `translate(${x} ${y})`;

  const bgFill = resolveSolidFill(node.fill);
  const strokeColor = resolveStrokeColor(node.stroke);
  const strokeWidth = resolveStrokeWidth(node.stroke);
  const rx = typeof node.cornerRadius === 'number' ? node.cornerRadius : undefined;

  return (
    <g transform={transform} opacity={opacity} clipPath={clipId ? `url(#${clipId})` : undefined}>
      {clipId && width != null && height != null && (
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={width} height={height} rx={rx} ry={rx} />
          </clipPath>
        </defs>
      )}
      {/* 背景 */}
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
      {/* 子 */}
      {node.children?.map((child) => <PenNodeView key={child.id} node={child} />)}
    </g>
  );
}
