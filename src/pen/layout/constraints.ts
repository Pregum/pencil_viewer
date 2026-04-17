/**
 * Frame Constraints の適用ロジック。
 *
 * 親 frame (layout: 'none') のサイズが oldW × oldH → newW × newH に変化したとき、
 * 子ノードの x, y, width, height を constraints に従って再計算する。
 *
 * 子の座標は親の座標系（親 frame の (0,0) が親の左上）。
 */

import type { NodeConstraints } from '../types';

export interface ChildGeom {
  x: number;
  y: number;
  width: number;
  height: number;
  constraints?: NodeConstraints;
}

export function applyHorizontal(
  c: ChildGeom,
  oldW: number,
  newW: number,
): { x: number; width: number } {
  const horiz = c.constraints?.horizontal ?? 'left';
  const childRight = oldW - (c.x + c.width);
  switch (horiz) {
    case 'left':
      return { x: c.x, width: c.width };
    case 'right':
      return { x: newW - childRight - c.width, width: c.width };
    case 'center': {
      const oldCenter = c.x + c.width / 2;
      const offset = oldCenter - oldW / 2;
      return { x: newW / 2 + offset - c.width / 2, width: c.width };
    }
    case 'stretch':
      return { x: c.x, width: Math.max(1, newW - c.x - childRight) };
    case 'scale': {
      const ratio = newW / Math.max(oldW, 1);
      return { x: c.x * ratio, width: c.width * ratio };
    }
  }
}

export function applyVertical(
  c: ChildGeom,
  oldH: number,
  newH: number,
): { y: number; height: number } {
  const vert = c.constraints?.vertical ?? 'top';
  const childBottom = oldH - (c.y + c.height);
  switch (vert) {
    case 'top':
      return { y: c.y, height: c.height };
    case 'bottom':
      return { y: newH - childBottom - c.height, height: c.height };
    case 'center': {
      const oldCenter = c.y + c.height / 2;
      const offset = oldCenter - oldH / 2;
      return { y: newH / 2 + offset - c.height / 2, height: c.height };
    }
    case 'stretch':
      return { y: c.y, height: Math.max(1, newH - c.y - childBottom) };
    case 'scale': {
      const ratio = newH / Math.max(oldH, 1);
      return { y: c.y * ratio, height: c.height * ratio };
    }
  }
}

export function applyConstraints(
  c: ChildGeom,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
): { x: number; y: number; width: number; height: number } {
  const h = applyHorizontal(c, oldW, newW);
  const v = applyVertical(c, oldH, newH);
  return { x: h.x, y: v.y, width: h.width, height: v.height };
}
