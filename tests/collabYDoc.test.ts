/**
 * 共同編集の CRDT レイヤー (Yjs) の検証。
 *
 * y-webrtc を通さず Y.Doc 同士を Y.applyUpdate で直結することで、
 * ネットワークなしに同期・マージの挙動を確認する。useCollab が
 * 実際に使っているスキーマ (Y.Map 'pen-document' の version /
 * children キー) と LOCAL_ORIGIN のエコーガードを対象にする。
 */

import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { PenDocument, PenNode, RectangleNode } from '../src/pen/types';

/** useCollab.ts と同じ値。ここがずれるとエコーガードが壊れる */
const LOCAL_ORIGIN = 'pencil-local';
const MAP_KEY = 'pen-document';

function rect(id: string, x: number, y: number): RectangleNode {
  return { type: 'rectangle', id, x, y, width: 10, height: 10 } as RectangleNode;
}

function doc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}

/** useCollab.joinRoom / syncDoc と同じ書き込み方 */
function writeDoc(ydoc: Y.Doc, d: PenDocument, origin: unknown = LOCAL_ORIGIN) {
  const ymap = ydoc.getMap(MAP_KEY);
  ydoc.transact(() => {
    ymap.set('version', d.version);
    ymap.set('children', JSON.stringify(d.children));
  }, origin);
}

function readDoc(ydoc: Y.Doc): PenDocument {
  const ymap = ydoc.getMap(MAP_KEY);
  return {
    version: (ymap.get('version') as string) ?? '1.0',
    children: JSON.parse((ymap.get('children') as string) ?? '[]'),
  };
}

/** 2 つの Y.Doc を双方向に繋ぐ (WebRTC の代わり) */
function connect(a: Y.Doc, b: Y.Doc): () => void {
  const aToB = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return;
    Y.applyUpdate(b, update, 'remote');
  };
  const bToA = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return;
    Y.applyUpdate(a, update, 'remote');
  };
  a.on('update', aToB);
  b.on('update', bToA);
  // 既存 state の初期同期
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'remote');
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b), 'remote');
  return () => {
    a.off('update', aToB);
    b.off('update', bToA);
  };
}

describe('collab — Y.Doc スキーマの往復', () => {
  it('書き込んだ PenDocument をそのまま読み戻せる', () => {
    const ydoc = new Y.Doc();
    const original = doc([rect('a', 0, 0), rect('b', 20, 5)]);
    writeDoc(ydoc, original);
    expect(readDoc(ydoc)).toEqual(original);
    ydoc.destroy();
  });

  it('children 未設定なら空配列・version は 1.0 にフォールバックする', () => {
    const ydoc = new Y.Doc();
    expect(readDoc(ydoc)).toEqual({ version: '1.0', children: [] });
    ydoc.destroy();
  });

  it('入れ子の frame を含む doc も欠落なく往復する', () => {
    const ydoc = new Y.Doc();
    const nested = doc([
      { type: 'frame', id: 'f', x: 0, y: 0, width: 100, height: 100, layout: 'none',
        children: [rect('c1', 1, 1), rect('c2', 2, 2)] } as unknown as PenNode,
    ]);
    writeDoc(ydoc, nested);
    expect(readDoc(ydoc)).toEqual(nested);
    ydoc.destroy();
  });
});

describe('collab — peer 間の同期', () => {
  it('作成者が seed した doc が参加者に伝わる', () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    writeDoc(host, doc([rect('a', 0, 0)]));

    const cleanup = connect(host, guest);
    expect(readDoc(guest).children).toHaveLength(1);
    expect((readDoc(guest).children[0] as RectangleNode).id).toBe('a');

    cleanup();
    host.destroy();
    guest.destroy();
  });

  it('接続後の編集が双方向に伝播する', () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    writeDoc(host, doc([rect('a', 0, 0)]));
    const cleanup = connect(host, guest);

    // guest → host
    writeDoc(guest, doc([rect('a', 0, 0), rect('b', 30, 0)]));
    expect(readDoc(host).children).toHaveLength(2);

    // host → guest
    writeDoc(host, doc([rect('a', 99, 0), rect('b', 30, 0)]));
    expect((readDoc(guest).children[0] as RectangleNode).x).toBe(99);

    cleanup();
    host.destroy();
    guest.destroy();
  });

  it('切断中の編集は再接続時にマージされる', () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    writeDoc(host, doc([rect('a', 0, 0)]));
    const cleanup = connect(host, guest);
    cleanup(); // 切断

    writeDoc(host, doc([rect('a', 0, 0), rect('offline', 50, 50)]));
    expect(readDoc(guest).children).toHaveLength(1); // まだ届いていない

    const cleanup2 = connect(host, guest); // 再接続
    expect(readDoc(guest).children).toHaveLength(2);

    cleanup2();
    host.destroy();
    guest.destroy();
  });
});

