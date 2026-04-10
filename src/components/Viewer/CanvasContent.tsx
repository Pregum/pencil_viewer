/**
 * SVG 内のコンテンツ描画。EditorContext の doc を使ってリアルタイム反映する。
 */

import { useMemo } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { PenNodeView } from '../../pen/renderer/PenNode';
import { buildPaintRegistry } from '../../pen/paint/registry';
import { Defs } from '../../pen/paint/Defs';
import { PaintRegistryProvider } from '../../pen/paint/PaintContext';

export function CanvasContent() {
  const { state } = useEditor();
  const doc = state.doc;
  const registry = useMemo(() => buildPaintRegistry(doc), [doc]);

  return (
    <>
      <Defs registry={registry} />
      <PaintRegistryProvider value={registry}>
        {doc.children.map((node) => (
          <PenNodeView key={node.id} node={node} />
        ))}
      </PaintRegistryProvider>
    </>
  );
}
