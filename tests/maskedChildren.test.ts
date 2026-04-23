import { describe, expect, it } from 'vitest';
import { splitByMasks } from '../src/pen/renderer/MaskedChildren';
import type { PenNode } from '../src/pen/types';

function rect(id: string, mask?: boolean): PenNode {
  return { type: 'rectangle', id, x: 0, y: 0, width: 10, height: 10, ...(mask ? { mask: true } : {}) } as PenNode;
}

describe('splitByMasks', () => {
  it('returns a single segment when no mask is present', () => {
    const seg = splitByMasks([rect('a'), rect('b')]);
    expect(seg.length).toBe(1);
    expect(seg[0].maskNode).toBeUndefined();
    expect(seg[0].children.length).toBe(2);
  });

  it('empty children → empty segments', () => {
    expect(splitByMasks([])).toEqual([]);
  });

  it('groups following siblings under a mask node', () => {
    const m = rect('m', true);
    const seg = splitByMasks([rect('a'), m, rect('b'), rect('c')]);
    expect(seg.length).toBe(2);
    expect(seg[0].maskNode).toBeUndefined();
    expect(seg[0].children.map((c) => c.id)).toEqual(['a']);
    expect(seg[1].maskNode?.id).toBe('m');
    expect(seg[1].children.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('multiple masks create independent segments', () => {
    const seg = splitByMasks([
      rect('a'),
      rect('m1', true), rect('x1'),
      rect('m2', true), rect('x2'), rect('x3'),
    ]);
    expect(seg.length).toBe(3);
    expect(seg[1].maskNode?.id).toBe('m1');
    expect(seg[1].children.map((c) => c.id)).toEqual(['x1']);
    expect(seg[2].maskNode?.id).toBe('m2');
    expect(seg[2].children.map((c) => c.id)).toEqual(['x2', 'x3']);
  });

  it('mask at the start with no leading non-mask → single masked segment', () => {
    const seg = splitByMasks([rect('m', true), rect('a')]);
    expect(seg.length).toBe(1);
    expect(seg[0].maskNode?.id).toBe('m');
    expect(seg[0].children.map((c) => c.id)).toEqual(['a']);
  });

  it('trailing mask with no following siblings is kept as empty-children segment', () => {
    const seg = splitByMasks([rect('a'), rect('m', true)]);
    expect(seg.length).toBe(2);
    expect(seg[1].maskNode?.id).toBe('m');
    expect(seg[1].children.length).toBe(0);
  });
});
