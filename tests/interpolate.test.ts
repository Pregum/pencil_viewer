import { describe, expect, it } from 'vitest';
import { lerp, ease, interpolateColor, interpolateNode } from '../src/pen/renderer/interpolate';
import type { PenNode } from '../src/pen/types';

describe('lerp', () => {
  it('interpolates at endpoints and midpoint', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('ease', () => {
  it('returns 0 and 1 at endpoints for all kinds', () => {
    const kinds = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;
    for (const k of kinds) {
      expect(ease(0, k)).toBe(0);
      expect(ease(1, k)).toBe(1);
    }
  });
  it('clamps outside [0,1]', () => {
    expect(ease(-0.5, 'linear')).toBe(0);
    expect(ease(1.5, 'linear')).toBe(1);
  });
});

describe('interpolateColor', () => {
  it('blends red and blue at midpoint', () => {
    const mid = interpolateColor('#FF0000', '#0000FF', 0.5);
    expect(mid).toBe('#800080');
  });
  it('returns from at t=0 and to at t=1 (case-normalized)', () => {
    expect(interpolateColor('#FF0000', '#0000FF', 0).toUpperCase()).toBe('#FF0000');
    expect(interpolateColor('#FF0000', '#0000FF', 1).toUpperCase()).toBe('#0000FF');
  });
  it('falls back cleanly on invalid input', () => {
    expect(interpolateColor('foo', '#000000', 0.5)).toBe('#000000');
  });
});

describe('interpolateNode', () => {
  it('lerps numeric props', () => {
    const a: PenNode = { type: 'rectangle', id: 'a', x: 0, y: 0, width: 100, height: 100 } as PenNode;
    const b: PenNode = { type: 'rectangle', id: 'a', x: 100, y: 50, width: 200, height: 100 } as PenNode;
    const r = interpolateNode(a, b, 0.5) as PenNode & Record<string, unknown>;
    expect(r.x).toBe(50);
    expect(r.y).toBe(25);
    expect(r.width).toBe(150);
    expect(r.height).toBe(100);
  });

  it('interpolates fill color when both are single colors', () => {
    const a = { type: 'rectangle', id: 'a', x: 0, y: 0, width: 10, height: 10, fill: '#FF0000' } as unknown as PenNode;
    const b = { type: 'rectangle', id: 'a', x: 0, y: 0, width: 10, height: 10, fill: '#0000FF' } as unknown as PenNode;
    const r = interpolateNode(a, b, 0.5) as PenNode & { fill?: string };
    expect(r.fill).toBe('#800080');
  });

  it('keeps from value when to is missing a number', () => {
    const a = { type: 'rectangle', id: 'a', x: 10, y: 20, width: 100, height: 100 } as PenNode;
    const b = { type: 'rectangle', id: 'a', x: 50, y: 20 } as unknown as PenNode;
    const r = interpolateNode(a, b, 0.5) as PenNode & { width?: number; height?: number };
    // width/height は to に無いので from 側 (10) が残る
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
  });
});
