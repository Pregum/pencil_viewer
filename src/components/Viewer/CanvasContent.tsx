/**
 * SVG 内のコンテンツ描画。EditorContext の doc を使ってリアルタイム反映する。
 * 背景クリックでノード選択解除。
 */

import { useMemo } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { PenNodeView } from '../../pen/renderer/PenNode';
import { buildPaintRegistry } from '../../pen/paint/registry';
import { Defs } from '../../pen/paint/Defs';
import { PaintRegistryProvider } from '../../pen/paint/PaintContext';

export function CanvasContent() {
  const { state, selectNode } = useEditor();
  const doc = state.doc;
  const registry = useMemo(() => buildPaintRegistry(doc), [doc]);

  return (
    <>
      {/* Background hit area: click to deselect */}
      <rect
        x={-1e6}
        y={-1e6}
        width={2e6}
        height={2e6}
        fill="transparent"
        onClick={() => selectNode(null)}
      />
      <Defs registry={registry} />
      <PaintRegistryProvider value={registry}>
        {doc.children.map((node) => (
          <PenNodeView key={node.id} node={node} />
        ))}
      </PaintRegistryProvider>
    </>
  );
}
