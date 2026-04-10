/**
 * エディタ状態管理: 選択ノード、ドキュメント編集を一元管理する Context。
 */

import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { PenDocument, PenNode } from '../types';

export interface EditorState {
  doc: PenDocument;
  selectedNodeId: string | null;
}

type EditorAction =
  | { type: 'SELECT_NODE'; nodeId: string | null }
  | { type: 'UPDATE_NODE'; nodeId: string; patch: Partial<PenNode> }
  | { type: 'SET_DOC'; doc: PenDocument };

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.nodeId };
    case 'UPDATE_NODE':
      return {
        ...state,
        doc: updateNodeInDoc(state.doc, action.nodeId, action.patch),
      };
    case 'SET_DOC':
      return { doc: action.doc, selectedNodeId: null };
    default:
      return state;
  }
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

interface EditorContextValue {
  state: EditorState;
  selectNode: (nodeId: string | null) => void;
  updateNode: (nodeId: string, patch: Partial<PenNode>) => void;
  selectedNode: PenNode | null;
  exportPen: () => void;
}

const EditorCtx = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  doc,
  children,
}: {
  doc: PenDocument;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, { doc, selectedNodeId: null });

  const selectNode = useCallback(
    (nodeId: string | null) => dispatch({ type: 'SELECT_NODE', nodeId }),
    [],
  );

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<PenNode>) =>
      dispatch({ type: 'UPDATE_NODE', nodeId, patch }),
    [],
  );

  const selectedNode = useMemo(
    () =>
      state.selectedNodeId ? findNode(state.doc.children, state.selectedNodeId) : null,
    [state.doc, state.selectedNodeId],
  );

  const exportPen = useCallback(() => {
    const json = JSON.stringify(state.doc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exported.pen';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.doc]);

  const value = useMemo(
    () => ({ state, selectNode, updateNode, selectedNode, exportPen }),
    [state, selectNode, updateNode, selectedNode, exportPen],
  );

  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorCtx);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
