/**
 * ドキュメント全体のバウンディングボックスから SVG の viewBox を算出する。
 *
 * MVP: トップレベルノードの x/y/width/height を見て合成。
 * 後続: frame の子も再帰的に辿る / layout 計算後の LaidOutNode を使う。
 */

import type { PenDocument, PenNode } from '../types';

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_VIEW_BOX: ViewBox = { x: 0, y: 0, width: 800, height: 600 };
const MARGIN = 40;

export function computeViewBox(doc: PenDocument): ViewBox {
  if (doc.children.length === 0) return DEFAULT_VIEW_BOX;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of doc.children) {
    const bounds = nodeBounds(child);
    if (!bounds) continue;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    maxY = Math.max(maxY, bounds.y + bounds.h);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return DEFAULT_VIEW_BOX;

  return {
    x: minX - MARGIN,
    y: minY - MARGIN,
    width: maxX - minX + MARGIN * 2,
    height: maxY - minY + MARGIN * 2,
  };
}

function nodeBounds(node: PenNode): { x: number; y: number; w: number; h: number } | null {
  const x = typeof (node as { x?: number }).x === 'number' ? (node as { x: number }).x : 0;
  const y = typeof (node as { y?: number }).y === 'number' ? (node as { y: number }).y : 0;
  const rawW = (node as { width?: number | string }).width;
  const rawH = (node as { height?: number | string }).height;
  const w = typeof rawW === 'number' ? rawW : 0;
  const h = typeof rawH === 'number' ? rawH : 0;
  if (w === 0 && h === 0) return null;
  return { x, y, w, h };
}
