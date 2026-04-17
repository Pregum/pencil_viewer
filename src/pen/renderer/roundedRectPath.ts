/**
 * 4 角それぞれ独立した corner radius の矩形パスを生成する。
 * cornerRadius が `number` なら等しい半径、`[nw, ne, se, sw]` なら個別。
 *
 * 戻り値は SVG path d 属性文字列。
 */

export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | [number, number, number, number] | undefined,
): string {
  if (w <= 0 || h <= 0) return '';
  const maxR = Math.min(w, h) / 2;
  let nw = 0, ne = 0, se = 0, sw = 0;
  if (typeof radius === 'number') {
    nw = ne = se = sw = Math.max(0, Math.min(radius, maxR));
  } else if (Array.isArray(radius) && radius.length === 4) {
    [nw, ne, se, sw] = radius.map((r) => Math.max(0, Math.min(r, maxR)));
  }
  // 4 角共通で radius 0 なら単純な矩形
  if (nw === 0 && ne === 0 && se === 0 && sw === 0) {
    return `M${x} ${y} h${w} v${h} h${-w} Z`;
  }
  // 時計回りで描画
  return [
    `M${x + nw} ${y}`,
    `h${w - nw - ne}`,
    ne > 0 ? `a${ne} ${ne} 0 0 1 ${ne} ${ne}` : '',
    `v${h - ne - se}`,
    se > 0 ? `a${se} ${se} 0 0 1 ${-se} ${se}` : '',
    `h${-(w - se - sw)}`,
    sw > 0 ? `a${sw} ${sw} 0 0 1 ${-sw} ${-sw}` : '',
    `v${-(h - sw - nw)}`,
    nw > 0 ? `a${nw} ${nw} 0 0 1 ${nw} ${-nw}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

export function isCornerRadiusArray(
  cr: number | number[] | undefined,
): cr is [number, number, number, number] {
  return Array.isArray(cr) && cr.length === 4 && cr.every((v) => typeof v === 'number');
}
