/**
 * SVG 内のコンテンツ描画。EditorContext の rawDoc を使い、毎レンダリングで
 * ref 展開 / 変数置換 / flex レイアウトを再計算してリアルタイム反映する。
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
import { layoutDocument } from '../../pen/layout';

export function CanvasContent() {
  const { state, selectNode } = useEditor();
  // 描画パイプライン: rawDoc → ref 展開 → 変数置換 → flex layout 再計算。
  // rawDoc を起点にすることで、PropertyPanel から justifyContent / alignItems /
  // gap / padding / layout など flex プロパティを変えても即時反映される。
  // (以前は state.doc (レイアウト済み) を使っていたため、これらのプロパティを
  //  更新してもレイアウトは初回ロード時のままになっていた)
  const doc = useMemo(
    () => layoutDocument(substituteVariables(resolveRefs(state.rawDoc))),
    [state.rawDoc],
  );
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
