/**
 * usePanZoom (#85 で PenViewer から切り出し) の検証 (#80)。
 *
 * カメラ計算そのものは fitCamera.test.ts が押さえているので、ここでは
 * hook としての配線を見る: ズーム操作でカメラが動くこと、倍率が MIN/MAX で
 * 止まること、ホイール / ポインタでのパンとズーム、Space+ドラッグ。
 *
 * jsdom には ResizeObserver が無いので、observe した瞬間に 1 回だけ
 * コールバックを呼ぶ簡易版を差し込む。clientWidth/Height も 0 なので
 * 必要なテストでは getter を上書きしている。
 */

import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { usePanZoom, type PanZoom } from '../src/components/Viewer/usePanZoom';
import type { PenDocument } from '../src/pen/types';
import type { ViewBox } from '../src/pen/renderer/viewBox';

const DOC: PenDocument = { version: '2.10', children: [] };
const BASE: ViewBox = { x: 0, y: 0, width: 1000, height: 500 };

beforeAll(() => {
  class RO {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe() {
      this.cb([], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
  // キャンバスを 800x400 として扱う
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 });
});

/** hook を実際の DOM (containerRef の付いた div) と一緒に動かす */
function Harness({ onHook }: { onHook: (h: PanZoom) => void }) {
  const pz = usePanZoom(DOC, BASE);
  onHook(pz);
  const { containerRef, handlePointerDown, handlePointerMove, handlePointerUp } = pz;
  return (
    <div
      ref={containerRef}
      data-testid="canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}

function setup() {
  let latest!: PanZoom;
  const utils = render(<Harness onHook={(h) => (latest = h)} />);
  const canvas = utils.getByTestId('canvas');
  // getBoundingClientRect も 0 なので、ズーム計算用に固定値を返す
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 400,
    right: 800,
    bottom: 400,
  } as DOMRect);
  return { ...utils, canvas, pz: () => latest };
}

describe('usePanZoom — 初期化', () => {
  it('マウント後に doc 全体へフィットし、clientSize を拾う', () => {
    const { pz } = setup();
    expect(pz().clientSize).toEqual({ width: 800, height: 400 });
    // 1000x500 を 800x400 (同じ比率) に収める → 少し余白を足した幅
    expect(pz().camera.cx).toBe(500);
    expect(pz().camera.cy).toBe(250);
    expect(pz().camera.svgWidth).toBeGreaterThan(1000);
    expect(pz().viewBox.width).toBe(pz().camera.svgWidth);
  });
});

describe('usePanZoom — ズーム API', () => {
  it('zoomTo100 で svgWidth が baseVb.width になり 100% と表示される', () => {
    const { pz } = setup();
    act(() => pz().zoomTo100());
    expect(pz().camera.svgWidth).toBe(1000);
    expect(pz().zoomPercent).toBe(100);
    expect(pz().scale).toBe(1);
  });

  it('zoomByFactor(2) で倍率が 2 倍になる (svgWidth は半分)', () => {
    const { pz } = setup();
    act(() => pz().zoomTo100());
    act(() => pz().zoomByFactor(2));
    expect(pz().camera.svgWidth).toBe(500);
    expect(pz().zoomPercent).toBe(200);
  });

  it('倍率は MIN 5% / MAX 6400% で止まる', () => {
    const { pz } = setup();
    act(() => pz().zoomByFactor(1e9));
    expect(pz().zoomPercent).toBe(6400);
    act(() => pz().zoomByFactor(1e-9));
    expect(pz().zoomPercent).toBe(5);
    expect(pz().clampSvgWidth(1)).toBe(1000 / 64);
  });

  it('zoomToRect は矩形の中心に寄せる', () => {
    const { pz } = setup();
    act(() => pz().zoomToRect({ x: 100, y: 100, width: 200, height: 100 }));
    expect(pz().camera.cx).toBe(200);
    expect(pz().camera.cy).toBe(150);
    expect(pz().camera.svgWidth).toBeLessThan(1000);
  });

  it('fitToDocument で全体表示に戻る', () => {
    const { pz } = setup();
    const initial = pz().camera;
    act(() => pz().zoomToRect({ x: 100, y: 100, width: 200, height: 100 }));
    act(() => pz().fitToDocument());
    expect(pz().camera).toEqual(initial);
  });
});

describe('usePanZoom — ホイール', () => {
  it('素のホイールはパン (deltaX/Y を SVG 単位に変換)', () => {
    const { pz, canvas } = setup();
    act(() => pz().zoomTo100());
    // 800px で 1000 SVG 単位 → 1px = 1.25 単位
    fireEvent.wheel(canvas, { deltaX: 80, deltaY: 40 });
    expect(pz().camera.cx).toBeCloseTo(500 + 100);
    expect(pz().camera.cy).toBeCloseTo(250 + 50);
  });

  it('Cmd/Ctrl+ホイールはズームで、カーソル下の点が動かない', () => {
    const { pz, canvas } = setup();
    act(() => pz().zoomTo100());
    // カーソルを左上 (0,0) に置いてズームイン → 左上 (SVG 0,0) が固定される
    fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 });
    const vb = pz().viewBox;
    expect(vb.width).toBeLessThan(1000);
    expect(vb.x).toBeCloseTo(0);
    expect(vb.y).toBeCloseTo(0);
  });
});

