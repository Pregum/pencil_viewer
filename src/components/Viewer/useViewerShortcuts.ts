/**
 * ビューア全体のキーボードショートカット。PenViewer.tsx から切り出した (#71)。
 *
 * 扱うもの: フレーム履歴 (Cmd+[ / ])、各パネル・ダイアログのトグル、
 * ズーム (Cmd+0 / 1 / + / -)、Present / Focus モード、
 * そして Vim モード時の [count]h/j/k/l 移動・g プレフィックス・H/J/K/L 半画面スクロール。
 *
 * ノード編集系のショートカット (undo / copy / delete など) は
 * EditorContext 側の useEditorShortcuts が担当する。
 */

import { useCallback, useEffect, useRef } from 'react';
import { isAIGenerateEnabled } from '../../utils/aiGenerate';
import type { Camera } from './usePanZoom';
import type { VimDirection } from './useFrameNavigation';

type Toggle = React.Dispatch<React.SetStateAction<boolean>>;

export interface ViewerShortcutDeps {
  vimMode: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
  setActiveFrameId: (id: string | null) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  navigateVim: (direction: VimDirection, count: number) => void;
  resetView: () => void;
  zoomTo100: () => void;
  zoomByFactor: (factor: number) => void;
  setShowCommandPalette: Toggle;
  setShowFrameSearch: Toggle;
  setShowAutoId: Toggle;
  setShowShortcuts: Toggle;
  setShowRulers: Toggle;
  setShowFindReplace: Toggle;
  setShowAIGenerate: Toggle;
  setShowDevInspect: Toggle;
  setPresentMode: Toggle;
  setFocusMode: Toggle;
}

