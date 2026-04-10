/**
 * ノードをクリック選択可能にするラッパー。
 * クリック時に EditorContext の selectNode を呼ぶ。
 * 選択中のノードには選択枠を表示する。
 */

import type { PenNode } from '../types';
import { useEditor } from '../state/EditorContext';

interface Props {
  node: PenNode;
  children: React.ReactNode;
}

export function SelectableNode({ node, children }: Props) {
  const { state, selectNode } = useEditor();
  const isSelected = state.selectedNodeId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id);
  };

  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof (node as { width?: unknown }).width === 'number'
    ? ((node as { width: number }).width)
    : 0;
  const height = typeof (node as { height?: unknown }).height === 'number'
    ? ((node as { height: number }).height)
    : 0;

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }}>
      {children}
      {/* Transparent hit area for nodes without fill */}
      {width > 0 && height > 0 && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="transparent"
          stroke="none"
          pointerEvents="all"
        />
      )}
      {/* Selection outline */}
      {isSelected && width > 0 && height > 0 && (
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
      )}
    </g>
  );
}
