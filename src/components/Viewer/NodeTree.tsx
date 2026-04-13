/**
 * 左サイドバー: ドキュメントのノードツリーを階層表示。
 * 選択ノードをハイライトし、クリックで選択を切り替える。
 * 選択変更時に自動スクロール + 祖先を自動展開。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

const TYPE_ICONS: Record<string, string> = {
  frame: 'F',
  group: 'G',
  rectangle: 'R',
  ellipse: 'E',
  line: 'L',
  polygon: 'P',
  path: 'Pa',
  text: 'T',
  icon_font: 'Ic',
  image: 'Im',
  unsupported: '?',
};

function hasChildren(node: PenNode): node is PenNode & { children: PenNode[] } {
  return 'children' in node && Array.isArray((node as { children?: unknown }).children);
}

/** 選択ノードの祖先IDセットを算出（自動展開用） */
function collectAncestorIds(nodes: PenNode[], targetId: string): Set<string> {
  const result = new Set<string>();
  function walk(node: PenNode, path: string[]): boolean {
    if (node.id === targetId) {
      for (const id of path) result.add(id);
      return true;
    }
    if (hasChildren(node)) {
      for (const child of node.children) {
        if (walk(child, [...path, node.id])) return true;
      }
    }
    return false;
  }
  for (const n of nodes) walk(n, []);
  return result;
}

function NodeItem({
  node,
  depth,
  selectedId,
  selectedIds,
  expandedIds,
  onSelect,
  onToggle,
}: {
  node: PenNode;
  depth: number;
  selectedId: string | null;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const isSelected = selectedId === node.id;
  const isMulti = selectedIds.has(node.id);
  const children = hasChildren(node) ? node.children : [];
  const hasKids = children.length > 0;
  const expanded = expandedIds.has(node.id);
  const name = (node as { name?: string }).name ?? node.id;
  const typeIcon = TYPE_ICONS[node.type] ?? '?';

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id);
    },
    [node.id, onToggle],
  );

  return (
    <div>
      <div
        data-node-id={node.id}
        className={`node-tree__item ${isSelected ? 'node-tree__item--selected' : ''} ${isMulti && !isSelected ? 'node-tree__item--multi' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(node.id)}
      >
        {hasKids ? (
          <span className="node-tree__toggle" onClick={handleToggle}>
            {expanded ? '\u25BE' : '\u25B8'}
          </span>
        ) : (
          <span className="node-tree__toggle-spacer" />
        )}
        <span className={`node-tree__type node-tree__type--${node.type}`}>
          {typeIcon}
        </span>
        <span className="node-tree__name" title={name}>
          {name}
        </span>
      </div>
      {expanded &&
        children.map((child) => (
          <NodeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            selectedIds={selectedIds}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

export function NodeTree({ collapsed, onTogglePanel }: { collapsed?: boolean; onTogglePanel?: () => void }) {
  const { state, selectNode } = useEditor();
  const listRef = useRef<HTMLDivElement>(null);

  // 展開状態の管理（トップレベルはデフォルト展開）
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const n of state.doc.children) initial.add(n.id);
    return initial;
  });

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 選択変更時: 祖先を自動展開 + スクロール
  useEffect(() => {
    if (!state.selectedNodeId) return;

    // 祖先を展開
    const ancestors = collectAncestorIds(state.doc.children, state.selectedNodeId);
    if (ancestors.size > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
    }

    // 少し待ってからスクロール（展開のレンダリング後）
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-node-id="${state.selectedNodeId}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [state.selectedNodeId, state.doc.children]);

  if (collapsed) {
    return (
      <div className="node-tree node-tree--collapsed">
        <button className="node-tree__toggle-btn" onClick={onTogglePanel} title="Show Layers">
          ☰
        </button>
      </div>
    );
  }

  return (
    <div className="node-tree">
      <div className="node-tree__header">
        <span>Layers</span>
        {state.selectedNodeIds.size > 0 && (
          <span className="node-tree__count">{state.selectedNodeIds.size} selected</span>
        )}
        {onTogglePanel && (
          <button className="node-tree__toggle-btn" onClick={onTogglePanel} title="Hide Layers">
            ✕
          </button>
        )}
      </div>
      <div className="node-tree__list" ref={listRef}>
        {state.doc.children.map((node) => (
          <NodeItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={state.selectedNodeId}
            selectedIds={state.selectedNodeIds}
            expandedIds={expandedIds}
            onSelect={selectNode}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
