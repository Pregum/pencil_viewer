/**
 * スマートガイド表示。SelectableNode のドラッグから 'pencil-snap-guides' イベントで
 * SnapGuide[] を受け取り、縦/横のアライメントガイド線を描画する。
 *
 * ドラッグ終了時に空配列が送られて消去される。
 */

import { useEffect, useState } from 'react';
import type { SnapGuide } from '../../pen/state/snapEngine';

interface Props {
  svgScale: number;
}

export function SnapGuides({ svgScale }: Props) {
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  useEffect(() => {
    const onGuides = (e: Event) => {
      const ce = e as CustomEvent<SnapGuide[]>;
      setGuides(ce.detail ?? []);
    };
    window.addEventListener('pencil-snap-guides', onGuides as EventListener);
    return () => window.removeEventListener('pencil-snap-guides', onGuides as EventListener);
  }, []);

  if (guides.length === 0) return null;

  const stroke = '#EC4899';
  const strokeWidth = 1 / Math.max(svgScale, 0.001);

  return (
    <g pointerEvents="none">
      {guides.map((g, i) => {
        if (g.orientation === 'v') {
          return (
            <line
              key={i}
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
            key={i}
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
    </g>
  );
}
