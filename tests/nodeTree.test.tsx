/**
 * NodeTree (Layers パネル) の検証 (#80)。
 *
 * #69 の ESLint 導入で Rules of Hooks 違反が見つかった場所で、それまで 0% だった。
 * EditorProvider の実物と組み合わせ、「クリックで選択が変わる」「選択すると祖先が
 * 開く」「検索でヒットの祖先が開き、外れたものは消える」「目 / 鍵ボタンが
 * enabled / locked を書き換える」を DOM から確かめる。
 */

import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { EditorProvider, useEditor } from '../src/pen/state/EditorContext';
import { NodeTree } from '../src/components/Viewer/NodeTree';
import type { PenDocument, PenNode } from '../src/pen/types';

function rect(id: string, extra: Record<string, unknown> = {}): PenNode {
  return { type: 'rectangle', id, name: id, x: 0, y: 0, width: 10, height: 10, ...extra } as PenNode;
}
function frame(id: string, children: PenNode[], extra: Record<string, unknown> = {}): PenNode {
  return { type: 'frame', id, name: id, x: 0, y: 0, width: 100, height: 100, children, ...extra } as PenNode;
}

/**
 * root
 *  ├ header
 *  │   └ title (text 相当の rect)
 *  └ body
 *      └ card
 *          └ avatar
 */
function makeDoc(): PenDocument {
  return {
    version: '2.10',
    children: [
      frame('root', [frame('header', [rect('title')]), frame('body', [frame('card', [rect('avatar')])])]),
      rect('loose'),
    ],
  };
}

/** useEditor を同じ Provider 配下で観測するためのハーネス */
function Harness({
  onEditor,
  children,
}: {
  onEditor: (e: ReturnType<typeof useEditor>) => void;
  children?: ReactNode;
}) {
  const editor = useEditor();
  onEditor(editor);
  return <>{children}</>;
}

function renderTree(doc = makeDoc()) {
  let editor!: ReturnType<typeof useEditor>;
  const utils = render(
    <EditorProvider doc={doc} rawDoc={doc}>
      <Harness onEditor={(e) => (editor = e)}>
        <NodeTree />
      </Harness>
    </EditorProvider>,
  );
  const item = (id: string) => utils.container.querySelector(`[data-node-id="${id}"]`) as HTMLElement | null;
  const ids = () =>
    Array.from(utils.container.querySelectorAll('[data-node-id]')).map((el) =>
      el.getAttribute('data-node-id'),
    );
  return { ...utils, item, ids, editor: () => editor };
}

beforeAll(() => {
  // jsdom には無い。選択時のスクロールで呼ばれる
  Element.prototype.scrollIntoView = vi.fn();
});

