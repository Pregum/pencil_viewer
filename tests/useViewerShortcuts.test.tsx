/**
 * useViewerShortcuts (#71 で PenViewer から切り出し) の検証 (#80)。
 *
 * 190 行の keydown リスナーで、切り出す前はカバレッジ 0% だった。
 * 依存はすべてモックで渡し、キーを window に投げて「どの操作が呼ばれるか」
 * 「入力欄では Vim キーが効かないこと」「vimMode の切替がリスナーに伝わること」
 * を見る。
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { useViewerShortcuts, type ViewerShortcutDeps } from '../src/components/Viewer/useViewerShortcuts';
import type { Camera } from '../src/components/Viewer/usePanZoom';
import { isAIGenerateEnabled } from '../src/utils/aiGenerate';

// Cmd+K の可否は VITE_AI_REVIEW_URL の有無で決まる。ローカルの .env.local に
// 左右されないようモックして両方の分岐を見る
vi.mock('../src/utils/aiGenerate', () => ({ isAIGenerateEnabled: vi.fn(() => false) }));

function makeDeps(over: Partial<ViewerShortcutDeps> = {}): ViewerShortcutDeps {
  return {
    vimMode: false,
    containerRef: createRef<HTMLDivElement>(),
    setCamera: vi.fn(),
    setActiveFrameId: vi.fn(),
    navigateBack: vi.fn(),
    navigateForward: vi.fn(),
    navigateVim: vi.fn(),
    resetView: vi.fn(),
    zoomTo100: vi.fn(),
    zoomByFactor: vi.fn(),
    setShowCommandPalette: vi.fn(),
    setShowFrameSearch: vi.fn(),
    setShowAutoId: vi.fn(),
    setShowShortcuts: vi.fn(),
    setShowRulers: vi.fn(),
    setShowFindReplace: vi.fn(),
    setShowAIGenerate: vi.fn(),
    setShowDevInspect: vi.fn(),
    setPresentMode: vi.fn(),
    setFocusMode: vi.fn(),
    ...over,
  };
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}, target: EventTarget = window) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  act(() => {
    target.dispatchEvent(ev);
  });
  return ev;
}

/** トグル系 setter は updater 関数を受け取るので、呼ばれたか + 反転するかを見る */
function expectToggled(fn: ReturnType<typeof vi.fn>) {
  expect(fn).toHaveBeenCalledTimes(1);
  const updater = fn.mock.calls[0][0] as (v: boolean) => boolean;
  expect(updater(false)).toBe(true);
  expect(updater(true)).toBe(false);
}

