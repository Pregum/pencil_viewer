import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getImports, loadImports, namespaceLibrary } from '../src/pen/imports';
import { builtinLibraryUrl } from '../src/pen/libraries';
import { parsePen } from '../src/pen/parser';
import { resolveRefs } from '../src/pen/refs';
import { substituteVariables } from '../src/pen/variables';
import type { PenDocument } from '../src/pen/types';

type N = Record<string, unknown> & { children?: N[] };

/** Pencil のデザインキットを模した小さなライブラリ */
const LIB = {
  version: '2.8',
  themes: { Mode: ['Light', 'Dark'] },
  variables: {
    '--background': {
      type: 'color',
      value: [{ value: '#FAFAFA' }, { value: '#0A0A0A', theme: { Mode: 'Dark' } }],
    },
    '--primary': { type: 'color', value: '#171717' },
  },
  children: [
    {
      type: 'frame',
      id: 'kit',
      layout: 'none',
      theme: { Mode: 'Light' },
      children: [
        {
          type: 'frame',
          id: 'checked',
          reusable: true,
          fill: '$--primary',
          stroke: { align: 'inside', thickness: 1, fill: '$--primary' },
          children: [
            { type: 'icon_font', id: 'mark', iconFontName: 'check', iconFontFamily: 'lucide' },
            { type: 'text', id: 'label', content: '$100 off' },
          ],
        },
        {
          type: 'ref',
          id: 'unchecked',
          reusable: true,
          ref: 'checked',
          descendants: { mark: { enabled: false } },
        },
      ],
    },
  ],
};

const DOC = {
  version: '2.21',
  imports: { ui: 'pencil:kit.lib.pen' },
  children: [
    {
      type: 'frame',
      id: 'screen',
      fill: '$ui:--background',
      theme: { 'ui:Mode': 'Dark' },
      children: [
        { type: 'ref', id: 'c1', ref: 'ui:unchecked', descendants: { 'ui:label': { content: 'Remember me' } } },
      ],
    },
  ],
};

function parse(json: unknown): PenDocument {
  const r = parsePen(json);
  if (!r.ok) throw new Error(r.error.summary);
  return r.doc;
}

describe('getImports', () => {
  it('reads alias → uri pairs and ignores malformed entries', () => {
    const doc = { version: '1', children: [], imports: { ui: 'pencil:a.lib.pen', bad: 1, 'x:y': 'z' } };
    expect(getImports(doc as unknown as PenDocument)).toEqual({ ui: 'pencil:a.lib.pen' });
    expect(getImports({ version: '1', children: [] })).toEqual({});
  });
});

describe('namespaceLibrary', () => {
  const lib = namespaceLibrary(parse(LIB), 'ui');
  const kit = lib.components[0] as N;
  const [checked, unchecked] = kit.children!;

  it('prefixes ids, refs and descendant paths', () => {
    expect(checked.id).toBe('ui:checked');
    expect(checked.children![0].id).toBe('ui:mark');
    expect(unchecked.ref).toBe('ui:checked');
    expect(Object.keys(unchecked.descendants as object)).toEqual(['ui:mark']);
  });

  it('prefixes variable references, variables and theme axes', () => {
    expect(checked.fill).toBe('$ui:--primary');
    expect((checked.stroke as N).fill).toBe('$ui:--primary');
    expect(kit.theme).toEqual({ 'ui:Mode': 'Light' });
    expect(Object.keys(lib.variables)).toEqual(['ui:--background', 'ui:--primary']);
    const bg = lib.variables['ui:--background'] as { value: { theme?: object }[] };
    expect(bg.value[1].theme).toEqual({ 'ui:Mode': 'Dark' });
    expect(lib.themes).toEqual({ 'ui:Mode': ['Light', 'Dark'] });
  });

  it('leaves text that only looks like a variable alone', () => {
    expect(checked.children![1].content).toBe('$100 off');
  });
});

describe('loadImports', () => {
  it('reads each import through the reader and skips the ones it cannot read', async () => {
    const asked: string[] = [];
    const doc = parse({ ...DOC, imports: { ui: 'pencil:kit.lib.pen', gone: 'pencil:missing.lib.pen', bad: 'pencil:bad.lib.pen' } });
    const libs = await loadImports(doc, async (uri) => {
      asked.push(uri);
      if (uri === 'pencil:kit.lib.pen') return JSON.stringify(LIB);
      if (uri === 'pencil:bad.lib.pen') return '{ not json';
      return null;
    });
    expect(asked.sort()).toEqual(['pencil:bad.lib.pen', 'pencil:kit.lib.pen', 'pencil:missing.lib.pen']);
    expect(libs.components).toHaveLength(1);
    expect(Object.keys(libs.variables)).toContain('ui:--background');
  });

  it('renders library components with library variables in the node theme', async () => {
    const doc = parse(DOC);
    const libs = await loadImports(doc, async () => JSON.stringify(LIB));
    const out = substituteVariables(resolveRefs(doc, { components: libs.components }), undefined, libs);
    const screen = out.children[0] as unknown as N;
    expect(screen.fill).toBe('#0A0A0A');
    const c1 = screen.children![0];
    expect(c1.type).toBe('frame');
    expect(c1.fill).toBe('#171717');
    expect(c1.children![0].enabled).toBe(false);
    expect(c1.children![1].content).toBe('Remember me');
  });
});

describe('built-in libraries', () => {
  it('maps pencil: URIs to the bundled copy', () => {
    expect(builtinLibraryUrl('pencil:shadcn.lib.pen', '/base/')).toBe(
      '/base/libraries/pencil/shadcn.lib.pen',
    );
    expect(builtinLibraryUrl('pencil:unknown.lib.pen', '/')).toBeNull();
    expect(builtinLibraryUrl('../shadcn.lib.pen', '/')).toBeNull();
  });

  it('bundles a shadcn kit that parses and has the components and variables kits refer to', () => {
    const text = readFileSync('public/libraries/pencil/shadcn.lib.pen', 'utf-8');
    const lib = namespaceLibrary(parse(JSON.parse(text)), 'j');
    const ids = new Set<string>();
    const walk = (n: N) => {
      if (n.reusable) ids.add(n.id as string);
      n.children?.forEach(walk);
    };
    lib.components.forEach((c) => walk(c as unknown as N));
    for (const id of ['j:VSnC2', 'j:C10zH', 'j:ovuDP', 'j:J7Uph', 'j:AfQIN', 'j:w5c1O']) {
      expect(ids.has(id)).toBe(true);
    }
    expect(lib.variables).toHaveProperty('j:--background');
    expect(lib.variables).toHaveProperty('j:--muted-foreground');
    expect(lib.themes['j:Mode']).toEqual(['Light', 'Dark']);
  });
});

describe('namespaceLibrary — literal text', () => {
  it('only rewrites references to variables the library defines', () => {
    const lib = namespaceLibrary(
      parse({
        version: '2.8',
        variables: { '--primary': { type: 'color', value: '#000' } },
        children: [
          { type: 'text', id: 'price', content: '$USD', fill: '$--primary' },
          { type: 'text', id: 'delta', content: '$-100' },
        ],
      }),
      'ui',
    );
    const [price, delta] = lib.components as unknown as N[];
    expect(price.content).toBe('$USD');
    expect(price.fill).toBe('$ui:--primary');
    expect(delta.content).toBe('$-100');
  });
});
