/**
 * Selection Colors の集計・置換ロジック (UI 非依存)。
 * SelectionColorsPanel から切り出したもの。テストはこのモジュールを直接叩く。
 */

import type { PenNode } from './types';

export interface ColorUse {
  color: string;
  /** node.id の一覧 */
  nodeIds: string[];
  /** fill / stroke どちらで使われているか */
  kinds: Set<'fill' | 'stroke'>;
}

export function flatten(nodes: PenNode[], out: PenNode[] = []): PenNode[] {
  for (const n of nodes) {
    out.push(n);
    const children = (n as { children?: PenNode[] }).children;
    if (children) flatten(children, out);
  }
  return out;
}

function extractColor(value: unknown): string | null {
  if (typeof value === 'string' && value.startsWith('#')) return value.toUpperCase();
  if (Array.isArray(value)) {
    for (const v of value) {
      const c = extractColor(v);
      if (c) return c;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const f = value as { type?: string; color?: string };
    if (f.type === 'color' && typeof f.color === 'string') return f.color.toUpperCase();
  }
  return null;
}

export function collect(nodes: PenNode[]): Map<string, ColorUse> {
  const map = new Map<string, ColorUse>();
  const add = (color: string, id: string, kind: 'fill' | 'stroke') => {
    const cur = map.get(color);
    if (cur) {
      if (!cur.nodeIds.includes(id)) cur.nodeIds.push(id);
      cur.kinds.add(kind);
    } else {
      map.set(color, { color, nodeIds: [id], kinds: new Set([kind]) });
    }
  };
  for (const n of flatten(nodes)) {
    const fill = (n as { fill?: unknown }).fill;
    if (fill != null) {
      const c = extractColor(fill);
      if (c) add(c, n.id, 'fill');
    }
    const stroke = (n as { stroke?: { fill?: unknown } }).stroke;
    if (stroke?.fill != null) {
      const c = extractColor(stroke.fill);
      if (c) add(c, n.id, 'stroke');
    }
  }
  return map;
}

/**
 * 指定色をもつノードの fill / stroke.fill を新色に置換（再帰）。
 * 純粋にノードツリーのクローンを返す。
 */
export function replaceColor(nodes: PenNode[], oldColor: string, newColor: string): { nodes: PenNode[]; replaced: number } {
  let replaced = 0;
  const upper = oldColor.toUpperCase();
  const walkVal = (v: unknown): unknown => {
    if (typeof v === 'string' && v.toUpperCase() === upper) { replaced++; return newColor; }
    if (Array.isArray(v)) return v.map(walkVal);
    if (v && typeof v === 'object') {
      const o = v as { type?: string; color?: string };
      if (o.type === 'color' && typeof o.color === 'string' && o.color.toUpperCase() === upper) {
        replaced++;
        return { ...o, color: newColor };
      }
    }
    return v;
  };
  const walk = (n: PenNode): PenNode => {
    const copy: Record<string, unknown> = { ...(n as object) };
    if (copy.fill !== undefined) copy.fill = walkVal(copy.fill);
    const stroke = copy.stroke as { fill?: unknown } | undefined;
    if (stroke && typeof stroke === 'object' && stroke.fill !== undefined) {
      copy.stroke = { ...(stroke as object), fill: walkVal(stroke.fill) };
    }
    if ('children' in copy && Array.isArray(copy.children)) {
      copy.children = (copy.children as PenNode[]).map(walk);
    }
    return copy as PenNode;
  };
  return { nodes: nodes.map(walk), replaced };
}
