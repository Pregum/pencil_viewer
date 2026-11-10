/**
 * Pencil アプリに同梱されているライブラリ(`pencil:xxx.lib.pen`)の読み込み。
 *
 * Pencil のデザインキットから作ったファイルは
 * `"imports": { "j": "pencil:shadcn.lib.pen" }` のように内蔵ライブラリを参照する。
 * その中身はアプリ側にしか無いので、ビューアにも同じものを
 * `public/libraries/pencil/` に置き、import されたときだけ取得する。
 */

import type { LibraryReader } from './imports';

/** 同梱している内蔵ライブラリ */
const BUILTIN_LIBRARIES = new Set(['shadcn.lib.pen']);

/** `pencil:shadcn.lib.pen` → 同梱ファイルの URL。同梱していなければ null */
export function builtinLibraryUrl(uri: string, baseUrl: string): string | null {
  const m = /^pencil:([a-z0-9-]+\.lib\.pen)$/.exec(uri);
  if (!m || !BUILTIN_LIBRARIES.has(m[1])) return null;
  return `${baseUrl}libraries/pencil/${m[1]}`;
}

const cache = new Map<string, Promise<string | null>>();

export const readBuiltinLibrary: LibraryReader = (uri) => {
  const url = builtinLibraryUrl(uri, import.meta.env.BASE_URL);
  if (!url) return Promise.resolve(null);
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null);
    // 失敗はキャッシュしない(オフラインから復帰したときに読み直せるように)
    void pending.then((text) => {
      if (text == null) cache.delete(url);
    });
    cache.set(url, pending);
  }
  return pending;
};
