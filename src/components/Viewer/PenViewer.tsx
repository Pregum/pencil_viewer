import { useMemo } from 'react';
import type { PenDocument } from '../../pen/types';
import { PenNodeView } from '../../pen/renderer/PenNode';
import { computeViewBox } from '../../pen/renderer/viewBox';
import { buildPaintRegistry } from '../../pen/paint/registry';
import { Defs } from '../../pen/paint/Defs';
import { PaintRegistryProvider } from '../../pen/paint/PaintContext';

export function PenViewer({ doc }: { doc: PenDocument }) {
  const vb = computeViewBox(doc);
  const registry = useMemo(() => buildPaintRegistry(doc), [doc]);

  return (
    <div className="viewer">
      <svg
        className="viewer__svg"
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs registry={registry} />
        <PaintRegistryProvider value={registry}>
          {doc.children.map((node) => (
            <PenNodeView key={node.id} node={node} />
          ))}
        </PaintRegistryProvider>
      </svg>
    </div>
  );
}
