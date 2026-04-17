/**
 * キャンバスルーラー: 上端と左端にピクセル目盛を SVG で描画。
 * 現在の camera viewBox を受け取り、ズーム倍率に応じて tick 間隔を自動調整する。
 */

import { useEditor } from '../../pen/state/EditorContext';

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  viewBox: ViewBox;
  /** SVG コンテナのクライアント矩形 (ruler の実 px サイズ) */
  clientSize: { width: number; height: number };
  show: boolean;
}

const RULER_SIZE = 24;

/** ズームに応じて読みやすい tick 間隔 (SVG 単位) を選ぶ: 1, 2, 5, 10, 20, 50, 100, ... */
function chooseTickStep(svgPerPx: number): number {
  // 目安: 主要 tick は約 80px ごと
  const targetPxStep = 80;
  const targetSvgStep = targetPxStep * svgPerPx;
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  for (const s of steps) if (s >= targetSvgStep) return s;
  return steps[steps.length - 1];
}

export function Rulers({ viewBox, clientSize, show }: Props) {
  const { state } = useEditor();
  if (!show || clientSize.width === 0 || clientSize.height === 0) return null;

  const svgPerPx = viewBox.width / clientSize.width;
  const majorStep = chooseTickStep(svgPerPx);
  const minorStep = majorStep / 5;

  const startX = Math.floor(viewBox.x / minorStep) * minorStep;
  const endX = viewBox.x + viewBox.width;
  const startY = Math.floor(viewBox.y / minorStep) * minorStep;
  const endY = viewBox.y + viewBox.height;

  const horiz: Array<{ x: number; major: boolean; label: string | null }> = [];
  for (let x = startX; x <= endX; x += minorStep) {
    const major = Math.round(x / majorStep) * majorStep === Math.round(x * 1000) / 1000;
    const xPx = ((x - viewBox.x) / viewBox.width) * clientSize.width;
    horiz.push({
      x: xPx,
      major,
      label: major ? `${Math.round(x)}` : null,
    });
  }

  const vert: Array<{ y: number; major: boolean; label: string | null }> = [];
  for (let y = startY; y <= endY; y += minorStep) {
    const major = Math.round(y / majorStep) * majorStep === Math.round(y * 1000) / 1000;
    const yPx = ((y - viewBox.y) / viewBox.height) * clientSize.height;
    vert.push({
      y: yPx,
      major,
      label: major ? `${Math.round(y)}` : null,
    });
  }

  // 選択ノードの bbox → スクリーン px でハイライト
  const selected = state.selectedNodeId
    ? state.doc.children.find((n) => n.id === state.selectedNodeId)
    : null;
  let hl: { x1: number; x2: number; y1: number; y2: number } | null = null;
  if (selected) {
    const w = typeof (selected as { width?: unknown }).width === 'number' ? (selected as { width: number }).width : 0;
    const h = typeof (selected as { height?: unknown }).height === 'number' ? (selected as { height: number }).height : 0;
    if (w > 0 && h > 0) {
      const nx = selected.x ?? 0;
      const ny = selected.y ?? 0;
      hl = {
        x1: ((nx - viewBox.x) / viewBox.width) * clientSize.width,
        x2: ((nx + w - viewBox.x) / viewBox.width) * clientSize.width,
        y1: ((ny - viewBox.y) / viewBox.height) * clientSize.height,
        y2: ((ny + h - viewBox.y) / viewBox.height) * clientSize.height,
      };
    }
  }

  return (
    <>
      {/* 左上コーナー（ルーラー同士の交差部） */}
      <div className="viewer__ruler-corner" style={{ width: RULER_SIZE, height: RULER_SIZE }} />

      {/* 水平ルーラー（上端） */}
      <svg
        className="viewer__ruler viewer__ruler--h"
        width={clientSize.width}
        height={RULER_SIZE}
        style={{ left: RULER_SIZE, top: 0 }}
      >
        <rect x={0} y={0} width={clientSize.width} height={RULER_SIZE} fill="var(--color-surface, #fff)" />
        {hl && (
          <rect
            x={hl.x1}
            y={0}
            width={hl.x2 - hl.x1}
            height={RULER_SIZE}
            fill="var(--color-accent, #4F46E5)"
            opacity={0.15}
          />
        )}
        {horiz.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x}
              x2={t.x}
              y1={t.major ? RULER_SIZE - 10 : RULER_SIZE - 4}
              y2={RULER_SIZE}
              stroke="var(--color-text-muted, #9CA3AF)"
              strokeWidth={1}
            />
            {t.label && (
              <text
                x={t.x + 3}
                y={10}
                fontSize={10}
                fontFamily="system-ui, sans-serif"
                fill="var(--color-text-muted, #9CA3AF)"
              >
                {t.label}
              </text>
            )}
          </g>
        ))}
        <line x1={0} x2={clientSize.width} y1={RULER_SIZE - 0.5} y2={RULER_SIZE - 0.5} stroke="var(--color-border, #E5E7EB)" strokeWidth={1} />
      </svg>

      {/* 垂直ルーラー（左端） */}
      <svg
        className="viewer__ruler viewer__ruler--v"
        width={RULER_SIZE}
        height={clientSize.height}
        style={{ left: 0, top: RULER_SIZE }}
      >
        <rect x={0} y={0} width={RULER_SIZE} height={clientSize.height} fill="var(--color-surface, #fff)" />
        {hl && (
          <rect
            x={0}
            y={hl.y1}
            width={RULER_SIZE}
            height={hl.y2 - hl.y1}
            fill="var(--color-accent, #4F46E5)"
            opacity={0.15}
          />
        )}
        {vert.map((t, i) => (
          <g key={i}>
            <line
              x1={t.major ? RULER_SIZE - 10 : RULER_SIZE - 4}
              x2={RULER_SIZE}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-text-muted, #9CA3AF)"
              strokeWidth={1}
            />
            {t.label && (
              <text
                x={2}
                y={t.y - 2}
                fontSize={10}
                fontFamily="system-ui, sans-serif"
                fill="var(--color-text-muted, #9CA3AF)"
                transform={`rotate(-90, 10, ${t.y + 8})`}
              >
                {t.label}
              </text>
            )}
          </g>
        ))}
        <line x1={RULER_SIZE - 0.5} x2={RULER_SIZE - 0.5} y1={0} y2={clientSize.height} stroke="var(--color-border, #E5E7EB)" strokeWidth={1} />
      </svg>
    </>
  );
}

export { RULER_SIZE };
