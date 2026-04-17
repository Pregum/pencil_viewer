import type { RectangleNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFillLayers,
  resolveStroke,
  resolveFilter,
  resolveStrokeWidth,
} from './paint';

export function Rectangle({ node }: { node: RectangleNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const rawRx = typeof node.cornerRadius === 'number' ? node.cornerRadius : undefined;
  const rx = rawRx != null ? Math.min(rawRx, width / 2, height / 2) : rawRx;

  const layers = resolveFillLayers(node.fill, ctx);
  const strokeColor = resolveStroke(node.stroke, ctx);
  const strokeWidth = resolveStrokeWidth(node.stroke);
  const filter = resolveFilter(ctx);

  // 単一 fill ならインライン 1 個の <rect> で済ませる（以前の挙動と同じ DOM）
  if (layers.length <= 1) {
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
        filter={filter}
      />
    );
  }

  // 複数 fill: 下層から順に重ね塗り、最上位に stroke だけの rect を被せる
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
      {strokeWidth > 0 && strokeColor !== 'none' && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={rx}
          ry={rx}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}
    </g>
  );
}
