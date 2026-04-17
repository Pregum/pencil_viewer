import { describe, expect, it } from 'vitest';
import { buildPathD, anchorsBBox, type PathAnchor } from '../src/pen/renderer/buildPath';

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

  it('adds Z and closes when closed=true', () => {
    const d = buildPathD(
      [
        { position: { x: 0, y: 0 } },
        { position: { x: 10, y: 0 } },
        { position: { x: 10, y: 10 } },
        { position: { x: 0, y: 10 } },
      ],
      true,
    );
    expect(d.endsWith('L 0 0 Z')).toBe(true);
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
