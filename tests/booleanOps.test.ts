import { describe, expect, it } from 'vitest';
import { nodeToPolygon, booleanOperation, polygonToPathD } from '../src/pen/renderer/booleanOps';
import type { PenNode } from '../src/pen/types';

function rect(id: string, x: number, y: number, w: number, h: number): PenNode {
  return { type: 'rectangle', id, x, y, width: w, height: h } as PenNode;
}

describe('nodeToPolygon', () => {
  it('converts a rectangle to a closed polygon with 5 points', () => {
    const p = nodeToPolygon(rect('r', 0, 0, 10, 10));
    expect(p).not.toBe(null);
    expect(p![0][0].length).toBe(5); // closed ring
    expect(p![0][0][0]).toEqual([0, 0]);
    expect(p![0][0][2]).toEqual([10, 10]);
  });

  it('converts ellipse to a 64+1-sample polygon', () => {
    const p = nodeToPolygon({ type: 'ellipse', id: 'e', x: 0, y: 0, width: 20, height: 20 } as PenNode);
    expect(p).not.toBe(null);
    expect(p![0][0].length).toBe(65);
  });

  it('returns null for unsupported types (group/text)', () => {
    expect(nodeToPolygon({ type: 'group', id: 'g', children: [] } as unknown as PenNode)).toBe(null);
    expect(nodeToPolygon({ type: 'text', id: 't', x: 0, y: 0, width: 10, height: 10 } as PenNode)).toBe(null);
  });

  it('returns null for rectangle with zero size', () => {
    expect(nodeToPolygon(rect('r', 0, 0, 0, 10))).toBe(null);
  });

  it('converts a closed path node to polygon with offset applied', () => {
    const n = {
      type: 'path', id: 'p', x: 100, y: 200,
      width: 10, height: 10,
      geometry: 'M 0 0 L 10 0 L 10 10 L 0 10 Z',
    } as PenNode;
    const p = nodeToPolygon(n);
    expect(p).not.toBe(null);
    // world 座標に offset されているはず
    expect(p![0][0][0]).toEqual([100, 200]);
    expect(p![0][0][2]).toEqual([110, 210]);
  });

  it('returns null for open path (no Z)', () => {
    const n = {
      type: 'path', id: 'p', x: 0, y: 0, width: 10, height: 10,
      geometry: 'M 0 0 L 10 10',
    } as PenNode;
    expect(nodeToPolygon(n)).toBe(null);
  });
});

describe('polygonToPathD', () => {
  it('emits M + L... + Z for each ring', () => {
    const d = polygonToPathD([[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]]);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/L /g) || []).length).toBe(4);
  });
});

describe('booleanOperation', () => {
  it('Union of two overlapping rects produces a single path', () => {
    const a = rect('a', 0, 0, 20, 20);
    const b = rect('b', 10, 10, 20, 20);
    const r = booleanOperation([a, b], 'union');
    expect(r).not.toBe(null);
    expect(r!.type).toBe('path');
    expect((r as PenNode & { geometry?: string }).geometry).toBeTruthy();
  });

  it('Intersect of two overlapping rects gives the overlap bbox', () => {
    const a = rect('a', 0, 0, 20, 20);
    const b = rect('b', 10, 10, 20, 20);
    const r = booleanOperation([a, b], 'intersect');
    expect(r).not.toBe(null);
    // overlap は 10,10 → 20,20 (10x10)
    expect(r!.x).toBe(10);
    expect(r!.y).toBe(10);
    expect((r as { width?: number }).width).toBe(10);
    expect((r as { height?: number }).height).toBe(10);
  });

  it('Subtract a ∩ b から b を引くと左側 L 字になり、bbox は A のまま', () => {
    const a = rect('a', 0, 0, 20, 20);
    const b = rect('b', 10, 10, 20, 20);
    const r = booleanOperation([a, b], 'subtract');
    expect(r).not.toBe(null);
    expect(r!.x).toBe(0);
    expect(r!.y).toBe(0);
    expect((r as { width?: number }).width).toBe(20);
    expect((r as { height?: number }).height).toBe(20);
  });

  it('Exclude (XOR) 2 rects', () => {
    const a = rect('a', 0, 0, 20, 20);
    const b = rect('b', 10, 10, 20, 20);
    const r = booleanOperation([a, b], 'exclude');
    expect(r).not.toBe(null);
  });

  it('returns null if fewer than 2 polygonal nodes', () => {
    expect(booleanOperation([rect('a', 0, 0, 10, 10)], 'union')).toBe(null);
    expect(booleanOperation([], 'union')).toBe(null);
  });

  it('skips non-polygonal nodes silently (< 2 remain)', () => {
    const a = rect('a', 0, 0, 10, 10);
    const g = { type: 'group', id: 'g', children: [] } as unknown as PenNode;
    expect(booleanOperation([a, g], 'union')).toBe(null);
  });
});
