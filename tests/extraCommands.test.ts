import { describe, expect, it } from 'vitest';
import type { PenNode } from '../src/pen/types';
import {
  findNodesByText,
  findNodesByColor,
  collectColors,
  collectFonts,
  countComponentUsage,
  duplicateNode,
} from '../src/components/Viewer/ExtraCommands';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleNodes: PenNode[] = [
  { type: 'text', id: 't1', x: 0, y: 0, content: 'Hello World', fontFamily: 'Inter', fill: '#FF0000' },
  { type: 'text', id: 't2', x: 10, y: 10, content: 'Goodbye', fontFamily: 'Roboto', fill: '#00FF00' },
  { type: 'rectangle', id: 'r1', x: 50, y: 50, width: 100, height: 60, fill: '#FF0000' },
  { type: 'ellipse', id: 'e1', x: 200, y: 200, width: 80, height: 80, fill: '#0000FF' },
  {
    type: 'frame',
    id: 'f1',
    x: 0,
    y: 0,
    children: [
      { type: 'text', id: 't3', x: 0, y: 0, content: 'Nested hello', fontFamily: 'Inter', fill: '#AABB00' },
      { type: 'rectangle', id: 'r2', x: 0, y: 0, width: 40, height: 40, fill: { type: 'color', color: '#FF0000' } },
    ],
  },
  { type: 'ref', id: 'ref1', x: 0, y: 0, ref: 'comp_a' } as PenNode,
  { type: 'ref', id: 'ref2', x: 0, y: 0, ref: 'comp_a' } as PenNode,
  { type: 'ref', id: 'ref3', x: 0, y: 0, ref: 'comp_b' } as PenNode,
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findNodesByText', () => {
  it('finds nodes containing the query (case-insensitive)', () => {
    const ids = findNodesByText(sampleNodes, 'hello');
    expect(ids).toContain('t1');
    expect(ids).toContain('t3');
    expect(ids).not.toContain('t2');
  });

  it('returns empty array when no match', () => {
    expect(findNodesByText(sampleNodes, 'zzz_no_match')).toEqual([]);
  });

  it('finds partial matches', () => {
    const ids = findNodesByText(sampleNodes, 'ood');
    expect(ids).toContain('t2'); // "Goodbye" contains "ood"
  });
});

describe('findNodesByColor', () => {
  it('finds nodes by hex color string fill', () => {
    const ids = findNodesByColor(sampleNodes, '#FF0000');
    expect(ids).toContain('t1');
    expect(ids).toContain('r1');
    // r2 uses SolidFill object with color #FF0000
    expect(ids).toContain('r2');
  });

  it('is case-insensitive', () => {
    const ids = findNodesByColor(sampleNodes, '#ff0000');
    expect(ids).toContain('t1');
    expect(ids).toContain('r1');
  });

  it('returns empty when no match', () => {
    expect(findNodesByColor(sampleNodes, '#123456')).toEqual([]);
  });
});

describe('collectColors', () => {
  it('collects all unique colors from the tree', () => {
    const colors = collectColors(sampleNodes);
    expect(colors).toContain('#FF0000');
    expect(colors).toContain('#00FF00');
    expect(colors).toContain('#0000FF');
    expect(colors).toContain('#AABB00');
  });

  it('returns sorted array', () => {
    const colors = collectColors(sampleNodes);
    const sorted = [...colors].sort();
    expect(colors).toEqual(sorted);
  });

  it('does not contain duplicates', () => {
    const colors = collectColors(sampleNodes);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('collectFonts', () => {
  it('collects all unique font families', () => {
    const fonts = collectFonts(sampleNodes);
    expect(fonts).toContain('Inter');
    expect(fonts).toContain('Roboto');
  });

  it('returns sorted array', () => {
    const fonts = collectFonts(sampleNodes);
    const sorted = [...fonts].sort();
    expect(fonts).toEqual(sorted);
  });

  it('does not include duplicates', () => {
    // "Inter" appears twice (t1 and t3)
    const fonts = collectFonts(sampleNodes);
    expect(fonts.filter((f) => f === 'Inter')).toHaveLength(1);
  });
});

describe('countComponentUsage', () => {
  it('counts ref node usage per component', () => {
    const usage = countComponentUsage(sampleNodes);
    expect(usage.get('comp_a')).toBe(2);
    expect(usage.get('comp_b')).toBe(1);
  });

  it('returns empty map when no refs', () => {
    const noRefs: PenNode[] = [
      { type: 'rectangle', id: 'r1', x: 0, y: 0, width: 10, height: 10 },
    ];
    expect(countComponentUsage(noRefs).size).toBe(0);
  });
});

describe('duplicateNode', () => {
  it('returns a new node with a different id', () => {
    const original: PenNode = { type: 'rectangle', id: 'r1', x: 10, y: 20, width: 100, height: 60 };
    const cloned = duplicateNode(original);
    expect(cloned.id).not.toBe(original.id);
    expect(cloned.id).toContain('r1_copy_');
  });

  it('offsets x and y by 20', () => {
    const original: PenNode = { type: 'rectangle', id: 'r1', x: 10, y: 20, width: 100, height: 60 };
    const cloned = duplicateNode(original);
    expect(cloned.x).toBe(30);
    expect(cloned.y).toBe(40);
  });

  it('preserves other properties', () => {
    const original: PenNode = { type: 'text', id: 't1', x: 0, y: 0, content: 'hello', fontFamily: 'Inter' };
    const cloned = duplicateNode(original);
    expect(cloned.type).toBe('text');
    expect((cloned as { content?: string }).content).toBe('hello');
    expect((cloned as { fontFamily?: string }).fontFamily).toBe('Inter');
  });

  it('handles nodes with no x/y (defaults to 0)', () => {
    const original: PenNode = { type: 'rectangle', id: 'r1', width: 50, height: 50 } as PenNode;
    const cloned = duplicateNode(original);
    expect(cloned.x).toBe(20);
    expect(cloned.y).toBe(20);
  });
});
