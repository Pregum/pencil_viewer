import { describe, expect, it } from 'vitest';
import { parseVariables, substituteVariables, extractThemeAxes } from '../src/pen/variables';
import type { PenDocument } from '../src/pen/types';

describe('parseVariables', () => {
  it('narrows typed variables into a flat map', () => {
    const vars = parseVariables({
      'surface-primary': { type: 'color', value: '#F5F2E9FF' },
      'radius-2xl': { type: 'number', value: 16 },
    });
    expect(vars).not.toBeNull();
    expect(vars!['surface-primary']).toEqual({ type: 'color', value: '#F5F2E9FF' });
    expect(vars!['radius-2xl']).toEqual({ type: 'number', value: 16 });
  });

  it('takes the first value when the variable is a themed array', () => {
    const vars = parseVariables({
      primary: {
        type: 'color',
        value: [
          { value: '#111', theme: { mode: 'light' } },
          { value: '#EEE', theme: { mode: 'dark' } },
        ],
      },
    });
    expect(vars!.primary.value).toBe('#111');
  });

  it('silently drops variables with an unknown type', () => {
    const vars = parseVariables({
      weird: { type: 'unknown-kind', value: 'x' },
      ok: { type: 'number', value: 42 },
    });
    expect(vars!.weird).toBeUndefined();
    expect(vars!.ok.value).toBe(42);
  });

  it('returns null when variables block is missing or not an object', () => {
    expect(parseVariables(undefined)).toBeNull();
    expect(parseVariables(null)).toBeNull();
    expect(parseVariables('string')).toBeNull();
  });
});

describe('substituteVariables', () => {
  function doc(variables: Record<string, unknown>, children: unknown[]): PenDocument {
    return { version: '2.10', variables, children } as unknown as PenDocument;
  }

  it('replaces $name references in leaf string fields', () => {
    const result = substituteVariables(
      doc(
        {
          primary: { type: 'color', value: '#FF00FF' },
          radius: { type: 'number', value: 12 },
        },
        [
          {
            type: 'rectangle',
            id: 'r1',
            width: 100,
            height: 50,
            fill: '$primary',
            cornerRadius: '$radius',
          },
        ],
      ),
    );
    const r1 = result.children[0] as {
      fill: unknown;
      cornerRadius: unknown;
    };
    expect(r1.fill).toBe('#FF00FF');
    expect(r1.cornerRadius).toBe(12);
  });

  it('recurses into nested objects and arrays', () => {
    const result = substituteVariables(
      doc(
        {
          border: { type: 'color', value: '#00FF00' },
          thick: { type: 'number', value: 2 },
        },
        [
          {
            type: 'frame',
            id: 'f1',
            width: 100,
            height: 100,
            children: [
              {
                type: 'rectangle',
                id: 'r',
                width: 50,
                height: 50,
                stroke: { thickness: '$thick', fill: '$border' },
              },
            ],
          },
        ],
      ),
    );
    const r = (result.children[0] as { children: { stroke: { thickness: unknown; fill: unknown } }[] })
      .children[0];
    expect(r.stroke.thickness).toBe(2);
    expect(r.stroke.fill).toBe('#00FF00');
  });

  it('leaves unmatched $refs as-is so the renderer fallback can show them', () => {
    const result = substituteVariables(
      doc({ known: { type: 'color', value: '#111' } }, [
        { type: 'rectangle', id: 'r', width: 10, height: 10, fill: '$unknown-var' },
      ]),
    );
    expect((result.children[0] as { fill: unknown }).fill).toBe('$unknown-var');
  });

  it('does not touch literal strings that only start with a dollar sign', () => {
    const result = substituteVariables(
      doc(
        { primary: { type: 'color', value: '#111' } },
        [
          {
            type: 'text',
            id: 't',
            fill: '$primary',
            content: '$100 割引! $   space',
          },
        ],
      ),
    );
    const t = result.children[0] as { content: unknown; fill: unknown };
    expect(t.fill).toBe('#111'); // actual ref replaced
    expect(t.content).toBe('$100 割引! $   space'); // literal preserved
  });

  it('does not substitute inside id / name / type / fontFamily (metadata keys)', () => {
    // Even if a metadata field happens to match the $name pattern, it must not
    // be replaced: node IDs are used as paint-registry keys and would break
    // if they were silently rewritten to color strings.
    const result = substituteVariables(
      doc(
        {
          'button-primary': { type: 'color', value: '#FF00FF' },
        },
        [
          {
            type: 'rectangle',
            id: '$button-primary', // edge case: id shaped like a var ref
            name: '$button-primary',
            fontFamily: '$button-primary',
            fill: '$button-primary',
          },
        ],
      ),
    );
    const r = result.children[0] as {
      id: unknown;
      name: unknown;
      fontFamily: unknown;
      fill: unknown;
    };
    expect(r.id).toBe('$button-primary'); // preserved
    expect(r.name).toBe('$button-primary'); // preserved
    expect(r.fontFamily).toBe('$button-primary'); // preserved
    expect(r.fill).toBe('#FF00FF'); // actually substituted
  });

  it('picks value matching the selected theme', () => {
    const input: PenDocument = {
      version: '2.10',
      variables: {
        primary: {
          type: 'color',
          value: [
            { value: '#111', theme: { mode: 'light' } },
            { value: '#EEE', theme: { mode: 'dark' } },
          ],
        },
      } as unknown as PenDocument['variables'],
      children: [
        {
          type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10,
          fill: '$primary',
        } as unknown as PenDocument['children'][number],
      ],
    };
    const light = substituteVariables(input, { mode: 'light' });
    const dark = substituteVariables(input, { mode: 'dark' });
    expect((light.children[0] as { fill?: string }).fill).toBe('#111');
    expect((dark.children[0] as { fill?: string }).fill).toBe('#EEE');
  });

  it('returns the same doc untouched when there is no variables block', () => {
    const input: PenDocument = {
      version: '2.10',
      children: [
        {
          type: 'rectangle',
          id: 'r',
          width: 10,
          height: 10,
          fill: '#ABC',
        } as unknown as PenDocument['children'][number],
      ],
    };
    const result = substituteVariables(input);
    expect(result).toEqual(input);
  });
});

describe('extractThemeAxes', () => {
  it('returns null when themes is missing', () => {
    expect(extractThemeAxes({ version: '2.10', children: [] })).toBeNull();
  });

  it('returns null when themes has no string-array entries', () => {
    expect(extractThemeAxes({
      version: '2.10',
      children: [],
      themes: { foo: 42 } as unknown,
    })).toBeNull();
  });

  it('extracts valid axes', () => {
    const r = extractThemeAxes({
      version: '2.10',
      children: [],
      themes: { mode: ['light', 'dark'], size: ['small', 'large'] } as unknown,
    });
    expect(r).toEqual({ mode: ['light', 'dark'], size: ['small', 'large'] });
  });

  it('filters out non-string-array entries while keeping valid ones', () => {
    const r = extractThemeAxes({
      version: '2.10',
      children: [],
      themes: { mode: ['light', 'dark'], weird: [1, 2] } as unknown,
    });
    expect(r).toEqual({ mode: ['light', 'dark'] });
  });
});
