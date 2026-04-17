/**
 * image ノードレンダラ。
 * URL を持つ画像を SVG <image> で描画する。
 * URL が無い場合はプレースホルダを表示。
 */

import type { ImageNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import { resolveFilter } from './paint';
import { isCornerRadiusArray, roundedRectPath } from './roundedRectPath';

/** 安全な画像 URL のみ許可 */
function sanitizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (/^data:image\/[a-z+]+;base64,/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch {
    // invalid
  }
  return null;
}

export function Image({ node }: { node: ImageNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const filter = resolveFilter(ctx);
  const rawCr = node.cornerRadius;
  const rxNum = typeof rawCr === 'number' ? rawCr : undefined;
  const crArr = isCornerRadiusArray(rawCr) ? rawCr : null;
  const safeUrl = sanitizeUrl(node.url);

  if (!safeUrl || width === 0 || height === 0) {
    // Placeholder
    const ph = crArr
      ? roundedRectPath(x, y, width || 100, height || 100, crArr)
      : null;
    return (
      <g filter={filter}>
        {ph ? (
          <path d={ph} fill="#F3F4F6" stroke="#D1D5DB" strokeWidth={1} />
        ) : (
          <rect
            x={x}
            y={y}
            width={width || 100}
            height={height || 100}
            fill="#F3F4F6"
            stroke="#D1D5DB"
            strokeWidth={1}
            rx={rxNum}
          />
        )}
        <text
          x={x + (width || 100) / 2}
          y={y + (height || 100) / 2}
          fill="#9CA3AF"
          fontSize={Math.min(14, (width || 100) / 8)}
          fontFamily="system-ui, sans-serif"
          dominantBaseline="central"
          textAnchor="middle"
        >
          Image
        </text>
      </g>
    );
  }

  const needsClip = node.clip || rxNum != null || crArr != null;
  const clipId = needsClip ? `img-clip-${node.id}` : undefined;

  return (
    <g filter={filter}>
      {clipId && (
        <defs>
          <clipPath id={clipId}>
            {crArr ? (
              <path d={roundedRectPath(x, y, width, height, crArr)} />
            ) : (
              <rect x={x} y={y} width={width} height={height} rx={rxNum} ry={rxNum} />
            )}
          </clipPath>
        </defs>
      )}
      <image
        href={safeUrl}
        x={x}
        y={y}
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid slice"
        clipPath={clipId ? `url(#${clipId})` : undefined}
      />
    </g>
  );
}
