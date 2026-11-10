/**
 * Pencil の flexbox 風レイアウトを SVG 座標に解決する。
 *
 * 戦略(bottom-up → top-down の 2 パス):
 *  1. `intrinsicSize(node, widthHint?)`: ノードの "自然なサイズ" を子から再帰的に算出。
 *     `fit_content` を解決するために使う。`fill_container` は 0 として扱う
 *     (親が size を持たないと決まらないので、fit_content 親の中の
 *     fill_container 子は degenerate ケース)。幅が先に決まっていれば
 *     `widthHint` で渡し、その幅で折り返したテキストの高さを使う。
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
  IconFontNode,
  PenNode,
  SizeValue,
  TextNode,
} from '../types';
import { getTextMetricsVersion, measureTextWidth } from './textMeasure';

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
  const width = resolveSizeValue(
    (node as { width?: SizeValue }).width,
    ctx.availableWidth,
    intrinsicSize(node).w,
    ctx.parentLayout === 'horizontal' ? 'main' : 'cross',
  );
  // 高さは幅が決まってから測る(折り返すテキストの行数が幅で変わるため)
  const height = resolveSizeValue(
    (node as { height?: SizeValue }).height,
    ctx.availableHeight,
    intrinsicSize(node, width).h,
    ctx.parentLayout === 'vertical' ? 'main' : 'cross',
  );

  // Pencil 公式仕様: "Frames default to horizontal, groups default to none."
  // frame/group いずれも Layout を mixin するので、同じ resolver で読む。
  const { layout, gap, padding, justify, align } = resolveFlexProps(node);

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

  // layoutPosition: "absolute" の子は flex flow から外して、自分の x/y
  // のまま親の座標系に絶対配置する(Pencil 拡張プロパティ)。
  // 非表示 (enabled: false) の子も場所を取らない。
  const flowChildren = rawChildren.filter(isInFlow);

  // flex layout(flow 内の子のみ)
  const flowLaidOut = flexChildren({
    rawChildren: flowChildren,
    layout,
    gap,
    padding,
    justify,
    align,
    containerWidth: width,
    containerHeight: height,
  });

  // flow 外の子は layout: none と同じパスで処理し、元の並び順(= 重なり順)を保つ
  let flowIndex = 0;
  const children = rawChildren.map((c) =>
    isInFlow(c)
      ? flowLaidOut[flowIndex++]
      : layoutNode(c, {
          availableWidth: width,
          availableHeight: height,
          parentLayout: 'none',
        }),
  );

  return {
    ...(node as object),
    width,
    height,
    children,
  } as PenNode;
}

/** flex の並びに参加する子か(絶対配置と非表示の子は参加しない) */
function isInFlow(c: PenNode): boolean {
  return (
    (c as { layoutPosition?: string }).layoutPosition !== 'absolute' &&
    (c as { enabled?: boolean }).enabled !== false
  );
}

