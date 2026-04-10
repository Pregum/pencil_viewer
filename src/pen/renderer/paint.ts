/**
 * fill / stroke を SVG 属性値に変換する resolver。
 * PaintRegistry が提供されていれば、gradient / image は `url(#id)` 参照に
 * 置き換える。レジストリがない場合はソリッド色にフォールバック。
 */

import type { Fill, Fills, Stroke } from '../types';
import type { PaintRegistry } from '../paint/registry';

export interface PaintContext {
  nodeId: string;
  registry?: PaintRegistry;
}

export function resolveFill(fill: Fills | undefined, ctx: PaintContext): string {
  const refId = ctx.registry?.fillMap.get(ctx.nodeId);
  if (refId) return `url(#${refId})`;
  return resolveSolidFill(fill);
}

export function resolveStroke(stroke: Stroke | undefined, ctx: PaintContext): string {
  const refId = ctx.registry?.strokeMap.get(ctx.nodeId);
  if (refId) return `url(#${refId})`;
  return resolveStrokeColor(stroke);
}

export function resolveFilter(ctx: PaintContext): string | undefined {
  const id = ctx.registry?.filterMap.get(ctx.nodeId);
  return id ? `url(#${id})` : undefined;
}

// ------------------------------------------------------------------
// Solid color fallbacks (registry 非対応時、およびレガシー呼び出し用)
// ------------------------------------------------------------------

export function resolveSolidFill(fill: Fills | undefined): string {
  const single = pickSingle(fill);
  if (!single) return 'none';
  if (typeof single === 'string') return single;
  if (single.type === 'color') return single.color;
  if (single.type === 'gradient') {
    const first = single.colors?.[0]?.color;
    return first ?? 'none';
  }
  return 'none';
}

export function resolveStrokeColor(stroke: Stroke | undefined): string {
  if (!stroke) return 'none';
  return resolveSolidFill(stroke.fill);
}

export function resolveStrokeWidth(stroke: Stroke | undefined): number {
  if (!stroke || stroke.thickness == null) return 0;
  if (typeof stroke.thickness === 'number') return stroke.thickness;
  const t = stroke.thickness;
  return Math.max(t.top ?? 0, t.right ?? 0, t.bottom ?? 0, t.left ?? 0);
}

/** stroke.thickness がオブジェクトかどうか */
export function hasPartialStroke(stroke: Stroke | undefined): boolean {
  return (
    stroke != null &&
    stroke.thickness != null &&
    typeof stroke.thickness !== 'number'
  );
}

/** 部分ボーダーの各辺の太さを返す */
export function resolvePartialStroke(
  stroke: Stroke | undefined,
): { top: number; right: number; bottom: number; left: number } | null {
  if (!stroke || stroke.thickness == null || typeof stroke.thickness === 'number') return null;
  const t = stroke.thickness;
  return {
    top: t.top ?? 0,
    right: t.right ?? 0,
    bottom: t.bottom ?? 0,
    left: t.left ?? 0,
  };
}

function pickSingle(fill: Fills | undefined): Fill | undefined {
  if (fill == null) return undefined;
  if (Array.isArray(fill)) return fill[0];
  return fill;
}