export function useViewerShortcuts({
  vimMode,
  containerRef,
  setCamera,
  setActiveFrameId,
  navigateBack,
  navigateForward,
  navigateVim,
  resetView,
  zoomTo100,
  zoomByFactor,
  setShowCommandPalette,
  setShowFrameSearch,
  setShowAutoId,
  setShowShortcuts,
  setShowRulers,
  setShowFindReplace,
  setShowAIGenerate,
  setShowDevInspect,
  setPresentMode,
  setFocusMode,
}: ViewerShortcutDeps) {
  // Vim-like frame navigation: [count]h/j/k/l
  // Text objects (vim mode only): vif, vaf, vir, vic
  const vimCount = useRef('');
  const vimGPending = useRef(false);
  const vimTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** 選択ノードを矢印方向に count px 動かす (NudgeHandler が受ける) */
  const nudgeSelected = useCallback((direction: string, count: number) => {
    window.dispatchEvent(new CustomEvent('pencil-nudge', { detail: { direction, count } }));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Skip vim keys when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (mod && e.key === '[') {
        e.preventDefault();
        navigateBack();
      } else if (mod && e.key === ']') {
        e.preventDefault();
        navigateForward();
      } else if (mod && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      } else if (mod && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setShowFrameSearch((v) => !v);
      } else if (mod && e.key === 'i') {
        e.preventDefault();
        setShowAutoId((v) => !v);
      } else if (mod && e.key === '/') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      } else if (mod && e.key === ';') {
        // Cmd+; でルーラー表示トグル（Cmd+R はブラウザ予約のため避ける）
        e.preventDefault();
        setShowRulers((v) => !v);
      } else if (e.shiftKey && !mod && !e.altKey && e.key === '1') {
        // Shift+1: Fit to view
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          resetView();
        }
      } else if (e.shiftKey && !mod && !e.altKey && e.key === '2') {
        // Shift+2: Zoom to selected node (similar to F)
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          window.dispatchEvent(new Event('pencil-zoom-to-selected'));
        }
      } else if (mod && !e.shiftKey && e.key === 'f') {
        // Cmd+F で Find & Replace
        e.preventDefault();
        setShowFindReplace((v) => !v);
      } else if (mod && (e.key === 'k' || e.key === 'K')) {
        // Cmd+K で AI Design Generator を開く
        if (isAIGenerateEnabled()) {
          e.preventDefault();
          setShowAIGenerate((v) => !v);
        }
      } else if (mod && e.key === 'Enter') {
        // Cmd+Enter で Present mode トグル
        e.preventDefault();
        setPresentMode((v) => !v);
      } else if (mod && e.key === '.') {
        // Cmd+. で Focus mode トグル（UI 全消し、編集は可能）
        e.preventDefault();
        setFocusMode((v) => !v);
      } else if (mod && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        // Cmd+Shift+D で Dev Inspect パネル
        e.preventDefault();
        setShowDevInspect((v) => !v);
      } else if (mod && e.key === '0') {
        e.preventDefault();
        resetView();
      } else if (mod && e.key === '1') {
        e.preventDefault();
        zoomTo100();
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomByFactor(1.25);
      } else if (mod && e.key === '-') {
        e.preventDefault();
        zoomByFactor(1 / 1.25);
      } else if (!mod && !isInput && vimMode) {
        // Vim-style keybindings (vim mode only)
        // Number prefix: accumulate digits
        if (/^[0-9]$/.test(e.key)) {
          vimCount.current += e.key;
          clearTimeout(vimTimeout.current);
          vimTimeout.current = setTimeout(() => {
            vimCount.current = '';
            vimGPending.current = false;
          }, 1500);
          return;
        }
        // g prefix: next h/j/k/l will do frame jump
        if (e.key === 'g' && !vimGPending.current) {
          vimGPending.current = true;
          clearTimeout(vimTimeout.current);
          vimTimeout.current = setTimeout(() => {
            vimGPending.current = false;
            vimCount.current = '';
          }, 1500);
          return;
        }
        // Shift + H/J/K/L: camera half-page scroll
        if (e.key === 'H' || e.key === 'J' || e.key === 'K' || e.key === 'L') {
          e.preventDefault();
          const dir = e.key.toLowerCase();
          const el = containerRef.current;
          const aspect = el ? el.clientWidth / el.clientHeight : 16 / 9;
          // ズーム倍率は prev から読む。camera を閉じ込めると、ズーム後も
          // 登録時の倍率でスクロールしてしまう（リスナーは貼りっぱなしのため）
          setCamera((prev) => {
            const halfW = prev.svgWidth / 2;
            const halfH = prev.svgWidth / aspect / 2;
            return {
              ...prev,
              cx: prev.cx + (dir === 'l' ? halfW : dir === 'h' ? -halfW : 0),
              cy: prev.cy + (dir === 'j' ? halfH : dir === 'k' ? -halfH : 0),
            };
          });
          return;
        }
        if (e.key === 'h' || e.key === 'j' || e.key === 'k' || e.key === 'l') {
          e.preventDefault();
          const count = Math.max(1, parseInt(vimCount.current) || 1);
          vimCount.current = '';
          clearTimeout(vimTimeout.current);
          if (vimGPending.current) {
            // g + h/j/k/l: frame jump
            vimGPending.current = false;
            navigateVim(e.key, count);
          } else if (document.querySelector('.node-tree__item--selected')) {
            // Node selected: nudge node by pixels
            nudgeSelected(e.key, count);
          } else {
            // No selection: pan camera
            setCamera((prev) => {
              const step = prev.svgWidth * 0.05 * count; // 5% of view per press
              return {
                ...prev,
                cx: prev.cx + (e.key === 'l' ? step : e.key === 'h' ? -step : 0),
                cy: prev.cy + (e.key === 'j' ? step : e.key === 'k' ? -step : 0),
              };
            });
          }
          return;
        }
        // i / I (Shift+i): enter insert mode on editable node
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          window.dispatchEvent(new Event('pencil-enter-insert'));
          return;
        }
        // F (Shift+f) to zoom-focus on selected node
        if (e.key === 'F') {
          e.preventDefault();
          window.dispatchEvent(new Event('pencil-zoom-to-selected'));
          return;
        }
        // / to open search (vim-style)
        if (e.key === '/') {
          e.preventDefault();
          setShowFrameSearch(true);
          return;
        }
        // Esc to deselect
        if (e.key === 'Escape') {
          setActiveFrameId(null);
        }
        // Reset g pending on other keys
        vimGPending.current = false;
      } else if (!mod && !isInput && !vimMode) {
        // Non-vim: / still opens search
        if (e.key === '/') {
          e.preventDefault();
          setShowFrameSearch(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // vimMode を落とすと、モード切替がこのリスナーに伝わらない（実害のある stale）。
    // nudgeSelected は useCallback([]) で安定なので依存に入れても再登録は増えない。
  }, [
    vimMode,
    containerRef,
    setCamera,
    setActiveFrameId,
    navigateBack,
    navigateForward,
    navigateVim,
    nudgeSelected,
    resetView,
    zoomTo100,
    zoomByFactor,
    setShowCommandPalette,
    setShowFrameSearch,
    setShowAutoId,
    setShowShortcuts,
    setShowRulers,
    setShowFindReplace,
    setShowAIGenerate,
    setShowDevInspect,
    setPresentMode,
    setFocusMode,
  ]);
}
