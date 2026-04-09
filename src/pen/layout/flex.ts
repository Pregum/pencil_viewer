/**
 * Pencil の flexbox 風レイアウトを SVG 座標に解決する。
 *
 * 戦略(bottom-up → top-down の 2 パス):
 *  1. `intrinsicSize(node)`: ノードの "自然なサイズ" を子から再帰的に算出。
 *     `fit_content` を解決するために使う。`fill_container` は 0 として扱う
 *     (親が size を持たないと決まらないので、fit_content 親の中の
 *     fill_container 子は degenerate ケース)。
 *  2. `layoutNode(node, ctx)`: 親から渡された context(解決後 width/height/layout)
 *     を元に、自分の width/height を決め、`layout === 'horizontal' | 'vertical'`
 *     なら子の x/y/w/h を flex ルールに従って上書きする。
 *
 * 出力は同じ PenNode 構造だが、すべての x/y/width/height が具体的な number に
 * なっている。renderer は座標計算に一切関与しない。
 */

import type {
  FrameNode,
  GroupNode,
  PenNode,
  SizeValue,
} from '../types';

type Padding = { top: number; right: number; bottom: number; left: number };

export interface LayoutContext {
  /** 親から与えられた利用可能幅(fill_container 解決用)。ルートでは Infinity */
  availableWidth: number;
  availableHeight: number;
  /** 親の layout 種別。none なら子の x/y を尊重、flex なら上書き */
  parentLayout: 'none' | 'horizontal' | 'vertical';
}

export function layoutNode(node: PenNode, ctx: LayoutContext): PenNode {
  if (node.type === 'frame' || node.type === 'group') {
    return layoutContainer(node, ctx);
  }
  // leaf: width/height が数値でない場合は親 context から解決
  return resolveLeafSize(node, ctx);
}

function layoutContainer(node: FrameNode | GroupNode, ctx: LayoutContext): PenNode {
  const own = intrinsicSize(node);
  const width = resolveSizeValue(
    (node as { width?: SizeValue }).width,
    ctx.availableWidth,
    own.w,
    ctx.parentLayout === 'horizontal' ? 'main' : 'cross',
  );
  const height = resolveSizeValue(
    (node as { height?: SizeValue }).height,
    ctx.availableHeight,
    own.h,
    ctx.parentLayout === 'vertical' ? 'main' : 'cross',
  );

  const layout = node.type === 'frame' ? node.layout ?? 'none' : 'none';
  const gap = node.type === 'frame' ? node.gap ?? 0 : 0;
  const padding = resolvePadding(node.type === 'frame' ? node.padding : undefined);
  const justify = node.type === 'frame' ? node.justifyContent ?? 'start' : 'start';
  const align = node.type === 'frame' ? node.alignItems ?? 'start' : 'start';

  const rawChildren = node.children ?? [];

  if (layout === 'none' || rawChildren.length === 0) {
    // 子の x/y/width/height はそのまま尊重。ただし再帰的に layout する
    const childCtx: LayoutContext = {
      availableWidth: width,
      availableHeight: height,
      parentLayout: 'none',
    };
    const children = rawChildren.map((c) => layoutNode(c, childCtx));
    return { ...(node as object), width, height, children } as PenNode;
  }

  // flex layout
  const children = flexChildren({
    rawChildren,
    layout,
    gap,
    padding,
    justify,
    align,
    containerWidth: width,
    containerHeight: height,
  });

  return { ...(node as object), width, height, children } as PenNode;
}

function resolveLeafSize(node: PenNode, ctx: LayoutContext): PenNode {
  const rawW = (node as { width?: SizeValue }).width;
  const rawH = (node as { height?: SizeValue }).height;
  const intrinsic = intrinsicSize(node);
  const width = resolveSizeValue(rawW, ctx.availableWidth, intrinsic.w, 'cross');
  const height = resolveSizeValue(rawH, ctx.availableHeight, intrinsic.h, 'cross');
  return { ...(node as object), width, height } as PenNode;
}

interface FlexChildrenInput {
  rawChildren: PenNode[];
  layout: 'horizontal' | 'vertical';
  gap: number;
  padding: Padding;
  justify: 'start' | 'center' | 'end' | 'space_between' | 'space_around';
  align: 'start' | 'center' | 'end';
  containerWidth: number;
  containerHeight: number;
}

