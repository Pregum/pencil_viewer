/**
 * 追加コマンドパレットコマンド: 検索・選択・編集・表示・ナビゲーション・レポート・クリップボード。
 */

import { useCallback } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode, FrameNode } from '../../pen/types';
import type { Command } from './CommandPalette';

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

/** Recursively flatten all nodes in the tree. */
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

/** Find node IDs whose `content` contains the query (case-insensitive). */
export function findNodesByText(nodes: PenNode[], query: string): string[] {
  const lower = query.toLowerCase();
  return flattenNodes(nodes)
    .filter((n) => {
      const content = (n as { content?: string }).content;
      return typeof content === 'string' && content.toLowerCase().includes(lower);
    })
    .map((n) => n.id);
}

/** Extract a flat list of color strings from a Fill value. */
function extractColors(fill: unknown): string[] {
  if (typeof fill === 'string') return [fill];
  if (fill && typeof fill === 'object') {
    if (Array.isArray(fill)) return fill.flatMap(extractColors);
    const f = fill as Record<string, unknown>;
    if (f.type === 'color' && typeof f.color === 'string') return [f.color];
    if (f.type === 'gradient' && Array.isArray(f.colors)) {
      return (f.colors as { color: string }[]).map((s) => s.color);
    }
  }
  return [];
}

/** Find node IDs that use a given fill color (case-insensitive hex match). */
export function findNodesByColor(nodes: PenNode[], color: string): string[] {
  const target = color.toLowerCase();
  return flattenNodes(nodes)
    .filter((n) => {
      const fill = (n as { fill?: unknown }).fill;
      if (!fill) return false;
      return extractColors(fill).some((c) => c.toLowerCase() === target);
    })
    .map((n) => n.id);
}

/** Find all nodes whose fill shares any color with the source node's fill. */
export function findNodesBySameFill(nodes: PenNode[], sourceId: string): string[] {
  const all = flattenNodes(nodes);
  const src = all.find((n) => n.id === sourceId);
  if (!src) return [];
  const srcFill = (src as { fill?: unknown }).fill;
  if (!srcFill) return [];
  const srcColors = new Set(extractColors(srcFill).map((c) => c.toLowerCase()));
  if (srcColors.size === 0) return [];
  return all
    .filter((n) => {
      const fill = (n as { fill?: unknown }).fill;
      if (!fill) return false;
      return extractColors(fill).some((c) => srcColors.has(c.toLowerCase()));
    })
    .map((n) => n.id);
}

/** Collect all unique fill colors used across all nodes. */
export function collectColors(nodes: PenNode[]): string[] {
  const colors = new Set<string>();
  for (const n of flattenNodes(nodes)) {
    const fill = (n as { fill?: unknown }).fill;
    if (fill) {
      for (const c of extractColors(fill)) colors.add(c);
    }
  }
  return Array.from(colors).sort();
}

/** Collect all unique fontFamily values used across all nodes. */
export function collectFonts(nodes: PenNode[]): string[] {
  const fonts = new Set<string>();
  for (const n of flattenNodes(nodes)) {
    const ff = (n as { fontFamily?: string }).fontFamily;
    if (typeof ff === 'string' && ff.length > 0) fonts.add(ff);
  }
  return Array.from(fonts).sort();
}

/** Count how many times each ref target is referenced. */
export function countComponentUsage(nodes: PenNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const n of flattenNodes(nodes)) {
    if (n.type === 'ref') {
      const ref = n.ref;
      counts.set(ref, (counts.get(ref) ?? 0) + 1);
    }
  }
  return counts;
}

