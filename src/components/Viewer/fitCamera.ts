/**
 * 矩形をビューポートに収めるカメラ計算。
 *
 * 面倒な点が 2 つある。
 *
 * 1. カメラは「中心 + 横方向に何 SVG 単位入るか (svgWidth)」しか持たず、縦は
 *    svgWidth / アスペクト比で決まる。幅だけを合わせると、ビューポートより
 *    縦長のドキュメントで上下がはみ出す。
 * 2. Pages / Layers / Property の各パネルはキャンバスと同じ座標系に重ねてあり、
 *    キャンバス要素自体は画面いっぱいのまま。素直に中央へ寄せると、左右の
 *    パネルの下にドキュメントが潜り込む。
 *
 * そこで「パネルを除いた実際に見えている帯」に収まる svgWidth を求め、
 * その帯の中心へ来るようにカメラ中心をずらす。
 */

export interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** キャンバス要素の実寸と、その上に重なっているパネルの食い込み幅（px） */
export interface Viewport {
  width: number;
  height: number;
  /** 左端に重なっているパネルの幅 */
  left?: number;
  /** 右端に重なっているパネルの幅 */
  right?: number;
}

export interface CameraFit {
  cx: number;
  cy: number;
  svgWidth: number;
}

/** キャンバスに重なるパネル。left/right どちら側に付くかは実測して判定する。 */
const OVERLAY_SELECTORS = ['.pages-panel', '.node-tree', '.prop-panel'];

const FALLBACK: Required<Viewport> = { width: 16, height: 9, left: 0, right: 0 };

/**
 * 収める矩形とビューポートからカメラを求める。
 *
 * @param rect      収めたい矩形（SVG 座標）
 * @param viewport  キャンバスの実寸とパネルの食い込み
 * @param padRatio  矩形の各辺に足す余白の割合（0.1 = 上下左右に 10% ずつ）
 */
export function fitCamera(rect: FitRect, viewport: Viewport, padRatio = 0): CameraFit {
  const vp = normalizeViewport(viewport);

  const width = Math.max(rect.width, Number.EPSILON);
  const height = Math.max(rect.height, Number.EPSILON);
  const needWidth = width * (1 + padRatio * 2);
  const needHeight = height * (1 + padRatio * 2);

  // パネルを除いて実際に見えている帯
  const freeWidth = Math.max(vp.width - vp.left - vp.right, 1);

  // svgWidth はキャンバス全幅に対応する値。見えている帯に needWidth を収めたいので
  // 全幅ぶんに割り戻す。縦はパネルに削られないので素直にアスペクト比で換算する。
  const byWidth = needWidth * (vp.width / freeWidth);
  const byHeight = needHeight * (vp.width / vp.height);
  const svgWidth = Math.max(byWidth, byHeight);

  // 帯の中心はキャンバスの中心から (left - right) / 2 px ずれている。
  // その分だけカメラを逆向きに動かして、矩形が帯の真ん中に来るようにする。
  const svgPerPx = svgWidth / vp.width;
  const shift = ((vp.left - vp.right) / 2) * svgPerPx;

  return {
    cx: rect.x + rect.width / 2 - shift,
    cy: rect.y + rect.height / 2,
    svgWidth,
  };
}

function normalizeViewport(viewport: Viewport): Required<Viewport> {
  const width = finitePositive(viewport.width);
  const height = finitePositive(viewport.height);
  if (width === null || height === null) return FALLBACK;

  // 食い込みが広すぎると帯が潰れるので、全幅の 75% を上限にする
  const cap = width * 0.75;
  const left = clamp(viewport.left ?? 0, 0, cap);
  const right = clamp(viewport.right ?? 0, 0, cap);
  if (left + right >= width) return { width, height, left: 0, right: 0 };
  return { width, height, left, right };
}

function finitePositive(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * キャンバス要素から Viewport を実測する。
 * パネルは開閉・折りたたみでき、モバイルでは display:none になるので、
 * 定数で持たず毎回測る。
 */
export function viewportOf(container: HTMLElement | null): Viewport {
  if (!container || container.clientHeight <= 0 || container.clientWidth <= 0) {
    return { width: FALLBACK.width, height: FALLBACK.height };
  }
  const box = container.getBoundingClientRect();
  const scope: ParentNode = container.closest('.viewer') ?? container.ownerDocument;

  let left = 0;
  let right = 0;
  for (const selector of OVERLAY_SELECTORS) {
    for (const el of scope.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.left <= box.left + 1) left = Math.max(left, r.right - box.left);
      else if (r.right >= box.right - 1) right = Math.max(right, box.right - r.left);
    }
  }

  return { width: container.clientWidth, height: container.clientHeight, left, right };
}
