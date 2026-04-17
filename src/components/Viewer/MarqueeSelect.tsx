/**
 * マーキー（矩形）範囲選択。
 * キャンバス上でドラッグして矩形を描画し、範囲内のノードをマルチ選択する。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  viewBox: Rect;
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

function nodeIntersects(node: PenNode, rect: Rect): boolean {
  const nx = node.x ?? 0;
  const ny = node.y ?? 0;
  const nw = typeof (node as { width?: unknown }).width === 'number'
    ? (node as { width: number }).width : 0;
  const nh = typeof (node as { height?: unknown }).height === 'number'
    ? (node as { height: number }).height : 0;
  if (nw === 0 && nh === 0) return false;
  return !(nx + nw < rect.x || nx > rect.x + rect.width ||
           ny + nh < rect.y || ny > rect.y + rect.height);
}

function collectIntersecting(nodes: PenNode[], rect: Rect): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (nodeIntersects(node, rect)) {
      result.push(node.id);
    }
  }
  return result;
}

export function MarqueeSelect({ svgRef }: Props) {
  const { state, selectMultiple, selectNode } = useEditor();
  const [dragging, setDragging] = useState(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const pointerId = useRef<number | null>(null);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0 || e.altKey || e.metaKey || e.ctrlKey) return;
      // タッチでは範囲選択を無効化(閲覧メインの操作感を優先、ドラッグはパンに割り当てる)
      if (e.pointerType === 'touch') return;
      // シェイプ作成ツール選択中はマーキー無効（ShapeCreator に譲る）
      if (state.activeTool !== 'select') return;
      const svg = svgRef.current;
      if (!svg) return;

      // Only start marquee if the pointer is within the SVG canvas area
      const svgRect = svg.getBoundingClientRect();
      if (e.clientX < svgRect.left || e.clientX > svgRect.right ||
          e.clientY < svgRect.top || e.clientY > svgRect.bottom) return;

      // Check target: only start on SVG background or the deselect rect
      const target = e.target as Element;
      const tagName = target.tagName.toLowerCase();
      // Allow: svg element itself, or a transparent rect (background hit area)
      const isBackground = tagName === 'svg' ||
        (tagName === 'rect' && target.getAttribute('fill') === 'transparent');
      if (!isBackground) return;

      const pt = screenToSvg(e.clientX, e.clientY, svg);
      startPoint.current = pt;
      hasMoved.current = false;
      pointerId.current = e.pointerId;
      setDragging(true);
      setMarquee(null);
    },
    [svgRef, state.activeTool],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId.current) return;
      const svg = svgRef.current;
      if (!svg) return;

      const pt = screenToSvg(e.clientX, e.clientY, svg);
      const x = Math.min(startPoint.current.x, pt.x);
      const y = Math.min(startPoint.current.y, pt.y);
      const width = Math.abs(pt.x - startPoint.current.x);
      const height = Math.abs(pt.y - startPoint.current.y);

      if (width > 3 || height > 3) {
        hasMoved.current = true;
        setMarquee({ x, y, width, height });

        // Live preview: select intersecting nodes during drag
        const ids = collectIntersecting(state.doc.children, { x, y, width, height });
        if (ids.length > 0) {
          selectMultiple(ids);
        }
      }
    },
    [dragging, svgRef, state.doc, selectMultiple],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId.current) return;
      setDragging(false);
      pointerId.current = null;

      if (hasMoved.current && marquee) {
        const ids = collectIntersecting(state.doc.children, marquee);
        if (ids.length > 0) {
          selectMultiple(ids);
        } else {
          selectNode(null);
        }
      }
      setMarquee(null);
    },
    [dragging, marquee, state.doc, selectMultiple, selectNode],
  );

  useEffect(() => {
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  if (!marquee) return null;

  return (
    <rect
      x={marquee.x}
      y={marquee.y}
      width={marquee.width}
      height={marquee.height}
      fill="rgba(79, 70, 229, 0.08)"
      stroke="#4F46E5"
      strokeWidth={1}
      strokeDasharray="4 3"
      pointerEvents="none"
    />
  );
}
