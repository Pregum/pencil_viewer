/**
 * グラデーション / フィルタ用の `<defs>` レジストリ。
 *
 * 責務:
 *  - ドキュメント全体を走査して、構造化 fill(gradient / image)と effect
 *    (blur / shadow)を抽出
 *  - それぞれに一意な ID を割り振り、`<defs>` 配下に描画するエントリを生成
 *  - 各ノードは paint の resolve 関数経由で `url(#id)` を参照する
 */

import type {
  Fill,
  Fills,
  GradientFill,
  ImageFill,
  PenDocument,
  PenNode,
  Effect,
  Effects,
  BlurEffect,
  ShadowEffect,
} from '../types';

export type PaintRef = {
  kind: 'gradient' | 'image';
  id: string;
  def: GradientFill | ImageFill;
};

export type FilterRef = {
  kind: 'filter';
  id: string;
  effects: (BlurEffect | ShadowEffect)[];
};

export interface PaintRegistry {
  /** ノード ID + fill index → paint ref ID(gradient/image 用) */
  fillMap: Map<string, string>;
  /** ノード ID + stroke → paint ref ID */
  strokeMap: Map<string, string>;
  /** ノード ID → filter ID */
  filterMap: Map<string, string>;
  paints: PaintRef[];
  filters: FilterRef[];
}

export function buildPaintRegistry(doc: PenDocument): PaintRegistry {
  const registry: PaintRegistry = {
    fillMap: new Map(),
    strokeMap: new Map(),
    filterMap: new Map(),
    paints: [],
    filters: [],
  };
  for (const node of doc.children) walkNode(node, registry);
  return registry;
}

function walkNode(node: PenNode, registry: PaintRegistry): void {
  const nodeId = (node as { id: string }).id;

  // fill
  const fill = (node as { fill?: Fills }).fill;
  if (fill) {
    const single = pickStructuredFill(fill);
    if (single) {
      const id = `fill-${nodeId}`;
      registry.fillMap.set(nodeId, id);
      registry.paints.push({
        kind: single.type === 'gradient' ? 'gradient' : 'image',
        id,
        def: single,
      });
    }
  }
  // stroke
  const stroke = (node as { stroke?: { fill?: Fills } }).stroke;
  if (stroke?.fill) {
    const single = pickStructuredFill(stroke.fill);
    if (single) {
      const id = `stroke-${nodeId}`;
      registry.strokeMap.set(nodeId, id);
      registry.paints.push({
        kind: single.type === 'gradient' ? 'gradient' : 'image',
        id,
        def: single,
      });
    }
  }
  // effect
  const effect = (node as { effect?: Effects }).effect;
  if (effect) {
    const list = Array.isArray(effect) ? effect : [effect];
    const enabled = list.filter((e): e is Effect => !!e && e.enabled !== false);
    if (enabled.length > 0) {
      const id = `filter-${nodeId}`;
      registry.filterMap.set(nodeId, id);
      registry.filters.push({ kind: 'filter', id, effects: enabled });
    }
  }

  // 子を再帰
  const children = (node as { children?: PenNode[] }).children;
  if (children) {
    for (const c of children) walkNode(c, registry);
  }
}

function pickStructuredFill(fill: Fills): GradientFill | ImageFill | null {
  const single: Fill | undefined = Array.isArray(fill) ? fill[0] : fill;
  if (!single || typeof single === 'string') return null;
  if (single.type === 'gradient') return single;
  if (single.type === 'image') return single;
  return null;
}
