/**
 * ノードツリーに対する純粋操作。
 *
 * EditorContext.tsx から切り出した (#71)。React に依存せず、
 * ドキュメントとノード配列だけを見る関数群。
 */

import type { PenDocument, PenNode } from '../types';

/** ノードを ID で探して patch を当てた新しいノードを返す (再帰) */
export function updateNodeRecursive(
  node: PenNode,
  nodeId: string,
  patch: Partial<PenNode>,
): PenNode {
  if (node.id === nodeId) {
    return { ...(node as object), ...patch } as PenNode;
  }
  if ('children' in node && Array.isArray((node as { children?: PenNode[] }).children)) {
    const children = (node as { children: PenNode[] }).children.map((c) =>
      updateNodeRecursive(c, nodeId, patch),
    );
    return { ...(node as object), children } as PenNode;
  }
  return node;
}

/** ドキュメント中の 1 ノードに patch を当てた新しいドキュメントを返す */
export function updateNodeInDoc(
  doc: PenDocument,
  nodeId: string,
  patch: Partial<PenNode>,
): PenDocument {
  return {
    ...doc,
    children: doc.children.map((n) => updateNodeRecursive(n, nodeId, patch)),
  };
}

/** ツリーからノードを ID で検索 */
export function findNode(nodes: PenNode[], id: string): PenNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const found = findNode((n as { children: PenNode[] }).children, id);
      if (found) return found;
    }
  }
  return null;
}

/** nodeId を含む階層の兄弟配列を返す。見つからなければ null */
export function findSiblings(nodeId: string, nodes: PenNode[]): PenNode[] | null {
  if (nodes.some((n) => n.id === nodeId)) return nodes;
  for (const n of nodes) {
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const result = findSiblings(nodeId, (n as { children: PenNode[] }).children);
      if (result) return result;
    }
  }
  return null;
}

/** ルートから targetId までの祖先チェーンを返す。見つからなければ null */
export function findParentChain(
  nodes: PenNode[],
  targetId: string,
  chain: PenNode[] = [],
): PenNode[] | null {
  for (const n of nodes) {
    if (n.id === targetId) return chain;
    // 元実装と同じく truthy 判定にしている (Array.isArray まで見ない)
    const children = (n as { children?: PenNode[] }).children;
    if (children) {
      const found = findParentChain(children, targetId, [...chain, n]);
      if (found) return found;
    }
  }
  return null;
}
