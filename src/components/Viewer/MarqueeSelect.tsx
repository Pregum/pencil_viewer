/**
 * マーキー（矩形）範囲選択。
 * キャンバス上でドラッグして矩形を描画し、範囲内のノードをマルチ選択する。
 * EditorProvider 内に配置する。
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
  /** SVG viewBox (for coordinate conversion) */
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

/** Check if a node's bounding box intersects with the selection rect */
function nodeIntersects(node: PenNode, rect: Rect, offsetX = 0, offsetY = 0): boolean {
  const nx = (node.x ?? 0) + offsetX;
  const ny = (node.y ?? 0) + offsetY;
  const nw = typeof (node as { width?: unknown }).width === 'number'
    ? (node as { width: number }).width : 0;
  const nh = typeof (node as { height?: unknown }).height === 'number'
    ? (node as { height: number }).height : 0;
  if (nw === 0 && nh === 0) return false;

  return !(nx + nw < rect.x || nx > rect.x + rect.width ||
           ny + nh < rect.y || ny > rect.y + rect.height);
}

/** Collect all nodes (top-level) that intersect with the rect */
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

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      // Only left button, no modifier keys (those are for pan)
      if (e.button !== 0 || e.altKey || e.metaKey || e.ctrlKey) return;
      // Don't start marquee if space is held (pan mode)
      // Check if the click is on the SVG background (not on a node)
      const target = e.target as Element;
      const isSvgBg = target.tagName === 'svg' || target.tagName === 'rect' && target.getAttribute('fill') === 'transparent' && !target.closest('[data-node-id]');

      if (!isSvgBg) return;

      const svg = svgRef.current;
      if (!svg) return;

      const pt = screenToSvg(e.clientX, e.clientY, svg);
      startPoint.current = pt;
      hasMoved.current = false;
      setDragging(true);
      setMarquee(null);
    },
    [svgRef],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return;
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
      }
    },
    [dragging, svgRef],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);

    if (hasMoved.current && marquee) {
      const ids = collectIntersecting(state.doc.children, marquee);
      if (ids.length > 0) {
        selectMultiple(ids);
      } else {
        selectNode(null);
      }
    }
    setMarquee(null);
  }, [dragging, marquee, state.doc, selectMultiple, selectNode]);

  useEffect(() => {
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
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
