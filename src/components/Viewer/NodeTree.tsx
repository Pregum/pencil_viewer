/**
 * 左サイドバー: ドキュメントのノードツリーを階層表示。
 * 選択ノードをハイライトし、クリックで選択を切り替える。
 */

import { useCallback, useState } from 'react';
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

function NodeItem({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: PenNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedId === node.id;
  const children = hasChildren(node) ? node.children : [];
  const hasKids = children.length > 0;
  const name = (node as { name?: string }).name ?? node.id;
  const typeIcon = TYPE_ICONS[node.type] ?? '?';

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((v) => !v);
    },
    [],
  );

  return (
    <div>
      <div
        className={`node-tree__item ${isSelected ? 'node-tree__item--selected' : ''}`}
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
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export function NodeTree() {
  const { state, selectNode } = useEditor();

  return (
    <div className="node-tree">
      <div className="node-tree__header">Layers</div>
      <div className="node-tree__list">
        {state.doc.children.map((node) => (
          <NodeItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={state.selectedNodeId}
            onSelect={selectNode}
          />
        ))}
      </div>
    </div>
  );
}
