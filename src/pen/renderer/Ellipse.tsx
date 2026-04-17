import type { EllipseNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFillLayers,
  resolveStroke,
  resolveFilter,
  resolveStrokeWidth,
  resolveStrokeAttrs,
} from './paint';

export function Ellipse({ node }: { node: EllipseNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const cx = (node.x ?? 0) + width / 2;
  const cy = (node.y ?? 0) + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  const layers = resolveFillLayers(node.fill, ctx);
  const strokeColor = resolveStroke(node.stroke, ctx);
  const strokeWidth = resolveStrokeWidth(node.stroke);
  const strokeAttrs = resolveStrokeAttrs(node.stroke);
  const filter = resolveFilter(ctx);

  const align = node.stroke?.align ?? 'center';
  const sw2 = strokeWidth / 2;
  // inside/outside で rx/ry を調整
  const sRx = align === 'inside' ? Math.max(0, rx - sw2) : align === 'outside' ? rx + sw2 : rx;
  const sRy = align === 'inside' ? Math.max(0, ry - sw2) : align === 'outside' ? ry + sw2 : ry;

  const hasStroke = strokeWidth > 0 && strokeColor !== 'none';

  if (layers.length <= 1 && (align === 'center' || !hasStroke)) {
    const fillPaint = layers[0]?.paint ?? 'none';
    const fillOpacity = layers[0]?.opacity;
    return (
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={fillPaint}
        fillOpacity={fillOpacity != null && fillOpacity !== 1 ? fillOpacity : undefined}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        {...strokeAttrs}
        filter={filter}
      />
    );
  }

  return (
    <g filter={filter}>
      {layers.map((l, i) => (
        <ellipse
          key={i}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={l.paint}
          fillOpacity={l.opacity !== 1 ? l.opacity : undefined}
        />
      ))}
      {hasStroke && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={sRx}
          ry={sRy}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          {...strokeAttrs}
        />
      )}
    </g>
  );
}
