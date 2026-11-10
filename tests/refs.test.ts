import { describe, expect, it } from 'vitest';
import { resolveRefs } from '../src/pen/refs';
import type { PenDocument, PenNode } from '../src/pen/types';

function makeDoc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}

describe('resolveRefs', () => {
  it('passes through docs without reusable nor ref', () => {
    const doc = makeDoc([
      { type: 'rectangle', id: 'r', x: 0, y: 0, width: 10, height: 10 } as PenNode,
    ]);
    const r = resolveRefs(doc);
    expect(r).toEqual(doc);
  });

  it('expands a ref node with reusable component', () => {
    const doc = makeDoc([
      {
        type: 'rectangle', id: 'master', reusable: true,
        x: 0, y: 0, width: 100, height: 50, fill: '#FF0000',
      } as unknown as PenNode,
      { type: 'ref', id: 'i1', ref: 'master', x: 200, y: 200 } as unknown as PenNode,
    ]);
    const r = resolveRefs(doc);
    // master はそのまま
    expect(r.children[0].id).toBe('master');
    // instance は rectangle に展開され、x/y は ref 側の値、fill は継承
    const inst = r.children[1] as PenNode & { fill?: string };
    expect(inst.type).toBe('rectangle');
    expect(inst.id).toBe('i1');
    expect(inst.x).toBe(200);
    expect(inst.y).toBe(200);
    expect(inst.fill).toBe('#FF0000');
  });

  it('leaves unresolved ref as unsupported node (no crash)', () => {
    const doc = makeDoc([
      { type: 'ref', id: 'i1', ref: 'nonexistent', x: 0, y: 0, width: 100, height: 50 } as unknown as PenNode,
    ]);
    const r = resolveRefs(doc);
    expect(r.children[0].type).toBe('unsupported');
    expect((r.children[0] as { originalType?: string }).originalType).toBe('ref:nonexistent');
  });

  it('applies descendants override to nested child', () => {
    const doc = makeDoc([
      {
        type: 'frame', id: 'card', reusable: true,
        x: 0, y: 0, width: 200, height: 100,
        children: [
          { type: 'text', id: 'label', content: 'Default' } as PenNode,
        ],
      } as unknown as PenNode,
      {
        type: 'ref', id: 'inst1', ref: 'card', x: 50, y: 50,
        descendants: { label: { content: 'Hello' } },
      } as unknown as PenNode,
    ]);
    const r = resolveRefs(doc);
    const inst = r.children[1] as PenNode & { children?: PenNode[] };
    const label = inst.children?.[0] as PenNode & { content?: string };
    expect(label.content).toBe('Hello');
  });

  it('recursively expands nested refs', () => {
    const doc = makeDoc([
      {
        type: 'rectangle', id: 'leaf', reusable: true,
        x: 0, y: 0, width: 10, height: 10, fill: '#00FF00',
      } as unknown as PenNode,
      {
        type: 'frame', id: 'card', reusable: true,
        x: 0, y: 0, width: 100, height: 50,
        children: [
          { type: 'ref', id: 'leaf-inst', ref: 'leaf' } as unknown as PenNode,
        ],
      } as unknown as PenNode,
      { type: 'ref', id: 'card-inst', ref: 'card', x: 300, y: 300 } as unknown as PenNode,
    ]);
    const r = resolveRefs(doc);
    const cardInst = r.children[2] as PenNode & { children?: PenNode[] };
    expect(cardInst.type).toBe('frame');
    // leaf も展開済みで rectangle になる
    const leaf = cardInst.children?.[0] as PenNode & { fill?: string };
    expect(leaf.type).toBe('rectangle');
    expect(leaf.fill).toBe('#00FF00');
  });
});

