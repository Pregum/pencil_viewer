/**
 * fill / stroke を SVG 属性値に変換する resolver。
 * PaintRegistry が提供されていれば、gradient / image は `url(#id)` 参照に
 * 置き換える。レジストリがない場合はソリッド色にフォールバック。
 */

import type { Fill, Fills, Stroke, BlendMode } from '../types';
import type { PaintRegistry } from '../paint/registry';

/**
 * Pencil の blend mode 名 → CSS mix-blend-mode 値にマップ。
 * LinearBurn / LinearDodge / Light は直接の対応が無いため近似値。
 */
export function blendModeToCss(mode: BlendMode | undefined): string | undefined {
  if (!mode || mode === 'normal') return undefined;
  switch (mode) {
    case 'darken': return 'darken';
    case 'multiply': return 'multiply';
    case 'linear_burn': return 'color-burn';
    case 'color_burn': return 'color-burn';
    case 'light': return 'hard-light';
    case 'screen': return 'screen';
    case 'linear_dodge': return 'color-dodge';
    case 'color_dodge': return 'color-dodge';
    case 'overlay': return 'overlay';
    case 'soft_light': return 'soft-light';
    case 'hard_light': return 'hard-light';
    case 'difference': return 'difference';
    case 'exclusion': return 'exclusion';
    case 'hue': return 'hue';
    case 'saturation': return 'saturation';
    case 'color': return 'color';
    case 'luminosity': return 'luminosity';
    default: return undefined;
  }
}

export interface PaintContext {
  nodeId: string;
  registry?: PaintRegistry;
}

export function resolveFill(fill: Fills | undefined, ctx: PaintContext): string {
  // 単一 fill の後方互換: 配列最初の paint ref があればそれ、無ければ solid fallback。
  const entries = ctx.registry?.fillMap.get(ctx.nodeId);
  const firstRef = entries?.find((e) => e != null);
  if (firstRef) return `url(#${firstRef})`;
  return resolveSolidFill(fill);
}

/**
 * 複数 fill を配列順に返す（pencil.dev 仕様: composite in order）。
 * 各 entry は SVG ready な fill 値（hex / url(#id)）。
 * fill opacity も同時に返す（OK: Fill.opacity / SolidFill.opacity）。
 */
export function resolveFillLayers(
  fill: Fills | undefined,
  ctx: PaintContext,
): Array<{ paint: string; opacity: number; blendMode?: string }> {
  if (fill == null) return [];
  const list: Fill[] = Array.isArray(fill) ? fill : [fill];
  const entries = ctx.registry?.fillMap.get(ctx.nodeId);
  const out: Array<{ paint: string; opacity: number; blendMode?: string }> = [];
  list.forEach((f, i) => {
    const refId = entries?.[i] ?? null;
    const opacity = (f && typeof f === 'object' && 'opacity' in f && typeof f.opacity === 'number') ? (f.opacity as number) : 1;
    const enabled = (f && typeof f === 'object' && 'enabled' in f ? (f as { enabled?: boolean }).enabled : undefined);
    if (enabled === false) return;
    const bm = (f && typeof f === 'object' && 'blendMode' in f)
      ? blendModeToCss((f as { blendMode?: BlendMode }).blendMode)
      : undefined;
    if (refId) {
      out.push({ paint: `url(#${refId})`, opacity, blendMode: bm });
    } else if (typeof f === 'string') {
      out.push({ paint: f, opacity });
    } else if (f && typeof f === 'object' && f.type === 'color') {
      out.push({ paint: f.color, opacity, blendMode: bm });
    }
  });
  return out;
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

/**
 * Pencil の stroke → SVG <rect> 等に渡す追加属性
 *  - cap: none / round / square → SVG stroke-linecap
 *  - join: miter / bevel / round → SVG stroke-linejoin
 *  - dashPattern: number[] → SVG stroke-dasharray (文字列)
 */
export interface StrokeAttrs {
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'bevel' | 'round';
  strokeDasharray?: string;
}

export function resolveStrokeAttrs(stroke: Stroke | undefined): StrokeAttrs {
  if (!stroke) return {};
  const out: StrokeAttrs = {};
  if (stroke.cap) {
    // Pencil: 'none' → SVG 'butt' (デフォルト)、その他はそのまま
    out.strokeLinecap = stroke.cap === 'none' ? 'butt' : stroke.cap;
  }
  if (stroke.join) {
    out.strokeLinejoin = stroke.join;
  }
  if (Array.isArray(stroke.dashPattern) && stroke.dashPattern.length > 0) {
    out.strokeDasharray = stroke.dashPattern.join(' ');
  }
  return out;
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
