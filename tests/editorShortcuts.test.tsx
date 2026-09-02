/**
 * キーボードショートカットの検証 (#71)。
 *
 * useEditorShortcuts は EditorContext.tsx から切り出した 389 行の塊で、
 * 切り出す前はカバレッジ 0% だった。EditorProvider 経由で実際に
 * window へ keydown を投げ、state の遷移を確認する。
 *
 * 個々のショートカットを網羅するのではなく、代表的なものと
 * 「入力欄にフォーカスがあるときは発火しない」というガードを押さえる。
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EditorProvider, useEditor } from '../src/pen/state/EditorContext';
import type { PenDocument, PenNode, RectangleNode } from '../src/pen/types';

function rect(id: string, x = 0, y = 0): RectangleNode {
  return { type: 'rectangle', id, x, y, width: 10, height: 10 } as RectangleNode;
}
function makeDoc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}
/** x / y は optional なので、未設定は 0 とみなして取り出す */
function posOf(doc: PenDocument, idx = 0): { x: number; y: number } {
  const n = doc.children[idx] as RectangleNode;
  return { x: n.x ?? 0, y: n.y ?? 0 };
}

function wrapperFor(doc: PenDocument) {
  return ({ children }: { children: ReactNode }) => (
    <EditorProvider doc={doc} rawDoc={doc}>{children}</EditorProvider>
  );
}

/** window に keydown を送る */
function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
  });
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
});

describe('キーボードショートカット — 選択の解除', () => {
  it('Escape で選択を解除する', () => {
    const doc = makeDoc([rect('a')]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    expect(result.current.state.selectedNodeId).toBe('a');

    press('Escape');
    expect(result.current.state.selectedNodeId).toBeNull();
  });

  it('insertMode 中の Escape は選択ではなく insertMode を抜ける', () => {
    const doc = makeDoc([rect('a')]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    act(() => result.current.enterInsertMode());
    expect(result.current.state.insertMode).toBe(true);

    press('Escape');
    expect(result.current.state.insertMode).toBe(false);
    // 選択は残る
    expect(result.current.state.selectedNodeId).toBe('a');
  });
});

describe('キーボードショートカット — 削除', () => {
  it('Backspace で選択ノードを削除する', () => {
    const doc = makeDoc([rect('a'), rect('b', 30)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('Backspace');

    expect(result.current.state.rawDoc.children.map((n) => n.id)).toEqual(['b']);
  });

  it('Delete でも削除できる', () => {
    const doc = makeDoc([rect('a'), rect('b', 30)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('b'));
    press('Delete');

    expect(result.current.state.rawDoc.children.map((n) => n.id)).toEqual(['a']);
  });

  it('複数選択をまとめて削除する', () => {
    const doc = makeDoc([rect('a'), rect('b', 30), rect('c', 60)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectMultiple(['a', 'c']));
    press('Backspace');

    expect(result.current.state.rawDoc.children.map((n) => n.id)).toEqual(['b']);
  });

  it('未選択なら何も消さない', () => {
    const doc = makeDoc([rect('a'), rect('b', 30)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    press('Backspace');
    expect(result.current.state.rawDoc.children).toHaveLength(2);
  });
});

describe('キーボードショートカット — 矢印キーによる移動', () => {
  it('ArrowRight で選択ノードを右へ動かす', () => {
    const doc = makeDoc([rect('a', 100, 100)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    const before = posOf(result.current.state.rawDoc).x;

    press('ArrowRight');

    expect(posOf(result.current.state.rawDoc).x).toBeGreaterThan(before);
  });

  it('ArrowLeft は左へ動かす', () => {
    const doc = makeDoc([rect('a', 100, 100)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('ArrowLeft');

    expect(posOf(result.current.state.rawDoc).x).toBeLessThan(100);
  });

  it('ArrowDown は y を増やす', () => {
    const doc = makeDoc([rect('a', 100, 100)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('ArrowDown');

    expect(posOf(result.current.state.rawDoc).y).toBeGreaterThan(100);
  });

  it('Shift 併用で移動量が大きくなる', () => {
    const doc = makeDoc([rect('a', 100, 100)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('ArrowRight');
    const small = posOf(result.current.state.rawDoc).x - 100;

    act(() => result.current.selectNode('a'));
    const base = posOf(result.current.state.rawDoc).x;
    press('ArrowRight', { shiftKey: true });
    const big = posOf(result.current.state.rawDoc).x - base;

    expect(big).toBeGreaterThan(small);
  });
});

describe('キーボードショートカット — Undo / Redo', () => {
  it('Cmd+Z で直前の編集を取り消す', () => {
    const doc = makeDoc([rect('a'), rect('b', 30)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('Backspace');
    expect(result.current.state.rawDoc.children).toHaveLength(1);

    press('z', { metaKey: true });
    expect(result.current.state.rawDoc.children).toHaveLength(2);
  });

  it('Cmd+Shift+Z でやり直す', () => {
    const doc = makeDoc([rect('a'), rect('b', 30)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('Backspace');
    press('z', { metaKey: true });
    expect(result.current.state.rawDoc.children).toHaveLength(2);

    press('z', { metaKey: true, shiftKey: true });
    expect(result.current.state.rawDoc.children).toHaveLength(1);
  });

  it('Ctrl+Z でも動く (非 Mac)', () => {
    const doc = makeDoc([rect('a'), rect('b', 30)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('Backspace');
    press('z', { ctrlKey: true });

    expect(result.current.state.rawDoc.children).toHaveLength(2);
  });
});

describe('キーボードショートカット — 複製', () => {
  it('Cmd+D で選択ノードを複製する', () => {
    const doc = makeDoc([rect('a')]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });

    act(() => result.current.selectNode('a'));
    press('d', { metaKey: true });

    expect(result.current.state.rawDoc.children.length).toBeGreaterThan(1);
  });
});

describe('キーボードショートカット — 入力欄でのガード', () => {
  it('input にフォーカスがあるとき Backspace でノードを消さない', () => {
    const doc = makeDoc([rect('a'), rect('b', 30)]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    expect(result.current.state.rawDoc.children).toHaveLength(2);
    input.remove();
  });

  it('textarea にフォーカスがあるとき Cmd+D で複製しない', () => {
    const doc = makeDoc([rect('a')]);
    const { result } = renderHook(() => useEditor(), { wrapper: wrapperFor(doc) });
    act(() => result.current.selectNode('a'));

    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    act(() => {
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true }));
    });

    expect(result.current.state.rawDoc.children).toHaveLength(1);
    ta.remove();
  });
});
