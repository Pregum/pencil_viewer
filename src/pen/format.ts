/**
 * Pencil の新しいファイル形式のプロパティを、ビューア内部の形式に揃える。
 *
 * Pencil は 2.1x 系でいくつかのプロパティの持ち方を変えた。renderer / editor は
 * 旧形式を前提にしているので、parse 時にここで旧形式へ寄せる。
 *
 * - `type: "icon"` (`icon` / `library`)
 *     → `type: "icon_font"` (`iconFontName` / `iconFontFamily`)
 * - `stroke` が Fill(色文字列 / fill オブジェクト / 配列)で、太さ等が別プロパティ
 *   (`strokeWidth` / `strokeAlignment` / `strokeLinecap` / `strokeLinejoin`)
 *     → `stroke: { fill, thickness, align, cap, join }`
 *
 * ref ノードのルートや `descendants` の上書きは「一部のプロパティだけ」を持つので
 * `mode: 'override'` で変換する。このとき既定値は補わない(上書き先の値を残すため)。
 */

type Obj = Record<string, unknown>;

const NEW_STROKE_KEYS = ['strokeWidth', 'strokeAlignment', 'strokeLinecap', 'strokeLinejoin'] as const;

const ALIGN_MAP: Record<string, string> = {
  inner: 'inside',
  inside: 'inside',
  center: 'center',
  outer: 'outside',
  outside: 'outside',
};

function isPlainObject(v: unknown): v is Obj {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 旧形式の stroke オブジェクト(`{ thickness, fill, align, ... }`)か。
 * fill オブジェクト(`{ type: 'color', ... }`)は `type` を持つので区別できる。
 */
export function isStrokeObject(v: unknown): v is Obj {
  return isPlainObject(v) && !('type' in v);
}

/**
 * 1 ノード(または上書きエントリ)のプロパティを内部形式に変換する。
 * 子ノードの再帰は呼び出し側(parser)が行う。元のオブジェクトは変更しない。
 */
export function normalizeNodeProps(src: Obj, mode: 'node' | 'override'): Obj {
  let out: Obj = src;
  const edit = (): Obj => {
    if (out === src) out = { ...src };
    return out;
  };

  // --- icon → icon_font ---
  const isIcon = src.type === 'icon';
  if (isIcon) edit().type = 'icon_font';
  if (isIcon || mode === 'override') {
    if ('icon' in src) {
      const o = edit();
      o.iconFontName = src.icon;
      delete o.icon;
    }
    if ('library' in src) {
      const o = edit();
      o.iconFontFamily = src.library;
      delete o.library;
    }
  }

  // --- stroke: Fill + strokeWidth 等 → stroke オブジェクト ---
  const strokeIsFill = 'stroke' in src && src.stroke != null && !isStrokeObject(src.stroke);
  const hasNewKeys = NEW_STROKE_KEYS.some((k) => k in src);
  if (strokeIsFill || hasNewKeys) {
    const o = edit();
    const stroke: Obj = isStrokeObject(src.stroke) ? { ...src.stroke } : {};
    if (strokeIsFill) stroke.fill = src.stroke;
    if (src.strokeWidth !== undefined) stroke.thickness = src.strokeWidth;
    if (typeof src.strokeAlignment === 'string') {
      stroke.align = ALIGN_MAP[src.strokeAlignment] ?? src.strokeAlignment;
    }
    if (typeof src.strokeLinecap === 'string') {
      // 内部形式は SVG の 'butt' を 'none' で表す
      stroke.cap = src.strokeLinecap === 'butt' ? 'none' : src.strokeLinecap;
    }
    if (typeof src.strokeLinejoin === 'string') stroke.join = src.strokeLinejoin;
    // 太さが省略された stroke は描かれない(thickness 未指定 = 0 として扱われる)。
    // 例: 下線 2px のアクティブタブと、色だけ残った非アクティブタブ
    if (stroke.align == null && mode === 'node' && strokeIsFill) stroke.align = 'inside';
    for (const k of NEW_STROKE_KEYS) delete o[k];
    o.stroke = stroke;
  }

  return out;
}

/**
 * stroke オブジェクト同士をフィールド単位でマージする(`over` が優先)。
 * 新形式では stroke の色と太さが別プロパティなので、片方だけの上書きで
 * もう片方が消えないようにする。どちらかが stroke オブジェクトでなければ `over` を返す。
 */
export function mergeStroke(base: unknown, over: unknown): unknown {
  if (isStrokeObject(base) && isStrokeObject(over)) return { ...base, ...over };
  return over;
}
