/**
 * MVP 向けの最小 paint ヘルパ。
 * - fill/stroke のソリッド色を SVG の属性値に変換するだけ
 * - グラデーション/画像/エフェクトは Step 6 で拡張予定(ここでは未対応)
 */

import type { Fill, Fills, Stroke } from '../types';

export function resolveSolidFill(fill: Fills | undefined): string {
  const single = pickSingle(fill);
  if (!single) return 'none';
  if (typeof single === 'string') return single;
  if (single.type === 'color') return single.color;
  // gradient/image は MVP では未対応 → フォールバックで最初の色か透明
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
  // 辺ごとの指定は MVP では max 値を採用(SVG は均一しかサポートしないため)
  const t = stroke.thickness;
  return Math.max(t.top ?? 0, t.right ?? 0, t.bottom ?? 0, t.left ?? 0);
}

function pickSingle(fill: Fills | undefined): Fill | undefined {
  if (fill == null) return undefined;
  if (Array.isArray(fill)) return fill[0];
  return fill;
}
