/**
 * fitCamera: ドキュメント/フレームを「実際に見えている範囲」に収める計算。
 *
 * 押さえたい回帰は 2 つ。
 * - 幅だけ合わせていたため、縦長のドキュメントで上下が切れていた。
 * - キャンバスに重なる Pages / Layers / Property パネルを勘定に入れておらず、
 *   ドキュメントがパネルの下に潜り込んでいた。
 */

import { describe, it, expect } from 'vitest';
import { fitCamera, viewportOf, type Viewport, type FitRect } from '../src/components/Viewer/fitCamera';

/** カメラから実際に描かれる範囲を復元する（PenViewer の getViewBox と同じ式） */
function visibleRect(cam: { cx: number; cy: number; svgWidth: number }, vp: Viewport) {
  const height = cam.svgWidth / (vp.width / vp.height);
  return {
    x: cam.cx - cam.svgWidth / 2,
    y: cam.cy - height / 2,
    width: cam.svgWidth,
    height,
  };
}

/** パネルに隠れず実際に目に入る範囲（SVG 座標） */
function unobscuredRect(cam: { cx: number; cy: number; svgWidth: number }, vp: Viewport) {
  const full = visibleRect(cam, vp);
  const svgPerPx = cam.svgWidth / vp.width;
  const left = (vp.left ?? 0) * svgPerPx;
  const right = (vp.right ?? 0) * svgPerPx;
  return { ...full, x: full.x + left, width: full.width - left - right };
}

function contains(outer: { x: number; y: number; width: number; height: number }, inner: FitRect) {
  const eps = 1e-6;
  return (
    outer.x <= inner.x + eps &&
    outer.y <= inner.y + eps &&
    outer.x + outer.width >= inner.x + inner.width - eps &&
    outer.y + outer.height >= inner.y + inner.height - eps
  );
}

describe('fitCamera', () => {
  it('パネルが無ければ矩形の中心にカメラを置く', () => {
    const cam = fitCamera({ x: 100, y: 200, width: 400, height: 300 }, { width: 1600, height: 900 });
    expect(cam.cx).toBe(300);
    expect(cam.cy).toBe(350);
  });

  it('横長ビューポート × 縦長ドキュメント: 高さ基準で合わせる', () => {
    const rect = { x: 0, y: 0, width: 400, height: 2000 };
    const vp = { width: 1600, height: 900 };
    const cam = fitCamera(rect, vp);
    // 幅だけ合わせると svgWidth = 400、見える高さは 225 しかなく 2000 が入らない
    expect(cam.svgWidth).toBeGreaterThan(400);
    expect(contains(visibleRect(cam, vp), rect)).toBe(true);
  });

  it('横長ドキュメントは幅基準のまま', () => {
    const rect = { x: 0, y: 0, width: 3000, height: 400 };
    const vp = { width: 1600, height: 900 };
    expect(fitCamera(rect, vp).svgWidth).toBeCloseTo(3000);
  });

  it.each([
    ['スマホ縦', 390, 844],
    ['タブレット', 820, 1180],
    ['ノート PC', 1440, 900],
    ['ウルトラワイド', 3440, 1440],
    ['ほぼ正方形', 900, 900],
  ])('%s でも矩形全体が収まる', (_label, width, height) => {
    for (const rect of [
      { x: -50, y: -30, width: 1200, height: 800 },
      { x: 0, y: 0, width: 375, height: 3000 },
      { x: 10, y: 10, width: 5000, height: 200 },
    ]) {
      const vp = { width, height };
      expect(contains(visibleRect(fitCamera(rect, vp), vp), rect)).toBe(true);
    }
  });

  describe('重なっているパネルを勘定に入れる', () => {
    // Layers 240px + Property 280px が開いている 1440x800 のキャンバス
    const vp = { width: 1440, height: 800, left: 240, right: 280 };

    it('パネルに隠れない帯に矩形全体が収まる', () => {
      const rect = { x: 0, y: 0, width: 1200, height: 700 };
      const cam = fitCamera(rect, vp);
      expect(contains(unobscuredRect(cam, vp), rect)).toBe(true);
    });

    it('パネルの分だけ引きの絵になる', () => {
      const rect = { x: 0, y: 0, width: 1200, height: 700 };
      const withPanels = fitCamera(rect, vp).svgWidth;
      const without = fitCamera(rect, { width: 1440, height: 800 }).svgWidth;
      expect(withPanels).toBeGreaterThan(without);
    });

    it('左右の食い込みが違う分だけカメラ中心をずらす', () => {
      const rect = { x: 0, y: 0, width: 1200, height: 700 };
      const centered = fitCamera(rect, { width: 1440, height: 800 }).cx;

      // 左のパネルが広い → 絵を右へ寄せたい → カメラは左を向く
      const leftHeavy = fitCamera(rect, { width: 1440, height: 800, left: 440, right: 0 });
      expect(leftHeavy.cx).toBeLessThan(centered);

      // 右のパネルが広ければ逆
      const rightHeavy = fitCamera(rect, { width: 1440, height: 800, left: 0, right: 440 });
      expect(rightHeavy.cx).toBeGreaterThan(centered);

      // 左右対称なら中心はずれない
      const symmetric = fitCamera(rect, { width: 1440, height: 800, left: 200, right: 200 });
      expect(symmetric.cx).toBeCloseTo(centered);
    });

    it('縦長ドキュメントではパネルがあっても高さ基準のまま', () => {
      const rect = { x: 0, y: 0, width: 200, height: 4000 };
      const cam = fitCamera(rect, vp);
      expect(contains(unobscuredRect(cam, vp), rect)).toBe(true);
      expect(cam.svgWidth).toBeCloseTo(4000 * (1440 / 800));
    });

    it('食い込みが幅を食い尽くす指定は無視する', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      const cam = fitCamera(rect, { width: 400, height: 300, left: 400, right: 400 });
      expect(Number.isFinite(cam.svgWidth)).toBe(true);
      expect(cam.cx).toBe(50);
    });

    it('負の食い込みは 0 として扱う', () => {
      const rect = { x: 0, y: 0, width: 500, height: 300 };
      const a = fitCamera(rect, { width: 1000, height: 600, left: -100, right: -50 });
      const b = fitCamera(rect, { width: 1000, height: 600 });
      expect(a).toEqual(b);
    });
  });

  it('余白の割合ぶんだけ広く取る', () => {
    const rect = { x: 0, y: 0, width: 1000, height: 100 };
    const vp = { width: 1600, height: 900 };
    const none = fitCamera(rect, vp, 0);
    const padded = fitCamera(rect, vp, 0.1);
    expect(padded.svgWidth).toBeCloseTo(none.svgWidth * 1.2);
    expect(padded.cy).toBe(none.cy);
  });

  it('不正なビューポートは 16:9 とみなす', () => {
    const rect = { x: 0, y: 0, width: 100, height: 500 };
    const expected = fitCamera(rect, { width: 16, height: 9 }).svgWidth;
    expect(fitCamera(rect, { width: 0, height: 0 }).svgWidth).toBeCloseTo(expected);
    expect(fitCamera(rect, { width: Number.NaN, height: 100 }).svgWidth).toBeCloseTo(expected);
    expect(fitCamera(rect, { width: -5, height: 100 }).svgWidth).toBeCloseTo(expected);
  });

  it('サイズ 0 の矩形でも svgWidth が 0 や NaN にならない', () => {
    const cam = fitCamera({ x: 5, y: 5, width: 0, height: 0 }, { width: 1600, height: 900 });
    expect(Number.isFinite(cam.svgWidth)).toBe(true);
    expect(cam.svgWidth).toBeGreaterThan(0);
    expect(cam.cx).toBe(5);
    expect(cam.cy).toBe(5);
  });
});