function flexChildren(input: FlexChildrenInput): PenNode[] {
  const { rawChildren, layout, gap, padding, justify, align, containerWidth, containerHeight } =
    input;
  const isHoriz = layout === 'horizontal';
  const mainAvailable =
    (isHoriz ? containerWidth : containerHeight) -
    (isHoriz ? padding.left + padding.right : padding.top + padding.bottom);
  const crossAvailable =
    (isHoriz ? containerHeight : containerWidth) -
    (isHoriz ? padding.top + padding.bottom : padding.left + padding.right);

  // Pass A: 各子の main/cross サイズを決定
  const sized = rawChildren.map((c) => {
    const intrinsic = intrinsicSize(c);
    const rawMain = isHoriz
      ? (c as { width?: SizeValue }).width
      : (c as { height?: SizeValue }).height;
    const rawCross = isHoriz
      ? (c as { height?: SizeValue }).height
      : (c as { width?: SizeValue }).width;
    return {
      node: c,
      intrinsicMain: isHoriz ? intrinsic.w : intrinsic.h,
      intrinsicCross: isHoriz ? intrinsic.h : intrinsic.w,
      rawMain,
      rawCross,
    };
  });

  // fill_container が取る領域を計算
  const fillIndices: number[] = [];
  let fixedMainTotal = 0;
  for (let i = 0; i < sized.length; i++) {
    const s = sized[i];
    if (isFill(s.rawMain)) {
      fillIndices.push(i);
    } else {
      const main = resolveSizeValue(s.rawMain, mainAvailable, s.intrinsicMain, 'main');
      fixedMainTotal += main;
    }
  }
  const totalGap = sized.length > 1 ? gap * (sized.length - 1) : 0;
  const remainingMain = Math.max(0, mainAvailable - fixedMainTotal - totalGap);
  const fillSize = fillIndices.length > 0 ? remainingMain / fillIndices.length : 0;

  const mainSizes = sized.map((s) => {
    if (isFill(s.rawMain)) return fillSize;
    return resolveSizeValue(s.rawMain, mainAvailable, s.intrinsicMain, 'main');
  });
  const crossSizes = sized.map((s) => {
    if (isFill(s.rawCross)) return crossAvailable;
    return resolveSizeValue(s.rawCross, crossAvailable, s.intrinsicCross, 'cross');
  });

  // Pass B: main 軸上の開始位置を justify で決める
  const totalMain = mainSizes.reduce((a, b) => a + b, 0) + totalGap;
  let mainStart = isHoriz ? padding.left : padding.top;
  let effectiveGap = gap;
  switch (justify) {
    case 'center':
      mainStart += Math.max(0, (mainAvailable - totalMain) / 2);
      break;
    case 'end':
      mainStart += Math.max(0, mainAvailable - totalMain);
      break;
    case 'space_between':
      if (sized.length > 1) {
        effectiveGap = (mainAvailable - mainSizes.reduce((a, b) => a + b, 0)) / (sized.length - 1);
      }
      break;
    case 'space_around':
      if (sized.length > 0) {
        const around =
          (mainAvailable - mainSizes.reduce((a, b) => a + b, 0)) / sized.length;
        mainStart += around / 2;
        effectiveGap = around;
      }
      break;
    case 'start':
    default:
      break;
  }

  // 位置付けと再帰 layout
  let cursor = mainStart;
  const placed: PenNode[] = [];
  for (let i = 0; i < sized.length; i++) {
    const s = sized[i];
    const mainSize = mainSizes[i];
    const crossSize = crossSizes[i];

    // cross 軸の開始位置を align で決める
    const crossStart = (() => {
      const base = isHoriz ? padding.top : padding.left;
      switch (align) {
        case 'center':
          return base + Math.max(0, (crossAvailable - crossSize) / 2);
        case 'end':
          return base + Math.max(0, crossAvailable - crossSize);
        case 'start':
        default:
          return base;
      }
    })();

    const x = isHoriz ? cursor : crossStart;
    const y = isHoriz ? crossStart : cursor;
    const width = isHoriz ? mainSize : crossSize;
    const height = isHoriz ? crossSize : mainSize;

    // 再帰的に子をレイアウト
    const childWithSize = {
      ...(s.node as object),
      x,
      y,
      width,
      height,
    } as PenNode;

    const laidOut = layoutNode(childWithSize, {
      availableWidth: width,
      availableHeight: height,
      parentLayout: 'none', // flex の中身はこの時点で座標確定
    });
    placed.push(laidOut);

    cursor += mainSize + effectiveGap;
  }

  return placed;
}

