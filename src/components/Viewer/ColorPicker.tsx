/**
 * カスタムカラーピッカー popover。
 * - Hue スライダ (0-360°)
 * - Saturation/Lightness 2D パッド
 * - Hex 入力
 * - プリセットカラー行
 *
 * onChange は drag 中に連続で発火し、最終値は commit で親側に通知される想定。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  color: string; // #RRGGBB
  onChange: (next: string) => void;
  onClose?: () => void;
  anchorRect?: DOMRect | null;
}

const PRESETS = [
  '#000000', '#FFFFFF', '#EF4444', '#F97316', '#F59E0B',
  '#10B981', '#14B8A6', '#0EA5E9', '#6366F1', '#A855F7',
  '#EC4899', '#6B7280', '#1F2937', '#E5E7EB', '#FDE68A',
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function ColorPicker({ color, onChange, onClose, anchorRect }: Props) {
  const rgb = hexToRgb(color) ?? { r: 0, g: 0, b: 0 };
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const [hue, setHue] = useState(hsv.h);
  const [sat, setSat] = useState(hsv.s);
  const [val, setVal] = useState(hsv.v);
  const [hexInput, setHexInput] = useState(color);

  const slRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) onClose?.();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onClose]);

  // prop の color が外から変わった場合に同期
  useEffect(() => {
    const r = hexToRgb(color);
    if (!r) return;
    const h = rgbToHsv(r.r, r.g, r.b);
    setHue(h.h);
    setSat(h.s);
    setVal(h.v);
    setHexInput(color.toUpperCase());
  }, [color]);

  const emit = useCallback((h: number, s: number, v: number) => {
    const rgb2 = hsvToRgb(h, s, v);
    const hex = rgbToHex(rgb2.r, rgb2.g, rgb2.b);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  // Saturation/Lightness パッドのドラッグ
  const slMove = useCallback((clientX: number, clientY: number) => {
    const el = slRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    const newSat = x;
    const newVal = 1 - y;
    setSat(newSat);
    setVal(newVal);
    emit(hue, newSat, newVal);
  }, [hue, emit]);

  const startSLDrag = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    slMove(e.clientX, e.clientY);
  };

  const hueMove = useCallback((clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const newHue = x * 360;
    setHue(newHue);
    emit(newHue, sat, val);
  }, [sat, val, emit]);

  const startHueDrag = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    hueMove(e.clientX);
  };

  // popover 位置: anchorRect があれば下に、なければ中央
  const style: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        top: Math.min(window.innerHeight - 340, anchorRect.bottom + 6),
        left: Math.min(window.innerWidth - 260, anchorRect.left),
      }
    : { position: 'fixed', top: 80, left: 80 };

  const hueColor = rgbToHex(
    hsvToRgb(hue, 1, 1).r,
    hsvToRgb(hue, 1, 1).g,
    hsvToRgb(hue, 1, 1).b,
  );

  return (
    <div ref={popRef} className="color-picker" style={style}>
      <div
        ref={slRef}
        className="color-picker__sl"
        style={{
          background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${hueColor})`,
        }}
        onPointerDown={startSLDrag}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && slMove(e.clientX, e.clientY)}
      >
        <div
          className="color-picker__sl-cursor"
          style={{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%` }}
        />
      </div>

      <div
        ref={hueRef}
        className="color-picker__hue"
        onPointerDown={startHueDrag}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && hueMove(e.clientX)}
      >
        <div className="color-picker__hue-cursor" style={{ left: `${(hue / 360) * 100}%` }} />
      </div>

      <div className="color-picker__row">
        <div className="color-picker__swatch" style={{ background: hexInput }} />
        <input
          className="color-picker__hex"
          type="text"
          value={hexInput}
          onChange={(e) => {
            const v = e.target.value;
            setHexInput(v);
            const r = hexToRgb(v);
            if (r) {
              const h = rgbToHsv(r.r, r.g, r.b);
              setHue(h.h);
              setSat(h.s);
              setVal(h.v);
              onChange(rgbToHex(r.r, r.g, r.b));
            }
          }}
          onBlur={() => {
            const r = hexToRgb(hexInput);
            if (!r) setHexInput(color);
          }}
        />
        {/* EyeDropper API (Chromium only) */}
        {typeof window !== 'undefined' && 'EyeDropper' in window && (
          <button
            type="button"
            className="color-picker__preset"
            style={{ flex: 'none', width: 28, height: 28, padding: 0 }}
            title="Pick color from screen (Eyedropper)"
            onClick={async () => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const EyeDropperCtor = (window as any).EyeDropper as new () => { open(): Promise<{ sRGBHex: string }> };
                const picker = new EyeDropperCtor();
                const result = await picker.open();
                const hex = result.sRGBHex;
                setHexInput(hex);
                const r = hexToRgb(hex);
                if (r) {
                  const h = rgbToHsv(r.r, r.g, r.b);
                  setHue(h.h);
                  setSat(h.s);
                  setVal(h.v);
                  onChange(rgbToHex(r.r, r.g, r.b));
                }
              } catch {
                // ユーザーがキャンセル等
              }
            }}
          >
            🔍
          </button>
        )}
      </div>

      <div className="color-picker__presets">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className="color-picker__preset"
            style={{ background: p }}
            title={p}
            onClick={() => {
              setHexInput(p);
              const r = hexToRgb(p)!;
              const h = rgbToHsv(r.r, r.g, r.b);
              setHue(h.h);
              setSat(h.s);
              setVal(h.v);
              onChange(p);
            }}
          />
        ))}
      </div>
    </div>
  );
}
