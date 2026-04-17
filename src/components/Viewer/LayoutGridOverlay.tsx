/**
 * Frame の layoutGrids (columns / rows / grid) を SVG で可視化するレイヤー。
 * Figma と同じく、半透明のガイドとして描画する（クリック不可）。
 */

import type { FrameNode, LayoutGrid } from '../../pen/types';

interface Props {
  frame: FrameNode;
}

function getSectionRanges(
  grid: LayoutGrid,
  total: number,
): Array<{ start: number; size: number }> {
  const pattern = grid.pattern;
  if (pattern === 'grid') return []; // grid は別処理
  const count = Math.max(0, grid.count ?? 0);
  const gutter = Math.max(0, grid.gutter ?? 0);
  const offset = Math.max(0, grid.offset ?? 0);
  const alignment = grid.alignment ?? 'stretch';
  if (count === 0) return [];

  if (alignment === 'stretch') {
    // 両端にoffsetを入れ、残りを count 等分してgutterで分ける
    const avail = total - offset * 2;
    const size = (avail - gutter * (count - 1)) / count;
    if (size <= 0) return [];
    return Array.from({ length: count }, (_, i) => ({
      start: offset + i * (size + gutter),
      size,
    }));
  }

  const size = grid.sectionSize ?? 64;
  const totalBand = size * count + gutter * (count - 1);
  let start = 0;
  if (alignment === 'min') start = offset;
  else if (alignment === 'max') start = total - offset - totalBand;
  else if (alignment === 'center') start = (total - totalBand) / 2;
  return Array.from({ length: count }, (_, i) => ({
    start: start + i * (size + gutter),
    size,
  }));
}

export function LayoutGridOverlay({ frame }: Props) {
  const grids = frame.layoutGrids;
  if (!grids || grids.length === 0) return null;
  const w = typeof frame.width === 'number' ? frame.width : 0;
  const h = typeof frame.height === 'number' ? frame.height : 0;
  if (w <= 0 || h <= 0) return null;

  return (
    <g pointerEvents="none">
      {grids.map((g, gi) => {
        if (g.visible === false) return null;
        const color = g.color ?? '#F472B6';
        const opacity = g.opacity ?? 0.15;

        if (g.pattern === 'columns') {
          const ranges = getSectionRanges(g, w);
          return (
            <g key={gi} opacity={opacity}>
              {ranges.map((r, i) => (
                <rect
                  key={i}
                  x={r.start}
                  y={0}
                  width={r.size}
                  height={h}
                  fill={color}
                />
              ))}
            </g>
          );
        }
        if (g.pattern === 'rows') {
          const ranges = getSectionRanges(g, h);
          return (
            <g key={gi} opacity={opacity}>
              {ranges.map((r, i) => (
                <rect
                  key={i}
                  x={0}
                  y={r.start}
                  width={w}
                  height={r.size}
                  fill={color}
                />
              ))}
            </g>
          );
        }
        // pattern === 'grid': 均等線 every `size` px
        const size = Math.max(2, g.size ?? 8);
        const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
        for (let x = 0; x <= w; x += size) {
          lines.push({ x1: x, y1: 0, x2: x, y2: h });
        }
        for (let y = 0; y <= h; y += size) {
          lines.push({ x1: 0, y1: y, x2: w, y2: y });
        }
        return (
          <g key={gi} opacity={opacity} stroke={color} strokeWidth={0.5}>
            {lines.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            ))}
          </g>
        );
      })}
    </g>
  );
}
