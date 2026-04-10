/**
 * ノードをクリック選択、ドラッグ移動、リサイズ可能にするラッパー。
 */

import { useCallback, useRef } from 'react';
import type { PenNode } from '../types';
import { useEditor } from '../state/EditorContext';

interface Props {
  node: PenNode;
  children: React.ReactNode;
}

const HANDLE_SIZE = 8;

export function SelectableNode({ node, children }: Props) {
  const { state, selectNode, updateNode } = useEditor();
  const isSelected = state.selectedNodeId === node.id;
  const isDragging = useRef(false);
  const isResizing = useRef<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const nodeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof (node as { width?: unknown }).width === 'number'
    ? ((node as { width: number }).width)
    : 0;
  const height = typeof (node as { height?: unknown }).height === 'number'
    ? ((node as { height: number }).height)
    : 0;

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging.current || isResizing.current) return;
    e.stopPropagation();
    selectNode(node.id);
  };

  // Convert screen delta to SVG delta using the SVG's CTM
  const screenToSvgDelta = useCallback((dx: number, dy: number, svg: SVGSVGElement) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { dx, dy };
    return { dx: dx / ctm.a, dy: dy / ctm.d };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle?: string) => {
      if (!isSelected) return;
      e.stopPropagation();
      e.preventDefault();

      if (handle) {
        isResizing.current = handle;
      } else {
        isDragging.current = true;
      }
      dragStart.current = { x: e.clientX, y: e.clientY };
      nodeStart.current = { x, y, w: width, h: height };
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [isSelected, x, y, width, height],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current && !isResizing.current) return;
      const svg = (e.target as SVGElement).closest('svg') as SVGSVGElement | null;
      if (!svg) return;

      const rawDx = e.clientX - dragStart.current.x;
      const rawDy = e.clientY - dragStart.current.y;
      const { dx, dy } = screenToSvgDelta(rawDx, rawDy, svg);

      if (isDragging.current) {
        updateNode(node.id, {
          x: Math.round(nodeStart.current.x + dx),
          y: Math.round(nodeStart.current.y + dy),
        } as Partial<PenNode>);
      } else if (isResizing.current) {
        const h = isResizing.current;
        let newW = nodeStart.current.w;
        let newH = nodeStart.current.h;
        let newX = nodeStart.current.x;
        let newY = nodeStart.current.y;

        if (h.includes('e')) newW = Math.max(1, nodeStart.current.w + dx);
        if (h.includes('s')) newH = Math.max(1, nodeStart.current.h + dy);
        if (h.includes('w')) {
          newW = Math.max(1, nodeStart.current.w - dx);
          newX = nodeStart.current.x + dx;
        }
        if (h.includes('n')) {
          newH = Math.max(1, nodeStart.current.h - dy);
          newY = nodeStart.current.y + dy;
        }

        updateNode(node.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        } as Partial<PenNode>);
      }
    },
    [node.id, updateNode, screenToSvgDelta],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    isResizing.current = null;
  }, []);

  // Resize handle positions
  const handles = isSelected && width > 0 && height > 0
    ? [
        { id: 'nw', cx: x, cy: y, cursor: 'nw-resize' },
        { id: 'ne', cx: x + width, cy: y, cursor: 'ne-resize' },
        { id: 'sw', cx: x, cy: y + height, cursor: 'sw-resize' },
        { id: 'se', cx: x + width, cy: y + height, cursor: 'se-resize' },
      ]
    : [];

  return (
    <g
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: isSelected ? 'move' : 'pointer' }}
    >
      {children}

      {/* Selection outline + drag area */}
      {isSelected && width > 0 && height > 0 && (
        <>
          <rect
            x={x - 1}
            y={y - 1}
            width={width + 2}
            height={height + 2}
            fill="transparent"
            stroke="#4F46E5"
            strokeWidth={2}
            rx={2}
            pointerEvents="all"
            style={{ cursor: 'move' }}
            onPointerDown={(e) => handlePointerDown(e)}
          />
          {/* Resize handles */}
          {handles.map((h) => (
            <rect
              key={h.id}
              x={h.cx - HANDLE_SIZE / 2}
              y={h.cy - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              fill="#FFFFFF"
              stroke="#4F46E5"
              strokeWidth={1.5}
              rx={2}
              style={{ cursor: h.cursor }}
              onPointerDown={(e) => handlePointerDown(e, h.id)}
            />
          ))}
        </>
      )}
    </g>
  );
}
