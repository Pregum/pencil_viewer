import type { RectangleNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFillLayers,
  resolveStroke,
  resolveFilter,
  resolveStrokeWidth,
  resolveStrokeAttrs,
} from './paint';
import { isCornerRadiusArray, roundedRectPath } from './roundedRectPath';

export function Rectangle({ node }: { node: RectangleNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const rawCr = node.cornerRadius;
  const asArray = isCornerRadiusArray(rawCr) ? rawCr : null;
  const rawRx = typeof rawCr === 'number' ? rawCr : undefined;
  const rx = rawRx != null ? Math.min(rawRx, width / 2, height / 2) : rawRx;

  const layers = resolveFillLayers(node.fill, ctx);
  const strokeColor = resolveStroke(node.stroke, ctx);
  const strokeWidth = resolveStrokeWidth(node.stroke);
  const strokeAttrs = resolveStrokeAttrs(node.stroke);
  const filter = resolveFilter(ctx);

  // stroke.align: 'inside' / 'outside' で rect の座標をオフセット
  const align = node.stroke?.align ?? 'center';
  const sw2 = strokeWidth / 2;
  const strokeRect = align === 'inside'
    ? { x: x + sw2, y: y + sw2, w: Math.max(0, width - strokeWidth), h: Math.max(0, height - strokeWidth) }
    : align === 'outside'
    ? { x: x - sw2, y: y - sw2, w: width + strokeWidth, h: height + strokeWidth }
    : { x, y, w: width, h: height };
  // inside/outside のとき対応する cornerRadius も調整（内側: 縮小、外側: 拡大）
  const strokeRx = rx != null
    ? Math.max(0, align === 'inside' ? rx - sw2 : align === 'outside' ? rx + sw2 : rx)
    : undefined;
  const strokeCrArray = asArray
    ? (asArray.map((r) => Math.max(0, align === 'inside' ? r - sw2 : align === 'outside' ? r + sw2 : r)) as [number, number, number, number])
    : null;

  const hasStroke = strokeWidth > 0 && strokeColor !== 'none';

  // cornerRadius が [nw, ne, se, sw] の配列なら path で描画
  if (asArray) {
    const fillPath = roundedRectPath(x, y, width, height, asArray);
    const strokePath = roundedRectPath(
      strokeRect.x,
      strokeRect.y,
      strokeRect.w,
      strokeRect.h,
      strokeCrArray ?? asArray,
    );
    return (
      <g filter={filter}>
        {layers.map((l, i) => (
          <path
            key={i}
            d={fillPath}
            fill={l.paint}
            fillOpacity={l.opacity !== 1 ? l.opacity : undefined}
          />
        ))}
        {hasStroke && (
          <path
            d={strokePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            {...strokeAttrs}
          />
        )}
      </g>
    );
  }

  // 中央整列かつ fill 単一なら 1 要素 <rect> で最適化
  if (layers.length <= 1 && (align === 'center' || !hasStroke)) {
    const fillPaint = layers[0]?.paint ?? 'none';
    const fillOpacity = layers[0]?.opacity;
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        ry={rx}
        fill={fillPaint}
        fillOpacity={fillOpacity != null && fillOpacity !== 1 ? fillOpacity : undefined}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        {...strokeAttrs}
        filter={filter}
      />
    );
  }

  // 複数 fill or inside/outside 整列: fill と stroke を分離
  return (
    <g filter={filter}>
      {layers.map((l, i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={width}
          height={height}
          rx={rx}
          ry={rx}
          fill={l.paint}
          fillOpacity={l.opacity !== 1 ? l.opacity : undefined}
        />
      ))}
      {hasStroke && (
        <rect
          x={strokeRect.x}
          y={strokeRect.y}
          width={strokeRect.w}
          height={strokeRect.h}
          rx={strokeRx}
          ry={strokeRx}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          {...strokeAttrs}
        />
      )}
    </g>
  );
}
