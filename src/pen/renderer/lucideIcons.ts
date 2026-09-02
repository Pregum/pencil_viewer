/**
 * lucide アイコンセットの遅延ロード。
 *
 * lucide は 1500 個超のアイコンを 1 パッケージに持ち、ビルドすると
 * 単独で約 400KB (gzip 89KB) になる。.pen ファイルの iconFontName は
 * 任意の名前を取りうるため名前列挙による tree-shaking ができない。
 * そこで初期バンドルからは外し、lucide アイコンを実際に描画する
 * ときだけ動的 import で取り込む。
 *
 * React からは useSyncExternalStore で購読する。ロード完了時に
 * 購読者へ通知して再描画させる。
 */

/** lucide の IconNode 配列 (tag と属性の組) */
export type LucideIconData = [string, Record<string, string>][];
type IconSet = Record<string, LucideIconData>;

let icons: IconSet | null = null;
let loadPromise: Promise<void> | null = null;
const subscribers = new Set<() => void>();

/** ロード済みアイコンセット。未ロードなら null */
export function getLucideIcons(): IconSet | null {
  return icons;
}

/** ロードを開始する (多重呼び出しは 1 回にまとまる) */
export function ensureLucideLoaded(): Promise<void> {
  if (icons) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = import('lucide')
    .then((mod) => {
      icons = mod.icons as unknown as IconSet;
      subscribers.forEach((fn) => fn());
    })
    .catch(() => {
      // 取得に失敗してもアプリは動かす (プレースホルダのまま)
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

/** useSyncExternalStore 用の購読 */
export function subscribeLucide(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

/** kebab-case / snake_case → PascalCase (lucide のエクスポート名) */
export function toPascalCase(name: string): string {
  return name.replace(/(^|[-_ ])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
}

/** ロード済みならアイコンデータを返す。未ロード / 未知の名前なら null */
export function lookupLucideIcon(name: string): LucideIconData | null {
  if (!icons) return null;
  return icons[toPascalCase(name)] ?? null;
}

/** テスト用: モジュール状態をリセットする */
export function __resetLucideForTest(next: IconSet | null = null): void {
  icons = next;
  loadPromise = null;
  subscribers.clear();
}
