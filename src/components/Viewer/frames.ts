/**
 * フレーム一覧の収集。PenViewer.tsx から切り出した (#71)。
 *
 * フレームナビゲーション (履歴 / Vim 移動 / Present モード / 検索) は
 * すべてこの FrameEntry の配列を土台にしている。
 */

import type { PenNode } from '../../pen/types';

/** トップレベルの frame / group を絶対座標付きで表したもの */
export interface FrameEntry {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Collect all frame/group nodes with absolute bounds */
export function collectFrames(nodes: PenNode[]): FrameEntry[] {
  const result: FrameEntry[] = [];
  for (const node of nodes) {
    if (node.type === 'frame' || node.type === 'group') {
      const w = typeof node.width === 'number' ? node.width : 0;
      const h = typeof node.height === 'number' ? node.height : 0;
      if (w > 0 && h > 0) {
        result.push({
          id: node.id,
          name: node.name ?? node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          width: w,
          height: h,
        });
      }
    }
  }
  return result;
}
