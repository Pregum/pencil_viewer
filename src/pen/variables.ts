/**
 * `.pen` ドキュメント内の `$variable` 参照を実値に置換する。
 *
 * Pencil のスキーマ:
 *   ```
 *   "variables": {
 *     "surface-primary": { "type": "color", "value": "#F5F2E9FF" },
 *     "radius-2xl":      { "type": "number", "value": 16 }
 *   }
 *   ```
 *   ドキュメント内ではこれを `"fill": "$surface-primary"` のように
 *   `$` プレフィックス付き文字列で参照する。
 *
 * 本モジュールは parse と layout の間に挟み、ツリー全体を再帰的に walk して
 * 変数参照を実値に解決する。未定義の変数はそのまま残す(renderer 側で fallback)。
 *
 * 注意:
 *   - `content` フィールドなどにユーザーが書いた文字列が `$foo` の形をしている
 *     場合、意図せず置換される可能性があるが、Pencil 実装に合わせて「`$` +
 *     識別子」パターンは全て変数参照として扱う。マッチしない場合は元の文字列を
 *     返すので、たとえば "$100" や "$ 割引" などは影響を受けない。
 *   - `themes` を持つ variable は MVP では最初の値を採用する
 *     (theme 切替は Phase2 以降)
 */

import type { PenDocument, PenNode } from './types';

type VarType = 'color' | 'number' | 'boolean' | 'string';

interface VariableDef {
  type: VarType;
  value: string | number | boolean;
}

export type VariableMap = Record<string, VariableDef>;

const VAR_REF_RE = /^\$([a-zA-Z_][a-zA-Z0-9_-]*)$/;

/**
 * ドキュメントを深く walk し、すべての `$variable` 参照を実値に置換した新しい
 * ドキュメントを返す(元のオブジェクトは mutate しない)。
 */
export function substituteVariables(doc: PenDocument): PenDocument {
  const vars = parseVariables(doc.variables);
  if (!vars || Object.keys(vars).length === 0) return doc;
  const children = doc.children.map((c) => walk(c, vars) as PenNode);
  return { ...doc, children };
}

/**
 * variable 辞書を narrow した形で取り出す。配列(theme 付き)の場合は先頭を使う。
 * 型が不明または壊れている項目は無視する。
 */
export function parseVariables(raw: unknown): VariableMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: VariableMap = {};
  for (const [name, def] of Object.entries(raw as Record<string, unknown>)) {
    if (!def || typeof def !== 'object') continue;
    const d = def as { type?: unknown; value?: unknown };
    const t = d.type;
    if (t !== 'color' && t !== 'number' && t !== 'boolean' && t !== 'string') continue;

    let value: unknown = d.value;
    // theme 別の配列: [{ value, theme }, ...] → 先頭の value を採用
    if (Array.isArray(value)) {
      const first = value[0];
      if (first && typeof first === 'object' && 'value' in first) {
        value = (first as { value: unknown }).value;
      }
    }

    if (
      (t === 'color' && typeof value === 'string') ||
      (t === 'number' && typeof value === 'number') ||
      (t === 'boolean' && typeof value === 'boolean') ||
      (t === 'string' && typeof value === 'string')
    ) {
      out[name] = { type: t, value: value as string | number | boolean };
    }
  }
  return out;
}

/**
 * 置換対象外の metadata フィールド。これらはノード識別子やフォント名などで、
 * 仮に `$name` の形をしていても変数参照ではなく literal として扱う。
 */
const NON_SUBSTITUTABLE_KEYS = new Set([
  'id',
  'name',
  'type',
  'originalType',
  'fontFamily',
  'iconFontName',
  'iconFontFamily',
]);

/**
 * 深い置換。配列とオブジェクトを再帰的に walk し、文字列がマッチすれば展開する。
 * metadata キーは置換対象から除外する。
 */
function walk(value: unknown, vars: VariableMap): unknown {
  if (typeof value === 'string') {
    const m = VAR_REF_RE.exec(value);
    if (m) {
      const def = vars[m[1]];
      if (def !== undefined) return def.value;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, vars));
  }
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k in src) {
      out[k] = NON_SUBSTITUTABLE_KEYS.has(k) ? src[k] : walk(src[k], vars);
    }
    return out;
  }
  return value;
}
