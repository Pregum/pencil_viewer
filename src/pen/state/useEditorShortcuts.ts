/**
 * エディタのキーボードショートカット。
 *
 * EditorContext.tsx から切り出した (#71)。元は Provider 内の 392 行の
 * useEffect で、ファイル全体の 4 分の 1 以上を占めていた。挙動は変えず、
 * 必要な操作を引数で受け取る形にしただけ。
 *
 * 扱うもの: undo/redo、コピー & ペースト、スタイルのコピー & ペースト、
 * 複製、削除、グループ化、マスク、重ね順、矢印キーによる移動など。
 */

import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PenDocument, PenNode, FrameNode } from '../types';
import type { EditorState } from './EditorContext';
import { duplicateNode } from '../../components/Viewer/ExtraCommands';
import { findNode, findSiblings, updateNodeInDoc } from './nodeOps';

export interface EditorShortcutDeps {
  stateRef: MutableRefObject<EditorState>;
  setState: Dispatch<SetStateAction<EditorState>>;
  clipboardRef: MutableRefObject<PenNode | null>;
  styleClipboardRef: MutableRefObject<Partial<PenNode> | null>;
  pushUndo: (prevDoc: PenDocument, prevRawDoc: PenDocument) => void;
  undo: () => void;
  redo: () => void;
  deleteNode: (nodeId: string) => void;
  reorderSelected: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  createComponent: (nodeId?: string) => void;
  wrapSelectionInFrame: () => void;
  toggleMaskSelected: () => void;
}

