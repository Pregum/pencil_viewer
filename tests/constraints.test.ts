import { describe, it, expect } from 'vitest';
import { applyConstraints, type ChildGeom } from '../src/pen/layout/constraints';

// 親 200x200 が 400x300 にリサイズされるケース
const OLD_W = 200;
const OLD_H = 200;
const NEW_W = 400;
const NEW_H = 300;

describe('applyConstraints', () => {
  it('defaults to left+top (no constraints)', () => {
    const c: ChildGeom = { x: 20, y: 30, width: 50, height: 50 };
    const r = applyConstraints(c, OLD_W, OLD_H, NEW_W, NEW_H);
    expect(r.x).toBe(20);
    expect(r.y).toBe(30);
    expect(r.width).toBe(50);
    expect(r.height).toBe(50);
  });

  it('right: keeps distance from right edge', () => {
    // 元は右端から 20px のところ (x=130 + w=50 → right at 180, old_w=200, gap=20)
    const c: ChildGeom = { x: 130, y: 0, width: 50, height: 50, constraints: { horizontal: 'right' } };
    const r = applyConstraints(c, OLD_W, OLD_H, NEW_W, NEW_H);
    // new_w=400, gap=20 → x = 400 - 20 - 50 = 330
    expect(r.x).toBe(330);
    expect(r.width).toBe(50);
  });

  it('center: maintains center offset', () => {
    const c: ChildGeom = { x: 75, y: 0, width: 50, height: 50, constraints: { horizontal: 'center' } };
    // center=100 = old center, offset=0 → new center=200, x=200-25=175
    const r = applyConstraints(c, OLD_W, OLD_H, NEW_W, NEW_H);
    expect(r.x).toBe(175);
  });

  it('stretch: fills space keeping left+right padding', () => {
    // x=20, w=160, right edge at 180, right gap=20
    const c: ChildGeom = { x: 20, y: 0, width: 160, height: 50, constraints: { horizontal: 'stretch' } };
    const r = applyConstraints(c, OLD_W, OLD_H, NEW_W, NEW_H);
    expect(r.x).toBe(20);
    // new width = 400 - 20 - 20 = 360
    expect(r.width).toBe(360);
  });

  it('scale: ratio-based', () => {
    const c: ChildGeom = { x: 20, y: 0, width: 100, height: 50, constraints: { horizontal: 'scale' } };
    const r = applyConstraints(c, OLD_W, OLD_H, NEW_W, NEW_H);
    // ratio 400/200 = 2
    expect(r.x).toBe(40);
    expect(r.width).toBe(200);
  });

  it('vertical top (default) + horizontal right combo', () => {
    const c: ChildGeom = {
      x: 130, y: 40, width: 50, height: 60,
      constraints: { horizontal: 'right' },
    };
    const r = applyConstraints(c, OLD_W, OLD_H, NEW_W, NEW_H);
    expect(r.x).toBe(330);
    expect(r.y).toBe(40);
    expect(r.width).toBe(50);
    expect(r.height).toBe(60);
  });

  it('vertical stretch keeps top/bottom padding', () => {
    const c: ChildGeom = {
      x: 0, y: 20, width: 50, height: 160,
      constraints: { vertical: 'stretch' },
    };
    const r = applyConstraints(c, OLD_W, OLD_H, NEW_W, NEW_H);
    // bottom gap = 200 - 180 = 20, new height = 300 - 20 - 20 = 260
    expect(r.y).toBe(20);
    expect(r.height).toBe(260);
  });

  it('clamps stretch min to 1', () => {
    const c: ChildGeom = {
      x: 0, y: 0, width: 200, height: 200,
      constraints: { horizontal: 'stretch' },
    };
    const r = applyConstraints(c, 200, 200, 10, 10);
    expect(r.width).toBeGreaterThanOrEqual(1);
  });
});
