/**
 * Flatten / Outline stroke 変換ロジック。
 *
 * - flattenToPath(nodes): 複数ノードを Union boolean で 1 つの path に統合
 * - outlineStroke(node): rectangle / ellipse の stroke を 2 つの閉形状の
 *   差分で path 化 (polygon-clipping 経由)
 */

import type { PenNode } from '../types';
import { nodeToPolygon, booleanOperation } from './booleanOps';

/** children を含めて全部 flat に取得 */
function flattenNodeList(nodes: PenNode[]): PenNode[] {
  const out: PenNode[] = [];
  for (const n of nodes) {
    out.push(n);
    const children = (n as { children?: PenNode[] }).children;
    if (children) out.push(...flattenNodeList(children));
  }
  return out;
}

/**
 * 指定ノード群（とその子孫）を Union して単一 path に統合。
 * Boolean 不可のノードは除外。1 つしかない場合は union の意味が無いため null。
 */
export function flattenToPath(nodes: PenNode[]): PenNode | null {
  const all = flattenNodeList(nodes).filter((n) => nodeToPolygon(n) != null);
  if (all.length < 2) return null;
  return booleanOperation(all, 'union');
}

/**
 * stroke を path 化する。rectangle / ellipse / polygon で対応。
 * アプローチ: 外側形状と内側形状を polygon 化し、差分 (difference) を取る。
 */
export function outlineStroke(node: PenNode): PenNode | null {
  const stroke = (node as { stroke?: { thickness?: unknown; fill?: unknown; align?: string } }).stroke;
  if (!stroke || stroke.thickness == null) return null;
  const thickness = typeof stroke.thickness === 'number'
    ? stroke.thickness
    : Math.max(
      (stroke.thickness as { top?: number }).top ?? 0,
      (stroke.thickness as { right?: number }).right ?? 0,
      (stroke.thickness as { bottom?: number }).bottom ?? 0,
      (stroke.thickness as { left?: number }).left ?? 0,
    );
  if (thickness <= 0) return null;
  const align = (stroke.align as 'inside' | 'center' | 'outside' | undefined) ?? 'center';
  const sw2 = thickness / 2;

  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const w = typeof (node as { width?: unknown }).width === 'number' ? (node as { width: number }).width : 0;
  const h = typeof (node as { height?: unknown }).height === 'number' ? (node as { height: number }).height : 0;
  if (w <= 0 || h <= 0) return null;

  // outer / inner の shape 定義を作る（同じ type、違うサイズ）
  const makeNode = (nx: number, ny: number, nw: number, nh: number): PenNode => ({
    ...(node as object),
    x: nx,
    y: ny,
    width: nw,
    height: nh,
  } as PenNode);

  let outer: PenNode, inner: PenNode;
  if (align === 'inside') {
    outer = makeNode(x, y, w, h);
    inner = makeNode(x + thickness, y + thickness, w - thickness * 2, h - thickness * 2);
  } else if (align === 'outside') {
    outer = makeNode(x - thickness, y - thickness, w + thickness * 2, h + thickness * 2);
    inner = makeNode(x, y, w, h);
  } else {
    outer = makeNode(x - sw2, y - sw2, w + thickness, h + thickness);
    inner = makeNode(x + sw2, y + sw2, w - thickness, h - thickness);
  }

  const innerW = typeof (inner as { width?: unknown }).width === 'number' ? (inner as { width: number }).width : 0;
  const innerH = typeof (inner as { height?: unknown }).height === 'number' ? (inner as { height: number }).height : 0;
  if (innerW <= 0 || innerH <= 0) return null;

  // stroke 色を fill に持たせた path ノードに（ booleanOperation の第 1 要素から継承する）
  const result = booleanOperation([outer, inner], 'subtract');
  if (!result) return null;
  const fillFromStroke = (stroke.fill as unknown) ?? '#111827';
  return {
    ...(result as Record<string, unknown>),
    fill: fillFromStroke,
    name: `outline(${node.name ?? node.id})`,
    stroke: undefined,
  } as PenNode;
}
