/**
 * .pen ドキュメントから使用されているフォントファミリーを収集し、
 * Google Fonts から動的にロードする。
 *
 * 事前にロード済みのフォントはスキップする。
 */

import type { PenDocument, PenNode } from '../pen/types';

/** system/generic fonts — ロード不要 */
const SYSTEM_FONTS = new Set([
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'ui-monospace',
  'ui-sans-serif',
  'ui-serif',
  'ui-rounded',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Helvetica Neue',
  'Arial',
  'Helvetica',
  'Menlo',
  'Monaco',
  'Consolas',
  'SFMono-Regular',
]);

/** Material Symbols はアイコンフォント用で別途ロード済み */
const ICON_FONTS = new Set([
  'Material Symbols Outlined',
  'Material Symbols Rounded',
  'Material Symbols Sharp',
  'lucide',
]);

const loaded = new Set<string>();

function collectFonts(node: PenNode, result: Set<string>) {
  const family = (node as { fontFamily?: string }).fontFamily;
  if (family) {
    // "Inter, system-ui, sans-serif" → "Inter" のみ取得
    const primary = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    if (primary && !SYSTEM_FONTS.has(primary) && !ICON_FONTS.has(primary)) {
      result.add(primary);
    }
  }
  if ('children' in node && Array.isArray((node as { children?: PenNode[] }).children)) {
    for (const child of (node as { children: PenNode[] }).children) {
      collectFonts(child, result);
    }
  }
}

export function loadDocumentFonts(doc: PenDocument): void {
  const fonts = new Set<string>();
  for (const child of doc.children) {
    collectFonts(child, fonts);
  }

  const toLoad: string[] = [];
  for (const font of fonts) {
    if (!loaded.has(font)) {
      toLoad.push(font);
      loaded.add(font);
    }
  }

  // 1 つの失敗が他のフォントを巻き込まないよう、ファミリーごとに読み込む
  toLoad.forEach((font) => requestFont(font));
}

/**
 * Google Fonts は、指定したウェイトがフォントに無いと CSS 全体を 400 で返す
 * (例: Roboto Mono は 700 までなので `100..900` が失敗する)。
 * 広い指定から順に試し、最後はウェイト指定なしで読み込む。
 */
const WEIGHT_SPECS = [':wght@100..900', ':wght@400;700', ''];

function requestFont(font: string, attempt = 0) {
  const family = `${encodeURIComponent(font)}${WEIGHT_SPECS[attempt]}`;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  if (attempt < WEIGHT_SPECS.length - 1) {
    link.onerror = () => {
      link.remove();
      requestFont(font, attempt + 1);
    };
  }
  document.head.appendChild(link);
}
