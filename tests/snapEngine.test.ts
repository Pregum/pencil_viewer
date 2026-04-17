import { describe, expect, it } from 'vitest';
import { computeSnap, computeResizeSnap, type SnapRect } from '../src/pen/state/snapEngine';

const ref: SnapRect = { id: 'r', x: 100, y: 100, width: 100, height: 100 };

describe('computeSnap', () => {
  it('snaps left edge when within threshold', () => {
    const moving: SnapRect = { id: 'm', x: 103, y: 400, width: 50, height: 50 };
    const result = computeSnap(moving, [ref], 6);
    expect(result.x).toBe(100);
    expect(result.guides.some((g) => g.orientation === 'v' && g.pos === 100)).toBe(true);
  });

  it('snaps right edge of moving to right edge of static', () => {
    const moving: SnapRect = { id: 'm', x: 150, y: 400, width: 48, height: 48 };
    // moving.right = 198, static.right = 200, diff = 2 → within threshold → snap
    const result = computeSnap(moving, [ref], 6);
    // moving.x becomes 200 - 48 = 152
    expect(result.x).toBe(152);
  });

  it('snaps center horizontally', () => {
    const moving: SnapRect = { id: 'm', x: 124, y: 400, width: 50, height: 50 };
    // moving center = 149, static center = 150 → diff 1
    const result = computeSnap(moving, [ref], 6);
    // moving.x becomes 150 - 25 = 125
    expect(result.x).toBe(125);
  });

  it('does not snap when beyond threshold', () => {
    const moving: SnapRect = { id: 'm', x: 110, y: 400, width: 50, height: 50 };
    const result = computeSnap(moving, [ref], 3);
    expect(result.x).toBe(110);
    expect(result.guides.length).toBe(0);
  });

  it('snaps both axes independently', () => {
    const moving: SnapRect = { id: 'm', x: 103, y: 202, width: 50, height: 50 };
    // x: snap left to 100, y: snap top to moving y=200 (bottom of ref = 200 -> moving top should snap to 200)
    const result = computeSnap(moving, [ref], 6);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    const orientations = new Set(result.guides.map((g) => g.orientation));
    expect(orientations.has('v')).toBe(true);
    expect(orientations.has('h')).toBe(true);
  });

  it('ignores self by id', () => {
    const moving: SnapRect = { id: 'r', x: 103, y: 100, width: 50, height: 50 };
    const result = computeSnap(moving, [ref], 6);
    expect(result.x).toBe(103);
    expect(result.y).toBe(100);
  });
});

describe('computeResizeSnap', () => {
  it('snaps the right edge (handle="e") to static left', () => {
    // ref: [100..200] x, moving right edge at 97 → snap to 100 → width += 3
    const moving: SnapRect = { id: 'm', x: 10, y: 400, width: 87, height: 50 };
    const result = computeResizeSnap(moving, [ref], 'e', 6);
    expect(result.width).toBe(90);
    expect(result.x).toBe(10);
    expect(result.guides.some((g) => g.orientation === 'v' && g.pos === 100)).toBe(true);
  });

  it('does not touch x when resizing east', () => {
    const moving: SnapRect = { id: 'm', x: 50, y: 400, width: 150, height: 50 };
    const result = computeResizeSnap(moving, [ref], 'e', 6);
    expect(result.x).toBe(50);
  });

  it('snaps the left edge (handle="w") shifting x and width', () => {
    // moving starts at x=203 w=50, left edge 203 near 200 (ref right) with threshold 6
    const moving: SnapRect = { id: 'm', x: 203, y: 400, width: 50, height: 50 };
    const result = computeResizeSnap(moving, [ref], 'w', 6);
    expect(result.x).toBe(200);
    expect(result.width).toBe(53);
  });

  it('snaps the south edge (handle="s")', () => {
    const moving: SnapRect = { id: 'm', x: 400, y: 150, width: 50, height: 47 };
    // moving bottom=197, ref bottom=200 → snap
    const result = computeResizeSnap(moving, [ref], 's', 6);
    expect(result.height).toBe(50);
  });

  it('snaps both axes at corner handle "se"', () => {
    const moving: SnapRect = { id: 'm', x: 50, y: 50, width: 47, height: 47 };
    const result = computeResizeSnap(moving, [ref], 'se', 6);
    // right edge 97 → 100, bottom 97 → 100
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
  });

  it('clamps min 1 on width/height when snap would invert', () => {
    const moving: SnapRect = { id: 'm', x: 0, y: 0, width: 2, height: 2 };
    const result = computeResizeSnap(moving, [ref], 'w', 6);
    expect(result.width).toBeGreaterThanOrEqual(1);
  });
});
