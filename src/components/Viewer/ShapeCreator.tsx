/**
 * アクティブツール (rectangle / ellipse / line / text / frame) に応じて、
 * SVG キャンバス上でドラッグしたサイズのノードを新規作成する。
 * - ドラッグ中はプレビュー (ゴースト) を描画
 * - ポインターアップ時に EditorContext.addNode で doc に挿入し、ツールを select に戻す
 * - クリック (ほぼ移動なし) の場合はツールのデフォルトサイズで作成
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, type ActiveTool } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

function screenToSvg(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return {
    x: (clientX - ctm.e) / ctm.a,
    y: (clientY - ctm.f) / ctm.d,
  };
}

/** クリック時 (ほぼ移動なし) のデフォルトサイズ */
function defaultSize(tool: ActiveTool): { width: number; height: number } {
  switch (tool) {
    case 'rectangle':
    case 'ellipse':
      return { width: 100, height: 100 };
    case 'line':
      return { width: 100, height: 0 };
    case 'text':
      return { width: 160, height: 40 };
    case 'frame':
      return { width: 375, height: 812 };
    case 'note':
      return { width: 200, height: 140 };
    default:
      return { width: 100, height: 100 };
  }
}

function buildNode(tool: ActiveTool, rect: Rect): PenNode | null {
  const id = `${tool}_${Date.now()}`;
  const baseGraphics = {
    id,
    name: id,
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
  switch (tool) {
    case 'rectangle':
      return {
        type: 'rectangle',
        ...baseGraphics,
        fill: '#E5E7EB',
        stroke: { thickness: 1, fill: '#9CA3AF' },
      } as PenNode;
    case 'ellipse':
      return {
        type: 'ellipse',
        ...baseGraphics,
        fill: '#E5E7EB',
        stroke: { thickness: 1, fill: '#9CA3AF' },
      } as PenNode;
    case 'line':
      return {
        type: 'line',
        ...baseGraphics,
        height: Math.max(0, rect.height),
        stroke: { thickness: 2, fill: '#111827' },
      } as PenNode;
    case 'text':
      return {
        type: 'text',
        ...baseGraphics,
        content: 'Text',
        fontSize: 16,
        fill: '#111827',
      } as PenNode;
    case 'frame':
      return {
        type: 'frame',
        ...baseGraphics,
        layout: 'none',
        fill: '#FFFFFF',
        stroke: { thickness: 1, fill: '#E5E7EB' },
        children: [],
      } as PenNode;
    case 'note':
      return {
        type: 'note',
        ...baseGraphics,
        content: 'Note',
        fontSize: 14,
        fill: '#FEF3C7',
      } as PenNode;
    default:
      return null;
  }
}

export function ShapeCreator({ svgRef }: Props) {
  const { state, addNode, setActiveTool, beginEditing } = useEditor();
  const tool = state.activeTool;
  const [preview, setPreview] = useState<Rect | null>(null);
  /** line プレビュー用の生の開始/終了点（bounding rect では方向情報が失われるため別管理） */
  const [linePts, setLinePts] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (tool === 'select') return;
      if (e.button !== 0) return;
      // touch の場合はパンと競合するので無効化
      if (e.pointerType === 'touch') return;
      const svg = svgRef.current;
      if (!svg) return;

      const svgRect = svg.getBoundingClientRect();
      if (
        e.clientX < svgRect.left ||
        e.clientX > svgRect.right ||
        e.clientY < svgRect.top ||
        e.clientY > svgRect.bottom
      )
        return;

      // 背景 (svg 自身 or 透明な deselect 用 rect) の上でだけ発火
      const target = e.target as Element;
      const tagName = target.tagName.toLowerCase();
      const isBackground =
        tagName === 'svg' ||
        (tagName === 'rect' && target.getAttribute('fill') === 'transparent');
      if (!isBackground) return;

      const pt = screenToSvg(e.clientX, e.clientY, svg);
      startPoint.current = pt;
      dragging.current = true;
      hasMoved.current = false;
      pointerId.current = e.pointerId;
      setPreview({ x: pt.x, y: pt.y, width: 0, height: 0 });
      setLinePts({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      e.preventDefault();
    },
    [tool, svgRef],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current || e.pointerId !== pointerId.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const pt = screenToSvg(e.clientX, e.clientY, svg);
      const x = Math.min(startPoint.current.x, pt.x);
      const y = Math.min(startPoint.current.y, pt.y);
      const width = Math.abs(pt.x - startPoint.current.x);
      const height = Math.abs(pt.y - startPoint.current.y);
      if (width > 1 || height > 1) hasMoved.current = true;
      setPreview({ x, y, width, height });
      setLinePts({ x1: startPoint.current.x, y1: startPoint.current.y, x2: pt.x, y2: pt.y });
    },
    [svgRef],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current || e.pointerId !== pointerId.current) return;
      dragging.current = false;
      pointerId.current = null;

      let rect: Rect;
      if (hasMoved.current && preview) {
        rect = preview;
      } else {
        // クリック: デフォルトサイズで作成（クリック位置が左上）
        const d = defaultSize(tool);
        rect = { x: startPoint.current.x, y: startPoint.current.y, ...d };
      }
      const node = buildNode(tool, rect);
      if (node) {
        addNode(node);
        // テキスト作成時は即インライン編集に入る（Figma 的 UX）
        if (tool === 'text') {
          beginEditing(node.id);
        }
      }
      setPreview(null);
      setLinePts(null);
      // 作成したら select ツールに戻す
      setActiveTool('select');
    },
    [preview, tool, addNode, setActiveTool, beginEditing],
  );

  useEffect(() => {
    if (tool === 'select') return;
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [tool, handlePointerDown, handlePointerMove, handlePointerUp]);

  if (!preview || tool === 'select') return null;

  // プレビュー描画
  if (tool === 'line' && linePts) {
    return (
      <line
        x1={linePts.x1}
        y1={linePts.y1}
        x2={linePts.x2}
        y2={linePts.y2}
        stroke="#4F46E5"
        strokeWidth={1}
        strokeDasharray="4 3"
        pointerEvents="none"
      />
    );
  }
  if (tool === 'ellipse') {
    return (
      <ellipse
        cx={preview.x + preview.width / 2}
        cy={preview.y + preview.height / 2}
        rx={preview.width / 2}
        ry={preview.height / 2}
        fill="rgba(79, 70, 229, 0.08)"
        stroke="#4F46E5"
        strokeWidth={1}
        strokeDasharray="4 3"
        pointerEvents="none"
      />
    );
  }
  return (
    <rect
      x={preview.x}
      y={preview.y}
      width={preview.width}
      height={preview.height}
      fill="rgba(79, 70, 229, 0.08)"
      stroke="#4F46E5"
      strokeWidth={1}
      strokeDasharray="4 3"
      pointerEvents="none"
    />
  );
}
