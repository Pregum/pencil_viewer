import { describe, expect, it } from 'vitest';
import { buildPathD, parsePathD, anchorsBBox, type PathAnchor } from '../src/pen/renderer/buildPath';

describe('buildPathD', () => {
  it('returns empty for no anchors', () => {
    expect(buildPathD([])).toBe('');
  });

  it('moves to the first anchor only for a single anchor', () => {
    const d = buildPathD([{ position: { x: 10, y: 20 } }]);
    expect(d).toBe('M 10 20');
  });

  it('emits L for straight segments between anchors without handles', () => {
    const d = buildPathD([
      { position: { x: 0, y: 0 } },
      { position: { x: 10, y: 10 } },
      { position: { x: 20, y: 0 } },
    ]);
    expect(d).toBe('M 0 0 L 10 10 L 20 0');
  });

  it('emits C when the previous anchor has outHandle or current has inHandle', () => {
    const d = buildPathD([
      { position: { x: 0, y: 0 }, outHandle: { x: 5, y: 10 } },
      { position: { x: 20, y: 0 }, inHandle: { x: 15, y: 10 } },
    ]);
    expect(d).toBe('M 0 0 C 5 10 15 10 20 0');
  });

  it('falls back to anchor position when only one side has a handle', () => {
    const d = buildPathD([
      { position: { x: 0, y: 0 }, outHandle: { x: 5, y: 10 } },
      { position: { x: 20, y: 0 } }, // no inHandle
    ]);
    expect(d).toBe('M 0 0 C 5 10 20 0 20 0');
  });

  it('adds Z at the end when closed=true (no explicit close segment for corner-only)', () => {
    const d = buildPathD(
      [
        { position: { x: 0, y: 0 } },
        { position: { x: 10, y: 0 } },
        { position: { x: 10, y: 10 } },
        { position: { x: 0, y: 10 } },
      ],
      true,
    );
    // Z だけで自動的に first まで直線クロージングされるので L は不要
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
  });

  it('emits explicit bezier closing segment when first has inHandle', () => {
    const d = buildPathD(
      [
        { position: { x: 0, y: 0 }, inHandle: { x: -5, y: -5 } },
        { position: { x: 10, y: 0 } },
      ],
      true,
    );
    expect(d).toContain('C ');
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('parsePathD', () => {
  it('returns null for empty or invalid input', () => {
    expect(parsePathD('')).toBe(null);
    expect(parsePathD('foo')).toBe(null);
    expect(parsePathD('M 10')).toBe(null); // 引数不足
  });

  it('parses M + L commands', () => {
    const r = parsePathD('M 0 0 L 10 10 L 20 0');
    expect(r).not.toBe(null);
    expect(r!.closed).toBe(false);
    expect(r!.anchors.length).toBe(3);
    expect(r!.anchors[1].position).toEqual({ x: 10, y: 10 });
  });

  it('parses M + C + Z', () => {
    const r = parsePathD('M 0 0 C 5 10 15 10 20 0 Z');
    expect(r).not.toBe(null);
    expect(r!.closed).toBe(true);
    expect(r!.anchors.length).toBe(2);
    expect(r!.anchors[0].outHandle).toEqual({ x: 5, y: 10 });
    expect(r!.anchors[1].inHandle).toEqual({ x: 15, y: 10 });
    expect(r!.anchors[1].position).toEqual({ x: 20, y: 0 });
  });

  it('returns null for unsupported commands', () => {
    expect(parsePathD('M 0 0 H 10')).toBe(null); // horizontal line 未対応
    expect(parsePathD('M 0 0 A 5 5 0 0 1 10 10')).toBe(null); // arc 未対応
  });

  it('round-trips via buildPathD', () => {
    const original: PathAnchor[] = [
      { position: { x: 0, y: 0 }, outHandle: { x: 5, y: 10 } },
      { position: { x: 20, y: 0 }, inHandle: { x: 15, y: 10 } },
      { position: { x: 40, y: 20 } },
    ];
    const d = buildPathD(original, true);
    const parsed = parsePathD(d);
    expect(parsed).not.toBe(null);
    expect(parsed!.closed).toBe(true);
    expect(parsed!.anchors.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(parsed!.anchors[i].position).toEqual(original[i].position);
    }
  });
});

describe('parsePathD (edge cases)', () => {
  it('parses negative and decimal coords', () => {
    const r = parsePathD('M -1.5 -2 L 3.25 4.5');
    expect(r).not.toBe(null);
    expect(r!.anchors[0].position).toEqual({ x: -1.5, y: -2 });
    expect(r!.anchors[1].position).toEqual({ x: 3.25, y: 4.5 });
  });

  it('accepts lowercase commands as uppercase (after normalization)', () => {
    const r = parsePathD('m 0 0 l 10 0');
    // 現実装は toUpperCase 済み。絶対座標として解釈される (相対サポートしない)
    expect(r).not.toBe(null);
    expect(r!.anchors[1].position).toEqual({ x: 10, y: 0 });
  });

  it('returns null if C has < 6 numbers', () => {
    expect(parsePathD('M 0 0 C 1 2 3')).toBe(null);
  });

  it('Z without preceding anchors returns null', () => {
    expect(parsePathD('Z')).toBe(null);
  });
});

describe('anchorsBBox', () => {
  it('includes positions and handles', () => {
    const anchors: PathAnchor[] = [
      { position: { x: 0, y: 0 }, outHandle: { x: -5, y: -3 } },
      { position: { x: 10, y: 20 }, inHandle: { x: 15, y: 25 } },
    ];
    const b = anchorsBBox(anchors);
    expect(b.x).toBe(-5);
    expect(b.y).toBe(-3);
    expect(b.width).toBe(20);
    expect(b.height).toBe(28);
  });
  it('returns zero size for empty input', () => {
    expect(anchorsBBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
