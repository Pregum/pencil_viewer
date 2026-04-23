import { describe, expect, it } from 'vitest';
import { detectTidyMode, tidyUp, type TidyItem } from '../src/utils/tidyUp';

const mk = (id: string, x: number, y: number, w = 100, h = 100): TidyItem => ({
  id,
  x,
  y,
  width: w,
  height: h,
});

describe('detectTidyMode', () => {
  it('detects row when horizontal spread dominates', () => {
    const items = [mk('a', 0, 0), mk('b', 200, 0), mk('c', 400, 10)];
    expect(detectTidyMode(items)).toBe('row');
  });

  it('detects column when vertical spread dominates', () => {
    const items = [mk('a', 0, 0), mk('b', 10, 200), mk('c', 5, 400)];
    expect(detectTidyMode(items)).toBe('column');
  });

  it('detects grid when spread is balanced', () => {
    const items = [
      mk('a', 0, 0),
      mk('b', 200, 0),
      mk('c', 0, 200),
      mk('d', 200, 200),
    ];
    expect(detectTidyMode(items)).toBe('grid');
  });
});

describe('tidyUp', () => {
  it('no-ops when fewer than 2 items', () => {
    expect(tidyUp([])).toEqual([]);
    expect(tidyUp([mk('a', 5, 5)])).toEqual([{ id: 'a', x: 5, y: 5 }]);
  });

  it('lays out a row with uniform gap, sorted by x', () => {
    const items = [mk('b', 300, 50), mk('a', 0, 40), mk('c', 150, 60)];
    const res = tidyUp(items, { mode: 'row', gap: 20 });
    expect(res.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(res[0]).toEqual({ id: 'a', x: 0, y: 40 });
    expect(res[1]).toEqual({ id: 'c', x: 120, y: 40 });
    expect(res[2]).toEqual({ id: 'b', x: 240, y: 40 });
  });

  it('lays out a column with uniform gap, sorted by y', () => {
    const items = [mk('b', 50, 300), mk('a', 40, 0), mk('c', 60, 150)];
    const res = tidyUp(items, { mode: 'column', gap: 10 });
    expect(res.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(res[0]).toEqual({ id: 'a', x: 40, y: 0 });
    expect(res[1]).toEqual({ id: 'c', x: 40, y: 110 });
    expect(res[2]).toEqual({ id: 'b', x: 40, y: 220 });
  });

  it('grid mode snaps to square-ish rows using sqrt(n)', () => {
    const items = [
      mk('a', 5, 5),
      mk('b', 300, 5),
      mk('c', 5, 300),
      mk('d', 300, 300),
    ];
    const res = tidyUp(items, { mode: 'grid', gap: 10 });
    expect(res).toHaveLength(4);
    const ys = new Set(res.map((r) => r.y));
    const xs = new Set(res.map((r) => r.x));
    expect(ys.size).toBe(2);
    expect(xs.size).toBe(2);
  });

  it('auto mode picks row for wide layouts', () => {
    const items = [mk('a', 0, 0), mk('b', 200, 5), mk('c', 400, 0)];
    const res = tidyUp(items, { mode: 'auto', gap: 10 });
    const yVals = new Set(res.map((r) => r.y));
    expect(yVals.size).toBe(1);
  });

  it('preserves ids (no loss)', () => {
    const items = [mk('a', 0, 0), mk('b', 200, 0), mk('c', 400, 0)];
    const res = tidyUp(items, { mode: 'row' });
    expect(new Set(res.map((r) => r.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('uses default gap of 16', () => {
    const items = [mk('a', 0, 0, 50, 50), mk('b', 200, 0, 50, 50)];
    const res = tidyUp(items, { mode: 'row' });
    expect(res[1].x).toBe(50 + 16);
  });
});
