/**
 * ブーリアン演算: 選択ノードを polygon 化して polygon-clipping で
 * Union / Subtract / Intersect / Exclude(XOR) 演算を行う。
 * 結果は単一の path ノードに変換される。
 *
 * 制限:
 *   - bezier 曲線は 32 セグメントの多角形で近似
 *   - path ノードは M/L/C/Z の既存パースに依存
 *   - 未対応コマンドを含む path は無視
 */

import polygonClipping from 'polygon-clipping';
import type { PenNode } from '../types';
import { parsePathD, type PathAnchor } from './buildPath';

type Pair = [number, number];
type Ring = Pair[];
type Polygon = Ring[];
type Geom = Polygon[];

export type BoolOp = 'union' | 'subtract' | 'intersect' | 'exclude';

const BEZIER_SEGMENTS = 32;

/** 3 次 bezier を line サンプルに分解 */
function sampleBezier(
  p0: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  p1: { x: number; y: number },
  steps = BEZIER_SEGMENTS,
): Array<Pair> {
  const out: Array<Pair> = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x;
    const y = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y;
    out.push([x, y]);
  }
  return out;
}

/** PathAnchor 配列を、closed 前提で polygon (number[][][]) に変換 */
function anchorsToPolygon(anchors: PathAnchor[]): Pair[] {
  if (anchors.length < 2) return [];
  const ring: Pair[] = [[anchors[0].position.x, anchors[0].position.y]];
  for (let i = 0; i < anchors.length; i++) {
    const from = anchors[i];
    const to = anchors[(i + 1) % anchors.length];
    if (from.outHandle || to.inHandle) {
      const samples = sampleBezier(
        from.position,
        from.outHandle ?? from.position,
        to.inHandle ?? to.position,
        to.position,
      );
      for (const s of samples) ring.push(s);
    } else {
      ring.push([to.position.x, to.position.y]);
    }
  }
  return ring;
}

/** PenNode を polygon (MultiPolygon) に変換。non-polygon は null */
export function nodeToPolygon(node: PenNode): Geom | null {
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  if (node.type === 'rectangle') {
    const w = typeof node.width === 'number' ? node.width : 0;
    const h = typeof node.height === 'number' ? node.height : 0;
    if (w <= 0 || h <= 0) return null;
    return [[[
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ]]];
  }

  if (node.type === 'ellipse') {
    const w = typeof node.width === 'number' ? node.width : 0;
    const h = typeof node.height === 'number' ? node.height : 0;
    if (w <= 0 || h <= 0) return null;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const ring: Pair[] = [];
    const N = 64;
    for (let i = 0; i < N; i++) {
      const t = (2 * Math.PI * i) / N;
      ring.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    ring.push(ring[0]); // 閉じる
    return [[ring]];
  }

  if (node.type === 'path') {
    const geometry = (node as { geometry?: string }).geometry;
    if (!geometry) return null;
    const parsed = parsePathD(geometry);
    if (!parsed || !parsed.closed) return null; // 開 path は boolean 対象外
    // ローカル座標 → ワールド座標
    const worldAnchors = parsed.anchors.map((a) => ({
      position: { x: a.position.x + x, y: a.position.y + y },
      inHandle: a.inHandle ? { x: a.inHandle.x + x, y: a.inHandle.y + y } : undefined,
      outHandle: a.outHandle ? { x: a.outHandle.x + x, y: a.outHandle.y + y } : undefined,
    }));
    const ring = anchorsToPolygon(worldAnchors);
    if (ring.length < 4) return null;
    return [[ring]];
  }

  if (node.type === 'polygon') {
    const w = typeof node.width === 'number' ? node.width : 0;
    const h = typeof node.height === 'number' ? node.height : 0;
    const sides = Math.max(3, (node as { polygonCount?: number }).polygonCount ?? 3);
    if (w <= 0 || h <= 0) return null;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const ring: Pair[] = [];
    for (let i = 0; i < sides; i++) {
      const t = -Math.PI / 2 + (2 * Math.PI * i) / sides;
      ring.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
    }
    ring.push(ring[0]);
    return [[ring]];
  }

  return null;
}

/** MultiPolygon (Geom) を SVG path d 文字列に変換 (すべて M...L...Z) */
export function polygonToPathD(geom: Geom): string {
  const parts: string[] = [];
  for (const poly of geom) {
    for (const ring of poly) {
      if (ring.length === 0) continue;
      parts.push(`M ${ring[0][0]} ${ring[0][1]}`);
      for (let i = 1; i < ring.length; i++) {
        parts.push(`L ${ring[i][0]} ${ring[i][1]}`);
      }
      parts.push('Z');
    }
  }
  return parts.join(' ');
}

/** 複数ノードに対して boolean 演算を実行、成功なら新しい path ノードを返す */
export function booleanOperation(
  nodes: PenNode[],
  op: BoolOp,
): PenNode | null {
  const polys = nodes.map((n) => nodeToPolygon(n)).filter((p): p is Geom => p != null);
  if (polys.length < 2) return null;

  let result: Geom;
  const [first, ...rest] = polys;
  try {
    // polygon-clipping の型は緩いのでキャストで整える
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const f = first as any;
    const r = rest as any[];
    if (op === 'union') result = polygonClipping.union(f, ...r) as Geom;
    else if (op === 'intersect') result = polygonClipping.intersection(f, ...r) as Geom;
    else if (op === 'subtract') result = polygonClipping.difference(f, ...r) as Geom;
    else result = polygonClipping.xor(f, ...r) as Geom;
    /* eslint-enable */
  } catch (e) {
    console.warn('Boolean op failed', e);
    return null;
  }
  if (!result || result.length === 0) return null;

  // 結果を path ノード化
  const dGlobal = polygonToPathD(result);
  // bbox を求めてローカル化
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of result) for (const ring of poly) for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!isFinite(minX)) return null;
  // ローカル座標化した path d を再構築
  const localized = result.map((poly) =>
    poly.map((ring) => ring.map(([x, y]) => [x - minX, y - minY] as Pair)),
  );
  const dLocal = polygonToPathD(localized);

  // fill / stroke は第 1 ノードのものを継承
  const firstNode = nodes[0] as Record<string, unknown>;
  const id = `bool_${op}_${Date.now()}`;
  void dGlobal; // 現在は未使用（将来 verify 用）
  return {
    type: 'path',
    id,
    name: `${op}(${nodes.length})`,
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
    geometry: dLocal,
    fill: firstNode.fill ?? '#E5E7EB',
    stroke: firstNode.stroke,
    fillRule: 'evenodd',
  } as unknown as PenNode;
}
