/**
 * SVG 内のコンテンツ描画。EditorContext の doc を使ってリアルタイム反映する。
 * 背景クリックでノード選択解除。
 */

import { useMemo } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { buildPaintRegistry } from '../../pen/paint/registry';
import { Defs } from '../../pen/paint/Defs';
import { PaintRegistryProvider } from '../../pen/paint/PaintContext';
import { resolveRefs } from '../../pen/refs';
import { substituteVariables } from '../../pen/variables';
import { renderMaskedChildren } from '../../pen/renderer/MaskedChildren';

export function CanvasContent() {
  const { state, selectNode } = useEditor();
  // ref ノード展開 → 変数置換を live に適用してから描画。
  // どちらも存在しない場合は no-op。
  const doc = useMemo(() => substituteVariables(resolveRefs(state.doc)), [state.doc]);
  const registry = useMemo(() => buildPaintRegistry(doc), [doc]);

  return (
    <>
      {/* Background hit area: click to deselect (シェイプ作成ツール中は ShapeCreator の addNode→selectedNodeId で上書きされるので無効化しない) */}
      <rect
        x={-1e6}
        y={-1e6}
        width={2e6}
        height={2e6}
        fill="transparent"
        onClick={() => {
          if (state.activeTool === 'select') selectNode(null);
        }}
      />
      <Defs registry={registry} />
      <PaintRegistryProvider value={registry}>
        {renderMaskedChildren(doc.children)}
      </PaintRegistryProvider>
    </>
  );
}
