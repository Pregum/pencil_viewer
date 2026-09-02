/**
 * CollabSync ブリッジの検証。
 *
 * CollabSync は表示を持たず、EditorContext と useCollab の間で
 * ドキュメントを双方向に橋渡しするだけのコンポーネント。ここでは
 * useCollab 側を素の spy に置き換え、EditorProvider の中に置いて
 * 以下を確認する。
 *
 * - リモート → ローカル: replaceDocChildren への適用とエコー抑止
 * - ローカル → リモート: 120ms debounce と joining 中の送信停止
 * - 選択ノードの awareness 送信
 * - 切断時の内部状態リセット
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { CollabSync } from '../src/collab/CollabSync';
import { EditorProvider, useEditor } from '../src/pen/state/EditorContext';
import type { PenDocument, PenNode, RectangleNode } from '../src/pen/types';

function rect(id: string, x = 0): RectangleNode {
  return { type: 'rectangle', id, x, y: 0, width: 10, height: 10 } as RectangleNode;
}
function makeDoc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}

/** CollabSync に渡す props を spy 付きで組み立てる */
function makeProps(overrides: Partial<Parameters<typeof CollabSync>[0]> = {}) {
  const syncDoc = vi.fn();
  const setLocalSelection = vi.fn();
  /** setRemoteHandler で登録されたハンドラを掴んでおき、テストから発火する */
  const handlerRef: { current: ((doc: PenDocument) => void) | null } = { current: null };
  const setRemoteHandler = vi.fn((cb: ((doc: PenDocument) => void) | null) => {
    handlerRef.current = cb;
  });
  return {
    props: { connected: true, joining: false, syncDoc, setRemoteHandler, setLocalSelection, ...overrides },
    syncDoc,
    setLocalSelection,
    setRemoteHandler,
    handlerRef,
  };
}

/** EditorContext を外から操作するための踏み台 */
function EditorHandle({ onReady }: { onReady: (api: ReturnType<typeof useEditor>) => void }) {
  const api = useEditor();
  useEffect(() => { onReady(api); });
  return null;
}

function renderSync(
  props: Parameters<typeof CollabSync>[0],
  doc: PenDocument,
  onReady?: (api: ReturnType<typeof useEditor>) => void,
) {
  let node: ReactNode = <CollabSync {...props} />;
  if (onReady) node = <>{node}<EditorHandle onReady={onReady} /></>;
  return render(<EditorProvider doc={doc} rawDoc={doc}>{node}</EditorProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CollabSync — リモートハンドラの登録', () => {
  it('接続中はハンドラを登録する', () => {
    const { props, setRemoteHandler, handlerRef } = makeProps();
    renderSync(props, makeDoc([rect('a')]));
    expect(setRemoteHandler).toHaveBeenCalled();
    expect(handlerRef.current).toBeTypeOf('function');
  });

  it('未接続ならハンドラを登録しない', () => {
    const { props, setRemoteHandler, handlerRef } = makeProps({ connected: false });
    renderSync(props, makeDoc([rect('a')]));
    expect(setRemoteHandler).toHaveBeenCalledWith(null);
    expect(handlerRef.current).toBeNull();
  });

  it('unmount でハンドラを解除する', () => {
    const { props, handlerRef } = makeProps();
    const { unmount } = renderSync(props, makeDoc([rect('a')]));
    expect(handlerRef.current).toBeTypeOf('function');
    unmount();
    expect(handlerRef.current).toBeNull();
  });

  it('表示要素を持たない', () => {
    const { props } = makeProps();
    const { container } = renderSync(props, makeDoc([rect('a')]));
    expect(container.textContent).toBe('');
  });
});

