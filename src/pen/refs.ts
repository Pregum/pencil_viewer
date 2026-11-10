/**
 * `ref` ノード(コンポーネントインスタンス)を、参照先コンポーネントの
 * サブツリーで展開する。
 *
 * パイプライン: parse → resolveRefs → substituteVariables → layout → render
 *
 * 手順:
 * 1. ドキュメント全体(と import したライブラリ)を走査して `reusable: true` の
 *    ノードを ID で索引化
 * 2. ref ノードを見つけたら:
 *    a. 参照先を deep clone
 *    b. ref ノード自身のプロパティ(id/type/ref/descendants 以外)で
 *       ルートを上書き
 *    c. `descendants` マップの各エントリでサブツリー内のノードを上書き
 *    d. 結果のノードで ref を置き換え
 * 3. 未解決の ref(参照先が見つからない)は UnsupportedNode に変換
 *
 * `descendants` のキーはインスタンス内のノード ID。インスタンス内にさらに
 * インスタンスがあるときは `"ok-button/label"` のように `/` で区切る。
 * エントリが `type` を持てばノードの置き換え、持たなければプロパティの上書き。
 */

import { mergeStroke } from './format';
import type { PenDocument, PenNode, UnsupportedNode } from './types';

const REF_SKIP_KEYS = new Set(['id', 'type', 'ref', 'descendants', 'reusable']);

/** 循環参照や異常に深いネストで止まらないための上限 */
const MAX_REF_DEPTH = 32;

type Obj = Record<string, unknown>;
type Overrides = Record<string, Obj>;

export interface ResolveRefsOptions {
  /**
   * ドキュメント外のコンポーネント(import したライブラリ)。
   * ID は `alias:id` の形に名前空間化済みであること。
   */
  components?: PenNode[];
}

export function resolveRefs(doc: PenDocument, options: ResolveRefsOptions = {}): PenDocument {
  // 1. reusable コンポーネントの索引を構築
  const index = new Map<string, PenNode>();
  const indexWalk = (node: PenNode) => {
    if ((node as { reusable?: boolean }).reusable) {
      index.set(node.id, node);
    }
    const children = (node as { children?: PenNode[] }).children;
    if (children) for (const c of children) indexWalk(c);
  };
  for (const c of options.components ?? []) indexWalk(c);
  // ドキュメント側を後に索引化し、同じ ID ならドキュメントを優先する
  for (const c of doc.children) indexWalk(c);

  if (index.size === 0 && !hasRefs(doc.children)) return doc;

  // 2. ref を再帰的に解決
  const children = doc.children.map((c) => resolveNode(c, index, []));
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

function resolveNode(node: PenNode, index: Map<string, PenNode>, stack: string[]): PenNode {
  if (node.type === 'ref') {
    return expandRef(node, index, stack);
  }
  const children = (node as { children?: PenNode[] }).children;
  if (children) {
    const resolved = children.map((c) => resolveNode(c, index, stack));
    return { ...(node as object), children: resolved } as PenNode;
  }
  return node;
}

function expandRef(
  ref: PenNode & { type: 'ref'; ref: string; descendants?: Overrides },
  index: Map<string, PenNode>,
  stack: string[],
): PenNode {
  const target = index.get(ref.ref);
  // 参照先が見つからない / 自分自身を含む循環 → Unsupported で通す
  if (!target || stack.includes(ref.ref) || stack.length >= MAX_REF_DEPTH) {
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
  const cloned = deepClone(target) as Obj;

  // ルートプロパティの上書き(id は ref のものを使う)
  cloned.id = ref.id;
  // インスタンスはコンポーネントではない(ref 自身が reusable のときだけ引き継ぐ)
  if ((ref as { reusable?: boolean }).reusable) cloned.reusable = true;
  else delete cloned.reusable;
  applyProps(cloned, ref as Obj, REF_SKIP_KEYS);

  // descendants の上書き
  if (ref.descendants) {
    if (cloned.type === 'ref') {
      // コンポーネント自体が別コンポーネントのインスタンス: 中身はまだ無いので、
      // 上書きをそのインスタンスの descendants に重ねて展開時に適用する
      const nested = { ...((cloned.descendants as Overrides | undefined) ?? {}) };
      for (const [path, overrides] of Object.entries(ref.descendants)) {
        if (overrides && typeof overrides === 'object') {
          nested[path] = mergeOverrides(nested[path], overrides);
        }
      }
      cloned.descendants = nested;
    } else {
      for (const [path, overrides] of Object.entries(ref.descendants)) {
        if (overrides && typeof overrides === 'object') {
          applyDescendantOverride(cloned, path.split('/'), overrides);
        }
      }
    }
  }

  // 再帰: 展開後のサブツリーにもさらに ref があれば解決する
  return resolveNode(cloned as PenNode, index, [...stack, ref.ref]);
}

/**
 * `scope` の配下(scope 自身は除く)から ID が一致するノードを深さ優先で探す。
 * 未展開の ref の中身はまだ無いので、ref ノードより下へは潜らない。
 */
function findDescendant(scope: Obj, id: string): Obj | undefined {
  const children = scope.children;
  if (!Array.isArray(children)) return undefined;
  for (const c of children as Obj[]) {
    if (!c || typeof c !== 'object') continue;
    if (c.id === id) return c;
    if (c.type === 'ref') continue;
    const found = findDescendant(c, id);
    if (found) return found;
  }
  return undefined;
}

function applyDescendantOverride(root: Obj, parts: string[], overrides: Obj): void {
  let scope = root;
  for (let i = 0; i < parts.length; i++) {
    const found = findDescendant(scope, parts[i]);
    if (!found) return;
    const rest = parts.slice(i + 1);
    if (rest.length > 0 && found.type === 'ref') {
      // ネストしたインスタンスの中身は、そのインスタンスを展開するときに上書きする。
      // 外側からの上書きが内側の descendants より優先される。
      const nested = { ...((found.descendants as Overrides | undefined) ?? {}) };
      const key = rest.join('/');
      nested[key] = mergeOverrides(nested[key], overrides);
      found.descendants = nested;
      return;
    }
    scope = found;
  }
  if (scope === root) return;

  if (typeof overrides.type === 'string') {
    // 置き換え: ノードを丸ごと差し替える(ID が無ければ元の ID を残す)
    const id = scope.id;
    for (const k of Object.keys(scope)) delete scope[k];
    Object.assign(scope, deepClone(overrides));
    if (scope.id == null) scope.id = id;
    return;
  }
  // プロパティの上書き(`children` を含めば中身の差し替え)
  applyProps(scope, overrides, new Set(['id']));
}

function applyProps(target: Obj, props: Obj, skip: Set<string>): void {
  for (const [k, v] of Object.entries(props)) {
    if (skip.has(k) || v === undefined) continue;
    target[k] = k === 'stroke' ? mergeStroke(target.stroke, deepClone(v)) : deepClone(v);
  }
}

/** 同じパスへの上書きを重ねる。`over` が置き換えならそれだけを使う */
function mergeOverrides(base: Obj | undefined, over: Obj): Obj {
  if (!base || typeof over.type === 'string') return over;
  if (typeof base.type === 'string') {
    // 置き換えたノードへのプロパティ上書き
    const merged = { ...base };
    applyProps(merged, over, new Set(['id']));
    return merged;
  }
  const merged: Obj = { ...base, ...over };
  if ('stroke' in base && 'stroke' in over) merged.stroke = mergeStroke(base.stroke, over.stroke);
  return merged;
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