describe('collab — エコーガード (LOCAL_ORIGIN)', () => {
  it('自分の書き込み (LOCAL_ORIGIN) では observe ハンドラが素通りする', () => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap(MAP_KEY);
    const onRemote = vi.fn();

    // useCollab.joinRoom と同じ observe
    ymap.observe((_e, transaction) => {
      if (transaction.origin === LOCAL_ORIGIN) return;
      onRemote();
    });

    writeDoc(ydoc, doc([rect('a', 0, 0)]), LOCAL_ORIGIN);
    expect(onRemote).not.toHaveBeenCalled();
    ydoc.destroy();
  });

  it('リモート由来の適用では observe ハンドラが呼ばれる', () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    const received: PenDocument[] = [];

    guest.getMap(MAP_KEY).observe((_e, transaction) => {
      if (transaction.origin === LOCAL_ORIGIN) return;
      received.push(readDoc(guest));
    });

    const cleanup = connect(host, guest);
    writeDoc(host, doc([rect('a', 7, 7)]));

    expect(received.length).toBeGreaterThan(0);
    expect((received[received.length - 1].children[0] as RectangleNode).x).toBe(7);

    cleanup();
    host.destroy();
    guest.destroy();
  });

  it('壊れた children JSON を受け取っても例外を投げない', () => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap(MAP_KEY);
    const onRemote = vi.fn();

    // useCollab.joinRoom の observe と同じ try/catch 構造
    ymap.observe((_e, transaction) => {
      if (transaction.origin === LOCAL_ORIGIN) return;
      const childrenStr = ymap.get('children') as string | undefined;
      if (!childrenStr) return;
      try {
        onRemote(JSON.parse(childrenStr));
      } catch {
        // ignore parse errors
      }
    });

    expect(() => {
      ydoc.transact(() => { ymap.set('children', '{not json'); }, 'remote');
    }).not.toThrow();
    expect(onRemote).not.toHaveBeenCalled();
    ydoc.destroy();
  });
});

describe('collab — 既知の制限: children 一括 JSON による後勝ち', () => {
  it('別ノードの同時編集でも片方が失われる (v2 の課題として固定)', () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    writeDoc(host, doc([rect('a', 0, 0), rect('b', 50, 0)]));
    const cleanup = connect(host, guest);
    cleanup(); // 一旦切断して「同時編集」を作る

    // host は a を、guest は b を動かす — 別ノードなので本来は両立するはず
    writeDoc(host, doc([rect('a', 111, 0), rect('b', 50, 0)]));
    writeDoc(guest, doc([rect('a', 0, 0), rect('b', 222, 0)]));

    const cleanup2 = connect(host, guest);

    // children を Y.Map の 1 キーに JSON で持つため、マージではなく後勝ちになる。
    // 両者は収束するが、片方の編集は必ず失われる。
    const hostChildren = readDoc(host).children as RectangleNode[];
    const guestChildren = readDoc(guest).children as RectangleNode[];
    expect(hostChildren).toEqual(guestChildren); // 収束はする

    const aMoved = hostChildren[0].x === 111;
    const bMoved = hostChildren[1].x === 222;
    expect(aMoved || bMoved).toBe(true);
    expect(aMoved && bMoved).toBe(false); // 両立しない = 後勝ち

    cleanup2();
    host.destroy();
    guest.destroy();
  });
});
