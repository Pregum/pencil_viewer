/**
 * Tidy Up: 選択ノードを等間隔の row / column / grid に整列する pure 関数。
 *
 * Figma の Tidy Up に相当。現在の配置の広がり(bbox)から向きを auto 判定する。
 * UI や React 状態には依存しないのでテスト可能。
 */

export interface TidyItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TidyMode = 'auto' | 'row' | 'column' | 'grid';

export interface TidyOptions {
  mode?: TidyMode;
  gap?: number;
}

export interface TidyResult {
  id: string;
  x: number;
  y: number;
}

export function detectTidyMode(items: TidyItem[]): Exclude<TidyMode, 'auto'> {
  if (items.length < 2) return 'row';
  const minX = Math.min(...items.map((i) => i.x));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const minY = Math.min(...items.map((i) => i.y));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  const dx = maxX - minX;
  const dy = maxY - minY;
  if (dx > 2.5 * dy) return 'row';
  if (dy > 2.5 * dx) return 'column';
  return 'grid';
}

export function tidyUp(items: TidyItem[], opts: TidyOptions = {}): TidyResult[] {
  if (items.length < 2) return items.map(({ id, x, y }) => ({ id, x, y }));
  const gap = opts.gap ?? 16;
  const mode = opts.mode && opts.mode !== 'auto' ? opts.mode : detectTidyMode(items);

  if (mode === 'row') {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const alignY = Math.min(...items.map((i) => i.y));
    let cursorX = sorted[0].x;
    return sorted.map((it) => {
      const pos = { id: it.id, x: cursorX, y: alignY };
      cursorX += it.width + gap;
      return pos;
    });
  }

  if (mode === 'column') {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    const alignX = Math.min(...items.map((i) => i.x));
    let cursorY = sorted[0].y;
    return sorted.map((it) => {
      const pos = { id: it.id, x: alignX, y: cursorY };
      cursorY += it.height + gap;
      return pos;
    });
  }

  // grid
  const cols = Math.max(1, Math.round(Math.sqrt(items.length)));
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const cellW = Math.max(...items.map((i) => i.width));
  const cellH = Math.max(...items.map((i) => i.height));
  const originX = Math.min(...items.map((i) => i.x));
  const originY = Math.min(...items.map((i) => i.y));
  return sorted.map((it, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return {
      id: it.id,
      x: originX + c * (cellW + gap),
      y: originY + r * (cellH + gap),
    };
  });
}
