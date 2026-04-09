import type { PenDocument } from '../../pen/types';
import { PenNodeView } from '../../pen/renderer/PenNode';
import { computeViewBox } from '../../pen/renderer/viewBox';

export function PenViewer({ doc }: { doc: PenDocument }) {
  const vb = computeViewBox(doc);
  return (
    <div className="viewer">
      <svg
        className="viewer__svg"
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {doc.children.map((node) => (
          <PenNodeView key={node.id} node={node} />
        ))}
      </svg>
    </div>
  );
}