describe('useViewerShortcuts — Cmd 系', () => {
  it.each([
    ['[', 'navigateBack'],
    [']', 'navigateForward'],
    ['0', 'resetView'],
    ['1', 'zoomTo100'],
  ] as const)('Cmd+%s → %s', (key, fnName) => {
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    const ev = press(key, { metaKey: true });
    expect(deps[fnName]).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('Cmd++ / Cmd+- でズーム倍率が変わる', () => {
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    press('=', { metaKey: true });
    expect(deps.zoomByFactor).toHaveBeenLastCalledWith(1.25);
    press('-', { metaKey: true });
    expect(deps.zoomByFactor).toHaveBeenLastCalledWith(1 / 1.25);
  });

  it.each([
    ['p', { shiftKey: true }, 'setShowCommandPalette'],
    ['p', {}, 'setShowFrameSearch'],
    ['i', {}, 'setShowAutoId'],
    ['/', {}, 'setShowShortcuts'],
    [';', {}, 'setShowRulers'],
    ['f', {}, 'setShowFindReplace'],
    ['Enter', {}, 'setPresentMode'],
    ['.', {}, 'setFocusMode'],
    ['d', { shiftKey: true }, 'setShowDevInspect'],
  ] as const)('Cmd+%s %o → %s をトグル', (key, mods, fnName) => {
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    press(key, { metaKey: true, ...mods });
    expectToggled(deps[fnName] as ReturnType<typeof vi.fn>);
  });

  it('Ctrl でも同じ (Windows / Linux)', () => {
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    press('0', { ctrlKey: true });
    expect(deps.resetView).toHaveBeenCalledTimes(1);
  });

  it('Cmd+K は AI Generator が無効なら何もしない', () => {
    vi.mocked(isAIGenerateEnabled).mockReturnValue(false);
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    const ev = press('k', { metaKey: true });
    expect(deps.setShowAIGenerate).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('Cmd+K は AI Generator が有効ならパネルをトグルする', () => {
    vi.mocked(isAIGenerateEnabled).mockReturnValue(true);
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    press('K', { metaKey: true, shiftKey: true });
    expectToggled(deps.setShowAIGenerate as ReturnType<typeof vi.fn>);
  });
});

describe('useViewerShortcuts — Shift+数字', () => {
  it('Shift+1 で Fit、Shift+2 で選択ノードへズームのイベントを飛ばす', () => {
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    const spy = vi.fn();
    window.addEventListener('pencil-zoom-to-selected', spy);
    press('1', { shiftKey: true });
    expect(deps.resetView).toHaveBeenCalledTimes(1);
    press('2', { shiftKey: true });
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('pencil-zoom-to-selected', spy);
  });

  it('入力欄にフォーカスがあるときは Shift+1 を奪わない', () => {
    const deps = makeDeps();
    renderHook(() => useViewerShortcuts(deps));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('1', { shiftKey: true }, input);
    expect(deps.resetView).not.toHaveBeenCalled();
    input.remove();
  });
});

describe('useViewerShortcuts — Vim モード', () => {
  it('vimMode off では h/j/k/l に反応せず、/ だけ検索を開く', () => {
    const deps = makeDeps({ vimMode: false });
    renderHook(() => useViewerShortcuts(deps));
    press('l');
    expect(deps.setCamera).not.toHaveBeenCalled();
    expect(deps.navigateVim).not.toHaveBeenCalled();
    press('/');
    expect(deps.setShowFrameSearch).toHaveBeenCalledWith(true);
  });

  it('選択が無ければ h/j/k/l はカメラをパンする', () => {
    const deps = makeDeps({ vimMode: true });
    renderHook(() => useViewerShortcuts(deps));
    press('l');
    expect(deps.setCamera).toHaveBeenCalledTimes(1);
    const updater = deps.setCamera as unknown as ReturnType<typeof vi.fn>;
    const next = (updater.mock.calls[0][0] as (c: Camera) => Camera)({ cx: 0, cy: 0, svgWidth: 1000 });
    // 5% of view per press
    expect(next).toEqual({ cx: 50, cy: 0, svgWidth: 1000 });
  });

  it('数字プレフィックスが count になり、g + 方向でフレームジャンプ', () => {
    const deps = makeDeps({ vimMode: true });
    renderHook(() => useViewerShortcuts(deps));
    press('3');
    press('g');
    press('j');
    expect(deps.navigateVim).toHaveBeenCalledWith('j', 3);
    // count はリセットされる
    press('g');
    press('j');
    expect(deps.navigateVim).toHaveBeenLastCalledWith('j', 1);
  });

  it('Shift+H/J/K/L は半画面スクロール', () => {
    const deps = makeDeps({ vimMode: true });
    renderHook(() => useViewerShortcuts(deps));
    press('J');
    const updater = deps.setCamera as unknown as ReturnType<typeof vi.fn>;
    const next = (updater.mock.calls[0][0] as (c: Camera) => Camera)({ cx: 0, cy: 0, svgWidth: 1600 });
    // containerRef が無いので aspect 16/9 → 高さ 900、その半分
    expect(next.cy).toBeCloseTo(450);
    expect(next.cx).toBe(0);
  });

  it('ノードが選択されていれば h/j/k/l は nudge イベントになる', () => {
    const deps = makeDeps({ vimMode: true });
    renderHook(() => useViewerShortcuts(deps));
    const selected = document.createElement('div');
    selected.className = 'node-tree__item--selected';
    document.body.appendChild(selected);
    const spy = vi.fn();
    window.addEventListener('pencil-nudge', spy);
    press('2');
    press('h');
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toEqual({ direction: 'h', count: 2 });
    expect(deps.setCamera).not.toHaveBeenCalled();
    window.removeEventListener('pencil-nudge', spy);
    selected.remove();
  });

  it('i で insert、F で選択ノードへズーム、Esc でフレーム選択解除', () => {
    const deps = makeDeps({ vimMode: true });
    renderHook(() => useViewerShortcuts(deps));
    const insert = vi.fn();
    const zoom = vi.fn();
    window.addEventListener('pencil-enter-insert', insert);
    window.addEventListener('pencil-zoom-to-selected', zoom);
    press('i');
    press('F');
    press('Escape');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(deps.setActiveFrameId).toHaveBeenCalledWith(null);
    window.removeEventListener('pencil-enter-insert', insert);
    window.removeEventListener('pencil-zoom-to-selected', zoom);
  });

  it('入力欄にフォーカスがあるときは Vim キーを奪わない', () => {
    const deps = makeDeps({ vimMode: true });
    renderHook(() => useViewerShortcuts(deps));
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    press('l', {}, input);
    expect(deps.setCamera).not.toHaveBeenCalled();
    input.remove();
  });

  it('vimMode を後から切り替えてもリスナーに伝わる (#78 の stale closure 回帰防止)', () => {
    let deps = makeDeps({ vimMode: false });
    const { rerender } = renderHook(({ d }) => useViewerShortcuts(d), { initialProps: { d: deps } });
    press('l');
    expect(deps.setCamera).not.toHaveBeenCalled();
    deps = { ...deps, vimMode: true };
    rerender({ d: deps });
    press('l');
    expect(deps.setCamera).toHaveBeenCalledTimes(1);
  });
});