function resolveLeafSize(node: PenNode, ctx: LayoutContext): PenNode {
  const rawW = (node as { width?: SizeValue }).width;
  const rawH = (node as { height?: SizeValue }).height;
  const width = resolveSizeValue(rawW, ctx.availableWidth, intrinsicSize(node).w, 'cross');
  const height = resolveSizeValue(rawH, ctx.availableHeight, intrinsicSize(node, width).h, 'cross');
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

  // Pass A: 各子の main/cross サイズを決定。
  // 幅を先に決め、高さはその幅で測る(折り返すテキストの行数が幅で変わるため)。
  const sized = rawChildren.map((c) => ({
    node: c,
    rawW: (c as { width?: SizeValue }).width,
    rawH: (c as { height?: SizeValue }).height,
  }));
  const totalGap = sized.length > 1 ? gap * (sized.length - 1) : 0;

  /** main 軸のサイズ。fill_container は残りを等分する */
  const distributeMain = (raw: (SizeValue | undefined)[], intrinsic: number[]): number[] => {
    let fixedTotal = 0;
    let fillCount = 0;
    raw.forEach((r, i) => {
      if (isFill(r)) fillCount++;
      else fixedTotal += resolveSizeValue(r, mainAvailable, intrinsic[i], 'main');
    });
    const fillSize =
      fillCount > 0 ? Math.max(0, mainAvailable - fixedTotal - totalGap) / fillCount : 0;
    return raw.map((r, i) =>
      isFill(r) ? fillSize : resolveSizeValue(r, mainAvailable, intrinsic[i], 'main'),
    );
  };
  const resolveCross = (r: SizeValue | undefined, intrinsic: number): number =>
    isFill(r) && Number.isFinite(crossAvailable)
      ? Math.max(0, crossAvailable)
      : resolveSizeValue(r, crossAvailable, intrinsic, 'cross');

  let widths: number[];
  let heights: number[];
  if (isHoriz) {
    widths = distributeMain(
      sized.map((s) => s.rawW),
      sized.map((s) => intrinsicSize(s.node).w),
    );
    heights = sized.map((s, i) => resolveCross(s.rawH, intrinsicSize(s.node, widths[i]).h));
  } else {
    widths = sized.map((s) => resolveCross(s.rawW, intrinsicSize(s.node).w));
    heights = distributeMain(
      sized.map((s) => s.rawH),
      sized.map((s, i) => intrinsicSize(s.node, widths[i]).h),
    );
  }
  const mainSizes = isHoriz ? widths : heights;
  const crossSizes = isHoriz ? heights : widths;

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
function intrinsicSize(node: PenNode, widthHint?: number): Size {
  // 同じノードを何度も測るので結果を覚えておく(Web フォントの読み込みで計測が
  // 変わったときは版が進むので古い結果は使われない)
  const key = `${getTextMetricsVersion()}|${widthHint ?? ''}`;
  let perNode = intrinsicMemo.get(node);
  const hit = perNode?.get(key);
  if (hit) return hit;
  const size = computeIntrinsicSize(node, widthHint);
  if (!perNode) {
    perNode = new Map();
    intrinsicMemo.set(node, perNode);
  }
  perNode.set(key, size);
  return size;
}

type Size = { w: number; h: number };
const intrinsicMemo = new WeakMap<object, Map<string, Size>>();

/**
 * @param widthHint 親が決めたこのノードの幅。分かっていれば、その幅で折り返した
 *   テキストの高さを使う。
 */
function computeIntrinsicSize(node: PenNode, widthHint?: number): Size {
  const rawW = (node as { width?: SizeValue }).width;
  const rawH = (node as { height?: SizeValue }).height;

  if (node.type === 'frame' || node.type === 'group') {
    const fixedW = typeof rawW === 'number' ? rawW : undefined;
    const fixedH = typeof rawH === 'number' ? rawH : undefined;
    if (fixedW != null && fixedH != null) return { w: fixedW, h: fixedH };

    const allChildren = node.children ?? [];
    if (allChildren.length === 0) return { w: fixedW ?? 0, h: fixedH ?? 0 };

    // Pencil 公式仕様: Frames default to horizontal, groups default to none.
    const { layout, gap, padding } = resolveFlexProps(node);

    // layoutPosition: "absolute" と非表示の子は flow に参加しないので、intrinsic 計算
    // からも除外する。layout: none の場合は従来通り authored x/y で bbox を取る。
    const flowChildren =
      layout === 'none'
        ? allChildren.filter((c) => (c as { enabled?: boolean }).enabled !== false)
        : allChildren.filter(isInFlow);

    if (layout === 'none') {
      let maxW = 0;
      let maxH = 0;
      for (const c of flowChildren) {
        const s = intrinsicSize(c);
        const cx = typeof (c as { x?: number }).x === 'number' ? ((c as { x: number }).x) : 0;
        const cy = typeof (c as { y?: number }).y === 'number' ? ((c as { y: number }).y) : 0;
        maxW = Math.max(maxW, cx + s.w);
        maxH = Math.max(maxH, cy + s.h);
      }
      return { w: fixedW ?? maxW, h: fixedH ?? maxH };
    }

    // 自分の幅が分かっていれば、子の幅(fill_container の取り分)も決まる
    const ownW = fixedW ?? widthHint;
    const childWidths = intrinsicChildWidths(flowChildren, layout, gap, padding, ownW);

    // flex: main 方向は合計 + gap + padding、cross 方向は max + padding
    let mainTotal = 0;
    let crossMax = 0;
    flowChildren.forEach((c, i) => {
      const s = intrinsicSize(c, childWidths[i]);
      const w = childWidths[i] ?? s.w;
      if (layout === 'horizontal') {
        mainTotal += w;
        crossMax = Math.max(crossMax, s.h);
      } else {
        mainTotal += s.h;
        crossMax = Math.max(crossMax, w);
      }
    });
    const mainGap = flowChildren.length > 1 ? gap * (flowChildren.length - 1) : 0;

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

  if (node.type === 'text') {
    return measureText(node, rawW, rawH, widthHint);
  }

  // icon_font leaf: width/height が未指定なら 24x24 に既定(material 系の標準)
  if (node.type === 'icon_font') {
    return measureIcon(node, rawW, rawH);
  }

  // その他 leaf
  return {
    w: typeof rawW === 'number' ? rawW : 0,
    h: typeof rawH === 'number' ? rawH : 0,
  };
}

/**
 * 幅 `ownW` のコンテナに並べたとき、各子が受け取る幅(layout と同じ規則)。
 * `ownW` が分からなければ、固定幅の子以外は undefined(= 自然な幅)。
 */
function intrinsicChildWidths(
  children: PenNode[],
  layout: 'horizontal' | 'vertical',
  gap: number,
  padding: Padding,
  ownW: number | undefined,
): (number | undefined)[] {
  const contentW = ownW != null ? Math.max(0, ownW - padding.left - padding.right) : undefined;
  const rawWidths = children.map((c) => (c as { width?: SizeValue }).width);
  if (layout === 'vertical') {
    return rawWidths.map((r, i) => {
      if (typeof r === 'number') return r;
      if (isFill(r)) return contentW;
      return intrinsicSize(children[i]).w;
    });
  }
  // horizontal: fill_container は残りを等分する
  let fixedTotal = 0;
  let fillCount = 0;
  const natural = rawWidths.map((r, i) => {
    if (isFill(r)) {
      fillCount++;
      return undefined;
    }
    const w = typeof r === 'number' ? r : intrinsicSize(children[i]).w;
    fixedTotal += w;
    return w;
  });
  if (fillCount === 0 || contentW == null) return natural;
  const totalGap = children.length > 1 ? gap * (children.length - 1) : 0;
  const fillW = Math.max(0, contentW - fixedTotal - totalGap) / fillCount;
  return natural.map((w) => w ?? fillW);
}

/** 計測できない環境での推定: ラテン文字の平均文字幅比率 */
const LATIN_CHAR_WIDTH_RATIO = 0.55;
/** CJK (日本語/中国語/韓国語) 文字は全角なので fontSize とほぼ同じ幅 */
const CJK_CHAR_WIDTH_RATIO = 1.0;
const TEXT_LINE_HEIGHT_RATIO = 1.2;

const CJK_RE = /[⺀-鿿豈-﫿＀-￯]/;
/**
 * 折り返しの単位。CJK は 1 文字ずつ、それ以外は「語 + 後ろの空白」。
 * (CSS の `white-space: pre-wrap; word-break: break-word` に近づける)
 */
const WRAP_TOKEN_RE = /[⺀-鿿豈-﫿＀-￯]|[^\s⺀-鿿豈-﫿＀-￯]+\s*|\s+/g;

function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    w += fontSize * (CJK_RE.test(ch) ? CJK_CHAR_WIDTH_RATIO : LATIN_CHAR_WIDTH_RATIO);
  }
  return w;
}

