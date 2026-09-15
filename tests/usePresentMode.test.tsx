/**
 * usePresentMode (#71 で PenViewer から切り出し) の検証。
 *
 * ヒットテスト (findTapHit / collectTapMap) は純関数として直接叩き、
 * hook 側はキー操作でスライドが送られること・Esc で抜けることを
 * zoomToRect の呼び出しで確認する。
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { collectTapMap, findTapHit, usePresentMode } from '../src/components/Viewer/usePresentMode';
import type { FrameEntry } from '../src/components/Viewer/frames';
import type { PenNode } from '../src/pen/types';

function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Record<string, unknown> = {},
): PenNode {
  return { type: 'rectangle', id, x, y, width: w, height: h, ...extra } as PenNode;
}
function frameNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  children: PenNode[],
  extra: Record<string, unknown> = {},
): PenNode {
  return { type: 'frame', id, x, y, width: w, height: h, children, ...extra } as PenNode;
}

describe('collectTapMap', () => {
  it('ネストした onTap を id → 遷移先で集める', () => {
    const doc = [
      frameNode('f1', 0, 0, 100, 100, [rect('btn', 10, 10, 20, 20, { onTap: 'f2' })]),
      frameNode('f2', 200, 0, 100, 100, [], { onTap: 'f1' }),
    ];
    const m = collectTapMap(doc);
    expect([...m.entries()]).toEqual([
      ['btn', 'f2'],
      ['f2', 'f1'],
    ]);
  });
});

describe('findTapHit', () => {
  const doc = [
    frameNode('f1', 0, 0, 100, 100, [
      rect('bg', 0, 0, 100, 100), // onTap なし
      rect('btn', 10, 10, 20, 20, { onTap: 'f2' }),
    ]),
    frameNode('f2', 200, 0, 100, 100, [], { onTap: 'f1' }),
  ];
  const tapMap = collectTapMap(doc);

  it('frame の子はローカル座標で判定し、onTap を持つ子を返す', () => {
    expect(findTapHit(doc, 15, 15, tapMap)).toBe('btn');
  });

  it('onTap を持たない子の上では null (親にも onTap が無い)', () => {
    expect(findTapHit(doc, 80, 80, tapMap)).toBeNull();
  });

  it('frame 自身に onTap があればそれを返す', () => {
    expect(findTapHit(doc, 250, 50, tapMap)).toBe('f2');
  });

  it('何も無い場所では null', () => {
    expect(findTapHit(doc, 150, 50, tapMap)).toBeNull();
  });
});

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('usePresentMode', () => {
  const frames: FrameEntry[] = [
    { id: 'f1', name: 'f1', x: 0, y: 0, width: 100, height: 100 },
    { id: 'f2', name: 'f2', x: 200, y: 0, width: 100, height: 100 },
  ];

  function setup() {
    const zoomToRect = vi.fn();
    const setActiveFrameId = vi.fn();
    const svgRef = createRef<SVGSVGElement>();
    const hook = renderHook(() =>
      usePresentMode({ docChildren: [], frames, svgRef, zoomToRect, setActiveFrameId }),
    );
    return { hook, zoomToRect, setActiveFrameId };
  }

  it('presentMode に入ると先頭フレームにズームする', () => {
    const { hook, zoomToRect, setActiveFrameId } = setup();
    expect(zoomToRect).not.toHaveBeenCalled();
    act(() => hook.result.current.setPresentMode(true));
    expect(zoomToRect).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 100, height: 100 });
    expect(setActiveFrameId).toHaveBeenLastCalledWith('f1');
  });

  it('→ で次、← で前のフレームへ。端では止まる', () => {
    const { hook, zoomToRect } = setup();
    act(() => hook.result.current.setPresentMode(true));
    press('ArrowRight');
    expect(zoomToRect).toHaveBeenLastCalledWith(expect.objectContaining({ x: 200 }));
    press('ArrowRight'); // 末尾なので変わらない
    expect(zoomToRect).toHaveBeenLastCalledWith(expect.objectContaining({ x: 200 }));
    press('ArrowLeft');
    expect(zoomToRect).toHaveBeenLastCalledWith(expect.objectContaining({ x: 0 }));
  });

  it('Escape で presentMode を抜ける', () => {
    const { hook } = setup();
    act(() => hook.result.current.setPresentMode(true));
    press('Escape');
    expect(hook.result.current.presentMode).toBe(false);
  });

  it('presentMode でないときはキーに反応しない', () => {
    const { hook, zoomToRect } = setup();
    press('ArrowRight');
    expect(zoomToRect).not.toHaveBeenCalled();
    expect(hook.result.current.presentMode).toBe(false);
  });
});