/**
 * ノードの "自然なサイズ"(fit_content 解決用)。
 * fill_container は 0 として扱う(親が決める)。
 */
function intrinsicSize(node: PenNode): { w: number; h: number } {
  const rawW = (node as { width?: SizeValue }).width;
  const rawH = (node as { height?: SizeValue }).height;

  if (node.type === 'frame' || node.type === 'group') {
    const fixedW = typeof rawW === 'number' ? rawW : undefined;
    const fixedH = typeof rawH === 'number' ? rawH : undefined;
    if (fixedW != null && fixedH != null) return { w: fixedW, h: fixedH };

    const children = node.children ?? [];
    if (children.length === 0) return { w: fixedW ?? 0, h: fixedH ?? 0 };

    const layout = node.type === 'frame' ? node.layout ?? 'none' : 'none';
    const gap = node.type === 'frame' ? node.gap ?? 0 : 0;
    const padding = resolvePadding(node.type === 'frame' ? node.padding : undefined);

    if (layout === 'none') {
      let maxW = 0;
      let maxH = 0;
      for (const c of children) {
        const s = intrinsicSize(c);
        const cx = typeof (c as { x?: number }).x === 'number' ? ((c as { x: number }).x) : 0;
        const cy = typeof (c as { y?: number }).y === 'number' ? ((c as { y: number }).y) : 0;
        maxW = Math.max(maxW, cx + s.w);
        maxH = Math.max(maxH, cy + s.h);
      }
      return { w: fixedW ?? maxW, h: fixedH ?? maxH };
    }

    // flex: main 方向は合計 + gap + padding、cross 方向は max + padding
    let mainTotal = 0;
    let crossMax = 0;
    for (const c of children) {
      const s = intrinsicSize(c);
      if (layout === 'horizontal') {
        mainTotal += s.w;
        crossMax = Math.max(crossMax, s.h);
      } else {
        mainTotal += s.h;
        crossMax = Math.max(crossMax, s.w);
      }
    }
    const mainGap = children.length > 1 ? gap * (children.length - 1) : 0;

    if (layout === 'horizontal') {
      return {
        w: fixedW ?? mainTotal + mainGap + padding.left + padding.right,
        h: fixedH ?? crossMax + padding.top + padding.bottom,
      };
    }
    return {
      w: fixedW ?? crossMax + padding.left + padding.right,
      h: fixedH ?? mainTotal + mainGap + padding.top + padding.bottom,
    };
  }

  // leaf
  return {
    w: typeof rawW === 'number' ? rawW : 0,
    h: typeof rawH === 'number' ? rawH : 0,
  };
}

function resolveSizeValue(
  raw: SizeValue | undefined,
  available: number,
  intrinsic: number,
  _axisHint: 'main' | 'cross',
): number {
  if (typeof raw === 'number') return raw;
  if (raw == null) return intrinsic;
  if (isFill(raw)) return Number.isFinite(available) ? Math.max(0, available) : intrinsic;
  if (isFit(raw)) {
    // "fit_content(N)" の N はフォールバックサイズ
    const m = typeof raw === 'string' ? raw.match(/fit_content\((\d+(?:\.\d+)?)\)/) : null;
    const fallback = m ? parseFloat(m[1]) : 0;
    return intrinsic > 0 ? intrinsic : fallback;
  }
  return intrinsic;
}

function isFill(v: SizeValue | undefined): boolean {
  return typeof v === 'string' && v.startsWith('fill_container');
}
function isFit(v: SizeValue | undefined): boolean {
  return typeof v === 'string' && v.startsWith('fit_content');
}

function resolvePadding(
  p:
    | number
    | [number, number]
    | [number, number, number, number]
    | undefined,
): Padding {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === 'number') return { top: p, right: p, bottom: p, left: p };
  if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
  return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
}
