import type { LineNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveStroke,
  resolveFill,
  resolveStrokeWidth,
} from './paint';

export function Line({ node }: { node: LineNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const width = typeof node.width === 'number' ? node.width : 0;
  const height = typeof node.height === 'number' ? node.height : 0;
  const x1 = node.x ?? 0;
  const y1 = node.y ?? 0;
  const x2 = x1 + width;
  const y2 = y1 + height;
  // stroke が未指定の場合は fill を stroke 色として扱う
  const strokeVal = resolveStroke(node.stroke, ctx);
  const fallback = resolveFill(node.fill, ctx);
  const finalStroke = strokeVal !== 'none' ? strokeVal : fallback !== 'none' ? fallback : '#111827';
  const strokeWidth = resolveStrokeWidth(node.stroke) || 1;
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={finalStroke} strokeWidth={strokeWidth} />
  );
}
