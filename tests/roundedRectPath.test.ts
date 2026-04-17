import { describe, expect, it } from 'vitest';
import { roundedRectPath, isCornerRadiusArray } from '../src/pen/renderer/roundedRectPath';

describe('roundedRectPath', () => {
  it('returns empty for non-positive size', () => {
    expect(roundedRectPath(0, 0, 0, 100, 10)).toBe('');
    expect(roundedRectPath(0, 0, 100, 0, 10)).toBe('');
  });

  it('uses a simple M-h-v-h-Z when all radii are 0', () => {
    const d = roundedRectPath(0, 0, 100, 50, 0);
    expect(d).toBe('M0 0 h100 v50 h-100 Z');
  });

  it('treats number radius uniformly (clamped to min(w,h)/2)', () => {
    const d = roundedRectPath(0, 0, 100, 50, 999);
    // min(100, 50) / 2 = 25
    expect(d).toContain('a25 25 0 0 1');
  });

  it('applies per-corner radii from [nw, ne, se, sw]', () => {
    const d = roundedRectPath(0, 0, 100, 100, [10, 20, 30, 40]);
    expect(d).toContain('a10 10 0 0 1');
    expect(d).toContain('a20 20 0 0 1');
    expect(d).toContain('a30 30 0 0 1');
    expect(d).toContain('a40 40 0 0 1');
  });

  it('omits the arc for a corner with radius 0', () => {
    const d = roundedRectPath(0, 0, 100, 100, [0, 20, 0, 40]);
    // "a0 0" はそのまま書かれないように分岐済み
    expect(d).not.toContain('a0 0');
  });
});

describe('isCornerRadiusArray', () => {
  it('detects a 4-number array', () => {
    expect(isCornerRadiusArray([1, 2, 3, 4])).toBe(true);
  });
  it('rejects non-4 length or wrong types', () => {
    expect(isCornerRadiusArray([1, 2, 3])).toBe(false);
    expect(isCornerRadiusArray([1, 2, 3, '4' as unknown as number])).toBe(false);
    expect(isCornerRadiusArray(undefined)).toBe(false);
    expect(isCornerRadiusArray(10)).toBe(false);
  });
});
