import type { TextNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import { normalizeTextLines } from '../layout/flex';
import { resolveFill, resolveFilter } from './paint';

/**
 * Pencil の text ノードを SVG <text> に変換する。
 *
 * Pencil の座標規約:
 *   - (x, y) は text bounding box の左上隅
 *   - textGrowth: "auto" → bounding box は内容にフィットする(width/height は無視)
 *   - textGrowth: "fixed-width" → width は確定、height は内容で伸びる
 *   - textGrowth: "fixed-width-height" → 両方確定
 *   - textAlign は bounding box 内での揃え方。auto では box が無いので原則無視
 *
 * SVG <text> の規約:
 *   - x, y は基準点
 *   - dominantBaseline="text-before-edge" にすると y は top
 *   - textAnchor が "start"=左, "middle"=中央, "end"=右(基準点に対して)
 *
 * よって:
 *   - auto growth: textAnchor=start, x = node.x
 *   - fixed-width + center: textAnchor=middle, x = node.x + node.width/2
 *   - fixed-width + right:  textAnchor=end,    x = node.x + node.width
 *   - fixed-width + left:   textAnchor=start,  x = node.x
 */
export function Text({ node }: { node: TextNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };

  const fontSize = node.fontSize ?? 14;
  const lineHeightRatio = node.lineHeight ?? 1.2;
  const fontFamily = node.fontFamily ?? 'Inter, system-ui, sans-serif';
  const fontWeight = node.fontWeight ?? 'normal';
  const fill = resolveFill(node.fill, ctx);
  // 改行解釈は flex.ts の intrinsic 計算と完全に合わせる(正規化を共有)
  const lines = normalizeTextLines(node.content);
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  const isFixedWidth =
    node.textGrowth === 'fixed-width' || node.textGrowth === 'fixed-width-height';
  const widthForAlign = typeof node.width === 'number' ? node.width : 0;

  let renderX = x;
  let textAnchor: 'start' | 'middle' | 'end' = 'start';
  if (isFixedWidth && widthForAlign > 0) {
    switch (node.textAlign) {
      case 'center':
        renderX = x + widthForAlign / 2;
        textAnchor = 'middle';
        break;
      case 'right':
        renderX = x + widthForAlign;
        textAnchor = 'end';
        break;
      default:
        renderX = x;
        textAnchor = 'start';
        break;
    }
  }

  const resolvedFill = fill === 'none' ? '#111827' : fill;
  const filterVal = resolveFilter(ctx);
  const letterSpacing = node.letterSpacing ?? 0;

  // fixed-width text with wrapping: use foreignObject for word wrap
  if (isFixedWidth && widthForAlign > 0) {
    // height: レイアウト計算済みなら使う。未定なら十分な高さを確保
    const resolvedHeight = typeof node.height === 'number' && node.height > 0
      ? node.height
      : undefined;
    // フォールバック: 大きめに取って overflow:hidden で制御しない(fit_content)
    const fallbackHeight = Math.max(fontSize * lineHeightRatio * lines.length * 5, 200);
    // textAlignVertical: fixed-width-height のときのみ上下整列が意味を持つ
    // (fixed-width は height が内容で伸びるので top 相当)
    const hasFixedHeight = node.textGrowth === 'fixed-width-height' && resolvedHeight != null;
    const vAlign = hasFixedHeight ? node.textAlignVertical ?? 'top' : 'top';
    const flexAlign = vAlign === 'middle' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start';
    return (
      <foreignObject
        x={x}
        y={y}
        width={widthForAlign}
        height={resolvedHeight ?? fallbackHeight}
        filter={filterVal}
      >
        <div
          // @ts-expect-error xmlns is valid for foreignObject children
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: flexAlign,
            margin: 0,
            padding: 0,
          }}
        >
          <div
            style={{
              fontSize: `${fontSize}px`,
              fontFamily,
              fontWeight,
              color: resolvedFill,
              lineHeight: lineHeightRatio,
              textAlign: node.textAlign ?? 'left',
              letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'visible',
              margin: 0,
              padding: 0,
              textDecoration: [
                node.underline ? 'underline' : '',
                node.strikethrough ? 'line-through' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined,
              fontStyle: node.fontStyle ?? undefined,
            }}
          >
            {node.content ?? ''}
          </div>
        </div>
      </foreignObject>
    );
  }

  // auto / fit-content text: simple SVG text
  return (
    <text
      x={renderX}
      y={y}
      fill={resolvedFill}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      dominantBaseline="text-before-edge"
      textAnchor={textAnchor}
      letterSpacing={letterSpacing || undefined}
      filter={filterVal}
      style={{
        whiteSpace: 'pre',
        textDecoration: [
          node.underline ? 'underline' : '',
          node.strikethrough ? 'line-through' : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined,
        fontStyle: node.fontStyle ?? undefined,
      }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={renderX} dy={i === 0 ? 0 : fontSize * lineHeightRatio}>
          {line || ' '}
        </tspan>
      ))}
    </text>
  );
}
