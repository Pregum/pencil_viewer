import { describe, expect, it } from 'vitest';
import { collectSelectionColors, replaceColor } from '../src/components/Viewer/SelectionColorsPanel';
import type { PenNode } from '../src/pen/types';

function rect(id: string, extra: Record<string, unknown> = {}): PenNode {
  return { type: 'rectangle', id, x: 0, y: 0, width: 10, height: 10, ...extra } as PenNode;
}

describe('collectSelectionColors', () => {
  it('collects fill colors with node references', () => {
    const m = collectSelectionColors([
      rect('a', { fill: '#FF0000' }),
      rect('b', { fill: '#FF0000' }),
      rect('c', { fill: '#00FF00' }),
    ]);
    expect(m.size).toBe(2);
    expect(m.get('#FF0000')?.nodeIds).toEqual(['a', 'b']);
    expect(m.get('#00FF00')?.nodeIds).toEqual(['c']);
  });

  it('collects stroke colors and marks kind', () => {
    const m = collectSelectionColors([
      rect('a', { fill: '#FFFFFF', stroke: { thickness: 1, fill: '#000000' } }),
    ]);
    expect(m.get('#FFFFFF')?.kinds.has('fill')).toBe(true);
    expect(m.get('#000000')?.kinds.has('stroke')).toBe(true);
  });

  it('handles solid fill object form ({type:"color",color:...})', () => {
    const m = collectSelectionColors([
      rect('a', { fill: { type: 'color', color: '#abcdef' } }),
    ]);
    expect(m.has('#ABCDEF')).toBe(true);
  });

  it('handles fill arrays (first color)', () => {
    const m = collectSelectionColors([
      rect('a', { fill: ['#FF0000', '#0000FF'] }),
    ]);
    expect(m.has('#FF0000')).toBe(true);
  });

  it('recurses into frame children', () => {
    const m = collectSelectionColors([
      {
        type: 'frame', id: 'f', x: 0, y: 0, width: 100, height: 100,
        children: [rect('a', { fill: '#111111' })],
      } as unknown as PenNode,
    ]);
    expect(m.has('#111111')).toBe(true);
  });

  it('ignores nodes without color', () => {
    const m = collectSelectionColors([rect('a')]);
    expect(m.size).toBe(0);
  });
});

describe('replaceColor', () => {
  it('replaces matching fill strings in all nodes', () => {
    const before = [
      rect('a', { fill: '#FF0000' }),
      rect('b', { fill: '#FF0000' }),
      rect('c', { fill: '#00FF00' }),
    ];
    const { nodes, replaced } = replaceColor(before, '#FF0000', '#0000FF');
    expect(replaced).toBe(2);
    expect((nodes[0] as { fill?: string }).fill).toBe('#0000FF');
    expect((nodes[1] as { fill?: string }).fill).toBe('#0000FF');
    expect((nodes[2] as { fill?: string }).fill).toBe('#00FF00');
  });

  it('replaces color inside stroke.fill', () => {
    const before = [
      rect('a', { stroke: { thickness: 1, fill: '#000000' } }),
    ];
    const { nodes, replaced } = replaceColor(before, '#000000', '#FF0000');
    expect(replaced).toBe(1);
    const s = (nodes[0] as { stroke?: { fill?: string } }).stroke;
    expect(s?.fill).toBe('#FF0000');
  });

  it('replaces inside {type:"color",color:...} object', () => {
    const before = [
      rect('a', { fill: { type: 'color', color: '#ABCDEF' } }),
    ];
    const { nodes, replaced } = replaceColor(before, '#ABCDEF', '#111111');
    expect(replaced).toBe(1);
    const f = (nodes[0] as { fill?: { color?: string } }).fill;
    expect(f?.color).toBe('#111111');
  });

  it('case-insensitive matching (uppercase color)', () => {
    const before = [rect('a', { fill: '#ff0000' })];
    const { replaced } = replaceColor(before, '#FF0000', '#0000FF');
    expect(replaced).toBe(1);
  });

  it('is a no-op when color is not found', () => {
    const before = [rect('a', { fill: '#FF0000' })];
    const { replaced } = replaceColor(before, '#123456', '#0000FF');
    expect(replaced).toBe(0);
  });

  it('recurses into frame children', () => {
    const before = [
      {
        type: 'frame', id: 'f', x: 0, y: 0, width: 100, height: 100,
        children: [rect('a', { fill: '#FF0000' })],
      } as unknown as PenNode,
    ];
    const { nodes, replaced } = replaceColor(before, '#FF0000', '#0000FF');
    expect(replaced).toBe(1);
    const f = nodes[0] as { children?: PenNode[] };
    const a = f.children?.[0] as { fill?: string };
    expect(a.fill).toBe('#0000FF');
  });
});