describe('viewportOf', () => {
  /** キャンバスと、その上に重ねたパネルを持つ DOM を組む */
  function buildCanvas(panels: { selector: string; left: number; width: number }[]) {
    const viewer = document.createElement('div');
    viewer.className = 'viewer';
    const canvas = document.createElement('div');
    canvas.className = 'viewer__canvas';

    // jsdom はレイアウトしないので実寸を差し込む
    Object.defineProperty(canvas, 'clientWidth', { value: 1440, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 800, configurable: true });
    canvas.getBoundingClientRect = () =>
      ({ left: 0, right: 1440, top: 0, bottom: 800, width: 1440, height: 800 }) as DOMRect;

    viewer.appendChild(canvas);
    for (const p of panels) {
      const el = document.createElement('div');
      el.className = p.selector.slice(1);
      el.getBoundingClientRect = () =>
        ({
          left: p.left,
          right: p.left + p.width,
          top: 0,
          bottom: 800,
          width: p.width,
          height: 800,
        }) as DOMRect;
      viewer.appendChild(el);
    }
    document.body.appendChild(viewer);
    return { viewer, canvas };
  }

  it('要素が無ければ 16:9 のダミーを返す', () => {
    expect(viewportOf(null)).toEqual({ width: 16, height: 9 });
  });

  it('パネルが無ければ食い込みは 0', () => {
    const { viewer, canvas } = buildCanvas([]);
    expect(viewportOf(canvas)).toEqual({ width: 1440, height: 800, left: 0, right: 0 });
    viewer.remove();
  });

  it('左右のパネルを実測して振り分ける', () => {
    const { viewer, canvas } = buildCanvas([
      { selector: '.node-tree', left: 0, width: 240 },
      { selector: '.prop-panel', left: 1160, width: 280 },
    ]);
    expect(viewportOf(canvas)).toEqual({ width: 1440, height: 800, left: 240, right: 280 });
    viewer.remove();
  });

  it('左に重なるパネルが複数あれば広い方を採る', () => {
    const { viewer, canvas } = buildCanvas([
      { selector: '.pages-panel', left: 0, width: 200 },
      { selector: '.node-tree', left: 0, width: 240 },
    ]);
    expect(viewportOf(canvas).left).toBe(240);
    viewer.remove();
  });

  it('畳まれて幅 0 のパネルは無視する（モバイルの display:none 相当）', () => {
    const { viewer, canvas } = buildCanvas([
      { selector: '.node-tree', left: 0, width: 0 },
      { selector: '.prop-panel', left: 1440, width: 0 },
    ]);
    expect(viewportOf(canvas)).toEqual({ width: 1440, height: 800, left: 0, right: 0 });
    viewer.remove();
  });

  it('高さ 0（レイアウト前）ならダミーを返す', () => {
    const { viewer, canvas } = buildCanvas([]);
    Object.defineProperty(canvas, 'clientHeight', { value: 0, configurable: true });
    expect(viewportOf(canvas)).toEqual({ width: 16, height: 9 });
    viewer.remove();
  });
});
