/**
 * 画像ファイルの ペースト (Cmd+V) / ドラッグ&ドロップ を監視して
 * image ノードをキャンバスに追加する。
 *
 * - data URL (base64) で保持。外部サーバーなし、.pen にそのまま書き出される。
 * - 画像の natural size を取得して width/height に設定
 * - 配置位置:
 *   - ドロップ: ドロップ座標 (SVG 変換後)
 *   - ペースト: 現在のビューポート中心
 */

import { useEffect } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 現在のビューポート中心 (SVG coord) */
  viewCenter: { x: number; y: number };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function ImageDropHandler({ svgRef, containerRef, viewCenter }: Props) {
  const { addNode } = useEditor();

  // ドラッグ&ドロップ
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (Array.from(e.dataTransfer.items).some((it) => it.kind === 'file')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) return;
      e.preventDefault();

      // ドロップ位置を SVG 座標に変換
      const svg = svgRef.current;
      let cx = viewCenter.x;
      let cy = viewCenter.y;
      if (svg) {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          cx = (e.clientX - ctm.e) / ctm.a;
          cy = (e.clientY - ctm.f) / ctm.d;
        }
      }

      // 各画像を読み込んで追加。水平方向に少しずつずらす。
      let offsetX = 0;
      for (const file of files) {
        try {
          const dataUrl = await readFileAsDataURL(file);
          const size = await loadImageSize(dataUrl);
          // 大きすぎる画像は max 800px に収める
          const MAX = 800;
          const scale = Math.min(1, MAX / Math.max(size.w, size.h));
          const w = Math.round(size.w * scale);
          const h = Math.round(size.h * scale);
          const node = {
            type: 'image' as const,
            id: `image_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: file.name,
            x: Math.round(cx - w / 2 + offsetX),
            y: Math.round(cy - h / 2),
            width: w,
            height: h,
            url: dataUrl,
          } as PenNode;
          addNode(node);
          offsetX += w + 16;
        } catch (err) {
          console.warn('Failed to load image', file.name, err);
        }
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
  }, [containerRef, svgRef, viewCenter.x, viewCenter.y, addNode]);

  // クリップボードから貼り付け
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      // 入力フィールド / contentEditable では通常のペースト挙動に任せる
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.isContentEditable) return;

      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter((it) => it.kind === 'file' && it.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      e.preventDefault();

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;
        try {
          const dataUrl = await readFileAsDataURL(file);
          const size = await loadImageSize(dataUrl);
          const MAX = 800;
          const scale = Math.min(1, MAX / Math.max(size.w, size.h));
          const w = Math.round(size.w * scale);
          const h = Math.round(size.h * scale);
          const node = {
            type: 'image' as const,
            id: `image_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: file.name || 'Pasted image',
            x: Math.round(viewCenter.x - w / 2),
            y: Math.round(viewCenter.y - h / 2),
            width: w,
            height: h,
            url: dataUrl,
          } as PenNode;
          addNode(node);
        } catch (err) {
          console.warn('Failed to paste image', err);
        }
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [viewCenter.x, viewCenter.y, addNode]);

  return null;
}