describe('CollabSync — リモート → ローカル', () => {
  it('受信した children をエディタに適用する', () => {
    const { props, handlerRef } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    act(() => { handlerRef.current!(makeDoc([rect('a'), rect('remote', 77)])); });

    expect(api.state.rawDoc.children).toHaveLength(2);
    expect((api.state.rawDoc.children[1] as RectangleNode).id).toBe('remote');
  });

  it('同じ children を再受信しても再適用しない (エコー抑止)', () => {
    const { props, handlerRef } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    const incoming = makeDoc([rect('a'), rect('b', 30)]);
    act(() => { handlerRef.current!(incoming); });
    const afterFirst = api.state.rawDoc;

    act(() => { handlerRef.current!(makeDoc([rect('a'), rect('b', 30)])); });

    // 2 回目は素通りするので rawDoc の参照が変わらない
    expect(api.state.rawDoc).toBe(afterFirst);
  });

  it('リモート受信で保留中のローカル送信を破棄する', () => {
    const { props, syncDoc, handlerRef } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    // ローカル編集して debounce 待ちの状態を作る
    act(() => { api.addNode(rect('local', 10)); });
    act(() => { vi.advanceTimersByTime(50); }); // まだ発火しない
    expect(syncDoc).not.toHaveBeenCalled();

    // debounce 満了前にリモートが届く
    act(() => { handlerRef.current!(makeDoc([rect('a'), rect('remote', 88)])); });
    act(() => { vi.advanceTimersByTime(200); });

    // 破棄された送信は飛ばない。飛ぶとしてもリモート適用後の内容になる
    const sentLocalOnly = syncDoc.mock.calls.some(
      (call) => JSON.stringify((call[0] as PenDocument).children)
        === JSON.stringify([rect('a'), rect('local', 10)]));
    expect(sentLocalOnly).toBe(false);
  });

  it('参加者は初回受信時に pencil-collab-fit を発火する', () => {
    const { props, handlerRef } = makeProps({ joining: true });
    const onFit = vi.fn();
    window.addEventListener('pencil-collab-fit', onFit);

    renderSync(props, makeDoc([]));
    act(() => { handlerRef.current!(makeDoc([rect('a', 5)])); });

    expect(onFit).toHaveBeenCalledTimes(1);
    const detail = (onFit.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toBeTruthy();

    // 2 回目以降は発火しない
    act(() => { handlerRef.current!(makeDoc([rect('a', 5), rect('b')])); });
    expect(onFit).toHaveBeenCalledTimes(1);

    window.removeEventListener('pencil-collab-fit', onFit);
  });

  it('作成者 (joining=false) では fit イベントを発火しない', () => {
    const { props, handlerRef } = makeProps({ joining: false });
    const onFit = vi.fn();
    window.addEventListener('pencil-collab-fit', onFit);

    renderSync(props, makeDoc([rect('a')]));
    act(() => { handlerRef.current!(makeDoc([rect('a'), rect('b')])); });

    expect(onFit).not.toHaveBeenCalled();
    window.removeEventListener('pencil-collab-fit', onFit);
  });
});

describe('CollabSync — ローカル → リモート (debounce)', () => {
  it('ローカル編集を 120ms の debounce 後に送信する', () => {
    const { props, syncDoc } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    act(() => { api.addNode(rect('b', 30)); });
    act(() => { vi.advanceTimersByTime(119); });
    expect(syncDoc).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1); });
    expect(syncDoc).toHaveBeenCalledTimes(1);
    expect(syncDoc.mock.calls[0][0].children).toHaveLength(2);
  });

  it('連続編集は最後の 1 回にまとまる', () => {
    const { props, syncDoc } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    act(() => { api.addNode(rect('b')); });
    act(() => { vi.advanceTimersByTime(60); });
    act(() => { api.addNode(rect('c')); });
    act(() => { vi.advanceTimersByTime(60); });
    act(() => { api.addNode(rect('d')); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(syncDoc).toHaveBeenCalledTimes(1);
    expect(syncDoc.mock.calls[0][0].children).toHaveLength(4);
  });

  it('version を保ったまま送信する', () => {
    const { props, syncDoc } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    act(() => { api.addNode(rect('b')); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(syncDoc.mock.calls[0][0].version).toBe('2.10');
  });

  it('未接続ならローカル編集を送信しない', () => {
    const { props, syncDoc } = makeProps({ connected: false });
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    act(() => { api.addNode(rect('b')); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(syncDoc).not.toHaveBeenCalled();
  });

  it('参加者は初回リモート受信まで送信しない (相手の doc を空で潰さない)', () => {
    const { props, syncDoc, handlerRef } = makeProps({ joining: true });
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([]), (a) => { api = a; });

    // 受信前のローカル編集は送らない
    act(() => { api.addNode(rect('early')); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(syncDoc).not.toHaveBeenCalled();

    // 初回受信後は送るようになる
    act(() => { handlerRef.current!(makeDoc([rect('fromHost')])); });
    act(() => { api.addNode(rect('after', 9)); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(syncDoc).toHaveBeenCalled();
  });
});

describe('CollabSync — 選択の共有', () => {
  it('選択ノードを awareness へ送る', () => {
    const { props, setLocalSelection } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a'), rect('b')]), (a) => { api = a; });

    act(() => { api.selectNode('b'); });
    expect(setLocalSelection).toHaveBeenLastCalledWith(['b']);
  });

  it('複数選択をまとめて送る', () => {
    const { props, setLocalSelection } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a'), rect('b')]), (a) => { api = a; });

    act(() => { api.selectMultiple(['a', 'b']); });
    expect(setLocalSelection).toHaveBeenLastCalledWith(expect.arrayContaining(['a', 'b']));
  });

  it('選択解除で空配列を送る', () => {
    const { props, setLocalSelection } = makeProps();
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    act(() => { api.selectNode('a'); });
    act(() => { api.selectNode(null); });
    expect(setLocalSelection).toHaveBeenLastCalledWith([]);
  });

  it('未接続なら選択を送らない', () => {
    const { props, setLocalSelection } = makeProps({ connected: false });
    let api!: ReturnType<typeof useEditor>;
    renderSync(props, makeDoc([rect('a')]), (a) => { api = a; });

    act(() => { api.selectNode('a'); });
    expect(setLocalSelection).not.toHaveBeenCalled();
  });
});

describe('CollabSync — 切断時のリセット', () => {
  it('切断すると同期済みマーカーが消え、再接続後に再送できる', () => {
    const { props, syncDoc, handlerRef } = makeProps();
    const { rerender } = renderSync(props, makeDoc([rect('a')]));

    act(() => { handlerRef.current!(makeDoc([rect('a'), rect('b', 30)])); });
    act(() => { vi.advanceTimersByTime(200); });
    syncDoc.mockClear();

    // 切断 → 再接続
    const doc = makeDoc([rect('a')]);
    rerender(
      <EditorProvider doc={doc} rawDoc={doc}>
        <CollabSync {...props} connected={false} />
      </EditorProvider>,
    );
    rerender(
      <EditorProvider doc={doc} rawDoc={doc}>
        <CollabSync {...props} connected />
      </EditorProvider>,
    );
    act(() => { vi.advanceTimersByTime(200); });

    // マーカーがリセットされているので、同じ内容でも改めて送信される
    expect(syncDoc).toHaveBeenCalled();
  });
});