describe('resolveRefs — descendants (#95)', () => {
  type N = Record<string, unknown> & { children?: N[] };
  const find = (node: N, id: string): N | undefined => {
    if (node.id === id) return node;
    for (const c of node.children ?? []) {
      const hit = find(c, id);
      if (hit) return hit;
    }
    return undefined;
  };

  /** Shell > Sidebar > Nav > Item > Label、Shell > Main > Slot */
  const shell = {
    type: 'frame',
    id: 'shell',
    reusable: true,
    children: [
      {
        type: 'frame',
        id: 'sidebar',
        children: [
          {
            type: 'frame',
            id: 'nav',
            children: [
              {
                type: 'frame',
                id: 'item',
                fill: '#000',
                children: [{ type: 'text', id: 'label', content: 'Home' }],
              },
            ],
          },
        ],
      },
      {
        type: 'frame',
        id: 'main',
        children: [{ type: 'frame', id: 'slot', fill: '#111', clip: true, children: [] }],
      },
    ],
  };

  it('overrides a node nested deep inside the instance by its id', () => {
    const doc = makeDoc([
      shell as unknown as PenNode,
      {
        type: 'ref',
        id: 'page',
        ref: 'shell',
        descendants: { label: { content: 'Agents' }, item: { fill: '#F00' } },
      } as unknown as PenNode,
    ]);
    const page = resolveRefs(doc).children[1] as unknown as N;
    expect(find(page, 'label')?.content).toBe('Agents');
    expect(find(page, 'item')?.fill).toBe('#F00');
  });

  it('replaces a node entirely when the override has a type', () => {
    const doc = makeDoc([
      shell as unknown as PenNode,
      {
        type: 'ref',
        id: 'page',
        ref: 'shell',
        descendants: {
          slot: {
            type: 'frame',
            id: 'content',
            layout: 'vertical',
            children: [{ type: 'text', id: 't', content: 'Body' }],
          },
        },
      } as unknown as PenNode,
    ]);
    const page = resolveRefs(doc).children[1] as unknown as N;
    const main = find(page, 'main')!;
    const content = main.children![0];
    expect(content.id).toBe('content');
    expect(content.layout).toBe('vertical');
    // 置き換え前のプロパティは残らない
    expect(content).not.toHaveProperty('fill');
    expect(content).not.toHaveProperty('clip');
    expect(content.children![0].content).toBe('Body');
  });

  it('swaps only the contents when the override has children but no type', () => {
    const doc = makeDoc([
      shell as unknown as PenNode,
      {
        type: 'ref',
        id: 'page',
        ref: 'shell',
        descendants: { slot: { children: [{ type: 'text', id: 't', content: 'Hi' }] } },
      } as unknown as PenNode,
    ]);
    const page = resolveRefs(doc).children[1] as unknown as N;
    const slot = find(page, 'slot')!;
    expect(slot.fill).toBe('#111');
    expect(slot.children![0].content).toBe('Hi');
  });

  it('follows a slash path into a nested instance', () => {
    const doc = makeDoc([
      {
        type: 'frame',
        id: 'button',
        reusable: true,
        children: [{ type: 'text', id: 'caption', content: 'OK' }],
      } as unknown as PenNode,
      {
        type: 'frame',
        id: 'dialog',
        reusable: true,
        children: [
          {
            type: 'ref',
            id: 'ok',
            ref: 'button',
            descendants: { caption: { content: 'Confirm' } },
          },
        ],
      } as unknown as PenNode,
      {
        type: 'ref',
        id: 'd1',
        ref: 'dialog',
        descendants: { 'ok/caption': { content: 'Save' } },
      } as unknown as PenNode,
    ]);
    const r = resolveRefs(doc);
    const d1 = r.children[2] as unknown as N;
    expect(find(d1, 'caption')?.content).toBe('Save');
    // コンポーネント側は変わらない
    const dialog = r.children[1] as unknown as N;
    expect(find(dialog, 'caption')?.content).toBe('Confirm');
  });

  it('keeps instance overrides when the component itself is an instance', () => {
    const doc = makeDoc([
      {
        type: 'frame',
        id: 'checkbox',
        reusable: true,
        fill: '#000',
        children: [{ type: 'text', id: 'label', content: 'Label' }],
      } as unknown as PenNode,
      {
        type: 'ref',
        id: 'unchecked',
        ref: 'checkbox',
        reusable: true,
        fill: '#FFF',
      } as unknown as PenNode,
      {
        type: 'ref',
        id: 'c1',
        ref: 'unchecked',
        descendants: { label: { content: 'Remember me' } },
      } as unknown as PenNode,
    ]);
    const c1 = resolveRefs(doc).children[2] as unknown as N;
    expect(c1.type).toBe('frame');
    expect(c1.fill).toBe('#FFF');
    expect(find(c1, 'label')?.content).toBe('Remember me');
  });

  it('does not mark instances as components', () => {
    const doc = makeDoc([
      shell as unknown as PenNode,
      { type: 'ref', id: 'page', ref: 'shell' } as unknown as PenNode,
    ]);
    const page = resolveRefs(doc).children[1] as unknown as N;
    expect(page.reusable).toBeUndefined();
  });

  it('merges a width-only stroke override into the component stroke', () => {
    const doc = makeDoc([
      {
        type: 'frame',
        id: 'card',
        reusable: true,
        stroke: { fill: '#ccc', thickness: 1, align: 'inside' },
      } as unknown as PenNode,
      { type: 'ref', id: 'c', ref: 'card', stroke: { thickness: 2 } } as unknown as PenNode,
    ]);
    const c = resolveRefs(doc).children[1] as unknown as N;
    expect(c.stroke).toEqual({ fill: '#ccc', thickness: 2, align: 'inside' });
  });

  it('resolves refs to library components passed in options', () => {
    const doc = makeDoc([{ type: 'ref', id: 'b', ref: 'ui:button' } as unknown as PenNode]);
    const r = resolveRefs(doc, {
      components: [
        { type: 'frame', id: 'ui:button', reusable: true, fill: '#00F' } as unknown as PenNode,
      ],
    });
    const b = r.children[0] as unknown as N;
    expect(b.type).toBe('frame');
    expect(b.fill).toBe('#00F');
  });

  it('stops on a component that contains itself', () => {
    const doc = makeDoc([
      {
        type: 'frame',
        id: 'loop',
        reusable: true,
        children: [{ type: 'ref', id: 'inner', ref: 'loop' }],
      } as unknown as PenNode,
      { type: 'ref', id: 'x', ref: 'loop' } as unknown as PenNode,
    ]);
    const x = resolveRefs(doc).children[1] as unknown as N;
    expect(x.type).toBe('frame');
    expect(x.children![0].type).toBe('unsupported');
  });
});
