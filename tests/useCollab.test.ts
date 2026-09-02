/**
 * useCollab フックのライフサイクル検証。
 *
 * y-webrtc の WebrtcProvider をモックに差し替えて、実際の WebRTC 接続
 * なしに join/disconnect・awareness 送信・招待 URL 生成を確認する。
 * モックは awareness の最小 API (setLocalStateField / getStates / on)
 * だけを再現する。
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as Y from 'yjs';
import type { PenDocument, PenNode, RectangleNode } from '../src/pen/types';

/** 生成された Provider をテストから覗くための記録 */
const providers: MockProvider[] = [];

class MockAwareness {
  states = new Map<number, Record<string, unknown>>();
  local: Record<string, unknown> = {};
  handlers: Array<() => void> = [];

  setLocalStateField(key: string, value: unknown) {
    this.local[key] = value;
  }
  getStates() {
    return this.states;
  }
  on(_event: string, cb: () => void) {
    this.handlers.push(cb);
  }
  /** テスト用: リモート peer の追加を模して change を発火する */
  emitChange() {
    this.handlers.forEach((h) => h());
  }
}

class MockProvider {
  awareness = new MockAwareness();
  destroyed = false;
  constructor(public room: string, public ydoc: Y.Doc, public opts: { signaling: string[] }) {
    providers.push(this);
  }
  destroy() {
    this.destroyed = true;
  }
}

vi.mock('y-webrtc', () => ({
  WebrtcProvider: class {
    constructor(room: string, ydoc: Y.Doc, opts: { signaling: string[] }) {
      return new MockProvider(room, ydoc, opts) as unknown as never;
    }
  },
}));

// モック定義後に import する必要がある
const { useCollab } = await import('../src/collab/useCollab');

function rect(id: string, x = 0): RectangleNode {
  return { type: 'rectangle', id, x, y: 0, width: 10, height: 10 } as RectangleNode;
}
function doc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}
const latest = () => providers[providers.length - 1];

beforeEach(() => {
  providers.length = 0;
  window.history.replaceState({}, '', '/');
});

describe('useCollab — 接続ライフサイクル', () => {
  it('初期状態は未接続', () => {
    const { result } = renderHook(() => useCollab());
    expect(result.current.collab.connected).toBe(false);
    expect(result.current.collab.roomId).toBeNull();
    expect(result.current.collab.peers).toEqual([]);
  });

  it('初期状態でユーザー名と色が割り当てられる', () => {
    const { result } = renderHook(() => useCollab());
    expect(result.current.collab.userName).toBeTruthy();
    expect(result.current.collab.selfColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('createRoom は 8 文字の room ID を返して接続する', () => {
    const { result } = renderHook(() => useCollab());
    let roomId = '';
    act(() => { roomId = result.current.createRoom(doc([rect('a')])); });

    expect(roomId).toMatch(/^[a-z0-9]{8}$/);
    expect(result.current.collab.connected).toBe(true);
    expect(result.current.collab.roomId).toBe(roomId);
  });

  it('room 名は pencil-viewer- プレフィックス付きで Provider に渡る', () => {
    const { result } = renderHook(() => useCollab());
    let roomId = '';
    act(() => { roomId = result.current.createRoom(doc([])); });
    expect(latest().room).toBe(`pencil-viewer-${roomId}`);
  });

  it('createRoom は初期ドキュメントを Y.Doc に seed する', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([rect('seeded', 42)])); });

    const ymap = latest().ydoc.getMap('pen-document');
    expect(ymap.get('version')).toBe('2.10');
    const children = JSON.parse(ymap.get('children') as string) as RectangleNode[];
    expect(children[0].id).toBe('seeded');
    expect(children[0].x).toBe(42);
  });

  it('joinRoom に null を渡すと seed しない (参加者は相手の doc を潰さない)', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.joinRoom('abc12345', null); });

    const ymap = latest().ydoc.getMap('pen-document');
    expect(ymap.get('children')).toBeUndefined();
    expect(result.current.collab.roomId).toBe('abc12345');
  });

  it('disconnect で Provider を破棄して状態をリセットする', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([rect('a')])); });
    const provider = latest();

    act(() => { result.current.disconnect(); });

    expect(provider.destroyed).toBe(true);
    expect(result.current.collab.connected).toBe(false);
    expect(result.current.collab.roomId).toBeNull();
    expect(result.current.collab.peers).toEqual([]);
  });

  it('連続 join では前の Provider が破棄される', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.joinRoom('room0001', doc([])); });
    const first = latest();
    act(() => { result.current.joinRoom('room0002', doc([])); });

    expect(first.destroyed).toBe(true);
    expect(providers).toHaveLength(2);
    expect(result.current.collab.roomId).toBe('room0002');
  });

  it('unmount で Provider を破棄する', () => {
    const { result, unmount } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });
    const provider = latest();
    unmount();
    expect(provider.destroyed).toBe(true);
  });

  it('未接続で syncDoc を呼んでも例外にならない', () => {
    const { result } = renderHook(() => useCollab());
    expect(() => act(() => { result.current.syncDoc(doc([rect('a')])); })).not.toThrow();
  });
});

