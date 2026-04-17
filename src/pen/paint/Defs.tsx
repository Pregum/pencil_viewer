/**
 * <defs> セクション。PaintRegistry が集めたグラデーション / フィルタを
 * ドキュメント 1 回だけ出力する。
 */

import type { GradientFill, MeshGradientFill } from '../types';
import type { PaintRegistry, PaintRef, FilterRef } from './registry';

export function Defs({ registry }: { registry: PaintRegistry }) {
  if (registry.paints.length === 0 && registry.filters.length === 0) return null;
  return (
    <defs>
      {registry.paints.map((p) => renderPaint(p))}
      {registry.filters.map((f) => renderFilter(f))}
    </defs>
  );
}

/** 安全な画像 URL のみ許可し、javascript: / data:text/html 等を排除 */
function sanitizeImageUrl(url: string): string | null {
  // data:image/* (base64) は許可
  if (/^data:image\/[a-z+]+;base64,/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch {
    // invalid URL
  }
  return null;
}

function renderPaint(p: PaintRef) {
  if (p.kind === 'gradient') return renderGradient(p.id, p.def as GradientFill);
  if (p.kind === 'mesh') return renderMeshGradient(p.id, p.def as MeshGradientFill);
  // image fill (pattern)
  const def = p.def as { url: string; mode?: 'stretch' | 'fill' | 'fit' };
  const safeUrl = sanitizeImageUrl(def.url);
  if (!safeUrl) return null;
  // mode → SVG preserveAspectRatio
  //   'stretch' (歪めて埋める) → 'none'
  //   'fill' (=cover, 短辺合わせで crop) → 'xMidYMid slice'
  //   'fit' (=contain, 長辺合わせで余白) → 'xMidYMid meet'
  const preserve = def.mode === 'stretch'
    ? 'none'
    : def.mode === 'fit'
    ? 'xMidYMid meet'
    : 'xMidYMid slice'; // fill or undefined
  return (
    <pattern
      key={p.id}
      id={p.id}
      patternUnits="objectBoundingBox"
      width={1}
      height={1}
    >
      <image
        href={safeUrl}
        preserveAspectRatio={preserve}
        width={1}
        height={1}
      />
    </pattern>
  );
}

/**
 * Mesh gradient の近似描画:
 * SVG に直接の対応が無いので、左上↔右下の対角 linear gradient を描く。
 * 対角 2 色以上あれば bezier 補間らしさは出ないが破綻しない fallback。
 */
function renderMeshGradient(id: string, def: MeshGradientFill) {
  const cols = Math.max(1, def.columns ?? 1);
  const rows = Math.max(1, def.rows ?? 1);
  const colors = def.colors ?? [];
  if (colors.length === 0) {
    return <linearGradient key={id} id={id} />;
  }
  // 頂点カラーの平均を補間の基準にする — 単純に対角方向に並べる
  const topLeft = colors[0];
  const topRight = colors[cols - 1] ?? colors[colors.length - 1];
  const bottomRight = colors[colors.length - 1];
  const bottomLeft = colors[(rows - 1) * cols] ?? colors[colors.length - 1];
  // 2 本の linear gradient を重ねると近似度が上がる: 横 (TL→TR→BR→BL) + 縦
  // ただし SVG 1 つの linearGradient で 4 隅を正しく出すのは不可能なので、
  // MVP では top 行 → bottom 行 の縦方向グラデに割り切る。
  return (
    <linearGradient key={id} id={id} x1={0} y1={0} x2={0} y2={1}>
      <stop offset="0" stopColor={topLeft} />
      <stop offset={0.5} stopColor={mixColors(topRight, bottomLeft)} />
      <stop offset="1" stopColor={bottomRight} />
    </linearGradient>
  );
}

/** 2 つの #RRGGBB を線形ブレンド。不正な形式は第 1 色を返す。 */
function mixColors(a: string, b: string): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const r = Math.round((pa.r + pb.r) / 2);
  const g = Math.round((pa.g + pb.g) / 2);
  const bl = Math.round((pa.b + pb.b) / 2);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function renderGradient(id: string, def: GradientFill) {
  const type = def.gradientType ?? 'linear';
  const stops = (def.colors ?? []).map((c, i) => (
    <stop key={i} offset={c.position} stopColor={c.color} />
  ));
  // rotation は degree(CCW, 0 = up)。SVG linearGradient は x1/y1/x2/y2 で方向を指定するので
  // 角度を objectBoundingBox 座標系上のベクトルに変換する。
  if (type === 'linear') {
    const rad = ((def.rotation ?? 0) + 180) * (Math.PI / 180);
    const dx = Math.sin(rad) / 2;
    const dy = -Math.cos(rad) / 2;
    return (
      <linearGradient
        key={id}
        id={id}
        x1={0.5 - dx}
        y1={0.5 - dy}
        x2={0.5 + dx}
        y2={0.5 + dy}
      >
        {stops}
      </linearGradient>
    );
  }
  if (type === 'radial') {
    const cx = def.center?.x ?? 0.5;
    const cy = def.center?.y ?? 0.5;
    const r = Math.max(def.size?.width ?? 0.5, def.size?.height ?? 0.5);
    return (
      <radialGradient key={id} id={id} cx={cx} cy={cy} r={r}>
        {stops}
      </radialGradient>
    );
  }
  // angular は SVG に直接対応がないので線形で代用
  return (
    <linearGradient key={id} id={id}>
      {stops}
    </linearGradient>
  );
}

function renderFilter(f: FilterRef) {
  return (
    <filter key={f.id} id={f.id} x="-50%" y="-50%" width="200%" height="200%">
      {f.effects.flatMap((e, i) => {
        if (e.type === 'blur') {
          return [<feGaussianBlur key={`b-${i}`} in="SourceGraphic" stdDeviation={e.radius ?? 4} />];
        }
        // shadow: inner / outer を分岐
        const dx = e.offset?.x ?? 0;
        const dy = e.offset?.y ?? 0;
        const blur = e.blur ?? 4;
        const color = e.color ?? '#00000040';
        if (e.shadowType === 'inner') {
          // 形状の内側に影を落とす。
          //   1) SourceAlpha を反転（外側=不透明に）
          //   2) それを blur + offset
          //   3) offset は意図的に -dx, -dy（外側から内側に光が入る方向に反転）
          //   4) SourceAlpha と intersect して形状内だけに絞る
          //   5) shadow 色を flood + in で着色
          //   6) SourceGraphic の上に over で重ねる
          const id = `${f.id}-inner-${i}`;
          return [
            <feColorMatrix
              key={`${id}-inv`}
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1 1"
              result={`${id}-inv`}
            />,
            <feGaussianBlur key={`${id}-blur`} in={`${id}-inv`} stdDeviation={blur} result={`${id}-blur`} />,
            <feOffset key={`${id}-off`} in={`${id}-blur`} dx={dx} dy={dy} result={`${id}-off`} />,
            // 形状内部に絞る
            <feComposite
              key={`${id}-inside`}
              in={`${id}-off`}
              in2="SourceAlpha"
              operator="in"
              result={`${id}-inside`}
            />,
            <feFlood key={`${id}-flood`} floodColor={color} result={`${id}-color`} />,
            <feComposite
              key={`${id}-colorIn`}
              in={`${id}-color`}
              in2={`${id}-inside`}
              operator="in"
              result={`${id}-shadow`}
            />,
            <feComposite
              key={`${id}-over`}
              in={`${id}-shadow`}
              in2="SourceGraphic"
              operator="over"
            />,
          ];
        }
        // outer shadow
        return [
          <feDropShadow key={`ds-${i}`} dx={dx} dy={dy} stdDeviation={blur} floodColor={color} />,
        ];
      })}
    </filter>
  );
}
