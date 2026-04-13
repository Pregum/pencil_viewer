/**
 * Right-click context menu for nodes in the canvas.
 * Listens for a custom 'pencil-context-menu' event dispatched by SelectableNode.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { duplicateNode } from './ExtraCommands';
import type { PenNode } from '../../pen/types';

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string;
}

/** Find a node by id in tree. */
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

/** Flatten all nodes recursively. */
function flattenNodes(nodes: PenNode[]): PenNode[] {
  const result: PenNode[] = [];
  for (const n of nodes) {
    result.push(n);
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      result.push(...flattenNodes((n as { children: PenNode[] }).children));
    }
  }
  return result;
}

export function ContextMenu() {
  const { state, selectNode, selectMultiple, deleteNode, replaceDocChildren } = useEditor();
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, nodeId: '' });
  const menuRef = useRef<HTMLDivElement>(null);

  // Listen for custom context menu event from SelectableNode
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { nodeId: string; x: number; y: number };
      selectNode(detail.nodeId);
      setMenu({ visible: true, x: detail.x, y: detail.y, nodeId: detail.nodeId });
    };
    window.addEventListener('pencil-context-menu', handler);
    return () => window.removeEventListener('pencil-context-menu', handler);
  }, [selectNode]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!menu.visible) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu((m) => ({ ...m, visible: false }));
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu((m) => ({ ...m, visible: false }));
      }
    };
    // Use timeout so the current click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menu.visible]);

  const close = useCallback(() => {
    setMenu((m) => ({ ...m, visible: false }));
  }, []);

  const node = menu.nodeId ? findNode(state.doc.children, menu.nodeId) : null;

  const handleCopyJson = useCallback(() => {
    if (!node) return;
    const json = JSON.stringify(node, null, 2);
    void navigator.clipboard.writeText(json);
    close();
  }, [node, close]);

  const handleDuplicate = useCallback(() => {
    if (!node) return;
    const cloned = duplicateNode(node);
    replaceDocChildren([...state.doc.children, cloned]);
    selectNode(cloned.id);
    close();
  }, [node, state.doc.children, replaceDocChildren, selectNode, close]);

  const handleDelete = useCallback(() => {
    if (!menu.nodeId) return;
    deleteNode(menu.nodeId);
    close();
  }, [menu.nodeId, deleteNode, close]);

  const handleBringToFront = useCallback(() => {
    if (!menu.nodeId) return;
    const idx = state.doc.children.findIndex((n) => n.id === menu.nodeId);
    if (idx < 0 || idx === state.doc.children.length - 1) { close(); return; }
    const children = [...state.doc.children];
    const [removed] = children.splice(idx, 1);
    children.push(removed);
    replaceDocChildren(children);
    close();
  }, [menu.nodeId, state.doc.children, replaceDocChildren, close]);

  const handleSendToBack = useCallback(() => {
    if (!menu.nodeId) return;
    const idx = state.doc.children.findIndex((n) => n.id === menu.nodeId);
    if (idx <= 0) { close(); return; }
    const children = [...state.doc.children];
    const [removed] = children.splice(idx, 1);
    children.unshift(removed);
    replaceDocChildren(children);
    close();
  }, [menu.nodeId, state.doc.children, replaceDocChildren, close]);

  const handleGroup = useCallback(() => {
    if (!node) return;
    const ids = state.selectedNodeIds.size > 0
      ? Array.from(state.selectedNodeIds)
      : [menu.nodeId];
    const idSet = new Set(ids);
    const selected = state.doc.children.filter((n) => idSet.has(n.id));
    const rest = state.doc.children.filter((n) => !idSet.has(n.id));
    if (selected.length === 0) { close(); return; }
    const minX = Math.min(...selected.map((n) => n.x ?? 0));
    const minY = Math.min(...selected.map((n) => n.y ?? 0));
    const frame: PenNode = {
      type: 'frame',
      id: `group_${Date.now()}`,
      x: minX,
      y: minY,
      layout: 'none',
      children: selected.map((n) => ({
        ...(n as object),
        x: (n.x ?? 0) - minX,
        y: (n.y ?? 0) - minY,
      } as PenNode)),
    } as PenNode;
    replaceDocChildren([...rest, frame]);
    selectNode(frame.id);
    close();
  }, [node, menu.nodeId, state, replaceDocChildren, selectNode, close]);

  const handleUngroup = useCallback(() => {
    if (!node) return;
    if (node.type !== 'frame' && node.type !== 'group') { close(); return; }
    const children = (node as { children?: PenNode[] }).children ?? [];
    const parentX = node.x ?? 0;
    const parentY = node.y ?? 0;
    const promoted = children.map((c) => ({
      ...(c as object),
      x: (c.x ?? 0) + parentX,
      y: (c.y ?? 0) + parentY,
    } as PenNode));
    const rest = state.doc.children.filter((n) => n.id !== menu.nodeId);
    replaceDocChildren([...rest, ...promoted]);
    selectMultiple(promoted.map((n) => n.id));
    close();
  }, [node, menu.nodeId, state.doc.children, replaceDocChildren, selectMultiple, close]);

  const handleSelectSameType = useCallback(() => {
    if (!node) return;
    const targetType = node.type;
    const ids = flattenNodes(state.doc.children)
      .filter((n) => n.type === targetType)
      .map((n) => n.id);
    selectMultiple(ids);
    close();
  }, [node, state.doc.children, selectMultiple, close]);

  if (!menu.visible || !node) return null;

  const isGroupOrFrame = node.type === 'frame' || node.type === 'group';

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <button type="button" className="context-menu__item" onClick={handleCopyJson}>
        Copy (JSON)
      </button>
      <button type="button" className="context-menu__item" onClick={handleDuplicate}>
        Duplicate
      </button>
      <button type="button" className="context-menu__item" onClick={handleDelete}>
        Delete
      </button>
      <div className="context-menu__divider" />
      <button type="button" className="context-menu__item" onClick={handleBringToFront}>
        Bring to Front
      </button>
      <button type="button" className="context-menu__item" onClick={handleSendToBack}>
        Send to Back
      </button>
      <div className="context-menu__divider" />
      <button type="button" className="context-menu__item" onClick={handleGroup}>
        Group
      </button>
      {isGroupOrFrame && (
        <button type="button" className="context-menu__item" onClick={handleUngroup}>
          Ungroup
        </button>
      )}
      <button type="button" className="context-menu__item" onClick={handleSelectSameType}>
        Select Same Type
      </button>
    </div>
  );
}
