import { describe, expect, it } from 'vitest';
import { flattenToPath, outlineStroke } from '../src/pen/renderer/flatten';
import type { PenNode } from '../src/pen/types';

function rect(id: string, x: number, y: number, w: number, h: number, extra: Partial<PenNode> = {}): PenNode {
  return { type: 'rectangle', id, x, y, width: w, height: h, ...extra } as PenNode;
}

describe('flattenToPath', () => {
  it('unions two overlapping rects into a single path', () => {
    const r = flattenToPath([rect('a', 0, 0, 20, 20), rect('b', 10, 10, 20, 20)]);
    expect(r).not.toBe(null);
    expect(r!.type).toBe('path');
  });

  it('flattens a frame with children via recursion', () => {
    const f = {
      type: 'frame', id: 'f', x: 0, y: 0, width: 100, height: 100,
      children: [
        rect('a', 0, 0, 20, 20),
        rect('b', 10, 10, 20, 20),
      ],
    } as unknown as PenNode;
    const r = flattenToPath([f]);
    expect(r).not.toBe(null);
    expect(r!.type).toBe('path');
  });

  it('returns null when fewer than 2 polygonal shapes found', () => {
    expect(flattenToPath([rect('a', 0, 0, 10, 10)])).toBe(null);
    expect(flattenToPath([])).toBe(null);
  });
});

describe('outlineStroke', () => {
  it('center align: creates a ring path with proper bbox', () => {
    const r = outlineStroke(rect('a', 10, 10, 100, 100, {
      stroke: { thickness: 4, fill: '#000' },
    } as Partial<PenNode>));
    expect(r).not.toBe(null);
    expect(r!.type).toBe('path');
    // center align → 外側は sw/2 だけ膨らむ
    expect(r!.x).toBe(8);
    expect(r!.y).toBe(8);
    expect((r as { width?: number }).width).toBe(104);
    expect((r as { height?: number }).height).toBe(104);
  });

  it('inside align: stroke 内に収まる', () => {
    const r = outlineStroke(rect('a', 10, 10, 100, 100, {
      stroke: { thickness: 4, fill: '#000', align: 'inside' },
    } as Partial<PenNode>));
    expect(r).not.toBe(null);
    expect(r!.x).toBe(10);
    expect(r!.y).toBe(10);
    expect((r as { width?: number }).width).toBe(100);
  });

  it('outside align: 外側に膨らむ', () => {
    const r = outlineStroke(rect('a', 10, 10, 100, 100, {
      stroke: { thickness: 4, fill: '#000', align: 'outside' },
    } as Partial<PenNode>));
    expect(r).not.toBe(null);
    expect(r!.x).toBe(6);
    expect(r!.y).toBe(6);
    expect((r as { width?: number }).width).toBe(108);
  });

  it('returns null when there is no stroke', () => {
    expect(outlineStroke(rect('a', 0, 0, 10, 10))).toBe(null);
  });

  it('returns null when stroke thickness is 0', () => {
    expect(outlineStroke(rect('a', 0, 0, 10, 10, { stroke: { thickness: 0, fill: '#000' } } as Partial<PenNode>))).toBe(null);
  });

  it('returns null when inner becomes non-positive (thickness too big)', () => {
    const r = outlineStroke(rect('a', 0, 0, 5, 5, { stroke: { thickness: 10, fill: '#000' } } as Partial<PenNode>));
    // center align で inner = 5 - 10 = -5 → null
    expect(r).toBe(null);
  });
});
