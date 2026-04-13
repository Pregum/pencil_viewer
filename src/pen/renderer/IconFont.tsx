/**
 * icon_font レンダラ。
 *
 * 対応フォントファミリー:
 *   - lucide: lucide パッケージの SVG パスデータを使って描画
 *   - Material Symbols Outlined / Rounded / Sharp: リガチャフォントで描画
 *
 * lucide の iconFontName は kebab-case (例: "arrow-left")。
 * lucide パッケージは PascalCase (例: "ArrowLeft") でエクスポートしている。
 */

import type { IconFontNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import { resolveFill, resolveFilter } from './paint';
import { icons as lucideIcons } from 'lucide';

const MATERIAL_FAMILIES: Record<string, string> = {
  'Material Symbols Outlined': 'Material Symbols Outlined',
  'Material Symbols Rounded': 'Material Symbols Rounded',
  'Material Symbols Sharp': 'Material Symbols Sharp',
};

/** kebab-case / snake_case → PascalCase */
function toPascalCase(name: string): string {
  return name.replace(/(^|[-_ ])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
}

/** lucide の IconNode 配列を SVG 子要素に変換 */
function renderLucideElements(
  iconData: [string, Record<string, string>][],
  fillColor: string,
): React.ReactNode[] {
  return iconData.map(([tag, attrs], i) => {
    const props: Record<string, unknown> = { key: i };
    for (const [k, v] of Object.entries(attrs)) {
      const reactKey = k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      // currentColor → 実際の色に置換
      props[reactKey] = v === 'currentColor' ? fillColor : v;
    }

    switch (tag) {
      case 'path':
        return <path {...props} />;
      case 'circle':
        return <circle {...props} />;
      case 'rect':
        return <rect {...props} />;
      case 'line':
        return <line {...props} />;
      case 'polyline':
        return <polyline {...props} />;
      case 'polygon':
        return <polygon {...props} />;
      case 'ellipse':
        return <ellipse {...props} />;
      default:
        return null;
    }
  });
}

function getLucideIcon(name: string): [string, Record<string, string>][] | null {
  const key = toPascalCase(name);
  const entry = (lucideIcons as Record<string, [string, Record<string, string>][]>)[key];
  return entry ?? null;
}

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
  const resolvedFill = fill === 'none' ? '#111827' : fill;

  // Material Symbols: リガチャ描画
  const isMaterial = family in MATERIAL_FAMILIES;
  if (isMaterial && name) {
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill={resolvedFill}
        fontFamily={MATERIAL_FAMILIES[family]}
        fontSize={size}
        fontWeight={node.weight ?? 400}
        dominantBaseline="central"
        textAnchor="middle"
        filter={filter}
        style={{
          fontVariationSettings: `'FILL' 0, 'wght' ${node.weight ?? 400}`,
        }}
      >
        {name}
      </text>
    );
  }

  // Lucide: SVG パスで描画
  if (family === 'lucide') {
    const iconData = getLucideIcon(name);
    if (iconData) {
      // lucide icons are designed on a 24x24 viewBox
      const scale = size / 24;
      const offsetX = x + (width - size) / 2;
      const offsetY = y + (height - size) / 2;
      // strokeWidth を 24px 基準で固定（scale で自動調整される）
      // Pencil 本家と同じく、アイコンサイズに関係なく線の太さが一定に見える
      const sw = 2;
      return (
        <g
          transform={`translate(${offsetX} ${offsetY}) scale(${scale})`}
          fill="none"
          stroke={resolvedFill}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={filter}
        >
          {renderLucideElements(iconData, resolvedFill)}
        </g>
      );
    }
  }

  // 未対応フォント / 見つからないアイコン: プレースホルダ
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
