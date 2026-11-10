/**
 * レイアウト用のテキスト計測。
 *
 * ブラウザでは Canvas の measureText で実際のフォントの幅を測る。Canvas が
 * 使えない環境(テストの jsdom、Node)では null を返し、呼び出し側は文字数からの
 * 推定にフォールバックする。
 *
 * Web フォントは非同期に読み込まれるので、読み込みが終わると計測結果が変わる。
 * そのたびにキャッシュを捨ててバージョンを進め、購読者(キャンバス)に
 * レイアウトのやり直しを促す。
 */

export interface FontSpec {
  family: string;
  size: number;
  weight?: string | number;
  style?: string;
}

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

let ctx: Ctx2D | null | undefined;
const cache = new Map<string, number>();
let version = 0;
const listeners = new Set<() => void>();

function getContext(): Ctx2D | null {
  if (ctx !== undefined) return ctx;
  ctx = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      ctx = new OffscreenCanvas(1, 1).getContext('2d');
    }
  } catch {
    ctx = null;
  }
  if (ctx && typeof document !== 'undefined' && document.fonts) {
    document.fonts.addEventListener('loadingdone', () => {
      cache.clear();
      version++;
      for (const l of listeners) l();
    });
  }
  return ctx;
}

function fontCss(font: FontSpec): string {
  const family = font.family
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => (/^["']|^[a-z-]+$/.test(f) ? f : `"${f}"`))
    .join(', ');
  return `${font.style ?? 'normal'} ${font.weight ?? 'normal'} ${font.size}px ${family}, sans-serif`;
}

/**
 * テキストの描画幅(px)。計測できない環境では null。
 * letterSpacing は含めない(呼び出し側で文字数 × letterSpacing を足す)。
 */
export function measureTextWidth(text: string, font: FontSpec): number | null {
  const c = getContext();
  if (!c) return null;
  const css = fontCss(font);
  const key = `${css}\u0000${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  c.font = css;
  const w = c.measureText(text).width;
  cache.set(key, w);
  return w;
}

/** 計測結果が変わったとき(Web フォントの読み込み完了)に呼ばれる */
export function subscribeTextMetrics(listener: () => void): () => void {
  getContext();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTextMetricsVersion(): number {
  return version;
}
