/**
 * Layers パネル用のノードツリー検索。
 * name / id / type / content(テキスト) に対して部分一致（大文字小文字無視）。
 *
 * 返り値:
 *   visible    – 表示すべき node id（ヒット自身 + 全祖先）
 *   autoExpand – ヒットを内包するため自動展開すべき祖先 id
 */

import type { PenNode } from '../pen/types';

function hasChildren(node: PenNode): node is PenNode & { children: PenNode[] } {
  return 'children' in node && Array.isArray((node as { children?: unknown }).children);
}

export interface FilterResult {
  visible: Set<string>;
  autoExpand: Set<string>;
  matchCount: number;
}

export function filterNodeTree(nodes: PenNode[], query: string): FilterResult {
  const visible = new Set<string>();
  const autoExpand = new Set<string>();
  const trimmed = query.trim();
  if (!trimmed) return { visible, autoExpand, matchCount: 0 };
  const q = trimmed.toLowerCase();
  let matchCount = 0;

  function walk(node: PenNode, ancestors: string[]): boolean {
    const name = ((node as { name?: string }).name ?? node.id).toLowerCase();
    const content = (node as { content?: string }).content;
    const contentLow = typeof content === 'string' ? content.toLowerCase() : '';
    const selfMatch =
      name.includes(q) ||
      node.id.toLowerCase().includes(q) ||
      node.type.toLowerCase().includes(q) ||
      contentLow.includes(q);

    let childMatch = false;
    if (hasChildren(node)) {
      for (const c of node.children) {
        if (walk(c, [...ancestors, node.id])) childMatch = true;
      }
    }

    if (selfMatch || childMatch) {
      if (selfMatch) matchCount++;
      visible.add(node.id);
      for (const a of ancestors) {
        visible.add(a);
        autoExpand.add(a);
      }
      return true;
    }
    return false;
  }

  for (const n of nodes) walk(n, []);
  return { visible, autoExpand, matchCount };
}
