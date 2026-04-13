/**
 * エディタ状態管理: 選択ノード、Undo/Redo、ドキュメント編集を一元管理する Context。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PenDocument, PenNode } from '../types';

export interface EditorState {
  doc: PenDocument;
  /** レイアウト計算前の元 doc（エクスポート用） */
  rawDoc: PenDocument;
  selectedNodeId: string | null;
  /** マルチ選択（vim visual mode 等） */
  selectedNodeIds: Set<string>;
  /** vim insert mode（テキスト編集中） */
  insertMode: boolean;
}

/** ドキュメントツリー内のノードを再帰的に更新 */
function updateNodeInDoc(
  doc: PenDocument,
  nodeId: string,
  patch: Partial<PenNode>,
): PenDocument {
  return {
    ...doc,
    children: doc.children.map((n) => updateNodeRecursive(n, nodeId, patch)),
  };
}

function updateNodeRecursive(
  node: PenNode,
  nodeId: string,
  patch: Partial<PenNode>,
): PenNode {
  if (node.id === nodeId) {
    return { ...(node as object), ...patch } as PenNode;
  }
  if ('children' in node && Array.isArray((node as { children?: PenNode[] }).children)) {
    const children = (node as { children: PenNode[] }).children.map((c) =>
      updateNodeRecursive(c, nodeId, patch),
    );
    return { ...(node as object), children } as PenNode;
  }
  return node;
}

/** ツリーからノードを ID で検索 */
function findNode(nodes: PenNode[], id: string): PenNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const found = findNode((n as { children: PenNode[] }).children, id);
      if (found) return found;
    }
  }
  return null;
}

const MAX_UNDO = 100;

interface EditorContextValue {
  state: EditorState;
  selectNode: (nodeId: string | null) => void;
  updateNode: (nodeId: string, patch: Partial<PenNode>) => void;
  selectedNode: PenNode | null;
  selectMultiple: (nodeIds: string[]) => void;
  enterInsertMode: () => void;
  exitInsertMode: () => void;
  /** Undo 履歴に積まずにノード更新（ドラッグ中の中間更新用） */
  updateNodeSilent: (nodeId: string, patch: Partial<PenNode>) => void;
  /** Undo 用: 現在の doc を明示的に undo スタックに積む */
  pushUndoCheckpoint: () => void;
  deleteNode: (nodeId: string) => void;
  /** ドキュメントの children を直接差し替える（undo 付き） */
  replaceDocChildren: (children: PenNode[]) => void;
  exportPen: (fileName?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const EditorCtx = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  doc,
  rawDoc,
  children,
}: {
  doc: PenDocument;
  rawDoc?: PenDocument;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<EditorState>({ doc, rawDoc: rawDoc ?? doc, selectedNodeId: null, selectedNodeIds: new Set(), insertMode: false });

  // Undo/Redo stacks store both doc and rawDoc snapshots
  const undoStack = useRef<{ doc: PenDocument; rawDoc: PenDocument }[]>([]);
  const redoStack = useRef<{ doc: PenDocument; rawDoc: PenDocument }[]>([]);

  const pushUndo = useCallback((prevDoc: PenDocument, prevRawDoc: PenDocument) => {
    undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), { doc: prevDoc, rawDoc: prevRawDoc }];
    redoStack.current = [];
  }, []);

  const selectNode = useCallback(
    (nodeId: string | null) => setState((s) => ({ ...s, selectedNodeId: nodeId, selectedNodeIds: new Set() })),
    [],
  );

  const selectMultiple = useCallback(
    (nodeIds: string[]) => setState((s) => ({ ...s, selectedNodeIds: new Set(nodeIds), selectedNodeId: nodeIds[0] ?? null })),
    [],
  );

  const enterInsertMode = useCallback(() => {
    setState((s) => ({ ...s, insertMode: true }));
  }, []);

  const exitInsertMode = useCallback(() => {
    setState((s) => ({ ...s, insertMode: false }));
  }, []);

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<PenNode>) => {
      setState((s) => {
        pushUndo(s.doc, s.rawDoc);
        return {
          ...s,
          doc: updateNodeInDoc(s.doc, nodeId, patch),
          rawDoc: updateNodeInDoc(s.rawDoc, nodeId, patch),
        };
      });
    },
    [pushUndo],
  );

  /** ドラッグ中など、undo に積まずに更新 */
  const updateNodeSilent = useCallback(
    (nodeId: string, patch: Partial<PenNode>) => {
      setState((s) => ({
        ...s,
        doc: updateNodeInDoc(s.doc, nodeId, patch),
        rawDoc: updateNodeInDoc(s.rawDoc, nodeId, patch),
      }));
    },
    [],
  );

  /** 手動で undo チェックポイントを作成（ドラッグ開始時に呼ぶ） */
  const pushUndoCheckpoint = useCallback(() => {
    setState((s) => {
      pushUndo(s.doc, s.rawDoc);
      return s;
    });
  }, [pushUndo]);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setState((s) => {
        pushUndo(s.doc, s.rawDoc);
        const removeRecursive = (nodes: PenNode[]): PenNode[] =>
          nodes
            .filter((n) => n.id !== nodeId)
            .map((n) => {
              if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
                return {
                  ...(n as object),
                  children: removeRecursive((n as { children: PenNode[] }).children),
                } as PenNode;
              }
              return n;
            });
        return {
          ...s,
          doc: { ...s.doc, children: removeRecursive(s.doc.children) },
          rawDoc: { ...s.rawDoc, children: removeRecursive(s.rawDoc.children) },
          selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
        };
      });
    },
    [pushUndo],
  );

  const replaceDocChildren = useCallback(
    (children: PenNode[]) => {
      setState((s) => {
        pushUndo(s.doc, s.rawDoc);
        return {
          ...s,
          doc: { ...s.doc, children },
          rawDoc: { ...s.rawDoc, children },
        };
      });
    },
    [pushUndo],
  );

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    setState((s) => {
      redoStack.current = [...redoStack.current, { doc: s.doc, rawDoc: s.rawDoc }];
      const prev = undoStack.current[undoStack.current.length - 1];
      undoStack.current = undoStack.current.slice(0, -1);
      return { ...s, doc: prev.doc, rawDoc: prev.rawDoc };
    });
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    setState((s) => {
      undoStack.current = [...undoStack.current, { doc: s.doc, rawDoc: s.rawDoc }];
      const next = redoStack.current[redoStack.current.length - 1];
      redoStack.current = redoStack.current.slice(0, -1);
      return { ...s, doc: next.doc, rawDoc: next.rawDoc };
    });
  }, []);

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z
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
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, deleteNode]);

  const selectedNode = useMemo(
    () =>
      state.selectedNodeId ? findNode(state.doc.children, state.selectedNodeId) : null,
    [state.doc, state.selectedNodeId],
  );

  const exportPen = useCallback((fileName?: string) => {
    // rawDoc を使用（レイアウト計算前の元データ + 編集差分）
    const json = JSON.stringify(state.rawDoc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ?? 'exported.pen';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.rawDoc]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const value = useMemo(
    () => ({ state, selectNode, selectMultiple, enterInsertMode, exitInsertMode, updateNode, updateNodeSilent, pushUndoCheckpoint, deleteNode, replaceDocChildren, selectedNode, exportPen, undo, redo, canUndo, canRedo }),
    [state, selectNode, selectMultiple, enterInsertMode, exitInsertMode, updateNode, updateNodeSilent, pushUndoCheckpoint, deleteNode, replaceDocChildren, selectedNode, exportPen, undo, redo, canUndo, canRedo],
  );

  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorCtx);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