function applyTextCase(text: string, textCase: TextNode['textCase']): string {
  switch (textCase) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return text.replace(/\b([a-z])/g, (_, ch: string) => ch.toUpperCase());
    default:
      return text;
  }
}

/** `maxWidth` で折り返したときの行数 */
function countWrappedLines(line: string, maxWidth: number, measure: (s: string) => number): number {
  if (line === '') return 1;
  const tokens = line.match(WRAP_TOKEN_RE) ?? [line];
  // 計測の丸め誤差で折り返しすぎないよう少しだけ余裕を持たせる
  const limit = maxWidth + 0.5;
  let lines = 1;
  let cur = 0;
  for (const tok of tokens) {
    const visible = tok.trimEnd();
    const visibleW = visible === tok ? measure(tok) : measure(visible);
    if (cur > 0 && cur + visibleW > limit) {
      lines++;
      cur = 0;
    }
    if (cur === 0 && visibleW > limit) {
      // 1 語が行より長い: 文字単位で折る
      let acc = 0;
      for (const ch of visible) {
        const cw = measure(ch);
        if (acc > 0 && acc + cw > limit) {
          lines++;
          acc = 0;
        }
        acc += cw;
      }
      cur = acc + measure(tok.slice(visible.length));
      continue;
    }
    cur += visible === tok ? visibleW : measure(tok);
  }
  return lines;
}

