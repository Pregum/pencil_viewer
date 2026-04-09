import type { GroupNode } from '../types';
import { PenNodeView } from './PenNode';

export function Group({ node }: { node: GroupNode }) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const opacity = node.opacity ?? 1;
  const transform = x === 0 && y === 0 ? undefined : `translate(${x} ${y})`;
  return (
    <g transform={transform} opacity={opacity}>
      {node.children?.map((child) => <PenNodeView key={child.id} node={child} />)}
    </g>
  );
}
