/**
 * `ref` ノード(コンポーネントインスタンス)を、参照先コンポーネントの
 * サブツリーで展開する。
 *
 * パイプライン: parse → resolveRefs → substituteVariables → layout → render
 *
 * 手順:
 * 1. ドキュメント全体を走査して `reusable: true` のノードを ID で索引化
 * 2. ref ノードを見つけたら:
 *    a. 参照先を deep clone
 *    b. ref ノード自身のプロパティ(id/type/ref/descendants 以外)で
 *       ルートを上書き
 *    c. `descendants` マップの各エントリでサブツリー内のノードを上書き
 *    d. 結果のノードで ref を置き換え
 * 3. 未解決の ref(参照先が見つからない)は UnsupportedNode に変換
 */

import type { PenDocument, PenNode, UnsupportedNode } from './types';

const REF_SKIP_KEYS = new Set(['type', 'ref', 'descendants', 'reusable']);

export function resolveRefs(doc: PenDocument): PenDocument {
  // 1. reusable コンポーネントの索引を構築
  const index = new Map<string, PenNode>();
  const indexWalk = (node: PenNode) => {
    if ((node as { reusable?: boolean }).reusable) {
      index.set(node.id, node);
    }
    const children = (node as { children?: PenNode[] }).children;
    if (children) for (const c of children) indexWalk(c);
  };
  for (const c of doc.children) indexWalk(c);

  if (index.size === 0 && !hasRefs(doc.children)) return doc;

  // 2. ref を再帰的に解決
  const children = doc.children.map((c) => resolveNode(c, index));
  return { ...doc, children };
}

function hasRefs(nodes: PenNode[]): boolean {
  for (const n of nodes) {
    if (n.type === 'ref') return true;
    const children = (n as { children?: PenNode[] }).children;
    if (children && hasRefs(children)) return true;
  }
  return false;
}

function resolveNode(node: PenNode, index: Map<string, PenNode>): PenNode {
  if (node.type === 'ref') {
    return expandRef(node, index);
  }
  const children = (node as { children?: PenNode[] }).children;
  if (children) {
    const resolved = children.map((c) => resolveNode(c, index));
    return { ...(node as object), children: resolved } as PenNode;
  }
  return node;
}

function expandRef(
  ref: PenNode & { type: 'ref'; ref: string; descendants?: Record<string, Record<string, unknown>> },
  index: Map<string, PenNode>,
): PenNode {
  const target = index.get(ref.ref);
  if (!target) {
    // 参照先が見つからない → Unsupported で通す
    return {
      type: 'unsupported',
      id: ref.id,
      x: ref.x ?? 0,
      y: ref.y ?? 0,
      width: (ref as { width?: unknown }).width ?? 120,
      height: (ref as { height?: unknown }).height ?? 60,
      originalType: `ref:${ref.ref}`,
      raw: ref,
    } as UnsupportedNode;
  }

  // deep clone
  const cloned = deepClone(target) as Record<string, unknown>;

  // ルートプロパティの上書き(id は ref のものを使う)
  cloned.id = ref.id;
  for (const [k, v] of Object.entries(ref as Record<string, unknown>)) {
    if (REF_SKIP_KEYS.has(k)) continue;
    if (v !== undefined) cloned[k] = v;
  }

  // descendants の上書き
  if (ref.descendants) {
    for (const [path, overrides] of Object.entries(ref.descendants)) {
      applyDescendantOverride(cloned as PenNode, path, overrides);
    }
  }

  // 再帰: 展開後のサブツリーにもさらに ref があれば解決する
  const result = cloned as PenNode;
  return resolveNode(result, index);
}

function applyDescendantOverride(
  root: PenNode,
  idPath: string,
  overrides: Record<string, unknown>,
): void {
  // idPath は "/" 区切り: e.g. "childId/grandchildId"
  const parts = idPath.split('/');
  let current: unknown = root;
  for (const part of parts) {
    const children = (current as { children?: PenNode[] }).children;
    if (!children) return;
    const found = children.find((c) => c.id === part);
    if (!found) return;
    current = found;
  }
  // overrides を適用
  if (current && typeof current === 'object') {
    const obj = current as Record<string, unknown>;
    // type が含まれている場合は置き換え(replacement mode)
    if ('type' in overrides) {
      Object.assign(obj, overrides);
    } else {
      // property overrides mode
      for (const [k, v] of Object.entries(overrides)) {
        if (k !== 'id' && k !== 'children') {
          obj[k] = v;
        }
      }
    }
  }
}

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = deepClone(v);
  }
  return out as T;
}
