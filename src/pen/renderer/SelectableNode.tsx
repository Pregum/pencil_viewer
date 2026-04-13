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
  const { state, selectNode, updateNodeSilent, pushUndoCheckpoint } = useEditor();
  const isSelected = state.selectedNodeId === node.id;
  const isMultiSelected = state.selectedNodeIds.has(node.id);
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
  // NodeBase.rotation(度)を SVG rotate(angle, cx, cy) で適用。
  // ピボットはノード自身の中心 (x+w/2, y+h/2)。
  // 子孫レンダラ(Frame の translate(x, y) など)はこの回転の内側にあるため、
  // 自動的に正しい位置で回転する。選択枠/ハンドルも一緒に回るので追加の補正は不要。
  const rotation = (node as { rotation?: number }).rotation ?? 0;
  const groupTransform =
    rotation !== 0 && width > 0 && height > 0
      ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})`
      : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging.current || isResizing.current) return;
    // Inner-first: stopPropagation so the deepest (innermost) node wins.
    // SVG bubble order: innermost → outermost. We stop at the first handler.
    e.stopPropagation();
    selectNode(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('pencil-context-menu', {
        detail: { nodeId: node.id, x: e.clientX, y: e.clientY },
      }),
    );
  };

  // Tooltip text: "name (type) — W×H"
  const tooltipName = node.name ?? node.id;
  const tooltipText =
    width > 0 && height > 0
      ? `${tooltipName} (${node.type}) — ${Math.round(width)}×${Math.round(height)}`
      : `${tooltipName} (${node.type})`;

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

      // Undo チェックポイント: ドラッグ開始時に1回だけ
      pushUndoCheckpoint();

      if (handle) {
        isResizing.current = handle;
      } else {
        isDragging.current = true;
      }
      dragStart.current = { x: e.clientX, y: e.clientY };
      nodeStart.current = { x, y, w: width, h: height };
      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [isSelected, x, y, width, height, pushUndoCheckpoint],
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
        updateNodeSilent(node.id, {
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

        updateNodeSilent(node.id, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        } as Partial<PenNode>);
      }
    },
    [node.id, updateNodeSilent, screenToSvgDelta],
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
      transform={groupTransform}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={isSelected ? (e) => handlePointerDown(e) : undefined}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: isSelected ? 'move' : 'pointer' }}
    >
      <title>{tooltipText}</title>
      {children}

      {/* Multi-selection highlight */}
      {!isSelected && isMultiSelected && width > 0 && height > 0 && (
        <rect
          x={x - 1}
          y={y - 1}
          width={width + 2}
          height={height + 2}
          fill="rgba(79, 70, 229, 0.05)"
          stroke="#818CF8"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          rx={2}
          pointerEvents="none"
        />
      )}
      {/* Selection outline (pointerEvents=none so children stay clickable) */}
      {isSelected && width > 0 && height > 0 && (
        <>
          <rect
            x={x - 1}
            y={y - 1}
            width={width + 2}
            height={height + 2}
            fill="none"
            stroke="#4F46E5"
            strokeWidth={2}
            rx={2}
            pointerEvents="none"
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
