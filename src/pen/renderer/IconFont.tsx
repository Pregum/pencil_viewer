/**
 * icon_font レンダラ。
 *
 * Pencil は複数の icon font を許可している:
 *   - Material Symbols Outlined / Rounded / Sharp
 *   - lucide / feather / phosphor
 *
 * MVP: Material Symbols 系のみ @font-face 経由で本物のアイコンとして描画する。
 * それ以外(lucide など)はフォントとして配信されていないので、プレースホルダ
 * として iconFontName を小さいラベルで表示する。
 *
 * Material Symbols はリガチャで描画するので、`content` に iconFontName を
 * そのまま入れれば対応するグリフが表示される。
 */

import type { IconFontNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import { resolveFill, resolveFilter } from './paint';

const MATERIAL_FAMILIES: Record<string, string> = {
  'Material Symbols Outlined': 'Material Symbols Outlined',
  'Material Symbols Rounded': 'Material Symbols Rounded',
  'Material Symbols Sharp': 'Material Symbols Sharp',
};

export function IconFont({ node }: { node: IconFontNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : 24;
  const height = typeof node.height === 'number' ? node.height : 24;
  const size = Math.min(width, height);
  const name = node.iconFontName ?? '';
  const family = node.iconFontFamily ?? 'Material Symbols Outlined';
  const fill = resolveFill(node.fill, ctx);
  const filter = resolveFilter(ctx);

  const isMaterial = family in MATERIAL_FAMILIES;
  if (isMaterial && name) {
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill={fill === 'none' ? '#111827' : fill}
        fontFamily={MATERIAL_FAMILIES[family]}
        fontSize={size}
        fontWeight={node.weight ?? 400}
        dominantBaseline="central"
        textAnchor="middle"
        filter={filter}
        style={{
          // Material Symbols はリガチャ描画
          fontVariationSettings: `'FILL' 0, 'wght' ${node.weight ?? 400}`,
        }}
      >
        {name}
      </text>
    );
  }

  // 未対応フォント: プレースホルダ(破線矩形 + ラベル)
  return (
    <g transform={`translate(${x} ${y})`} filter={filter}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={4}
        ry={4}
        fill="none"
        stroke="#9CA3AF"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <text
        x={width / 2}
        y={height / 2}
        fill="#6B7280"
        fontSize={Math.min(10, size / 2)}
        fontFamily="ui-monospace, Menlo, monospace"
        dominantBaseline="central"
        textAnchor="middle"
      >
        {name.slice(0, 6) || '?'}
      </text>
    </g>
  );
}
