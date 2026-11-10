import { describe, expect, it } from 'vitest';
import { normalizeNodeProps, mergeStroke } from '../src/pen/format';
import { parsePen } from '../src/pen/parser';

describe('normalizeNodeProps', () => {
  it('turns an icon node into icon_font', () => {
    const out = normalizeNodeProps(
      { type: 'icon', id: 'i', icon: 'house', library: 'lucide', width: 14, height: 14 },
      'node',
    );
    expect(out).toEqual({
      type: 'icon_font',
      id: 'i',
      iconFontName: 'house',
      iconFontFamily: 'lucide',
      width: 14,
      height: 14,
    });
  });

  it('folds a fill-typed stroke and strokeWidth into a stroke object', () => {
    const out = normalizeNodeProps(
      { type: 'frame', id: 'f', stroke: '$border', strokeWidth: { bottom: 1 } },
      'node',
    );
    expect(out.stroke).toEqual({ fill: '$border', thickness: { bottom: 1 }, align: 'inside' });
    expect(out).not.toHaveProperty('strokeWidth');
  });

  it('maps strokeAlignment / strokeLinecap / strokeLinejoin', () => {
    const out = normalizeNodeProps(
      {
        type: 'path',
        id: 'p',
        stroke: '#000',
        strokeWidth: 2,
        strokeAlignment: 'outer',
        strokeLinecap: 'butt',
        strokeLinejoin: 'round',
      },
      'node',
    );
    expect(out.stroke).toEqual({
      fill: '#000',
      thickness: 2,
      align: 'outside',
      cap: 'none',
      join: 'round',
    });
  });

  it('leaves a stroke without a width undrawn (no thickness is invented)', () => {
    const out = normalizeNodeProps({ type: 'frame', id: 'f', stroke: '$border' }, 'node');
    expect((out.stroke as { thickness?: unknown }).thickness).toBeUndefined();
  });

  it('keeps the old stroke object format untouched', () => {
    const src = { type: 'frame', id: 'f', stroke: { thickness: 1, fill: '#000', align: 'inside' } };
    expect(normalizeNodeProps(src, 'node')).toBe(src);
  });

  it('converts only what an override carries', () => {
    expect(normalizeNodeProps({ strokeWidth: 3 }, 'override')).toEqual({
      stroke: { thickness: 3 },
    });
    expect(normalizeNodeProps({ icon: 'bot' }, 'override')).toEqual({ iconFontName: 'bot' });
  });
});

describe('mergeStroke', () => {
  it('merges stroke objects field by field', () => {
    expect(mergeStroke({ fill: '#000', thickness: 1 }, { thickness: 2 })).toEqual({
      fill: '#000',
      thickness: 2,
    });
  });
});

describe('parsePen with the 2.1x format', () => {
  it('normalizes icons, strokes and ref overrides', () => {
    const result = parsePen({
      version: '2.21',
      children: [
        {
          type: 'frame',
          id: 'f',
          stroke: '#ccc',
          strokeWidth: 1,
          children: [{ type: 'icon', id: 'i', icon: 'bot', library: 'lucide' }],
        },
        {
          type: 'ref',
          id: 'r',
          ref: 'f',
          strokeWidth: 2,
          descendants: {
            i: { icon: 'house' },
            x: { type: 'icon', id: 'x2', icon: 'star', library: 'lucide' },
            y: { children: [{ type: 'icon', id: 'y1', icon: 'cog', library: 'lucide' }] },
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [frame, ref] = result.doc.children as unknown as Record<string, unknown>[];
    expect(frame.stroke).toEqual({ fill: '#ccc', thickness: 1, align: 'inside' });
    expect((frame.children as Record<string, unknown>[])[0].type).toBe('icon_font');
    expect(ref.stroke).toEqual({ thickness: 2 });
    const d = ref.descendants as Record<string, Record<string, unknown>>;
    expect(d.i).toEqual({ iconFontName: 'house' });
    expect(d.x.type).toBe('icon_font');
    expect((d.y.children as Record<string, unknown>[])[0].type).toBe('icon_font');
  });
});
