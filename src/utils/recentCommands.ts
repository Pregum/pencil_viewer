/**
 * コマンドパレットで直近使ったコマンドを localStorage に保存し、
 * クエリ未入力時に上位表示するための小ユーティリティ。
 *
 * reorderWithRecent は pure function。UI/ストレージに依存しないのでテスト可。
 */

const STORAGE_KEY = 'pencilViewer.recentCommands';
const MAX_RECENT = 8;

export function loadRecent(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function saveRecent(ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // quota exceeded など。履歴なしで動作継続。
  }
}

export function pushRecent(existing: string[], id: string): string[] {
  const without = existing.filter((x) => x !== id);
  return [id, ...without].slice(0, MAX_RECENT);
}

export function reorderWithRecent<T extends { id: string }>(
  items: T[],
  recentIds: string[],
): T[] {
  if (recentIds.length === 0) return items;
  const byId = new Map(items.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const head: T[] = [];
  for (const id of recentIds) {
    const c = byId.get(id);
    if (c && !seen.has(id)) {
      head.push(c);
      seen.add(id);
    }
  }
  const tail = items.filter((c) => !seen.has(c.id));
  return [...head, ...tail];
}
