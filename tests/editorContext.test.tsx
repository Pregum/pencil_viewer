/**
 * EditorContext のアクション統合テスト。
 *
 * renderHook + EditorProvider で Context を生成し、各 action を act() で
 * 発火させて state.doc / state.rawDoc の遷移を検証する。
 *
 * window.alert を使う action (applyBooleanOp / flattenSelection /
 * outlineStrokeSelected) のため、事前に alert を spy でスタブする。
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EditorProvider, useEditor } from '../src/pen/state/EditorContext';
import type { PenDocument, PenNode, FrameNode, RectangleNode, TextStyle, ColorStyle } from '../src/pen/types';

function rect(id: string, x: number, y: number, w: number, h: number, extra: Partial<RectangleNode> = {}): RectangleNode {
  return { type: 'rectangle', id, x, y, width: w, height: h, ...extra } as RectangleNode;
}

function frame(partial: Partial<FrameNode> & { id: string }): FrameNode {
  return {
    type: 'frame',
    x: 0, y: 0, width: 200, height: 200, layout: 'none', children: [],
    ...partial,
  } as FrameNode;
}

function makeDoc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}

function wrapperFor(doc: PenDocument) {
  return ({ children }: { children: ReactNode }) => (
    <EditorProvider doc={doc} rawDoc={doc}>{children}</EditorProvider>
  );
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
});

describe('EditorContext — basic selection & updates', () => {
  it('selectNode sets selectedNodeId', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('b'));
    expect(result.current.state.selectedNodeId).toBe('b');
  });

  it('updateNode patches a node and pushes undo', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10, { fill: '#FF0000' })]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.updateNode('a', { fill: '#00FF00' } as Partial<PenNode>));
    const a = result.current.state.rawDoc.children[0] as PenNode & { fill?: string };
    expect(a.fill).toBe('#00FF00');
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    const a2 = result.current.state.rawDoc.children[0] as PenNode & { fill?: string };
    expect(a2.fill).toBe('#FF0000');
  });

  it('deleteNode removes top-level node', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.deleteNode('a'));
    expect(result.current.state.rawDoc.children.length).toBe(1);
    expect(result.current.state.rawDoc.children[0].id).toBe('b');
  });

  it('addNode appends and selects', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.addNode(rect('b', 20, 0, 10, 10)));
    expect(result.current.state.rawDoc.children.length).toBe(2);
    expect(result.current.state.selectedNodeId).toBe('b');
  });

  it('toggleSelectNode adds and removes from multi-select', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10), rect('c', 40, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.toggleSelectNode('b'));
    expect(result.current.state.selectedNodeIds.has('a')).toBe;
    expect(result.current.state.selectedNodeIds.has('b')).toBe(true);
    act(() => result.current.toggleSelectNode('a'));
    expect(result.current.state.selectedNodeIds.has('a')).toBe(false);
  });
});

describe('EditorContext — wrapSelectionInFrame', () => {
  it('wraps 2 top-level rects in a new frame, children x/y become local', () => {
    const doc = makeDoc([
      rect('a', 100, 100, 50, 50),
      rect('b', 200, 120, 50, 50),
    ]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectMultiple(['a', 'b']));
    act(() => result.current.wrapSelectionInFrame());
    const children = result.current.state.rawDoc.children;
    // 前の 2 つは消え、新規 frame が 1 つ
    expect(children.length).toBe(1);
    const f = children[0] as FrameNode;
    expect(f.type).toBe('frame');
    expect(f.x).toBe(100); // minX
    expect(f.y).toBe(100); // minY
    expect(f.width).toBe(150); // max(250) - min(100)
    expect(f.height).toBe(70);
    // 子は frame 座標系に変換
    const a = f.children![0] as PenNode;
    const b = f.children![1] as PenNode;
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
    expect(b.x).toBe(100);
    expect(b.y).toBe(20);
  });

  it('no-op when nothing is selected', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.wrapSelectionInFrame());
    expect(result.current.state.rawDoc.children.length).toBe(1);
    expect(result.current.state.rawDoc.children[0].id).toBe('a');
  });
});

describe('EditorContext — component / variant / instance', () => {
  it('createComponent marks a node reusable', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.createComponent());
    expect((result.current.state.rawDoc.children[0] as { reusable?: boolean }).reusable).toBe(true);
  });

  it('unmakeComponent flips reusable back to false', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10, { reusable: true } as Partial<RectangleNode>)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.unmakeComponent('a'));
    expect((result.current.state.rawDoc.children[0] as { reusable?: boolean }).reusable).toBe(false);
  });

  it('insertInstance adds a ref node pointing to the component', () => {
    const doc = makeDoc([
      rect('master', 0, 0, 100, 50, { reusable: true } as Partial<RectangleNode>),
    ]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.insertInstance('master', { x: 10, y: 20 }));
    // master + new ref
    expect(result.current.state.rawDoc.children.length).toBe(2);
    const ref = result.current.state.rawDoc.children[1] as PenNode & { ref?: string };
    expect(ref.type).toBe('ref');
    expect(ref.ref).toBe('master');
    expect(ref.x).toBe(10);
    expect(ref.y).toBe(20);
  });
});

describe('EditorContext — z-order', () => {
  it('reorderSelected forward moves node one step later', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10), rect('c', 40, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.reorderSelected('forward'));
    expect(result.current.state.rawDoc.children.map((n) => n.id)).toEqual(['b', 'a', 'c']);
  });

  it('reorderSelected front moves to the end', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10), rect('c', 40, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.reorderSelected('front'));
    expect(result.current.state.rawDoc.children.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('reorderSelected backward at index 0 is a no-op', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.reorderSelected('backward'));
    expect(result.current.state.rawDoc.children.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('reorderChildren moves at top-level', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10), rect('c', 40, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.reorderChildren(null, 0, 2));
    expect(result.current.state.rawDoc.children.map((n) => n.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('EditorContext — styles', () => {
  it('upsertStyle adds and replaces by id', () => {
    const doc = makeDoc([]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    const s1: ColorStyle = { id: 's1', type: 'color', name: 'Primary', value: '#FF0000' };
    act(() => result.current.upsertStyle(s1));
    expect(result.current.state.rawDoc.styles?.length).toBe(1);
    // 同じ id で上書き
    act(() => result.current.upsertStyle({ ...s1, value: '#00FF00' }));
    expect(result.current.state.rawDoc.styles?.length).toBe(1);
    expect((result.current.state.rawDoc.styles?.[0] as ColorStyle).value).toBe('#00FF00');
  });

  it('removeStyle drops the entry', () => {
    const doc = makeDoc([]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    const s1: ColorStyle = { id: 's1', type: 'color', name: 'Primary', value: '#FF0000' };
    act(() => result.current.upsertStyle(s1));
    act(() => result.current.removeStyle('s1'));
    expect(result.current.state.rawDoc.styles?.length).toBe(0);
  });

  it('applyStyleToSelection applies a color style to selected nodes', () => {
    const doc = makeDoc([
      rect('a', 0, 0, 10, 10, { fill: '#FFFFFF' } as Partial<RectangleNode>),
      rect('b', 20, 0, 10, 10, { fill: '#FFFFFF' } as Partial<RectangleNode>),
    ]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    const s1: ColorStyle = { id: 's1', type: 'color', name: 'Primary', value: '#123456' };
    act(() => result.current.upsertStyle(s1));
    act(() => result.current.selectMultiple(['a', 'b']));
    act(() => result.current.applyStyleToSelection('s1'));
    expect((result.current.state.rawDoc.children[0] as { fill?: string }).fill).toBe('#123456');
    expect((result.current.state.rawDoc.children[1] as { fill?: string }).fill).toBe('#123456');
  });

  it('applyStyleToSelection applies text style props', () => {
    const doc = makeDoc([
      { type: 'text', id: 't', x: 0, y: 0, width: 100, height: 20, content: 'hi' } as unknown as PenNode,
    ]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    const ts: TextStyle = {
      id: 'h1', type: 'text', name: 'Heading',
      fontSize: 28, fontWeight: 'bold', fill: '#111827',
    };
    act(() => result.current.upsertStyle(ts));
    act(() => result.current.selectNode('t'));
    act(() => result.current.applyStyleToSelection('h1'));
    const t = result.current.state.rawDoc.children[0] as PenNode & { fontSize?: number; fontWeight?: string; fill?: string };
    expect(t.fontSize).toBe(28);
    expect(t.fontWeight).toBe('bold');
    expect(t.fill).toBe('#111827');
  });
});

describe('EditorContext — boolean / flatten / outline stroke', () => {
  it('applyBooleanOp union merges two overlapping rects into one path', () => {
    const doc = makeDoc([rect('a', 0, 0, 20, 20), rect('b', 10, 10, 20, 20)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectMultiple(['a', 'b']));
    act(() => result.current.applyBooleanOp('union'));
    expect(result.current.state.rawDoc.children.length).toBe(1);
    expect(result.current.state.rawDoc.children[0].type).toBe('path');
  });

  it('applyBooleanOp with < 2 selection alerts and is no-op', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10), rect('b', 20, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.applyBooleanOp('union'));
    expect(result.current.state.rawDoc.children.length).toBe(2);
    expect(window.alert).toHaveBeenCalled();
  });

  it('flattenSelection unions selected rects into a path', () => {
    const doc = makeDoc([rect('a', 0, 0, 20, 20), rect('b', 10, 10, 20, 20)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectMultiple(['a', 'b']));
    act(() => result.current.flattenSelection());
    expect(result.current.state.rawDoc.children.length).toBe(1);
    expect(result.current.state.rawDoc.children[0].type).toBe('path');
  });

  it('outlineStrokeSelected converts stroke into a ring path', () => {
    const doc = makeDoc([
      rect('a', 10, 10, 100, 100, {
        stroke: { thickness: 4, fill: '#000' },
      } as Partial<RectangleNode>),
    ]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.outlineStrokeSelected());
    expect(result.current.state.rawDoc.children.length).toBe(1);
    expect(result.current.state.rawDoc.children[0].type).toBe('path');
  });
});

describe('EditorContext — mask / comments', () => {
  it('toggleMaskSelected flips mask flag', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));
    act(() => result.current.toggleMaskSelected());
    expect((result.current.state.rawDoc.children[0] as { mask?: boolean }).mask).toBe(true);
    act(() => result.current.toggleMaskSelected());
    expect((result.current.state.rawDoc.children[0] as { mask?: boolean }).mask).toBe(false);
  });

  it('addComment / updateComment / removeComment lifecycle', () => {
    const doc = makeDoc([]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    let id = '';
    act(() => { id = result.current.addComment(50, 50, 'hello'); });
    expect(result.current.state.rawDoc.comments?.length).toBe(1);
    expect(result.current.state.rawDoc.comments?.[0].text).toBe('hello');
    act(() => result.current.updateComment(id, { text: 'updated', resolved: true }));
    expect(result.current.state.rawDoc.comments?.[0].text).toBe('updated');
    expect(result.current.state.rawDoc.comments?.[0].resolved).toBe(true);
    act(() => result.current.removeComment(id));
    expect(result.current.state.rawDoc.comments?.length).toBe(0);
  });
});

describe('EditorContext — detachFromParentIfOutside', () => {
  it('promotes child to top-level when dragged outside parent bbox', () => {
    // frame at (100,100) 100x100, child at local (50,50) 20x20 → world center (160,160) → inside
    // 子の local x/y を (200, 200) に動かすと world center (310, 310) は frame bbox (100..200) 外
    const doc = makeDoc([
      frame({
        id: 'f', x: 100, y: 100, width: 100, height: 100,
        children: [rect('c', 200, 200, 20, 20)],
      }),
    ]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    const detached = act(() => result.current.detachFromParentIfOutside('c'));
    // 親 f の children から消え、top-level に昇格
    expect(result.current.state.rawDoc.children.length).toBe(2);
    const f = result.current.state.rawDoc.children[0] as FrameNode;
    expect(f.children?.length).toBe(0);
    const promoted = result.current.state.rawDoc.children[1] as PenNode & { x?: number; y?: number };
    expect(promoted.id).toBe('c');
    // world 座標 (parent.x + child.local.x) に変換されているはず
    expect(promoted.x).toBe(300);
    expect(promoted.y).toBe(300);
    void detached;
  });

  it('does nothing when child is still within parent bbox', () => {
    const doc = makeDoc([
      frame({
        id: 'f', x: 0, y: 0, width: 200, height: 200,
        children: [rect('c', 50, 50, 20, 20)],
      }),
    ]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.detachFromParentIfOutside('c'));
    expect(result.current.state.rawDoc.children.length).toBe(1);
    const f = result.current.state.rawDoc.children[0] as FrameNode;
    expect(f.children?.length).toBe(1);
  });

  it('does nothing for already top-level node', () => {
    const doc = makeDoc([rect('a', 0, 0, 10, 10)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.detachFromParentIfOutside('a'));
    expect(result.current.state.rawDoc.children.length).toBe(1);
  });
});

describe('EditorContext — variables CRUD', () => {
  it('upsertVariable / renameVariable / removeVariable', () => {
    const doc = makeDoc([]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.upsertVariable('primary', { type: 'color', value: '#FF0000' }));
    expect((result.current.state.rawDoc.variables as Record<string, { value: string }>).primary.value).toBe('#FF0000');
    act(() => result.current.renameVariable('primary', 'brand'));
    const vars = result.current.state.rawDoc.variables as Record<string, unknown>;
    expect(vars.brand).toBeTruthy();
    expect(vars.primary).toBeUndefined();
    act(() => result.current.removeVariable('brand'));
    expect((result.current.state.rawDoc.variables as Record<string, unknown>).brand).toBeUndefined();
  });
});
