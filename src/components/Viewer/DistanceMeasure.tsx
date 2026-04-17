/**
 * Figma ライクな距離測定: 選択ノードがあり、Alt/Option を押しながら別ノードをホバーすると、
 * 両矩形間の上下左右ギャップを赤線と数値ラベルで表示する。
 *
 * 対象は doc.children (トップレベル) の axis-aligned bbox。
 */

import { useEffect, useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
}

function nodeToRect(n: PenNode): Rect | null {
  const w = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : 0;
  const h = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : 0;
  if (w <= 0 || h <= 0) return null;
  return { id: n.id, x: n.x ?? 0, y: n.y ?? 0, width: w, height: h };
}

function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return { x: (clientX - ctm.e) / ctm.a, y: (clientY - ctm.f) / ctm.d };
}

function pointInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** 2 つの矩形間の上下左右のギャップを算出（重なりの場合は 0 or 負を返す） */
interface Gaps {
  /** A の right → B の left (正: 離れている / 負: 重なり) */
  horizontal: number;
  /** A の bottom → B の top */
  vertical: number;
  /** A と B の x 軸上の重なり区間 */
  horizontalOverlap: [number, number] | null;
  /** A と B の y 軸上の重なり区間 */
  verticalOverlap: [number, number] | null;
  /** 測定線の a/b 側 ("right"|"left"|"top"|"bottom") */
  xDir: 'right' | 'left' | 'overlap';
  yDir: 'down' | 'up' | 'overlap';
}

function computeGaps(a: Rect, b: Rect): Gaps {
  const aLeft = a.x, aRight = a.x + a.width;
  const aTop = a.y, aBottom = a.y + a.height;
  const bLeft = b.x, bRight = b.x + b.width;
  const bTop = b.y, bBottom = b.y + b.height;

  let horizontal: number;
  let xDir: Gaps['xDir'];
  if (aRight <= bLeft) {
    horizontal = bLeft - aRight;
    xDir = 'right';
  } else if (bRight <= aLeft) {
    horizontal = aLeft - bRight;
    xDir = 'left';
  } else {
    horizontal = 0;
    xDir = 'overlap';
  }

  let vertical: number;
  let yDir: Gaps['yDir'];
  if (aBottom <= bTop) {
    vertical = bTop - aBottom;
    yDir = 'down';
  } else if (bBottom <= aTop) {
    vertical = aTop - bBottom;
    yDir = 'up';
  } else {
    vertical = 0;
    yDir = 'overlap';
  }

  const hOvLow = Math.max(aLeft, bLeft);
  const hOvHigh = Math.min(aRight, bRight);
  const vOvLow = Math.max(aTop, bTop);
  const vOvHigh = Math.min(aBottom, bBottom);

  return {
    horizontal,
    vertical,
    horizontalOverlap: hOvLow < hOvHigh ? [hOvLow, hOvHigh] : null,
    verticalOverlap: vOvLow < vOvHigh ? [vOvLow, vOvHigh] : null,
    xDir,
    yDir,
  };
}

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
  svgScale: number;
}

