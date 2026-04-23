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
