/**
 * `imports` で読み込むライブラリ(別の .pen)を解決する。
 *
 * ```json
 * "imports": { "ui": "pencil:shadcn.lib.pen" }
 * ```
 * のように宣言すると、ドキュメントからはライブラリのコンポーネントを
 * `"ref": "ui:button"`、変数を `"$ui:--background"`、テーマ軸を
 * `{ "ui:Mode": "Dark" }` のように `エイリアス:` 付きで参照する。
 *
 * ライブラリの中身はライブラリ内の名前(`button`, `$--background`)で書かれて
 * いるので、ここで ID・参照・変数・テーマ軸のすべてに `エイリアス:` を付けて
 * ドキュメント側の名前に揃える。
 */

import { parsePen } from './parser';
import type { PenDocument, PenNode } from './types';
import type { ExternalVariables, ThemeAxes } from './variables';

type Obj = Record<string, unknown>;

/** ライブラリ内の変数参照(`$--background`)。別ライブラリ参照(`$x:y`)は対象外 */
const LOCAL_VAR_REF_RE = /^\$[a-zA-Z_-][a-zA-Z0-9_-]*$/;

/** 解決済みのライブラリ群。resolveRefs と substituteVariables にそのまま渡せる */
export interface ImportedLibraries extends ExternalVariables {
  components: PenNode[];
  variables: Record<string, unknown>;
  themes: ThemeAxes;
}

export const EMPTY_LIBRARIES: ImportedLibraries = { components: [], variables: {}, themes: {} };

/** ライブラリ URI → .pen のテキスト。読めなければ null */
export type LibraryReader = (uri: string) => Promise<string | null>;

/** ドキュメントの `imports`(エイリアス → URI)を取り出す */
export function getImports(doc: PenDocument): Record<string, string> {
  const raw = doc.imports;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [alias, uri] of Object.entries(raw as Obj)) {
    if (typeof uri === 'string' && alias && !alias.includes(':')) out[alias] = uri;
  }
  return out;
}

/**
 * ドキュメントが import しているライブラリを読み込み、名前空間を付けて返す。
 * 読めないライブラリは飛ばす(その参照は未解決のまま描画される)。
 */
export async function loadImports(
  doc: PenDocument,
  read: LibraryReader,
): Promise<ImportedLibraries> {
  const entries = Object.entries(getImports(doc));
  if (entries.length === 0) return EMPTY_LIBRARIES;
  const libs = await Promise.all(
    entries.map(async ([alias, uri]) => {
      try {
        const text = await read(uri);
        if (text == null) return null;
        const parsed = parsePen(JSON.parse(text));
        return parsed.ok ? namespaceLibrary(parsed.doc, alias) : null;
      } catch {
        return null;
      }
    }),
  );
  return mergeLibraries(libs.filter((l): l is ImportedLibraries => l != null));
}

export function mergeLibraries(libs: ImportedLibraries[]): ImportedLibraries {
  if (libs.length === 0) return EMPTY_LIBRARIES;
  return {
    components: libs.flatMap((l) => l.components),
    variables: Object.assign({}, ...libs.map((l) => l.variables)),
    themes: Object.assign({}, ...libs.map((l) => l.themes)),
  };
}

/** ライブラリの ID・参照・変数・テーマ軸に `alias:` を付ける */
export function namespaceLibrary(lib: PenDocument, alias: string): ImportedLibraries {
  const ns = (name: string) => (name.includes(':') ? name : `${alias}:${name}`);

  const nsValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return LOCAL_VAR_REF_RE.test(value) ? `$${ns(value.slice(1))}` : value;
    }
    if (Array.isArray(value)) return value.map(nsValue);
    if (value && typeof value === 'object') {
      const out: Obj = {};
      for (const [k, v] of Object.entries(value as Obj)) {
        if ((k === 'id' || k === 'ref') && typeof v === 'string') out[k] = ns(v);
        else if (k === 'descendants' && v && typeof v === 'object') {
          const d: Obj = {};
          for (const [path, entry] of Object.entries(v as Obj)) {
            d[path.split('/').map(ns).join('/')] = nsValue(entry);
          }
          out[k] = d;
        } else if (k === 'theme' && v && typeof v === 'object' && !Array.isArray(v)) {
          out[k] = Object.fromEntries(Object.entries(v as Obj).map(([axis, val]) => [ns(axis), val]));
        } else if (k === 'name') {
          // レイヤー名は変数参照ではない
          out[k] = v;
        } else {
          out[k] = nsValue(v);
        }
      }
      return out;
    }
    return value;
  };

  const variables: Record<string, unknown> = {};
  if (lib.variables && typeof lib.variables === 'object') {
    for (const [name, def] of Object.entries(lib.variables as Obj)) {
      variables[ns(name)] = nsValue(def);
    }
  }
  const themes: ThemeAxes = {};
  if (lib.themes && typeof lib.themes === 'object') {
    for (const [axis, values] of Object.entries(lib.themes as Obj)) {
      if (Array.isArray(values)) themes[ns(axis)] = values.filter((v) => typeof v === 'string');
    }
  }
  return {
    components: lib.children.map((c) => nsValue(c) as PenNode),
    variables,
    themes,
  };
}
