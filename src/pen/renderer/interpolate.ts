/**
 * Smart Animate 用の補間ヘルパ。
 *
 * - lerp(a, b, t): 数値線形補間
 * - interpolateColor(from, to, t): #RRGGBB の色を RGB 空間で補間
 * - ease(t, kind): イージング関数
 * - interpolateNode(from, to, t): 2 つの node を t ∈ [0,1] で補間した "仮想" node を返す
 *   - 数値系: x, y, width, height, opacity, rotation, cornerRadius(number),
 *     fontSize, letterSpacing, lineHeight
 *   - color: fill の先頭色、stroke.fill の先頭色
 *   - その他は from を優先
 */

import type { PenNode } from '../types';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function ease(t: number, kind: 'linear' | 'ease-out' | 'ease-in' | 'ease-in-out' = 'ease-out'): number {
  const x = Math.max(0, Math.min(1, t));
  switch (kind) {
    case 'linear': return x;
    case 'ease-in': return x * x;
    case 'ease-out': return 1 - Math.pow(1 - x, 2);
    case 'ease-in-out': return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function interpolateColor(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return t < 0.5 ? from : to;
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`.toUpperCase();
}

function firstColor(fill: unknown): string | null {
  if (typeof fill === 'string') return fill;
  if (Array.isArray(fill)) return firstColor(fill[0]);
  if (fill && typeof fill === 'object') {
    const f = fill as { type?: string; color?: string };
    if (f.type === 'color' && typeof f.color === 'string') return f.color;
  }
  return null;
}

/** 2 つのノードを t で補間した仮想ノードを返す（元のノードは mutate しない） */
export function interpolateNode(from: PenNode, to: PenNode, t: number): PenNode {
  const result: Record<string, unknown> = { ...(from as object) };
  const fromAny = from as Record<string, unknown>;
  const toAny = to as Record<string, unknown>;

  // 数値補間対象
  const numericKeys = [
    'x', 'y', 'width', 'height', 'opacity', 'rotation',
    'fontSize', 'letterSpacing', 'lineHeight', 'cornerRadius',
  ];
  for (const k of numericKeys) {
    const a = fromAny[k];
    const b = toAny[k];
    if (typeof a === 'number' && typeof b === 'number') {
      result[k] = lerp(a, b, t);
    } else if (typeof b === 'number' && a === undefined) {
      result[k] = b; // from に無ければ to のまま
    }
  }

  // fill の色補間（シンプルケース: 両方とも単色の場合のみ）
  const fromColor = firstColor(fromAny.fill);
  const toColor = firstColor(toAny.fill);
  if (fromColor && toColor && fromColor !== toColor) {
    result.fill = interpolateColor(fromColor, toColor, t);
  }

  // stroke.fill の色補間
  const fromStroke = fromAny.stroke as { fill?: unknown } | undefined;
  const toStroke = toAny.stroke as { fill?: unknown } | undefined;
  if (fromStroke && toStroke) {
    const a = firstColor(fromStroke.fill);
    const b = firstColor(toStroke.fill);
    if (a && b && a !== b) {
      result.stroke = { ...(fromStroke as object), fill: interpolateColor(a, b, t) };
    }
  }

  return result as unknown as PenNode;
}
