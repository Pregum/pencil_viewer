/**
 * スマートガイド表示。SelectableNode のドラッグから以下のイベントを受け取って描画する:
 * - 'pencil-snap-guides'       -> SnapGuide[]       (エッジ/中心アライメント)
 * - 'pencil-equal-space-guides'-> EqualSpaceGuide[] (等間隔スペースとラベル)
 *
 * ドラッグ終了時に空配列が送られて消去される。
 */

import { useEffect, useState } from 'react';
import type { SnapGuide, EqualSpaceGuide } from '../../pen/state/snapEngine';

interface Props {
  svgScale: number;
}

export function SnapGuides({ svgScale }: Props) {
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [equals, setEquals] = useState<EqualSpaceGuide[]>([]);

  useEffect(() => {
    const onGuides = (e: Event) => {
      const ce = e as CustomEvent<SnapGuide[]>;
      setGuides(ce.detail ?? []);
    };
    const onEqual = (e: Event) => {
      const ce = e as CustomEvent<EqualSpaceGuide[]>;
      setEquals(ce.detail ?? []);
    };
    window.addEventListener('pencil-snap-guides', onGuides as EventListener);
    window.addEventListener('pencil-equal-space-guides', onEqual as EventListener);
    return () => {
      window.removeEventListener('pencil-snap-guides', onGuides as EventListener);
      window.removeEventListener('pencil-equal-space-guides', onEqual as EventListener);
    };
  }, []);

  if (guides.length === 0 && equals.length === 0) return null;

  const stroke = '#EC4899';
  const strokeWidth = 1 / Math.max(svgScale, 0.001);
  const labelFont = 11 / Math.max(svgScale, 0.001);
  const labelPad = 4 / Math.max(svgScale, 0.001);

  return (
    <g pointerEvents="none">
      {/* エッジ/中心アライメントガイド */}
      {guides.map((g, i) => {
        if (g.orientation === 'v') {
          return (
            <line
              key={`al-${i}`}
              x1={g.pos}
              x2={g.pos}
              y1={g.from}
              y2={g.to}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={`${4 / svgScale} ${3 / svgScale}`}
            />
          );
        }
        return (
          <line
            key={`al-${i}`}
            x1={g.from}
            x2={g.to}
            y1={g.pos}
            y2={g.pos}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={`${4 / svgScale} ${3 / svgScale}`}
          />
        );
      })}

      {/* 等間隔スペースの距離ラベル + 両端矢印風 */}
      {equals.map((eg, i) =>
        eg.segments.map((seg, j) => {
          const mid = (seg.start + seg.end) / 2;
          const span = Math.abs(seg.end - seg.start);
          const labelText = `${Math.round(span)}`;
          // 水平 (h) なら横方向の距離、縦 (v) なら縦方向
          if (eg.orientation === 'h') {
            return (
              <g key={`eq-${i}-${j}`}>
                <line
                  x1={seg.start}
                  x2={seg.end}
                  y1={seg.perp}
                  y2={seg.perp}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <rect
                  x={mid - (labelText.length * labelFont * 0.3 + labelPad)}
                  y={seg.perp - labelFont}
                  width={labelText.length * labelFont * 0.6 + labelPad * 2}
                  height={labelFont * 1.3}
                  rx={labelFont * 0.2}
                  fill={stroke}
                />
                <text
                  x={mid}
                  y={seg.perp - labelFont * 0.1}
                  fontSize={labelFont}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={600}
                  fill="#FFFFFF"
                  textAnchor="middle"
                >
                  {labelText}
                </text>
              </g>
            );
          }
          return (
            <g key={`eq-${i}-${j}`}>
              <line
                x1={seg.perp}
                x2={seg.perp}
                y1={seg.start}
                y2={seg.end}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              <rect
                x={seg.perp - (labelText.length * labelFont * 0.3 + labelPad)}
                y={mid - labelFont * 0.6}
                width={labelText.length * labelFont * 0.6 + labelPad * 2}
                height={labelFont * 1.3}
                rx={labelFont * 0.2}
                fill={stroke}
              />
              <text
                x={seg.perp}
                y={mid + labelFont * 0.3}
                fontSize={labelFont}
                fontFamily="system-ui, sans-serif"
                fontWeight={600}
                fill="#FFFFFF"
                textAnchor="middle"
              >
                {labelText}
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}
