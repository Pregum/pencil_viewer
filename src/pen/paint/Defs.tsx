/**
 * <defs> セクション。PaintRegistry が集めたグラデーション / フィルタを
 * ドキュメント 1 回だけ出力する。
 */

import type { GradientFill } from '../types';
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
  // image fill (pattern) — MVP では簡易対応
  const rawUrl = (p.def as { url: string }).url;
  const safeUrl = sanitizeImageUrl(rawUrl);
  if (!safeUrl) return null; // 不正な URL はレンダリングしない
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
        preserveAspectRatio="xMidYMid slice"
        width={1}
        height={1}
      />
    </pattern>
  );
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
      {f.effects.map((e, i) => {
        if (e.type === 'blur') {
          return <feGaussianBlur key={i} in="SourceGraphic" stdDeviation={e.radius ?? 4} />;
        }
        // shadow
        const dx = e.offset?.x ?? 0;
        const dy = e.offset?.y ?? 0;
        const blur = e.blur ?? 4;
        const color = e.color ?? '#00000040';
        return (
          <feDropShadow key={i} dx={dx} dy={dy} stdDeviation={blur} floodColor={color} />
        );
      })}
    </filter>
  );
}
