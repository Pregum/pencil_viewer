/**
 * マルチ選択ノードの整列・等間隔配置コマンドを提供。
 * コマンドパレットから呼び出す。
 */

import { useCallback } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';
import type { Command } from './CommandPalette';

function getNodeRect(node: PenNode): { id: string; x: number; y: number; w: number; h: number } | null {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const w = typeof (node as { width?: unknown }).width === 'number' ? (node as { width: number }).width : 0;
  const h = typeof (node as { height?: unknown }).height === 'number' ? (node as { height: number }).height : 0;
  if (w === 0 && h === 0) return null;
  return { id: node.id, x, y, w, h };
}

function findNode(nodes: PenNode[], id: string): PenNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const found = findNode((n as { children: PenNode[] }).children, id);
      if (found) return found;
    }
  }
  return null;
}

export function useAlignCommands(): Command[] {
  const { state, updateNode, pushUndoCheckpoint } = useEditor();

  const getSelectedRects = useCallback(() => {
    const ids = state.selectedNodeIds.size > 0
      ? Array.from(state.selectedNodeIds)
      : state.selectedNodeId ? [state.selectedNodeId] : [];
    return ids
      .map((id) => {
        const node = findNode(state.doc.children, id);
        return node ? getNodeRect(node) : null;
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
  }, [state]);

  const alignLeft = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 2) return;
    pushUndoCheckpoint();
    const minX = Math.min(...rects.map((r) => r.x));
    for (const r of rects) updateNode(r.id, { x: minX } as Partial<PenNode>);
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const alignRight = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 2) return;
    pushUndoCheckpoint();
    const maxRight = Math.max(...rects.map((r) => r.x + r.w));
    for (const r of rects) updateNode(r.id, { x: maxRight - r.w } as Partial<PenNode>);
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const alignTop = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 2) return;
    pushUndoCheckpoint();
    const minY = Math.min(...rects.map((r) => r.y));
    for (const r of rects) updateNode(r.id, { y: minY } as Partial<PenNode>);
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const alignBottom = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 2) return;
    pushUndoCheckpoint();
    const maxBottom = Math.max(...rects.map((r) => r.y + r.h));
    for (const r of rects) updateNode(r.id, { y: maxBottom - r.h } as Partial<PenNode>);
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const alignCenterH = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 2) return;
    pushUndoCheckpoint();
    const centers = rects.map((r) => r.x + r.w / 2);
    const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
    for (const r of rects) updateNode(r.id, { x: Math.round(avg - r.w / 2) } as Partial<PenNode>);
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const alignCenterV = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 2) return;
    pushUndoCheckpoint();
    const centers = rects.map((r) => r.y + r.h / 2);
    const avg = centers.reduce((a, b) => a + b, 0) / centers.length;
    for (const r of rects) updateNode(r.id, { y: Math.round(avg - r.h / 2) } as Partial<PenNode>);
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const distributeH = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 3) return;
    pushUndoCheckpoint();
    const sorted = [...rects].sort((a, b) => a.x - b.x);
    const totalWidth = sorted.reduce((s, r) => s + r.w, 0);
    const totalSpan = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w - sorted[0].x;
    const gap = (totalSpan - totalWidth) / (sorted.length - 1);
    let cursor = sorted[0].x;
    for (const r of sorted) {
      updateNode(r.id, { x: Math.round(cursor) } as Partial<PenNode>);
      cursor += r.w + gap;
    }
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const distributeV = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 3) return;
    pushUndoCheckpoint();
    const sorted = [...rects].sort((a, b) => a.y - b.y);
    const totalHeight = sorted.reduce((s, r) => s + r.h, 0);
    const totalSpan = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h - sorted[0].y;
    const gap = (totalSpan - totalHeight) / (sorted.length - 1);
    let cursor = sorted[0].y;
    for (const r of sorted) {
      updateNode(r.id, { y: Math.round(cursor) } as Partial<PenNode>);
      cursor += r.h + gap;
    }
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const sortByX = useCallback(() => {
    const rects = getSelectedRects();
    if (rects.length < 2) return;
    pushUndoCheckpoint();
    const sorted = [...rects].sort((a, b) => a.x - b.x);
    const positions = rects.map((r) => ({ x: r.x, y: r.y }));
    positions.sort((a, b) => a.x - b.x || a.y - b.y);
    for (let i = 0; i < sorted.length; i++) {
      updateNode(sorted[i].id, { x: positions[i].x, y: positions[i].y } as Partial<PenNode>);
    }
  }, [getSelectedRects, updateNode, pushUndoCheckpoint]);

  const count = state.selectedNodeIds.size;
  const suffix = count > 0 ? ` (${count} nodes)` : '';

  return [
    { id: 'align-left', label: `Align Left${suffix}`, action: alignLeft },
    { id: 'align-right', label: `Align Right${suffix}`, action: alignRight },
    { id: 'align-top', label: `Align Top${suffix}`, action: alignTop },
    { id: 'align-bottom', label: `Align Bottom${suffix}`, action: alignBottom },
    { id: 'align-center-h', label: `Align Center Horizontal${suffix}`, action: alignCenterH },
    { id: 'align-center-v', label: `Align Center Vertical${suffix}`, action: alignCenterV },
    { id: 'distribute-h', label: `Distribute Horizontal${suffix}`, action: distributeH },
    { id: 'distribute-v', label: `Distribute Vertical${suffix}`, action: distributeV },
    { id: 'sort-by-x', label: `Sort by X position${suffix}`, action: sortByX },
  ];
}