describe('usePanZoom — ポインタ', () => {
  it('左クリックだけではパンしない', () => {
    const { pz, canvas } = setup();
    act(() => pz().zoomTo100());
    const before = pz().camera;
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 150, pointerType: 'mouse' });
    expect(pz().camera).toEqual(before);
  });

  it('中ボタンドラッグでパンする (ドラッグ方向と逆にカメラが動く)', () => {
    const { pz, canvas } = setup();
    act(() => pz().zoomTo100());
    (canvas as HTMLElement).setPointerCapture = vi.fn();
    fireEvent.pointerDown(canvas, {
      button: 1,
      clientX: 100,
      clientY: 100,
      pointerType: 'mouse',
      pointerId: 1,
    });
    expect(pz().isPanning.current).toBe(true);
    fireEvent.pointerMove(canvas, { clientX: 180, clientY: 140, pointerType: 'mouse', pointerId: 1 });
    // 80px 右へドラッグ = 100 SVG 単位、カメラは左へ
    expect(pz().camera.cx).toBeCloseTo(500 - 100);
    expect(pz().camera.cy).toBeCloseTo(250 - 50);
    fireEvent.pointerUp(canvas, { pointerType: 'mouse', pointerId: 1 });
    expect(pz().isPanning.current).toBe(false);
  });

  it('Space を押している間は左ドラッグでパンする', () => {
    const { pz, canvas } = setup();
    act(() => pz().zoomTo100());
    (canvas as HTMLElement).setPointerCapture = vi.fn();
    fireEvent.keyDown(window, { code: 'Space' });
    expect(pz().isSpaceHeld.current).toBe(true);
    fireEvent.pointerDown(canvas, { button: 0, clientX: 0, clientY: 0, pointerType: 'mouse', pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 8, clientY: 0, pointerType: 'mouse', pointerId: 1 });
    expect(pz().camera.cx).toBeCloseTo(500 - 10);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(pz().isSpaceHeld.current).toBe(false);
  });

  it('タッチ 2 本指のピンチでズームする', () => {
    const { pz, canvas } = setup();
    act(() => pz().zoomTo100());
    (canvas as HTMLElement).setPointerCapture = vi.fn();
    const touch = (type: string, id: number, x: number, y: number) =>
      fireEvent[type as 'pointerDown'](canvas, {
        pointerType: 'touch',
        pointerId: id,
        clientX: x,
        clientY: y,
        button: 0,
      });
    touch('pointerDown', 1, 300, 200);
    touch('pointerDown', 2, 500, 200); // 指の距離 200px
    touch('pointerMove', 2, 700, 200); // 距離 400px → 2 倍ズームイン
    expect(pz().camera.svgWidth).toBeCloseTo(500);
    touch('pointerUp', 2, 700, 200);
    touch('pointerUp', 1, 300, 200);
    expect(pz().isPanning.current).toBe(false);
  });
});
