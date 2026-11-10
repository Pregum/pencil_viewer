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

  it('resolves --prefixed design-kit variables, including themed ones (#95)', () => {
    const result = substituteVariables(
      doc(
        {
          '--background': {
            type: 'color',
            value: [
              { value: '#FFFFFF', theme: { mode: 'light' } },
              { value: '#000000', theme: { mode: 'dark' } },
            ],
          },
          '--radius-m': { type: 'number', value: 8 },
        },
        [
          {
            type: 'frame',
            id: 'f',
            fill: '$--background',
            cornerRadius: '$--radius-m',
            stroke: { thickness: 1, fill: '$--missing' },
          },
        ],
      ),
    );
    const f = result.children[0] as {
      fill: unknown;
      cornerRadius: unknown;
      stroke: { fill: unknown };
    };
    expect(f.fill).toBe('#FFFFFF');
    expect(f.cornerRadius).toBe(8);
    expect(f.stroke.fill).toBe('$--missing'); // undefined refs stay as-is
  });

  it('resolves fontFamily only through string variables (#95)', () => {
    const result = substituteVariables(
      doc(
        {
          '--font-primary': { type: 'string', value: 'Geist' },
          '--primary': { type: 'color', value: '#111' },
        },
        [
          { type: 'text', id: 'a', fontFamily: '$--font-primary' },
          { type: 'text', id: 'b', fontFamily: '$--primary' },
          { type: 'text', id: 'c', fontFamily: 'Inter, sans-serif' },
          { type: 'icon_font', id: 'd', iconFontFamily: '$--font-primary' },
        ],
      ),
    );
    const [a, b, c, d] = result.children as unknown as {
      fontFamily?: unknown;
      iconFontFamily?: unknown;
    }[];
    expect(a.fontFamily).toBe('Geist');
    expect(b.fontFamily).toBe('$--primary'); // non-string variable: literal
    expect(c.fontFamily).toBe('Inter, sans-serif');
    expect(d.iconFontFamily).toBe('Geist');
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

describe('substituteVariables — themes and imported variables (#95)', () => {
  type N = Record<string, unknown> & { children?: N[] };
  const vars = {
    bg: {
      type: 'color',
      value: [
        { value: '#FFF' },
        { value: '#000', theme: { mode: 'dark' } },
        { value: '#111', theme: { mode: 'dark', base: 'zinc' } },
      ],
    },
  };

  it('uses the last value whose theme is satisfied, defaulting to the first value of each axis', () => {
    const doc = {
      version: '2.21',
      themes: { mode: ['light', 'dark'], base: ['neutral', 'zinc'] },
      variables: vars,
      children: [
        { type: 'frame', id: 'a', fill: '$bg' },
        { type: 'frame', id: 'b', fill: '$bg', theme: { mode: 'dark' } },
        { type: 'frame', id: 'c', fill: '$bg', theme: { mode: 'dark', base: 'zinc' } },
      ],
    } as unknown as PenDocument;
    const [a, b, c] = substituteVariables(doc).children as unknown as N[];
    expect(a.fill).toBe('#FFF');
    expect(b.fill).toBe('#000');
    expect(c.fill).toBe('#111');
  });

  it('applies a node theme to everything beneath it', () => {
    const doc = {
      version: '2.21',
      themes: { mode: ['light', 'dark'] },
      variables: vars,
      children: [
        {
          type: 'frame',
          id: 'screen',
          theme: { mode: 'dark' },
          children: [
            { type: 'frame', id: 'card', fill: '$bg' },
            { type: 'frame', id: 'light-card', theme: { mode: 'light' }, fill: '$bg' },
          ],
        },
      ],
    } as unknown as PenDocument;
    const screen = substituteVariables(doc).children[0] as unknown as N;
    expect(screen.children![0].fill).toBe('#000');
    expect(screen.children![1].fill).toBe('#FFF');
  });

  it('resolves `$alias:name` from imported variables and their themes', () => {
    const doc = {
      version: '2.21',
      variables: {
        accent: {
          type: 'color',
          value: [
            { value: '#2563EB', theme: { 'ui:Mode': 'Light' } },
            { value: '#3B82F6', theme: { 'ui:Mode': 'Dark' } },
          ],
        },
      },
      children: [
        { type: 'frame', id: 'a', fill: '$ui:--background', stroke: { fill: '$accent' } },
        { type: 'frame', id: 'b', fill: '$ui:--background', stroke: { fill: '$accent' }, theme: { 'ui:Mode': 'Dark' } },
      ],
    } as unknown as PenDocument;
    const external = {
      themes: { 'ui:Mode': ['Light', 'Dark'] },
      variables: {
        'ui:--background': {
          type: 'color',
          value: [{ value: '#FAFAFA' }, { value: '#0A0A0A', theme: { 'ui:Mode': 'Dark' } }],
        },
      },
    };
    const [a, b] = substituteVariables(doc, undefined, external).children as unknown as N[];
    expect(a.fill).toBe('#FAFAFA');
    expect((a.stroke as N).fill).toBe('#2563EB');
    expect(b.fill).toBe('#0A0A0A');
    expect((b.stroke as N).fill).toBe('#3B82F6');
  });

  it('follows a variable whose value is another variable', () => {
    const doc = {
      version: '2.21',
      variables: {
        brand: { type: 'color', value: '#F00' },
        primary: { type: 'color', value: '$brand' },
        loop: { type: 'color', value: '$loop' },
      },
      children: [
        { type: 'frame', id: 'a', fill: '$primary' },
        { type: 'frame', id: 'b', fill: '$loop' },
      ],
    } as unknown as PenDocument;
    const [a, b] = substituteVariables(doc).children as unknown as N[];
    expect(a.fill).toBe('#F00');
    expect(b.fill).toBe('$loop');
  });
});