describe('useCollab — ドキュメント同期', () => {
  it('syncDoc が Y.Map を更新する', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([rect('a')])); });
    act(() => { result.current.syncDoc(doc([rect('a'), rect('b', 30)])); });

    const children = JSON.parse(latest().ydoc.getMap('pen-document').get('children') as string);
    expect(children).toHaveLength(2);
  });

  it('リモート更新が setRemoteHandler に登録したハンドラへ届く', () => {
    const { result } = renderHook(() => useCollab());
    const received: PenDocument[] = [];
    act(() => { result.current.setRemoteHandler((d) => received.push(d)); });
    act(() => { result.current.createRoom(doc([rect('a')])); });

    // リモート由来 (LOCAL_ORIGIN 以外) の書き込みを模す
    const ydoc = latest().ydoc;
    act(() => {
      ydoc.transact(() => {
        const m = ydoc.getMap('pen-document');
        m.set('version', '2.10');
        m.set('children', JSON.stringify([rect('remote', 5)]));
      }, 'remote');
    });

    expect(received).toHaveLength(1);
    expect((received[0].children[0] as RectangleNode).id).toBe('remote');
  });

  it('自分の syncDoc はハンドラに返ってこない (エコー防止)', () => {
    const { result } = renderHook(() => useCollab());
    const received: PenDocument[] = [];
    act(() => { result.current.setRemoteHandler((d) => received.push(d)); });
    act(() => { result.current.createRoom(doc([rect('a')])); });
    act(() => { result.current.syncDoc(doc([rect('a'), rect('b')])); });

    expect(received).toHaveLength(0);
  });
});

describe('useCollab — awareness (presence)', () => {
  it('接続時に自分の user を awareness へ載せる', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });

    const user = latest().awareness.local.user as { name: string; color: string };
    expect(user.name).toBe(result.current.collab.userName);
    expect(user.color).toBe(result.current.collab.selfColor);
  });

  it('setLocalCursor がカーソル位置を送信し null でクリアする', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });

    act(() => { result.current.setLocalCursor({ x: 12, y: 34 }); });
    expect(latest().awareness.local.cursor).toEqual({ x: 12, y: 34 });

    act(() => { result.current.setLocalCursor(null); });
    expect(latest().awareness.local.cursor).toBeUndefined();
  });

  it('setLocalSelection が選択ノード ID を送信する', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });
    act(() => { result.current.setLocalSelection(['n1', 'n2']); });
    expect(latest().awareness.local.selection).toEqual(['n1', 'n2']);
  });

  it('setUserName が state と awareness の両方を更新する', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });
    act(() => { result.current.setUserName('Hokusai'); });

    expect(result.current.collab.userName).toBe('Hokusai');
    expect((latest().awareness.local.user as { name: string }).name).toBe('Hokusai');
  });

  it('awareness の change で peers が更新され、自分自身は除外される', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });

    const provider = latest();
    const selfId = provider.ydoc.clientID;
    provider.awareness.states.set(selfId, { user: { name: 'Me', color: '#000000' } });
    provider.awareness.states.set(999, {
      user: { name: 'Other', color: '#ef4444' },
      cursor: { x: 1, y: 2 },
      selection: ['n1'],
    });

    act(() => { provider.awareness.emitChange(); });

    expect(result.current.collab.peers).toHaveLength(1);
    expect(result.current.collab.peers[0]).toMatchObject({
      id: '999', name: 'Other', color: '#ef4444',
      cursor: { x: 1, y: 2 }, selection: ['n1'],
    });
  });

  it('user フィールドを持たない awareness state は peers に含めない', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });

    const provider = latest();
    provider.awareness.states.set(888, { cursor: { x: 0, y: 0 } }); // user なし
    act(() => { provider.awareness.emitChange(); });

    expect(result.current.collab.peers).toEqual([]);
  });
});

describe('useCollab — 招待リンク', () => {
  it('未接続なら空文字を返す', () => {
    const { result } = renderHook(() => useCollab());
    expect(result.current.getRoomUrl()).toBe('');
  });

  it('room クエリを付与した URL を返す', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.joinRoom('abcd1234', doc([])); });
    expect(result.current.getRoomUrl()).toContain('room=abcd1234');
  });

  it('src / id クエリは招待リンクから取り除く', () => {
    window.history.replaceState({}, '', '/?src=https%3A%2F%2Fexample.com%2Fa.pen&id=xyz');
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.joinRoom('abcd1234', doc([])); });

    const url = result.current.getRoomUrl();
    expect(url).toContain('room=abcd1234');
    expect(url).not.toContain('src=');
    expect(url).not.toContain('id=');
  });
});

describe('useCollab — シグナリング設定', () => {
  it('VITE_COLLAB_SIGNALING 未設定なら signaling は空配列 (同一ブラウザのタブ間のみ)', () => {
    const { result } = renderHook(() => useCollab());
    act(() => { result.current.createRoom(doc([])); });
    expect(latest().opts.signaling).toEqual([]);
  });
});