export function DistanceMeasure({ svgRef, svgScale }: Props) {
  const { state } = useEditor();
  const [altDown, setAltDown] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Alt キーの押下状態
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.altKey) setAltDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (!e.altKey) setAltDown(false);
    };
    const blur = () => setAltDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // ホバー位置を追跡
  useEffect(() => {
    if (!altDown || !state.selectedNodeId) {
      setHoverId(null);
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;

    const handleMove = (e: PointerEvent) => {
      if (!svgRef.current) return;
      const pt = screenToSvg(svgRef.current, e.clientX, e.clientY);
      let found: string | null = null;
      for (const n of state.doc.children) {
        if (n.id === state.selectedNodeId) continue;
        const r = nodeToRect(n);
        if (r && pointInRect(pt, r)) {
          found = r.id;
          // 深さ優先ではなく一番後ろ（前面）を採用
        }
      }
      setHoverId(found);
    };

    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, [altDown, state.selectedNodeId, state.doc.children, svgRef]);

  const selected = useMemo(() => {
    const n = state.selectedNodeId
      ? state.doc.children.find((c) => c.id === state.selectedNodeId)
      : null;
    return n ? nodeToRect(n) : null;
  }, [state.selectedNodeId, state.doc.children]);

  const hovered = useMemo(() => {
    const n = hoverId ? state.doc.children.find((c) => c.id === hoverId) : null;
    return n ? nodeToRect(n) : null;
  }, [hoverId, state.doc.children]);

  if (!altDown || !selected || !hovered || selected.id === hovered.id) return null;

  const gaps = computeGaps(selected, hovered);
  const stroke = '#DC2626';
  const strokeWidth = 1 / Math.max(svgScale, 0.001);
  const labelFont = 11 / Math.max(svgScale, 0.001);
  const labelPad = 3 / Math.max(svgScale, 0.001);

  const labels: Array<{ x: number; y: number; text: string; key: string }> = [];
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = [];

  // --- 水平ギャップ ---
  if (gaps.xDir !== 'overlap' && gaps.horizontal > 0.5) {
    const yMid = gaps.verticalOverlap
      ? (gaps.verticalOverlap[0] + gaps.verticalOverlap[1]) / 2
      : (selected.y + selected.height / 2 + hovered.y + hovered.height / 2) / 2;
    const xStart = gaps.xDir === 'right' ? selected.x + selected.width : hovered.x + hovered.width;
    const xEnd = gaps.xDir === 'right' ? hovered.x : selected.x;
    lines.push({ x1: xStart, y1: yMid, x2: xEnd, y2: yMid, key: 'h-main' });
    // 縦方向に overlap が無い場合、hovered 側にガイド延長線を引く
    if (!gaps.verticalOverlap) {
      const tickY = gaps.yDir === 'down' ? hovered.y : hovered.y + hovered.height;
      // 両ノードのエッジから測定線の高さへ破線
      lines.push({
        x1: selected.x + selected.width / 2,
        y1: tickY,
        x2: selected.x + selected.width / 2,
        y2: yMid,
        key: 'h-sel-ext',
      });
    }
    labels.push({
      x: (xStart + xEnd) / 2,
      y: yMid,
      text: `${Math.round(gaps.horizontal)}`,
      key: 'h-label',
    });
  }

  // --- 垂直ギャップ ---
  if (gaps.yDir !== 'overlap' && gaps.vertical > 0.5) {
    const xMid = gaps.horizontalOverlap
      ? (gaps.horizontalOverlap[0] + gaps.horizontalOverlap[1]) / 2
      : (selected.x + selected.width / 2 + hovered.x + hovered.width / 2) / 2;
    const yStart = gaps.yDir === 'down' ? selected.y + selected.height : hovered.y + hovered.height;
    const yEnd = gaps.yDir === 'down' ? hovered.y : selected.y;
    lines.push({ x1: xMid, y1: yStart, x2: xMid, y2: yEnd, key: 'v-main' });
    if (!gaps.horizontalOverlap) {
      const tickX = gaps.xDir === 'right' ? hovered.x : hovered.x + hovered.width;
      lines.push({
        x1: tickX,
        y1: selected.y + selected.height / 2,
        x2: xMid,
        y2: selected.y + selected.height / 2,
        key: 'v-sel-ext',
      });
    }
    labels.push({
      x: xMid,
      y: (yStart + yEnd) / 2,
      text: `${Math.round(gaps.vertical)}`,
      key: 'v-label',
    });
  }

  return (
    <g pointerEvents="none">
      {/* ホバー中ノードをハイライト */}
      <rect
        x={hovered.x - 1}
        y={hovered.y - 1}
        width={hovered.width + 2}
        height={hovered.height + 2}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={`${4 / svgScale} ${3 / svgScale}`}
      />
      {lines.map((l) => (
        <line
          key={l.key}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={l.key.endsWith('-ext') ? `${3 / svgScale} ${2 / svgScale}` : undefined}
        />
      ))}
      {labels.map((l) => {
        const textWidth = l.text.length * labelFont * 0.6 + labelPad * 2;
        return (
          <g key={l.key}>
            <rect
              x={l.x - textWidth / 2}
              y={l.y - labelFont * 0.7}
              width={textWidth}
              height={labelFont * 1.3}
              rx={labelFont * 0.2}
              fill={stroke}
            />
            <text
              x={l.x}
              y={l.y + labelFont * 0.3}
              fontSize={labelFont}
              fontFamily="system-ui, sans-serif"
              fontWeight={600}
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {l.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
