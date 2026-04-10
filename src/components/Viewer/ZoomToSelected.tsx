/**
 * 選択ノードにカメラをズームするブリッジコンポーネント。
 * 'f' キーで `pencil-zoom-to-selected` カスタムイベントを受け取り、
 * 選択ノードの座標でコールバックを呼ぶ。
 */

import { useEffect } from 'react';
import { useEditor } from '../../pen/state/EditorContext';

interface Props {
  onZoomTo: (target: { x: number; y: number; width: number; height: number }) => void;
}

export function ZoomToSelected({ onZoomTo }: Props) {
  const { selectedNode } = useEditor();

  useEffect(() => {
    const handler = () => {
      if (!selectedNode) return;
      const x = selectedNode.x ?? 0;
      const y = selectedNode.y ?? 0;
      const w = typeof (selectedNode as { width?: unknown }).width === 'number'
        ? (selectedNode as { width: number }).width : 0;
      const h = typeof (selectedNode as { height?: unknown }).height === 'number'
        ? (selectedNode as { height: number }).height : 0;
      if (w > 0 && h > 0) {
        onZoomTo({ x, y, width: w, height: h });
      }
    };
    window.addEventListener('pencil-zoom-to-selected', handler);
    return () => window.removeEventListener('pencil-zoom-to-selected', handler);
  }, [selectedNode, onZoomTo]);

  return null;
}
