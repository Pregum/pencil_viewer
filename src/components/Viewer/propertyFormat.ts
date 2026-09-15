/**
 * プロパティパネルの表示用フォーマッタ。
 *
 * コンポーネントと同じファイルに置くと Fast Refresh が効かなくなるので
 * 分けてある (react-refresh/only-export-components, #78)。
 */

export function formatColor(fill: unknown): string | null {
  if (typeof fill === 'string') return fill;
  if (fill && typeof fill === 'object') {
    const f = fill as Record<string, unknown>;
    if (f.type === 'color' && typeof f.color === 'string') return f.color;
    if (f.type === 'gradient') return '(gradient)';
    if (f.type === 'image') return '(image)';
  }
  if (Array.isArray(fill) && fill.length > 0) return formatColor(fill[0]);
  return null;
}
