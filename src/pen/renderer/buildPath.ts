/**
 * ペンツール用: アンカー配列から SVG path d 文字列を組み立てる純関数。
 *
 * アンカー (PathAnchor):
 *   - position: {x, y} — 絶対座標（path ノードのローカル座標系）
 *   - inHandle / outHandle: あれば 3 次 bezier の制御点（絶対座標）
 *
 * セグメントの選択:
 *   - 前のアンカーの outHandle か 現アンカーの inHandle のどちらかが存在すれば
 *     3 次 bezier (C x1 y1 x2 y2 x y) を出す
 *   - どちらも無ければ直線 (L x y)
 *
 * closed = true のとき末尾に Z を付ける。最終アンカー → 最初のアンカーの
 * クロージング曲線も、先頭 inHandle / 末尾 outHandle を使って描く。
 */

export interface PathAnchor {
  position: { x: number; y: number };
  /** このアンカーへ入る側の bezier 制御点（絶対座標） */
  inHandle?: { x: number; y: number };
  /** このアンカーから出る側の bezier 制御点（絶対座標） */
  outHandle?: { x: number; y: number };
}

export function buildPathD(anchors: PathAnchor[], closed = false): string {
  if (anchors.length === 0) return '';
  const first = anchors[0];
  const parts: string[] = [`M ${fmt(first.position.x)} ${fmt(first.position.y)}`];

  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const cur = anchors[i];
    parts.push(segment(prev, cur));
  }

  if (closed && anchors.length >= 2) {
    const last = anchors[anchors.length - 1];
    // 両端のどちらかに bezier ハンドルがあれば明示的な closing bezier が必要。
    // 両端コーナー同士なら Z が自動で直線クロージングするため冗長セグメント不要。
    if (last.outHandle || first.inHandle) {
      parts.push(segment(last, first));
    }
    parts.push('Z');
  }
  return parts.join(' ');
}

function segment(from: PathAnchor, to: PathAnchor): string {
  if (from.outHandle || to.inHandle) {
    const c1 = from.outHandle ?? from.position;
    const c2 = to.inHandle ?? to.position;
    return `C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(to.position.x)} ${fmt(to.position.y)}`;
  }
  return `L ${fmt(to.position.x)} ${fmt(to.position.y)}`;
}

function fmt(n: number): string {
  // 小数点 2 桁まで、余計な 0 を削る
  return Number(n.toFixed(2)).toString();
}

/**
 * SVG path d 文字列を PathAnchor 配列にパースする（逆変換）。
 *
 * 対応コマンド: M, L, C, Z (buildPathD が出力するもの)。
 * H / V / S / Q / T / A は未対応 — 非対応コマンドに遭遇すると null を返す。
 *
 * closed は末尾が Z で閉じられているか。
 */
export interface ParsedPath {
  anchors: PathAnchor[];
  closed: boolean;
}

export function parsePathD(d: string): ParsedPath | null {
  if (!d || typeof d !== 'string') return null;
  // 数値と 1 文字コマンドを順に読み取る
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/gi);
  if (!tokens) return null;

  const anchors: PathAnchor[] = [];
  let closed = false;
  let i = 0;

  const readNum = (): number | null => {
    const t = tokens[i++];
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  };

  while (i < tokens.length) {
    const cmd = tokens[i++].toUpperCase();
    if (cmd === 'M' || cmd === 'L') {
      const x = readNum(); const y = readNum();
      if (x == null || y == null) return null;
      anchors.push({ position: { x, y } });
    } else if (cmd === 'C') {
      const x1 = readNum(); const y1 = readNum();
      const x2 = readNum(); const y2 = readNum();
      const x = readNum(); const y = readNum();
      if ([x1, y1, x2, y2, x, y].some((v) => v == null)) return null;
      // 前アンカーに outHandle (x1,y1)、新アンカーに position (x,y) と inHandle (x2,y2)
      const prev = anchors[anchors.length - 1];
      if (prev) prev.outHandle = { x: x1!, y: y1! };
      anchors.push({ position: { x: x!, y: y! }, inHandle: { x: x2!, y: y2! } });
    } else if (cmd === 'Z') {
      closed = true;
    } else {
      // 未対応コマンド (H/V/S/Q/T/A 等)
      return null;
    }
  }

  if (anchors.length === 0) return null;
  return { anchors, closed };
}

/** アンカー配列全体の軸並行バウンディングボックスを計算 */
export function anchorsBBox(
  anchors: PathAnchor[],
): { x: number; y: number; width: number; height: number } {
  if (anchors.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const include = (p: { x: number; y: number }) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const a of anchors) {
    include(a.position);
    if (a.inHandle) include(a.inHandle);
    if (a.outHandle) include(a.outHandle);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}
