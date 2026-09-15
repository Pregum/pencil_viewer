/**
 * useFrameNavigation (#71 で PenViewer から切り出し) の検証。
 *
 * 履歴の積み方・戻る/進むの境界、Vim 移動のソート順と端の扱いを押さえる。
 * camera は setState をモックせず、実際の useState と組み合わせて
 * 「ジャンプすると camera が動き、戻ると元に戻る」ところまで見る。
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { useFrameNavigation } from '../src/components/Viewer/useFrameNavigation';
import type { Camera } from '../src/components/Viewer/usePanZoom';
import type { FrameEntry } from '../src/components/Viewer/frames';

function frame(id: string, x: number, y: number, w = 100, h = 100): FrameEntry {
  return { id, name: id, x, y, width: w, height: h };
}

/** 横に 3 枚、縦に 1 枚ずれた計 4 フレーム */
const FRAMES = [frame('a', 0, 0), frame('b', 200, 0), frame('c', 400, 0), frame('d', 0, 300)];

function useHarness(frames: FrameEntry[] = FRAMES) {
  const [camera, setCamera] = useState<Camera>({ cx: 0, cy: 0, svgWidth: 1000 });
  // zoomToRect は矩形の中心に寄せるだけの簡易版
  const zoomToRect = useCallback((r: { x: number; y: number; width: number; height: number }) => {
    setCamera({ cx: r.x + r.width / 2, cy: r.y + r.height / 2, svgWidth: r.width });
  }, []);
  const fitToDocument = useCallback(() => setCamera({ cx: 0, cy: 0, svgWidth: 1000 }), []);
  const nav = useFrameNavigation({ frames, camera, setCamera, zoomToRect, fitToDocument });
  return { camera, nav };
}

describe('useFrameNavigation — 履歴', () => {
  it('初期状態では戻る / 進むどちらも不可', () => {
    const { result } = renderHook(() => useHarness());
    expect(result.current.nav.canGoBack).toBe(false);
    expect(result.current.nav.canGoForward).toBe(false);
    expect(result.current.nav.activeFrameId).toBeNull();
  });

  it('zoomToFrame でカメラが動き、activeFrameId が更新される', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.zoomToFrame(FRAMES[1]));
    expect(result.current.nav.activeFrameId).toBe('b');
    expect(result.current.camera.cx).toBe(250);
  });

  it('2 回ジャンプすると戻れる。戻ると 1 つ前のフレームに戻る', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.zoomToFrame(FRAMES[0]));
    act(() => result.current.nav.zoomToFrame(FRAMES[2]));
    expect(result.current.nav.canGoBack).toBe(true);
    expect(result.current.nav.canGoForward).toBe(false);

    act(() => result.current.nav.navigateBack());
    expect(result.current.nav.activeFrameId).toBe('a');
    expect(result.current.nav.canGoForward).toBe(true);

    act(() => result.current.nav.navigateForward());
    expect(result.current.nav.activeFrameId).toBe('c');
    // NOTE: 履歴エントリは「ジャンプ前のカメラ」と「ジャンプ先のフレーム id」を
    // 組にしているため、戻った先のカメラ位置はハイライトと一致しない。
    // 切り出し前からの挙動なのでここでは camera を検証しない (別 issue で扱う)
  });

  it('先頭で戻る / 末尾で進むは何もしない', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.zoomToFrame(FRAMES[0]));
    const before = result.current.camera;
    act(() => result.current.nav.navigateForward());
    expect(result.current.camera).toBe(before);
    act(() => result.current.nav.navigateBack());
    // 履歴が 1 件しか無いので戻れない
    expect(result.current.camera).toBe(before);
  });

  it('resetView はカメラを全体表示に戻し、ハイライトも外す', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.zoomToFrame(FRAMES[1]));
    act(() => result.current.nav.resetView());
    expect(result.current.nav.activeFrameId).toBeNull();
    expect(result.current.camera).toEqual({ cx: 0, cy: 0, svgWidth: 1000 });
  });
});

describe('useFrameNavigation — Vim 移動', () => {
  it('選択なしで l を押すと x 順の先頭フレームへ', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.navigateVim('l', 1));
    // x 順: a(0), d(0), b(200), c(400)。同じ x は y で並ぶので a が先頭
    expect(result.current.nav.activeFrameId).toBe('a');
  });

  it('count 付きで飛び、端を超えない', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.navigateVim('l', 1)); // a
    act(() => result.current.nav.navigateVim('l', 2)); // a → d → b
    expect(result.current.nav.activeFrameId).toBe('b');
    act(() => result.current.nav.navigateVim('l', 10)); // 末尾 c で止まる
    expect(result.current.nav.activeFrameId).toBe('c');
    act(() => result.current.nav.navigateVim('h', 10)); // 先頭 a で止まる
    expect(result.current.nav.activeFrameId).toBe('a');
  });

  it('j は y 順で下のフレームへ', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.navigateVim('l', 1)); // a
    act(() => result.current.nav.navigateVim('j', 3)); // y 順: a,b,c (y=0), d (y=300)
    expect(result.current.nav.activeFrameId).toBe('d');
  });

  it('Vim 移動も履歴に積まれる', () => {
    const { result } = renderHook(() => useHarness());
    act(() => result.current.nav.navigateVim('l', 1));
    act(() => result.current.nav.navigateVim('l', 1));
    expect(result.current.nav.canGoBack).toBe(true);
    act(() => result.current.nav.navigateBack());
    expect(result.current.nav.activeFrameId).toBe('a');
  });

  it('フレームが無ければ何もしない', () => {
    const { result } = renderHook(() => useHarness([]));
    const spy = vi.fn();
    act(() => result.current.nav.navigateVim('l', 1));
    expect(result.current.nav.activeFrameId).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
