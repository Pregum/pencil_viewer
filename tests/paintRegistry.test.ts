import { describe, expect, it } from 'vitest';
import { buildPaintRegistry } from '../src/pen/paint/registry';
import type { PenDocument, PenNode } from '../src/pen/types';

function doc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}

describe('buildPaintRegistry', () => {
  it('empty doc → empty maps', () => {
    const r = buildPaintRegistry(doc([]));
    expect(r.paints.length).toBe(0);
    expect(r.filters.length).toBe(0);
    expect(r.fillMap.size).toBe(0);
    expect(r.strokeMap.size).toBe(0);
  });

  it('solid fill only → fillMap entry with null (no paint ref)', () => {
    const r = buildPaintRegistry(doc([
      { type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10, fill: '#FF0000' } as unknown as PenNode,
    ]));
    // 単色でも fillMap にはエントリが入る（配列長 1、null）
    expect(r.fillMap.get('r')).toEqual([null]);
    expect(r.paints.length).toBe(0);
  });

  it('gradient fill registers a paint entry', () => {
    const r = buildPaintRegistry(doc([
      {
        type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10,
        fill: {
          type: 'gradient',
          gradientType: 'linear',
          colors: [{ color: '#F00', position: 0 }, { color: '#00F', position: 1 }],
        },
      } as unknown as PenNode,
    ]));
    expect(r.paints.length).toBe(1);
    expect(r.paints[0].kind).toBe('gradient');
    expect(r.fillMap.get('r')).toEqual(['fill-r-0']);
  });

  it('multi-fill mix of solid + gradient gets per-index entries', () => {
    const r = buildPaintRegistry(doc([
      {
        type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10,
        fill: [
          '#FF0000',
          { type: 'gradient', colors: [{ color: '#000', position: 0 }] },
          { type: 'image', url: 'https://example.com/a.png' },
        ],
      } as unknown as PenNode,
    ]));
    const entries = r.fillMap.get('r');
    expect(entries).toEqual([null, 'fill-r-1', 'fill-r-2']);
    expect(r.paints.length).toBe(2); // gradient + image
  });

  it('image fill registers as "image"', () => {
    const r = buildPaintRegistry(doc([
      { type: 'image', id: 'i', x: 0, y: 0, width: 10, height: 10, url: 'https://example.com/a.png' } as unknown as PenNode,
    ]));
    // image ノード自身には fill 無いので paints は空
    expect(r.paints.length).toBe(0);
  });

  it('mesh_gradient is registered as kind "mesh"', () => {
    const r = buildPaintRegistry(doc([
      {
        type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10,
        fill: { type: 'mesh_gradient', columns: 2, rows: 2, colors: ['#F00', '#0F0', '#00F', '#FF0'] },
      } as unknown as PenNode,
    ]));
    expect(r.paints.length).toBe(1);
    expect(r.paints[0].kind).toBe('mesh');
  });

  it('stroke.fill of gradient registers under strokeMap', () => {
    const r = buildPaintRegistry(doc([
      {
        type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10,
        stroke: {
          thickness: 2,
          fill: { type: 'gradient', colors: [{ color: '#F00', position: 0 }] },
        },
      } as unknown as PenNode,
    ]));
    expect(r.strokeMap.get('r')).toBe('stroke-r');
  });

  it('effects array registers a filter entry (enabled only)', () => {
    const r = buildPaintRegistry(doc([
      {
        type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10,
        effect: [
          { type: 'blur', radius: 4 },
          { type: 'shadow', shadowType: 'outer', offset: { x: 2, y: 2 }, blur: 4, color: '#000', enabled: false },
          { type: 'shadow', shadowType: 'inner', offset: { x: 2, y: 2 }, blur: 4, color: '#000' },
        ],
      } as unknown as PenNode,
    ]));
    expect(r.filters.length).toBe(1);
    // disabled shadow は除外
    expect(r.filters[0].effects.length).toBe(2);
    expect(r.filterMap.get('r')).toBe('filter-r');
  });

  it('walks nested frame children and collects their fills', () => {
    const r = buildPaintRegistry(doc([
      {
        type: 'frame', id: 'f', x: 0, y: 0, width: 100, height: 100,
        children: [
          {
            type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10,
            fill: { type: 'gradient', colors: [{ color: '#F00', position: 0 }] },
          } as unknown as PenNode,
        ],
      } as unknown as PenNode,
    ]));
    expect(r.paints.length).toBe(1);
    expect(r.fillMap.get('r')).toEqual(['fill-r-0']);
  });
});
