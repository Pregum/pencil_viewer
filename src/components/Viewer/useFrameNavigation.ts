/**
 * フレーム単位のナビゲーション。PenViewer.tsx から切り出した (#71)。
 *
 * usePanZoom が「カメラをどこに置くか」だけを扱うのに対し、ここは
 * その上に載る「どのフレームを見ているか」を扱う。
 *
 * - activeFrameId: ハイライト中のフレーム
 * - 履歴 (Cmd+[ / Cmd+]): フレームへジャンプするたびにカメラと activeFrameId を積む
 * - Vim 移動 ([count]h/j/k/l): x / y でソートした隣のフレームへ、前後 3 フレームが
 *   収まる少し引いたビューで移動する
 */

import { useCallback, useState } from 'react';
import type { ViewBox } from '../../pen/renderer/viewBox';
import type { Camera } from './usePanZoom';
import type { FrameEntry } from './frames';

interface HistoryEntry {
  camera: Camera;
  activeFrameId: string | null;
}

export type VimDirection = 'h' | 'j' | 'k' | 'l';

export interface FrameNavigationDeps {
  frames: FrameEntry[];
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
  zoomToRect: (rect: ViewBox) => void;
  fitToDocument: () => void;
}

export interface FrameNavigation {
  activeFrameId: string | null;
  setActiveFrameId: (id: string | null) => void;
  /** Back ボタンの disabled 判定用 */
  canGoBack: boolean;
  /** Forward ボタンの disabled 判定用 */
  canGoForward: boolean;
  navigateBack: () => void;
  navigateForward: () => void;
  /** フレームへズームし、履歴に積む */
  zoomToFrame: (frame: FrameEntry) => void;
  /** 「全体を表示」: カメラを doc 全体に合わせ、フレームの選択も外す */
  resetView: () => void;
  /** Vim 風の隣フレーム移動 */
  navigateVim: (direction: VimDirection, count: number) => void;
}

export function useFrameNavigation({
  frames,
  camera,
  setCamera,
  zoomToRect,
  fitToDocument,
}: FrameNavigationDeps): FrameNavigation {
  // Active frame highlight
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);

  // Navigation history
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Push current state to history
  const pushHistory = useCallback(
    (frameId: string | null) => {
      const entry: HistoryEntry = { camera: { ...camera }, activeFrameId: frameId };
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), entry]);
      setHistoryIndex((prev) => prev + 1);
    },
    [camera, historyIndex],
  );

  const applyHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      setCamera(entry.camera);
      setActiveFrameId(entry.activeFrameId);
    },
    [setCamera],
  );

  const navigateBack = useCallback(() => {
    if (historyIndex <= 0) return;
    if (historyIndex === history.length - 1) {
      setHistory((prev) => [...prev, { camera: { ...camera }, activeFrameId }]);
    }
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    applyHistoryEntry(history[newIdx]);
  }, [historyIndex, history, camera, activeFrameId, applyHistoryEntry]);

  const navigateForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    applyHistoryEntry(history[newIdx]);
  }, [historyIndex, history, applyHistoryEntry]);

  // Zoom to a specific frame
  const zoomToFrame = useCallback(
    (frame: FrameEntry) => {
      pushHistory(frame.id);
      setActiveFrameId(frame.id);
      zoomToRect(frame);
    },
    [pushHistory, zoomToRect],
  );

  const resetView = useCallback(() => {
    fitToDocument();
    setActiveFrameId(null);
  }, [fitToDocument]);

  // Vim-like frame navigation: [count]h/j/k/l
  const navigateVim = useCallback(
    (direction: VimDirection, count: number) => {
      if (frames.length === 0) return;

      const sortedByX = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
      const sortedByY = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);

      const currentId = activeFrameId;
      let sorted: FrameEntry[];
      let step: number;

      switch (direction) {
        case 'l':
          sorted = sortedByX;
          step = count;
          break;
        case 'h':
          sorted = sortedByX;
          step = -count;
          break;
        case 'j':
          sorted = sortedByY;
          step = count;
          break;
        case 'k':
          sorted = sortedByY;
          step = -count;
          break;
      }

      const currentIdx = currentId ? sorted.findIndex((f) => f.id === currentId) : -1;
      const startIdx = currentIdx >= 0 ? currentIdx : step > 0 ? -1 : sorted.length;
      const targetIdx = Math.max(0, Math.min(sorted.length - 1, startIdx + step));
      const target = sorted[targetIdx];
      if (!target) return;

      // 少し引いたビュー: ターゲットの前後3フレーム分のバウンディングボックスを表示
      const contextRange = 3;
      const lo = Math.max(0, targetIdx - contextRange);
      const hi = Math.min(sorted.length - 1, targetIdx + contextRange);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (let i = lo; i <= hi; i++) {
        const f = sorted[i];
        minX = Math.min(minX, f.x);
        minY = Math.min(minY, f.y);
        maxX = Math.max(maxX, f.x + f.width);
        maxY = Math.max(maxY, f.y + f.height);
      }
      const pad = 60;
      pushHistory(target.id);
      setActiveFrameId(target.id);
      zoomToRect({
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      });
    },
    [frames, activeFrameId, pushHistory, zoomToRect],
  );

  return {
    activeFrameId,
    setActiveFrameId,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    navigateBack,
    navigateForward,
    zoomToFrame,
    resetView,
    navigateVim,
  };
}
