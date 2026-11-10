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
 *   `$` プレフィックス付き文字列で参照する。import したライブラリの変数は
 *   `"$ui:color-primary"` のように `エイリアス:名前` で参照する。
 *
 * テーマ:
 *   - `themes` は軸ごとの値の一覧で、各軸の既定値は先頭の値
 *   - 変数の値は `[{ value, theme }, ...]` の配列を取れて、テーマ条件を満たす
 *     **最後の** エントリが勝つ(`theme` の無いエントリは常に満たす)
 *   - ノードの `theme` はそのノードと配下すべてに効く
 *
 * 本モジュールは parse と layout の間に挟み、ツリー全体を再帰的に walk して
 * 変数参照を実値に解決する。未定義の変数はそのまま残す(renderer 側で fallback)。
 *
 * 注意:
 *   - `content` フィールドなどにユーザーが書いた文字列が `$foo` の形をしている
 *     場合、意図せず置換される可能性があるが、Pencil 実装に合わせて「`$` +
 *     識別子」パターンは全て変数参照として扱う。マッチしない場合は元の文字列を
 *     返すので、たとえば "$100" や "$ 割引" などは影響を受けない。
 */

import type { PenDocument, PenNode } from './types';

type VarType = 'color' | 'number' | 'boolean' | 'string';

interface VariableDef {
  type: VarType;
  value: string | number | boolean;
}

export type VariableMap = Record<string, VariableDef>;

// 先頭の `-` は Pencil のデザインキットが生成する `$--background` 形式のため許可する。
// `エイリアス:` は import したライブラリの変数(`$ui:--background`)。
// 未定義の名前は置換されないので、`$-100` のような文字列はそのまま残る。
const VAR_REF_RE = /^\$((?:[a-zA-Z_][a-zA-Z0-9_-]*:)?[a-zA-Z_-][a-zA-Z0-9_-]*)$/;

/** 変数の値が別の変数を参照するときの最大の深さ(循環参照の保険) */
const MAX_ALIAS_DEPTH = 8;

/**
 * ドキュメントのテーマ軸定義を抽出する。
 * 例: { "mode": ["light", "dark"], "device": ["phone", "tablet"] }
 */
export type ThemeAxes = Record<string, string[]>;
export type SelectedTheme = Record<string, string>;

export function extractThemeAxes(doc: PenDocument): ThemeAxes | null {
  return toThemeAxes(doc.themes);
}

function toThemeAxes(themes: unknown): ThemeAxes | null {
  if (!themes || typeof themes !== 'object') return null;
  const axes: ThemeAxes = {};
  for (const [axis, values] of Object.entries(themes as Record<string, unknown>)) {
    if (Array.isArray(values) && values.every((v) => typeof v === 'string')) {
      axes[axis] = values as string[];
    }
  }
  return Object.keys(axes).length > 0 ? axes : null;
}

/** import したライブラリから持ち込む変数とテーマ軸(名前は `エイリアス:` 付き) */
export interface ExternalVariables {
  variables?: Record<string, unknown>;
  themes?: ThemeAxes;
}

/**
 * ドキュメントを深く walk し、すべての `$variable` 参照を実値に置換した新しい
 * ドキュメントを返す(元のオブジェクトは mutate しない)。
 *
 * @param selectedTheme テーマ軸の選択値(例: { mode: 'dark' })。
 *   未指定の軸は `themes` の先頭値を使う。
 * @param external import したライブラリの変数とテーマ軸
 */
export function substituteVariables(
  doc: PenDocument,
  selectedTheme?: SelectedTheme,
  external?: ExternalVariables,
): PenDocument {
  const rawVars: Record<string, unknown> = {
    ...(external?.variables ?? {}),
    ...(isObject(doc.variables) ? doc.variables : {}),
  };
  if (Object.keys(rawVars).length === 0) return doc;

  const defaults: SelectedTheme = {};
  for (const axes of [external?.themes ?? null, extractThemeAxes(doc)]) {
    if (!axes) continue;
    for (const [axis, values] of Object.entries(axes)) {
      if (values.length > 0) defaults[axis] = values[0];
    }
  }
  const resolver = new VariableResolver(rawVars);
  const children = doc.children.map(
    (c) => walk(c, resolver, { ...defaults, ...(selectedTheme ?? {}) }) as PenNode,
  );
  return { ...doc, children };
}

/**
 * variable 辞書を narrow した形で取り出す。テーマ付きの値は `selectedTheme` で
 * 選び、条件を満たすものが無ければ先頭を使う。型が不明または壊れている項目は無視する。
 */
export function parseVariables(
  raw: unknown,
  selectedTheme?: SelectedTheme,
): VariableMap | null {
  if (!isObject(raw)) return null;
  const resolver = new VariableResolver(raw);
  const out: VariableMap = {};
  for (const name of Object.keys(raw)) {
    const def = resolver.resolve(name, selectedTheme ?? {});
    if (def) out[name] = def;
  }
  return out;
}