export function useEditorShortcuts({
  stateRef,
  setState,
  clipboardRef,
  styleClipboardRef,
  pushUndo,
  undo,
  redo,
  deleteNode,
  reorderSelected,
  createComponent,
  wrapSelectionInFrame,
  toggleMaskSelected,
}: EditorShortcutDeps): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      }
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isInput =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable === true;

      // Opt+Cmd+G: 選択ノード群を Frame で囲む（Figma の Frame Selection）
      if (mod && e.altKey && (e.key === 'g' || e.key === 'G' || e.key === '©')) {
        if (!isInput) {
          e.preventDefault();
          wrapSelectionInFrame();
          return;
        }
      }

      // Cmd+Alt+M: 選択ノードを mask としてトグル（Figma "Use as mask"）
      if (mod && e.altKey && (e.key === 'm' || e.key === 'M' || e.key === 'µ')) {
        if (!isInput) {
          e.preventDefault();
          toggleMaskSelected();
          return;
        }
      }

      // Figma 準拠: 0-9 数字キーで選択ノードの opacity を設定
      //   1=10%, 2=20%, ..., 9=90%, 0=100%
      //   修飾キー無し / input フォーカス外でのみ作動、vim mode では数字は count として解釈されるので除外
      if (!mod && !e.altKey && !e.shiftKey && !isInput && /^[0-9]$/.test(e.key)) {
        setState((s) => {
          if (!s.selectedNodeId) return s;
          // vim 等で数字カウントを使う仕組みには触らない（vim 側で preventDefault 済み）
          const digit = parseInt(e.key, 10);
          const targetOpacity = digit === 0 ? 1 : digit / 10;
          e.preventDefault();
          pushUndo(s.doc, s.rawDoc);
          return {
            ...s,
            doc: updateNodeInDoc(s.doc, s.selectedNodeId, { opacity: targetOpacity } as Partial<PenNode>),
            rawDoc: updateNodeInDoc(s.rawDoc, s.selectedNodeId, { opacity: targetOpacity } as Partial<PenNode>),
          };
        });
        return;
      }

      // Cmd+Alt+K: 選択ノードをコンポーネント化
      if (mod && e.altKey && (e.key === 'k' || e.key === 'K' || e.key === '˚')) {
        if (!isInput) {
          e.preventDefault();
          createComponent();
          return;
        }
      }

      // Cmd+Shift+H: 選択ノードの visibility をトグル
      if (mod && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        setState((s) => {
          if (!s.selectedNodeId) return s;
          e.preventDefault();
          const n = findNode(s.doc.children, s.selectedNodeId);
          if (!n) return s;
          const cur = (n as { enabled?: boolean }).enabled !== false;
          pushUndo(s.doc, s.rawDoc);
          return {
            ...s,
            doc: updateNodeInDoc(s.doc, s.selectedNodeId, { enabled: !cur } as Partial<PenNode>),
            rawDoc: updateNodeInDoc(s.rawDoc, s.selectedNodeId, { enabled: !cur } as Partial<PenNode>),
          };
        });
        return;
      }
      // Cmd+Shift+L: 選択ノードの lock をトグル
      if (mod && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        setState((s) => {
          if (!s.selectedNodeId) return s;
          e.preventDefault();
          const n = findNode(s.doc.children, s.selectedNodeId);
          if (!n) return s;
          const cur = (n as { locked?: boolean }).locked === true;
          pushUndo(s.doc, s.rawDoc);
          return {
            ...s,
            doc: updateNodeInDoc(s.doc, s.selectedNodeId, { locked: !cur } as Partial<PenNode>),
            rawDoc: updateNodeInDoc(s.rawDoc, s.selectedNodeId, { locked: !cur } as Partial<PenNode>),
          };
        });
        return;
      }

      // z-order: 選択ノードがある場合のみ Cmd+[ / ] を横取りし、
      // PenViewer 側の history nav (navigateBack/Forward) が発火しないようにする。
      if (mod && !isInput && (e.key === '[' || e.key === ']')) {
        setState((s) => {
          if (!s.selectedNodeId) return s;
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.shiftKey) {
            reorderSelected(e.key === ']' ? 'front' : 'back');
          } else {
            reorderSelected(e.key === ']' ? 'forward' : 'backward');
          }
          return s;
        });
      }
      // Escape: exit insert mode + blur input, then deselect
      if (e.key === 'Escape') {
        setState((s) => {
          if (s.insertMode) {
            // Blur the active input/textarea to return to normal mode
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            return { ...s, insertMode: false };
          }
          if (!isInput && s.selectedNodeId) return { ...s, selectedNodeId: null };
          return s;
        });
      }
      // Backspace/Delete: delete selected node(s) (only when not in input)
      if (!isInput && (e.key === 'Backspace' || e.key === 'Delete')) {
        setState((s) => {
          // Multi-select: delete all selected
          if (s.selectedNodeIds.size > 0) {
            e.preventDefault();
            for (const id of s.selectedNodeIds) deleteNode(id);
            return s;
          }
          if (s.selectedNodeId) {
            e.preventDefault();
            deleteNode(s.selectedNodeId);
          }
          return s;
        });
      }

      // --- Standard keyboard shortcuts (work outside vim mode too) ---
      if (isInput) return;

      // Cmd+D: Duplicate selected node
      if (mod && !e.shiftKey && e.key === 'd') {
        e.preventDefault();
        setState((s) => {
          if (!s.selectedNodeId) return s;
          const node = findNode(s.doc.children, s.selectedNodeId);
          if (!node) return s;
          const cloned = duplicateNode(node);
          pushUndo(s.doc, s.rawDoc);
          return {
            ...s,
            doc: { ...s.doc, children: [...s.doc.children, cloned] },
            rawDoc: { ...s.rawDoc, children: [...s.rawDoc.children, cloned] },
            selectedNodeId: cloned.id,
            selectedNodeIds: new Set(),
          };
        });
        return;
      }

      // Cmd+G: Group selected nodes
      if (mod && !e.shiftKey && e.key === 'g') {
        e.preventDefault();
        setState((s) => {
          const ids = s.selectedNodeIds.size > 0
            ? Array.from(s.selectedNodeIds)
            : s.selectedNodeId ? [s.selectedNodeId] : [];
          if (ids.length === 0) return s;
          const idSet = new Set(ids);
          const selected = s.doc.children.filter((n) => idSet.has(n.id));
          const rest = s.doc.children.filter((n) => !idSet.has(n.id));
          if (selected.length === 0) return s;
          const minX = Math.min(...selected.map((n) => n.x ?? 0));
          const minY = Math.min(...selected.map((n) => n.y ?? 0));
          const frame: FrameNode = {
            type: 'frame',
            id: `group_${Date.now()}`,
            x: minX,
            y: minY,
            layout: 'none',
            children: selected.map((n) => ({
              ...(n as object),
              x: (n.x ?? 0) - minX,
              y: (n.y ?? 0) - minY,
            } as PenNode)),
          };
          pushUndo(s.doc, s.rawDoc);
          const newChildren = [...rest, frame];
          return {
            ...s,
            doc: { ...s.doc, children: newChildren },
            rawDoc: { ...s.rawDoc, children: newChildren },
            selectedNodeId: frame.id,
            selectedNodeIds: new Set(),
          };
        });
        return;
      }

      // Cmd+Shift+G: Ungroup
      if (mod && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setState((s) => {
          if (!s.selectedNodeId) return s;
          const node = findNode(s.doc.children, s.selectedNodeId);
          if (!node || (node.type !== 'frame' && node.type !== 'group')) return s;
          const children = (node as { children?: PenNode[] }).children ?? [];
          const parentX = node.x ?? 0;
          const parentY = node.y ?? 0;
          const promoted = children.map((c) => ({
            ...(c as object),
            x: (c.x ?? 0) + parentX,
            y: (c.y ?? 0) + parentY,
          } as PenNode));
          const rest = s.doc.children.filter((n) => n.id !== s.selectedNodeId);
          pushUndo(s.doc, s.rawDoc);
          const newChildren = [...rest, ...promoted];
          return {
            ...s,
            doc: { ...s.doc, children: newChildren },
            rawDoc: { ...s.rawDoc, children: newChildren },
            selectedNodeId: promoted[0]?.id ?? null,
            selectedNodeIds: new Set(promoted.map((n) => n.id)),
          };
        });
        return;
      }

      // Cmd+Alt+C: Copy style (fill/stroke/effect 等) only
      if (mod && e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 'ç')) {
        e.preventDefault();
        setState((s) => {
          if (!s.selectedNodeId) return s;
          const node = findNode(s.doc.children, s.selectedNodeId);
          if (!node) return s;
          const src = node as Record<string, unknown>;
          const style: Partial<PenNode> = {};
          const keys: (keyof PenNode | string)[] = [
            'fill', 'stroke', 'effect', 'cornerRadius', 'opacity',
            'rotation', 'fontFamily', 'fontSize', 'fontWeight',
            'letterSpacing', 'lineHeight', 'textAlign',
          ];
          for (const k of keys) {
            if (src[k as string] !== undefined) {
              (style as Record<string, unknown>)[k as string] = src[k as string];
            }
          }
          styleClipboardRef.current = style;
          return s;
        });
        return;
      }

      // Cmd+Alt+V: Paste style onto selected
      if (mod && e.altKey && (e.key === 'v' || e.key === 'V' || e.key === '√')) {
        e.preventDefault();
        const style = styleClipboardRef.current;
        if (!style) return;
        setState((s) => {
          const ids = s.selectedNodeIds.size > 0
            ? Array.from(s.selectedNodeIds)
            : s.selectedNodeId ? [s.selectedNodeId] : [];
          if (ids.length === 0) return s;
          pushUndo(s.doc, s.rawDoc);
          let nextDoc = s.doc;
          let nextRaw = s.rawDoc;
          for (const id of ids) {
            nextDoc = updateNodeInDoc(nextDoc, id, style);
            nextRaw = updateNodeInDoc(nextRaw, id, style);
          }
          return { ...s, doc: nextDoc, rawDoc: nextRaw };
        });
        return;
      }

      // Cmd+C: Copy selected node to internal clipboard (not system clipboard for node data)
      if (mod && !e.shiftKey && e.key === 'c') {
        e.preventDefault();
        setState((s) => {
          if (!s.selectedNodeId) return s;
          const node = findNode(s.doc.children, s.selectedNodeId);
          if (node) clipboardRef.current = node;
          return s;
        });
        return;
      }

      // Cmd+V: Paste from internal clipboard
      if (mod && !e.shiftKey && e.key === 'v') {
        e.preventDefault();
        const clipNode = clipboardRef.current;
        if (!clipNode) return;
        const cloned = duplicateNode(clipNode);
        setState((s) => {
          pushUndo(s.doc, s.rawDoc);
          return {
            ...s,
            doc: { ...s.doc, children: [...s.doc.children, cloned] },
            rawDoc: { ...s.rawDoc, children: [...s.rawDoc.children, cloned] },
            selectedNodeId: cloned.id,
            selectedNodeIds: new Set(),
          };
        });
        return;
      }

      // Tab / Shift+Tab: Navigate siblings
      if (e.key === 'Tab') {
        e.preventDefault();
        setState((s) => {
          if (!s.selectedNodeId) {
            // Nothing selected: select first top-level node
            const first = s.doc.children[0];
            if (first) return { ...s, selectedNodeId: first.id, selectedNodeIds: new Set() };
            return s;
          }
          const siblings = findSiblings(s.selectedNodeId, s.doc.children);
          if (!siblings || siblings.length === 0) return s;
          const idx = siblings.findIndex((n) => n.id === s.selectedNodeId);
          if (idx < 0) return s;
          const step = e.shiftKey ? -1 : 1;
          const nextIdx = (idx + step + siblings.length) % siblings.length;
          return { ...s, selectedNodeId: siblings[nextIdx].id, selectedNodeIds: new Set() };
        });
        return;
      }

      // Arrow keys:
      //   - 素のみ / Shift = ナッジ移動 (1px / 10px)
      //   - Cmd/Ctrl = リサイズ (1px / 10px)
      // vim mode は h/j/k/l を使うので矢印と競合しない
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setState((s) => {
          if (!s.selectedNodeId) return s;
          const node = findNode(s.doc.children, s.selectedNodeId);
          if (!node) return s;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;

          if (mod) {
            // --- リサイズ ---
            const curW = typeof (node as { width?: unknown }).width === 'number' ? (node as { width: number }).width : 0;
            const curH = typeof (node as { height?: unknown }).height === 'number' ? (node as { height: number }).height : 0;
            let dw = 0;
            let dh = 0;
            if (e.key === 'ArrowLeft') dw = -step;
            if (e.key === 'ArrowRight') dw = step;
            if (e.key === 'ArrowUp') dh = -step;
            if (e.key === 'ArrowDown') dh = step;
            const patch: Record<string, number> = {};
            if (dw !== 0) patch.width = Math.max(1, curW + dw);
            if (dh !== 0) patch.height = Math.max(1, curH + dh);
            if (Object.keys(patch).length === 0) return s;
            pushUndo(s.doc, s.rawDoc);
            return {
              ...s,
              doc: updateNodeInDoc(s.doc, s.selectedNodeId, patch as Partial<PenNode>),
              rawDoc: updateNodeInDoc(s.rawDoc, s.selectedNodeId, patch as Partial<PenNode>),
            };
          }

          // --- ナッジ ---
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          const patch = { x: (node.x ?? 0) + dx, y: (node.y ?? 0) + dy } as Partial<PenNode>;
          pushUndo(s.doc, s.rawDoc);
          return {
            ...s,
            doc: updateNodeInDoc(s.doc, s.selectedNodeId!, patch),
            rawDoc: updateNodeInDoc(s.rawDoc, s.selectedNodeId!, patch),
          };
        });
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    undo,
    redo,
    deleteNode,
    pushUndo,
    reorderSelected,
    createComponent,
    wrapSelectionInFrame,
    toggleMaskSelected,
    setState,
    stateRef,
    clipboardRef,
    styleClipboardRef,
  ]);
}
