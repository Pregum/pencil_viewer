/**
 * ツール切替のキーボードショートカットと、アクティブツールに応じたカーソル
 * (.viewer__canvas への data 属性) を管理する小コンポーネント。
 * EditorProvider の配下で動作する。
 *
 * ショートカット:
 *   V = select / R = rectangle / O = ellipse / L = line / T = text / F = frame
 *   Esc = select に戻る（insert mode / 選択解除は EditorContext が処理）
 */

import { useEffect } from 'react';
import { useEditor, type ActiveTool } from '../../pen/state/EditorContext';

const TOOL_KEYS: Record<string, ActiveTool> = {
  v: 'select',
  r: 'rectangle',
  o: 'ellipse',
  l: 'line',
  t: 'text',
  f: 'frame',
  n: 'note',
  p: 'pen',
  c: 'comment',
};

export function ToolShortcuts() {
  const { state, setActiveTool, setGridSnap, applyBooleanOp, flattenSelection, outlineStrokeSelected } = useEditor();

  // boolean op event listener
  useEffect(() => {
    const onBool = (e: Event) => {
      const ce = e as CustomEvent<'union' | 'subtract' | 'intersect' | 'exclude'>;
      if (ce.detail) applyBooleanOp(ce.detail);
    };
    const onFlatten = () => flattenSelection();
    const onOutline = () => outlineStrokeSelected();
    window.addEventListener('pencil-bool-op', onBool as EventListener);
    window.addEventListener('pencil-flatten', onFlatten);
    window.addEventListener('pencil-outline-stroke', onOutline);
    return () => {
      window.removeEventListener('pencil-bool-op', onBool as EventListener);
      window.removeEventListener('pencil-flatten', onFlatten);
      window.removeEventListener('pencil-outline-stroke', onOutline);
    };
  }, [applyBooleanOp, flattenSelection, outlineStrokeSelected]);

  // 修飾キー付きショートカット
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true;
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+' で Grid Snap トグル
      if (mod && !e.altKey && !e.shiftKey && e.key === "'") {
        if (isInput) return;
        e.preventDefault();
        setGridSnap(!state.gridSnap);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.gridSnap, setGridSnap]);

  // ツール切替キー
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // contentEditable (TextEditor) 編集中はショートカットを奪わない
      if (target?.isContentEditable) return;
      if (state.insertMode) return;
      if (state.editingNodeId) return;

      const key = e.key.toLowerCase();
      if (key === 'escape' && state.activeTool !== 'select') {
        e.preventDefault();
        setActiveTool('select');
        return;
      }
      const mapped = TOOL_KEYS[key];
      if (mapped && mapped !== state.activeTool) {
        // 選択中のノードがあるときは h/j/k/l と競合するので、text(t) と frame(f) は常に許可、
        // それ以外のツールキーも選択ノードなし時のみ動作するよう制限しない（Figma も選択中でも効く）
        e.preventDefault();
        setActiveTool(mapped);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.activeTool, state.insertMode, state.editingNodeId, setActiveTool]);

  // .viewer__canvas にカーソル指示を data 属性で反映
  useEffect(() => {
    const el = document.querySelector('.viewer__canvas') as HTMLElement | null;
    if (!el) return;
    el.dataset.tool = state.activeTool;
    return () => {
      el.dataset.tool = 'select';
    };
  }, [state.activeTool]);

  return null;
}