/** 変数名 + テーマ文脈 → 値。テーマ文脈ごとに結果をキャッシュする */
class VariableResolver {
  private cache = new Map<string, Map<string, VariableDef | null>>();

  constructor(private readonly raw: Record<string, unknown>) {}

  resolve(name: string, theme: SelectedTheme, depth = 0): VariableDef | undefined {
    const key = themeKey(theme);
    let perTheme = this.cache.get(key);
    if (!perTheme) {
      perTheme = new Map();
      this.cache.set(key, perTheme);
    }
    if (perTheme.has(name)) return perTheme.get(name) ?? undefined;
    const def = this.compute(name, theme, depth);
    perTheme.set(name, def ?? null);
    return def;
  }

  private compute(name: string, theme: SelectedTheme, depth: number): VariableDef | undefined {
    const def = this.raw[name];
    if (!isObject(def)) return undefined;
    const t = def.type;
    if (t !== 'color' && t !== 'number' && t !== 'boolean' && t !== 'string') return undefined;

    let value: unknown = Array.isArray(def.value) ? pickThemedValue(def.value, theme) : def.value;

    // 値が別の変数を参照している(`"value": "$--primary"`)
    if (typeof value === 'string' && depth < MAX_ALIAS_DEPTH) {
      const m = VAR_REF_RE.exec(value);
      if (m && m[1] !== name) {
        const aliased = this.resolve(m[1], theme, depth + 1);
        if (aliased) value = aliased.value;
      }
    }

    if (
      (t === 'color' && typeof value === 'string') ||
      (t === 'number' && typeof value === 'number') ||
      (t === 'boolean' && typeof value === 'boolean') ||
      (t === 'string' && typeof value === 'string')
    ) {
      return { type: t, value: value as string | number | boolean };
    }
    return undefined;
  }
}

function themeKey(theme: SelectedTheme): string {
  return Object.keys(theme)
    .sort()
    .map((k) => `${k}=${theme[k]}`)
    .join('\u0000');
}

/**
 * themed 配列から、テーマ条件を満たす最後のエントリの value を選ぶ。
 * 1 つも満たさない場合は先頭の value を返す。
 */
function pickThemedValue(arr: unknown[], theme: SelectedTheme): unknown {
  let picked: { value: unknown } | undefined;
  for (const entry of arr) {
    if (!isObject(entry) || !('value' in entry)) continue;
    const cond = entry.theme;
    const satisfied =
      !isObject(cond) || Object.entries(cond).every(([axis, val]) => theme[axis] === val);
    if (satisfied) picked = entry as { value: unknown };
  }
  if (picked) return picked.value;
  const first = arr[0];
  return isObject(first) && 'value' in first ? first.value : undefined;
}

/**
 * 置換対象外の metadata フィールド。これらはノード識別子などで、
 * 仮に `$name` の形をしていても変数参照ではなく literal として扱う。
 */
const NON_SUBSTITUTABLE_KEYS = new Set([
  'id',
  'name',
  'type',
  'originalType',
  'iconFontName',
  'theme',
]);

/**
 * フォント名のフィールド。`$--font-primary` のように string 型の変数は参照するが、
 * 色など他の型の変数と名前が一致しただけのものは literal として残す。
 */
const FONT_KEYS = new Set(['fontFamily', 'iconFontFamily']);

function lookupVariable(
  value: string,
  resolver: VariableResolver,
  theme: SelectedTheme,
): VariableDef | undefined {
  const m = VAR_REF_RE.exec(value);
  return m ? resolver.resolve(m[1], theme) : undefined;
}

/**
 * 深い置換。配列とオブジェクトを再帰的に walk し、文字列がマッチすれば展開する。
 * metadata キーは置換対象から除外する。ノードが `theme` を持てば、
 * そのノードと配下はそのテーマで解決する。
 */
function walk(value: unknown, resolver: VariableResolver, theme: SelectedTheme): unknown {
  if (typeof value === 'string') {
    const def = lookupVariable(value, resolver, theme);
    return def !== undefined ? def.value : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, resolver, theme));
  }
  if (isObject(value)) {
    const src = value;
    let ctx = theme;
    if (typeof src.type === 'string' && isObject(src.theme)) {
      ctx = { ...theme };
      for (const [axis, val] of Object.entries(src.theme)) {
        if (typeof val === 'string') ctx[axis] = val;
      }
    }
    const out: Record<string, unknown> = {};
    for (const k in src) {
      if (NON_SUBSTITUTABLE_KEYS.has(k)) out[k] = src[k];
      else if (FONT_KEYS.has(k)) {
        const v = src[k];
        if (typeof v === 'string') {
          const def = lookupVariable(v, resolver, ctx);
          out[k] = def?.type === 'string' ? def.value : v;
        } else {
          out[k] = v;
        }
      } else out[k] = walk(src[k], resolver, ctx);
    }
    return out;
  }
  return value;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}
