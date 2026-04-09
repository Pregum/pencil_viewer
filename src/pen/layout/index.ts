/**
 * .pen ドキュメントの全ノードをレイアウト済み(x/y/width/height が
 * すべて実数の)ドキュメントに変換するエントリ。
 */

import type { PenDocument, PenNode } from '../types';
import { layoutNode, type LayoutContext } from './flex';

export function layoutDocument(doc: PenDocument): PenDocument {
  const rootCtx: LayoutContext = {
    // ドキュメントルートには外側からの制約がないので無限大
    availableWidth: Number.POSITIVE_INFINITY,
    availableHeight: Number.POSITIVE_INFINITY,
    parentLayout: 'none',
  };
  const children: PenNode[] = doc.children.map((c) => layoutNode(c, rootCtx));
  return { ...doc, children };
}

export { layoutNode } from './flex';
export type { LayoutContext } from './flex';