function measureText(
  node: TextNode,
  rawW: SizeValue | undefined,
  rawH: SizeValue | undefined,
  widthHint?: number,
): Size {
  const fontSize = node.fontSize ?? 14;
  const lineHeightPx = (node.lineHeight ?? TEXT_LINE_HEIGHT_RATIO) * fontSize;
  const lines = normalizeTextLines(node.content).map((l) => applyTextCase(l, node.textCase));
  const letterSpacing = typeof node.letterSpacing === 'number' ? node.letterSpacing : 0;
  const font = {
    family: node.fontFamily ?? 'Inter, system-ui, sans-serif',
    size: fontSize,
    weight: node.fontWeight,
    style: node.fontStyle,
  };
  // ブラウザでは実際のフォントで測り、測れない環境では文字数から推定する
  const measure = (s: string): number => {
    const measured = measureTextWidth(s, font);
    const base = measured ?? estimateTextWidth(s, fontSize);
    return base + letterSpacing * [...s].length;
  };

  // 幅: 確定値があればそれ、無ければ最長行の幅
  const w = typeof rawW === 'number' ? rawW : lines.reduce((max, l) => Math.max(max, measure(l)), 0);

  // 高さ: 確定値があれば優先
  if (typeof rawH === 'number') {
    return { w: Math.max(1, w), h: rawH };
  }

  // textGrowth が固定幅なら、その幅(fill_container なら親から渡された幅)で折り返す
  const isFixedWidth =
    node.textGrowth === 'fixed-width' || node.textGrowth === 'fixed-width-height';
  const wrapWidth = typeof rawW === 'number' ? rawW : widthHint;
  if (isFixedWidth && wrapWidth != null && wrapWidth > 0) {
    const totalLines = lines.reduce((n, l) => n + countWrappedLines(l, wrapWidth, measure), 0);
    return { w: Math.max(1, w), h: Math.max(1, totalLines * lineHeightPx) };
  }

  return { w: Math.max(1, w), h: Math.max(1, lines.length * lineHeightPx) };
}

/**
 * テキストノードの content を行配列に正規化する。
 * - undefined/null/非文字列(将来の rich text TextStyle[])は空文字列扱い
 * - 空文字列でも 1 行として扱う(高さの計算に使う)
 */
export function normalizeTextLines(content: unknown): string[] {
  if (typeof content !== 'string' || content.length === 0) return [''];
  return content.split('\n');
}

function measureIcon(
  _node: IconFontNode,
  rawW: SizeValue | undefined,
  rawH: SizeValue | undefined,
): { w: number; h: number } {
  const fallback = 24;
  return {
    w: typeof rawW === 'number' ? rawW : fallback,
    h: typeof rawH === 'number' ? rawH : fallback,
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

/**
 * コンテナ(frame / group)の flex プロパティをまとめて解決する。
 *
 * Pencil 仕様では:
 *   - frame のデフォルトは `horizontal`(`layout` 省略時)
 *   - group のデフォルトは `none`(`layout` 省略時)
 *
 * レイアウト値が明示的に設定されていればそれを使う。
 * gap / padding / justifyContent / alignItems は frame/group 共通で、
 * 未指定時はそれぞれ 0 / 無し / 'start' / 'start' にフォールバックする。
 */
function resolveFlexProps(node: FrameNode | GroupNode): {
  layout: 'none' | 'horizontal' | 'vertical';
  gap: number;
  padding: Padding;
  justify: 'start' | 'center' | 'end' | 'space_between' | 'space_around';
  align: 'start' | 'center' | 'end';
} {
  const defaultLayout = node.type === 'frame' ? 'horizontal' : 'none';
  return {
    layout: node.layout ?? defaultLayout,
    gap: node.gap ?? 0,
    padding: resolvePadding(node.padding),
    justify: node.justifyContent ?? 'start',
    align: node.alignItems ?? 'start',
  };
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