describe('NodeTree — 表示', () => {
  it('トップレベルは展開、その下は畳まれた状態で始まる', () => {
    const { ids } = renderTree();
    expect(ids()).toEqual(['root', 'header', 'body', 'loose']);
  });

  it('▸ をクリックすると子が開き、もう一度で閉じる', () => {
    const { item, ids } = renderTree();
    const toggle = item('header')!.querySelector('.node-tree__toggle')!;
    fireEvent.click(toggle);
    expect(ids()).toContain('title');
    fireEvent.click(toggle);
    expect(ids()).not.toContain('title');
  });

  it('collapsed のときはボタンだけを描く', () => {
    const onToggle = vi.fn();
    const doc = makeDoc();
    const { container } = render(
      <EditorProvider doc={doc} rawDoc={doc}>
        <NodeTree collapsed onTogglePanel={onToggle} />
      </EditorProvider>,
    );
    expect(container.querySelectorAll('[data-node-id]').length).toBe(0);
    fireEvent.click(container.querySelector('.node-tree__toggle-btn')!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('NodeTree — 選択', () => {
  it('行クリックで selectNode され、選択クラスが付く', () => {
    const { item, editor } = renderTree();
    fireEvent.click(item('body')!);
    expect(editor().state.selectedNodeId).toBe('body');
    expect(item('body')!.className).toContain('node-tree__item--selected');
  });

  it('外から深いノードを選択すると祖先が自動で開く', () => {
    const { ids, editor } = renderTree();
    expect(ids()).not.toContain('avatar');
    act(() => editor().selectNode('avatar'));
    expect(ids()).toEqual(expect.arrayContaining(['body', 'card', 'avatar']));
  });

  it('選択すると rAF 後にその行へ scrollIntoView する', async () => {
    const spy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    spy.mockClear();
    const { editor } = renderTree();
    act(() => editor().selectNode('title'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(spy).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
  });
});

describe('NodeTree — 検索', () => {
  it('ヒットの祖先を開き、ヒットしない枝は消す。件数も出す', () => {
    const { container, ids } = renderTree();
    const input = container.querySelector('.node-tree__search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'avatar' } });
    expect(ids()).toEqual(['root', 'body', 'card', 'avatar']);
    expect(container.querySelector('.node-tree__search-result')!.textContent).toBe('1 match');
  });

  it('該当なしのときは No matches', () => {
    const { container, ids } = renderTree();
    const input = container.querySelector('.node-tree__search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(ids()).toEqual([]);
    expect(container.querySelector('.node-tree__search-result')!.textContent).toBe('No matches');
  });

  it('× で検索を消すと全体に戻る。検索で開いた枝は開いたまま', () => {
    const { container, ids } = renderTree();
    const input = container.querySelector('.node-tree__search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'avatar' } });
    fireEvent.click(container.querySelector('.node-tree__search-clear')!);
    expect(container.querySelector('.node-tree__search-result')).toBeNull();
    expect(ids()).toEqual(['root', 'header', 'body', 'card', 'avatar', 'loose']);
  });
});

describe('NodeTree — 目 / 鍵', () => {
  it('目ボタンで enabled が false ↔ true に切り替わる (行の選択は変えない)', () => {
    const { item, editor } = renderTree();
    const eye = item('loose')!.querySelector('button[title^="Hide"]')!;
    fireEvent.click(eye);
    const loose = () => editor().state.doc.children.find((n) => n.id === 'loose') as { enabled?: boolean };
    expect(loose().enabled).toBe(false);
    expect(editor().state.selectedNodeId).toBeNull();
    fireEvent.click(item('loose')!.querySelector('button[title="Show"]')!);
    expect(loose().enabled).toBe(true);
  });

  it('鍵ボタンで locked がトグルする', () => {
    const { item, editor } = renderTree();
    fireEvent.click(item('loose')!.querySelector('button[title="Lock"]')!);
    const loose = () => editor().state.doc.children.find((n) => n.id === 'loose') as { locked?: boolean };
    expect(loose().locked).toBe(true);
    fireEvent.click(item('loose')!.querySelector('button[title^="Unlock"]')!);
    expect(loose().locked).toBe(false);
  });
});

describe('NodeTree — 並び替え (drag & drop)', () => {
  /** jsdom には DataTransfer が無いので drop イベントの中身を手で組む */
  function dt(payload: object | null) {
    const store: Record<string, string> = {};
    if (payload) store['application/pencil-layer'] = JSON.stringify(payload);
    return {
      dataTransfer: {
        setData: (k: string, v: string) => (store[k] = v),
        getData: (k: string) => store[k] ?? '',
        effectAllowed: '',
        dropEffect: '',
      },
    };
  }

  it('同じ親の中で下へドロップすると順序が入れ替わる', () => {
    const { item, editor } = renderTree();
    const target = item('loose')!;
    // 行の下半分にドロップ → 'below'
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 20 } as DOMRect);
    fireEvent.dragOver(target, { ...dt(null), clientY: 15 });
    fireEvent.drop(target, dt({ parentId: null, fromIdx: 0, nodeId: 'root' }));
    expect(editor().state.doc.children.map((n) => n.id)).toEqual(['loose', 'root']);
  });

  it('親が違う場合は何もしない', () => {
    const { item, editor } = renderTree();
    const before = editor().state.doc.children.map((n) => n.id);
    const target = item('header')!;
    fireEvent.dragOver(target, { ...dt(null), clientY: 0 });
    fireEvent.drop(target, dt({ parentId: null, fromIdx: 1, nodeId: 'loose' }));
    expect(editor().state.doc.children.map((n) => n.id)).toEqual(before);
  });
});