/** Clone a node with a new id and offset position. */
export function duplicateNode(node: PenNode): PenNode {
  const id = `${node.id}_copy_${Date.now()}`;
  return {
    ...(node as object),
    id,
    x: (node.x ?? 0) + 20,
    y: (node.y ?? 0) + 20,
  } as PenNode;
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useExtraCommands(): Command[] {
  const { state, selectMultiple, selectNode, replaceDocChildren } = useEditor();

  // -- Search --

  const findByText = useCallback(() => {
    const query = window.prompt('Search nodes by text content:');
    if (!query) return;
    const ids = findNodesByText(state.doc.children, query);
    if (ids.length === 0) {
      window.alert('No nodes found.');
      return;
    }
    selectMultiple(ids);
  }, [state.doc.children, selectMultiple]);

  const findByColor = useCallback(() => {
    const color = window.prompt('Enter hex color (e.g. #FF0000):');
    if (!color) return;
    const ids = findNodesByColor(state.doc.children, color);
    if (ids.length === 0) {
      window.alert('No nodes found with that color.');
      return;
    }
    selectMultiple(ids);
  }, [state.doc.children, selectMultiple]);

  // -- Selection --

  const selectAll = useCallback(() => {
    const ids = state.doc.children.map((n) => n.id);
    selectMultiple(ids);
  }, [state.doc.children, selectMultiple]);

  const selectSameType = useCallback(() => {
    const sel = state.selectedNodeId
      ? findNode(state.doc.children, state.selectedNodeId)
      : null;
    if (!sel) return;
    const targetType = sel.type;
    const ids = flattenNodes(state.doc.children)
      .filter((n) => n.type === targetType)
      .map((n) => n.id);
    selectMultiple(ids);
  }, [state.doc.children, state.selectedNodeId, selectMultiple]);

  const selectSameFill = useCallback(() => {
    const srcId = state.selectedNodeId;
    if (!srcId) return;
    const ids = findNodesBySameFill(state.doc.children, srcId);
    if (ids.length === 0) return;
    selectMultiple(ids);
  }, [state.doc.children, state.selectedNodeId, selectMultiple]);

  // -- Edit --

  const duplicateSelected = useCallback(() => {
    const selId = state.selectedNodeId;
    if (!selId) return;
    const node = findNode(state.doc.children, selId);
    if (!node) return;
    const cloned = duplicateNode(node);
    replaceDocChildren([...state.doc.children, cloned]);
    selectNode(cloned.id);
  }, [state.doc.children, state.selectedNodeId, replaceDocChildren, selectNode]);

  const groupSelection = useCallback(() => {
    const ids = state.selectedNodeIds.size > 0
      ? Array.from(state.selectedNodeIds)
      : state.selectedNodeId ? [state.selectedNodeId] : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const selected = state.doc.children.filter((n) => idSet.has(n.id));
    const rest = state.doc.children.filter((n) => !idSet.has(n.id));
    if (selected.length === 0) return;
    const minX = Math.min(...selected.map((n) => n.x ?? 0));
    const minY = Math.min(...selected.map((n) => n.y ?? 0));
    const frame: FrameNode = {
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
    };
    replaceDocChildren([...rest, frame]);
    selectNode(frame.id);
  }, [state, replaceDocChildren, selectNode]);

  const ungroupSelection = useCallback(() => {
    const selId = state.selectedNodeId;
    if (!selId) return;
    const node = findNode(state.doc.children, selId);
    if (!node) return;
    if (node.type !== 'frame' && node.type !== 'group') return;
    const children = (node as { children?: PenNode[] }).children ?? [];
    const parentX = node.x ?? 0;
    const parentY = node.y ?? 0;
    const promoted = children.map((c) => ({
      ...(c as object),
      x: (c.x ?? 0) + parentX,
      y: (c.y ?? 0) + parentY,
    } as PenNode));
    const rest = state.doc.children.filter((n) => n.id !== selId);
    replaceDocChildren([...rest, ...promoted]);
    selectMultiple(promoted.map((n) => n.id));
  }, [state, replaceDocChildren, selectMultiple]);

  // -- Display --

  const toggleGrid = useCallback(() => {
    const canvas = document.querySelector('.viewer__canvas');
    if (canvas) canvas.classList.toggle('viewer__canvas--no-grid');
  }, []);

  const toggleDarkCanvas = useCallback(() => {
    const canvas = document.querySelector('.viewer__canvas');
    if (canvas) canvas.classList.toggle('viewer__canvas--dark');
  }, []);

  const toggleOutlines = useCallback(() => {
    const canvas = document.querySelector('.viewer__canvas');
    if (canvas) canvas.classList.toggle('viewer__canvas--outlines');
  }, []);

  // -- Navigation --

  const goToNodeById = useCallback(() => {
    const id = window.prompt('Enter node ID:');
    if (!id) return;
    const node = findNode(state.doc.children, id);
    if (!node) {
      window.alert(`Node "${id}" not found.`);
      return;
    }
    selectNode(id);
  }, [state.doc.children, selectNode]);

  // -- Reports --

  const colorPalette = useCallback(() => {
    const colors = collectColors(state.doc.children);
    if (colors.length === 0) {
      window.alert('No colors found.');
      return;
    }
    const text = colors.join('\n');
    void navigator.clipboard.writeText(text);
    window.alert(`${colors.length} colors copied to clipboard:\n${text}`);
  }, [state.doc.children]);

  const fontInventory = useCallback(() => {
    const fonts = collectFonts(state.doc.children);
    if (fonts.length === 0) {
      window.alert('No fonts found.');
      return;
    }
    const text = fonts.join('\n');
    void navigator.clipboard.writeText(text);
    window.alert(`${fonts.length} fonts copied to clipboard:\n${text}`);
  }, [state.doc.children]);

  const componentUsage = useCallback(() => {
    const usage = countComponentUsage(state.doc.children);
    if (usage.size === 0) {
      window.alert('No component references found.');
      return;
    }
    const lines = Array.from(usage.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ref, count]) => `${ref}: ${count}`);
    const text = lines.join('\n');
    void navigator.clipboard.writeText(text);
    window.alert(`Component usage copied to clipboard:\n${text}`);
  }, [state.doc.children]);

  // -- Clipboard --

  const copyAsJson = useCallback(() => {
    const selId = state.selectedNodeId;
    if (!selId) {
      window.alert('No node selected.');
      return;
    }
    const node = findNode(state.doc.children, selId);
    if (!node) return;
    const json = JSON.stringify(node, null, 2);
    void navigator.clipboard.writeText(json);
  }, [state.doc.children, state.selectedNodeId]);

  return [
    // Search
    { id: 'find-by-text', label: 'Find by Text', shortcut: 'Ctrl+F', action: findByText },
    { id: 'find-by-color', label: 'Find by Color', action: findByColor },
    // Selection
    { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A', action: selectAll },
    { id: 'select-same-type', label: 'Select Same Type', action: selectSameType },
    { id: 'select-same-fill', label: 'Select Same Fill', action: selectSameFill },
    // Edit
    { id: 'duplicate-node', label: 'Duplicate Node', shortcut: 'Ctrl+D', action: duplicateSelected },
    { id: 'group-selection', label: 'Group Selection', shortcut: 'Ctrl+G', action: groupSelection },
    { id: 'ungroup', label: 'Ungroup', shortcut: 'Ctrl+Shift+G', action: ungroupSelection },
    // Display
    { id: 'toggle-grid', label: 'Toggle Grid', action: toggleGrid },
    { id: 'dark-canvas', label: 'Dark Canvas', action: toggleDarkCanvas },
    { id: 'show-outlines', label: 'Show Outlines', action: toggleOutlines },
    // Navigation
    { id: 'go-to-node', label: 'Go to Node by ID', action: goToNodeById },
    // Reports
    { id: 'color-palette', label: 'Color Palette', action: colorPalette },
    { id: 'font-inventory', label: 'Font Inventory', action: fontInventory },
    { id: 'component-usage', label: 'Component Usage', action: componentUsage },
    // Clipboard
    { id: 'copy-as-json', label: 'Copy as JSON', action: copyAsJson },
  ];
}
