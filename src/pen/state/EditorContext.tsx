/**
 * エディタ状態管理: 選択ノード、Undo/Redo、ドキュメント編集を一元管理する Context。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PenDocument, PenNode, FrameNode, NamedStyle, ColorStyle, TextStyle, EffectStyle } from '../types';
import { duplicateNode } from '../../components/Viewer/ExtraCommands';
import { booleanOperation, type BoolOp } from '../renderer/booleanOps';

/** 変数 1 つの形。Pencil の $var は color / number / boolean / string のいずれか。 */
export type VariableType = 'color' | 'number' | 'boolean' | 'string';
export interface VariableDef {
  type: VariableType;
  value: string | number | boolean;
}

/** アクティブな作成ツール。'select' 以外を選ぶとドラッグでシェイプが生成される */
export type ActiveTool = 'select' | 'rectangle' | 'ellipse' | 'line' | 'text' | 'frame' | 'note' | 'pen';

export interface EditorState {
  doc: PenDocument;
  /** レイアウト計算前の元 doc（エクスポート用） */
  rawDoc: PenDocument;
  selectedNodeId: string | null;
  /** マルチ選択（vim visual mode 等） */
  selectedNodeIds: Set<string>;
  /** vim insert mode（テキスト編集中） */
  insertMode: boolean;
  /** 現在選択中のツール（デフォルトは select） */
  activeTool: ActiveTool;
  /** インラインテキスト編集中のノードID（dblclick で設定、Esc/Blur で解除） */
  editingNodeId: string | null;
  /** ペンツールの path 編集モードのノード ID（dblclick で path を開くとセット） */
  editingPathId: string | null;
  /** Grid Snap: ON のとき位置/サイズを gridSize (px) にラウンドする */
  gridSnap: boolean;
  gridSize: number;
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
  /** Shift+クリック用: 選択セットをトグル */
  toggleSelectNode: (nodeId: string) => void;
  enterInsertMode: () => void;
  exitInsertMode: () => void;
  /** Undo 履歴に積まずにノード更新（ドラッグ中の中間更新用） */
  updateNodeSilent: (nodeId: string, patch: Partial<PenNode>) => void;
  /** 複数ノードを undo なしで一括更新 */
  updateManySilent: (patches: Array<{ nodeId: string; patch: Partial<PenNode> }>) => void;
  /** Undo 用: 現在の doc を明示的に undo スタックに積む */
  pushUndoCheckpoint: () => void;
  deleteNode: (nodeId: string) => void;
  /** ドキュメントの children を直接差し替える（undo 付き） */
  replaceDocChildren: (children: PenNode[]) => void;
  /** 選択ノードの z-order を移動（forward/backward/front/back） */
  reorderSelected: (action: 'forward' | 'backward' | 'front' | 'back') => void;
  /** 親配下の兄弟配列の並びを from → to に変更（レイヤーDnD用） */
  reorderChildren: (parentId: string | null, fromIdx: number, toIdx: number) => void;
  /** 新しいノードをトップレベルに追加して選択する（undo 付き） */
  addNode: (node: PenNode) => void;
  /** Alt+ドラッグ複製用: トップレベル指定 IDs をクローン追加して選択、開始位置を返す */
  cloneNodesAtTop: (ids: string[]) => Array<{ id: string; x0: number; y0: number; w: number; h: number }>;
  /** Grid snap のトグルとサイズ変更 */
  setGridSnap: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  /** 選択ノードを Frame で囲む (Opt+Cmd+G / Figma の "Frame Selection") */
  wrapSelectionInFrame: () => void;
  /** 選択ノードの mask フラグをトグル (Cmd+Alt+M) */
  toggleMaskSelected: () => void;
  /** 選択ノードに boolean 演算を適用し、結果の path ノードで置換 */
  applyBooleanOp: (op: 'union' | 'subtract' | 'intersect' | 'exclude') => void;
  /** Named Styles */
  upsertStyle: (style: NamedStyle) => void;
  removeStyle: (id: string) => void;
  applyStyleToSelection: (styleId: string) => void;
  /** 変数の追加/更新 */
  upsertVariable: (name: string, def: VariableDef) => void;
  /** 変数を削除 */
  removeVariable: (name: string) => void;
  /** 変数をリネーム（古い名前は削除し、同じ値で新しい名前を作る。参照 $old は置換しない） */
  renameVariable: (oldName: string, newName: string) => void;
  /** 選択ノードをコンポーネント化（reusable=true） */
  createComponent: (nodeId?: string) => void;
  /** コンポーネント化を解除 */
  unmakeComponent: (nodeId: string) => void;
  /** コンポーネント ID を参照する ref インスタンスをトップレベルに追加 */
  insertInstance: (componentId: string, pos?: { x?: number; y?: number; width?: number; height?: number }) => void;
  /** アクティブツールを切り替える */
  setActiveTool: (tool: ActiveTool) => void;
  /** インラインテキスト編集の開始/終了 */
  beginEditing: (nodeId: string) => void;
  endEditing: () => void;
  /** path 編集モードの開始/終了（ペンツール拡張） */
  beginPathEditing: (nodeId: string) => void;
  endPathEditing: () => void;
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
  const [state, setState] = useState<EditorState>({
    doc,
    rawDoc: rawDoc ?? doc,
    selectedNodeId: null,
    selectedNodeIds: new Set(),
    insertMode: false,
    activeTool: 'select',
    editingNodeId: null,
    editingPathId: null,
    gridSnap: false,
    gridSize: 8,
  });

  /** 同期的に最新 state を参照したいコールバック（cloneNodesAtTop など）用 */
  const stateRef = useRef(state);
  stateRef.current = state;

  // Undo/Redo stacks store both doc and rawDoc snapshots
  const undoStack = useRef<{ doc: PenDocument; rawDoc: PenDocument }[]>([]);
  const redoStack = useRef<{ doc: PenDocument; rawDoc: PenDocument }[]>([]);

  // Internal clipboard for Cmd+C / Cmd+V of nodes
  const clipboardRef = useRef<PenNode | null>(null);
  // スタイルクリップボード (Cmd+Alt+C / Cmd+Alt+V)
  const styleClipboardRef = useRef<Partial<PenNode> | null>(null);

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

  /** Shift+クリック: 選択セットにトグル追加 */
  const toggleSelectNode = useCallback((nodeId: string) => {
    setState((s) => {
      // 現在の選択を multi set に正規化（selectedNodeId も含める）
      const current = new Set(s.selectedNodeIds);
      if (s.selectedNodeId) current.add(s.selectedNodeId);

      if (current.has(nodeId)) {
        current.delete(nodeId);
      } else {
        current.add(nodeId);
      }
      const arr = Array.from(current);
      return {
        ...s,
        selectedNodeIds: current,
        selectedNodeId: arr[arr.length - 1] ?? null,
      };
    });
  }, []);

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

  /** 複数ノードをまとめて undo なしで更新（マルチ選択ドラッグ用） */
  const updateManySilent = useCallback(
    (patches: Array<{ nodeId: string; patch: Partial<PenNode> }>) => {
      setState((s) => {
        let nextDoc = s.doc;
        let nextRaw = s.rawDoc;
        for (const { nodeId, patch } of patches) {
          nextDoc = updateNodeInDoc(nextDoc, nodeId, patch);
          nextRaw = updateNodeInDoc(nextRaw, nodeId, patch);
        }
        return { ...s, doc: nextDoc, rawDoc: nextRaw };
      });
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

  /**
   * z-order 並び替え: 選択ノードをツリー内の同じ親の兄弟内で移動する。
   * delta: +1 = 前面に1つ / -1 = 背面に1つ / 'front' / 'back'
   */
  const reorderSelected = useCallback(
    (action: 'forward' | 'backward' | 'front' | 'back') => {
      setState((s) => {
        if (!s.selectedNodeId) return s;
        const targetId = s.selectedNodeId;

        /** ツリー内の node を parent (兄弟配列) 単位で移動する再帰ヘルパー */
        function applyReorder(nodes: PenNode[]): { nodes: PenNode[]; changed: boolean } {
          const idx = nodes.findIndex((n) => n.id === targetId);
          if (idx >= 0) {
            const arr = [...nodes];
            const [item] = arr.splice(idx, 1);
            let toIdx = idx;
            if (action === 'forward') toIdx = Math.min(arr.length, idx + 1);
            else if (action === 'backward') toIdx = Math.max(0, idx - 1);
            else if (action === 'front') toIdx = arr.length;
            else if (action === 'back') toIdx = 0;
            arr.splice(toIdx, 0, item);
            return { nodes: arr, changed: toIdx !== idx };
          }
          let changed = false;
          const next = nodes.map((n) => {
            if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
              const res = applyReorder((n as { children: PenNode[] }).children);
              if (res.changed) {
                changed = true;
                return { ...(n as object), children: res.nodes } as PenNode;
              }
            }
            return n;
          });
          return { nodes: next, changed };
        }

        const docRes = applyReorder(s.doc.children);
        const rawRes = applyReorder(s.rawDoc.children);
        if (!docRes.changed) return s;
        pushUndo(s.doc, s.rawDoc);
        return {
          ...s,
          doc: { ...s.doc, children: docRes.nodes },
          rawDoc: { ...s.rawDoc, children: rawRes.nodes },
        };
      });
    },
    [pushUndo],
  );

  /**
   * 指定の親配下で兄弟配列の並びを from → to に変更する（レイヤーパネル DnD 用）。
   * parentId=null の場合はトップレベル children を対象にする。
   */
  const reorderChildren = useCallback(
    (parentId: string | null, fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      setState((s) => {
        function reorderArr(arr: PenNode[]): PenNode[] {
          if (fromIdx < 0 || fromIdx >= arr.length) return arr;
          const next = [...arr];
          const [item] = next.splice(fromIdx, 1);
          const insertAt = Math.max(0, Math.min(next.length, toIdx > fromIdx ? toIdx - 1 : toIdx));
          next.splice(insertAt, 0, item);
          return next;
        }
        function applyIn(nodes: PenNode[]): PenNode[] {
          if (parentId === null) return reorderArr(nodes);
          return nodes.map((n) => {
            if (n.id === parentId && 'children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
              return {
                ...(n as object),
                children: reorderArr((n as { children: PenNode[] }).children),
              } as PenNode;
            }
            if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
              return {
                ...(n as object),
                children: applyIn((n as { children: PenNode[] }).children),
              } as PenNode;
            }
            return n;
          });
        }
        pushUndo(s.doc, s.rawDoc);
        return {
          ...s,
          doc: { ...s.doc, children: applyIn(s.doc.children) },
          rawDoc: { ...s.rawDoc, children: applyIn(s.rawDoc.children) },
        };
      });
    },
    [pushUndo],
  );

  const addNode = useCallback(
    (node: PenNode) => {
      setState((s) => {
        pushUndo(s.doc, s.rawDoc);
        return {
          ...s,
          doc: { ...s.doc, children: [...s.doc.children, node] },
          rawDoc: { ...s.rawDoc, children: [...s.rawDoc.children, node] },
          selectedNodeId: node.id,
          selectedNodeIds: new Set(),
        };
      });
    },
    [pushUndo],
  );

  /**
   * Alt+ドラッグ複製用: トップレベルの指定ノードを同位置でクローンしてドキュメントに追加、
   * 返り値としてクローン ID と開始位置を返す。呼び出し側は multiStart にセットして
   * そのまま updateManySilent で移動させる想定。
   */
  const cloneNodesAtTop = useCallback(
    (ids: string[]): Array<{ id: string; x0: number; y0: number; w: number; h: number }> => {
      const idSet = new Set(ids);
      const originals = stateRef.current.doc.children.filter((n) => idSet.has(n.id));
      if (originals.length === 0) return [];
      const clones: PenNode[] = originals.map((n) => ({
        ...(n as object),
        id: `${n.id}_copy_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      } as PenNode));
      setState((s) => {
        pushUndo(s.doc, s.rawDoc);
        return {
          ...s,
          doc: { ...s.doc, children: [...s.doc.children, ...clones] },
          rawDoc: { ...s.rawDoc, children: [...s.rawDoc.children, ...clones] },
          selectedNodeId: clones[0].id,
          selectedNodeIds: new Set(clones.map((c) => c.id)),
        };
      });
      return clones.map((c) => ({
        id: c.id,
        x0: c.x ?? 0,
        y0: c.y ?? 0,
        w: typeof (c as { width?: unknown }).width === 'number' ? (c as { width: number }).width : 0,
        h: typeof (c as { height?: unknown }).height === 'number' ? (c as { height: number }).height : 0,
      }));
    },
    [pushUndo],
  );

  const setActiveTool = useCallback((tool: ActiveTool) => {
    setState((s) => (s.activeTool === tool ? s : { ...s, activeTool: tool }));
  }, []);

  /** 変数辞書（{name: {type,value}} の形）を取り出す */
  const getVarsDict = (d: PenDocument): Record<string, { type: VariableType; value: string | number | boolean }> => {
    if (!d.variables || typeof d.variables !== 'object') return {};
    return { ...(d.variables as Record<string, { type: VariableType; value: string | number | boolean }>) };
  };

  const upsertVariable = useCallback((name: string, def: VariableDef) => {
    setState((s) => {
      pushUndo(s.doc, s.rawDoc);
      const dict = getVarsDict(s.rawDoc);
      dict[name] = def;
      return {
        ...s,
        doc: { ...s.doc, variables: dict },
        rawDoc: { ...s.rawDoc, variables: dict },
      };
    });
  }, [pushUndo]);

  const removeVariable = useCallback((name: string) => {
    setState((s) => {
      pushUndo(s.doc, s.rawDoc);
      const dict = getVarsDict(s.rawDoc);
      delete dict[name];
      return {
        ...s,
        doc: { ...s.doc, variables: dict },
        rawDoc: { ...s.rawDoc, variables: dict },
      };
    });
  }, [pushUndo]);

  const setGridSnap = useCallback((enabled: boolean) => {
    setState((s) => (s.gridSnap === enabled ? s : { ...s, gridSnap: enabled }));
  }, []);

  const setGridSize = useCallback((size: number) => {
    const v = Math.max(1, Math.round(size));
    setState((s) => (s.gridSize === v ? s : { ...s, gridSize: v }));
  }, []);

  /**
   * 選択ノード群をトップレベルの新規 Frame で囲む。
   * Figma の Opt+Cmd+G "Frame Selection" と同等。
   * - トップレベルの兄弟ノードのみを対象（階層跨ぎはサポートしない）
   * - 囲む Frame は選択セットの bbox にフィット、layout='none'
   * - 子ノードの x/y は Frame 内座標系に変換
   */
  /** Named Styles */
  const upsertStyle = useCallback((style: NamedStyle) => {
    setState((s) => {
      pushUndo(s.doc, s.rawDoc);
      const existing = (s.doc.styles ?? []).filter((x) => x.id !== style.id);
      const next = [...existing, style];
      return {
        ...s,
        doc: { ...s.doc, styles: next },
        rawDoc: { ...s.rawDoc, styles: next },
      };
    });
  }, [pushUndo]);

  const removeStyle = useCallback((id: string) => {
    setState((s) => {
      pushUndo(s.doc, s.rawDoc);
      const next = (s.doc.styles ?? []).filter((x) => x.id !== id);
      return {
        ...s,
        doc: { ...s.doc, styles: next },
        rawDoc: { ...s.rawDoc, styles: next },
      };
    });
  }, [pushUndo]);

  const applyStyleToSelection = useCallback((styleId: string) => {
    setState((s) => {
      const ids = s.selectedNodeIds.size > 0
        ? Array.from(s.selectedNodeIds)
        : s.selectedNodeId ? [s.selectedNodeId] : [];
      if (ids.length === 0) return s;
      const style = (s.doc.styles ?? []).find((x) => x.id === styleId);
      if (!style) return s;
      pushUndo(s.doc, s.rawDoc);
      let patch: Partial<PenNode>;
      if (style.type === 'color') {
        // color style は fill に適用（stroke はユーザ操作で決める）
        patch = { fill: (style as ColorStyle).value } as Partial<PenNode>;
      } else if (style.type === 'text') {
        const t = style as TextStyle;
        const p: Record<string, unknown> = {};
        if (t.fontFamily !== undefined) p.fontFamily = t.fontFamily;
        if (t.fontSize !== undefined) p.fontSize = t.fontSize;
        if (t.fontWeight !== undefined) p.fontWeight = t.fontWeight;
        if (t.lineHeight !== undefined) p.lineHeight = t.lineHeight;
        if (t.letterSpacing !== undefined) p.letterSpacing = t.letterSpacing;
        if (t.textAlign !== undefined) p.textAlign = t.textAlign;
        if (t.fill !== undefined) p.fill = t.fill;
        patch = p as Partial<PenNode>;
      } else {
        // effect style
        patch = { effect: (style as EffectStyle).effects } as Partial<PenNode>;
      }
      let nextDoc = s.doc;
      let nextRaw = s.rawDoc;
      for (const id of ids) {
        nextDoc = updateNodeInDoc(nextDoc, id, patch);
        nextRaw = updateNodeInDoc(nextRaw, id, patch);
      }
      return { ...s, doc: nextDoc, rawDoc: nextRaw };
    });
  }, [pushUndo]);

  const applyBooleanOp = useCallback((op: BoolOp) => {
    setState((s) => {
      const ids = s.selectedNodeIds.size >= 2
        ? Array.from(s.selectedNodeIds)
        : s.selectedNodeId ? [s.selectedNodeId] : [];
      if (ids.length < 2) {
        window.alert('Select at least 2 shapes to apply a boolean operation.');
        return s;
      }
      const idSet = new Set(ids);
      // トップレベルの選択ノードのみ対応
      const selected = s.doc.children.filter((n) => idSet.has(n.id));
      if (selected.length < 2) {
        window.alert('Boolean operations only apply to top-level shapes currently.');
        return s;
      }
      const result = booleanOperation(selected, op);
      if (!result) {
        window.alert(`Boolean "${op}" failed or produced empty result. Bezier/open paths and non-shape nodes are not supported.`);
        return s;
      }
      pushUndo(s.doc, s.rawDoc);
      const rest = s.doc.children.filter((n) => !idSet.has(n.id));
      const newChildren = [...rest, result];
      return {
        ...s,
        doc: { ...s.doc, children: newChildren },
        rawDoc: { ...s.rawDoc, children: newChildren },
        selectedNodeId: result.id,
        selectedNodeIds: new Set(),
      };
    });
  }, [pushUndo]);

  const toggleMaskSelected = useCallback(() => {
    setState((s) => {
      if (!s.selectedNodeId) return s;
      const n = findNode(s.doc.children, s.selectedNodeId);
      if (!n) return s;
      const cur = (n as { mask?: boolean }).mask === true;
      pushUndo(s.doc, s.rawDoc);
      const patch = { mask: !cur } as Partial<PenNode>;
      return {
        ...s,
        doc: updateNodeInDoc(s.doc, s.selectedNodeId, patch),
        rawDoc: updateNodeInDoc(s.rawDoc, s.selectedNodeId, patch),
      };
    });
  }, [pushUndo]);

  const wrapSelectionInFrame = useCallback(() => {
    setState((s) => {
      const ids = s.selectedNodeIds.size > 0
        ? Array.from(s.selectedNodeIds)
        : (s.selectedNodeId ? [s.selectedNodeId] : []);
      if (ids.length === 0) return s;
      const idSet = new Set(ids);
      const selected = s.doc.children.filter((n) => idSet.has(n.id));
      const rest = s.doc.children.filter((n) => !idSet.has(n.id));
      if (selected.length === 0) return s;

      // bbox 計算
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of selected) {
        const x0 = n.x ?? 0;
        const y0 = n.y ?? 0;
        const w = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : 0;
        const h = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : 0;
        minX = Math.min(minX, x0);
        minY = Math.min(minY, y0);
        maxX = Math.max(maxX, x0 + w);
        maxY = Math.max(maxY, y0 + h);
      }
      if (!isFinite(minX) || !isFinite(minY)) return s;

      const frame: FrameNode = {
        type: 'frame',
        id: `frame_${Date.now()}`,
        name: 'Frame',
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(Math.max(1, maxX - minX)),
        height: Math.round(Math.max(1, maxY - minY)),
        layout: 'none',
        fill: '#FFFFFF',
        stroke: { thickness: 1, fill: '#E5E7EB' },
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
  }, [pushUndo]);

  const renameVariable = useCallback((oldName: string, newName: string) => {
    if (!newName || oldName === newName) return;
    setState((s) => {
      pushUndo(s.doc, s.rawDoc);
      const dict = getVarsDict(s.rawDoc);
      if (!dict[oldName]) return s;
      dict[newName] = dict[oldName];
      delete dict[oldName];
      return {
        ...s,
        doc: { ...s.doc, variables: dict },
        rawDoc: { ...s.rawDoc, variables: dict },
      };
    });
  }, [pushUndo]);

  /**
   * 選択ノードをコンポーネント化（reusable: true を付与）。
   * 既存の refs.ts が reusable を参照するので、これだけで ref インスタンス化の対象になる。
   */
  const createComponent = useCallback((nodeId?: string) => {
    setState((s) => {
      const target = nodeId ?? s.selectedNodeId;
      if (!target) return s;
      pushUndo(s.doc, s.rawDoc);
      const patch = { reusable: true } as Partial<PenNode>;
      return {
        ...s,
        doc: updateNodeInDoc(s.doc, target, patch),
        rawDoc: updateNodeInDoc(s.rawDoc, target, patch),
      };
    });
  }, [pushUndo]);

  /** コンポーネント化を解除 */
  const unmakeComponent = useCallback((nodeId: string) => {
    setState((s) => {
      pushUndo(s.doc, s.rawDoc);
      // reusable: false を立てる（undefined は Partial で消せないため false を入れる）
      const patch = { reusable: false } as unknown as Partial<PenNode>;
      return {
        ...s,
        doc: updateNodeInDoc(s.doc, nodeId, patch),
        rawDoc: updateNodeInDoc(s.rawDoc, nodeId, patch),
      };
    });
  }, [pushUndo]);

  /**
   * コンポーネント ID への参照 (RefNode) を生成してトップレベルに追加する。
   * 引数の width/height は参照先のサイズを継承するため省略可。
   */
  const insertInstance = useCallback(
    (componentId: string, pos?: { x?: number; y?: number; width?: number; height?: number }) => {
      // 参照先を探す（サイズ取得のため）
      const target = stateRef.current.rawDoc.children.find((n) => n.id === componentId)
        ?? (function search(nodes: PenNode[]): PenNode | null {
          for (const n of nodes) {
            if (n.id === componentId) return n;
            const children = (n as { children?: PenNode[] }).children;
            if (children) {
              const f = search(children);
              if (f) return f;
            }
          }
          return null;
        })(stateRef.current.rawDoc.children);

      if (!target) return;

      const tw = typeof (target as { width?: unknown }).width === 'number' ? (target as { width: number }).width : 100;
      const th = typeof (target as { height?: unknown }).height === 'number' ? (target as { height: number }).height : 100;

      const instance = {
        type: 'ref' as const,
        id: `${componentId}_instance_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ref: componentId,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        width: pos?.width ?? tw,
        height: pos?.height ?? th,
      } as PenNode;
      addNode(instance);
    },
    [addNode],
  );

  const beginEditing = useCallback((nodeId: string) => {
    setState((s) => ({ ...s, editingNodeId: nodeId, selectedNodeId: nodeId, selectedNodeIds: new Set(), insertMode: true }));
  }, []);

  const endEditing = useCallback(() => {
    setState((s) => (s.editingNodeId === null ? s : { ...s, editingNodeId: null, insertMode: false }));
  }, []);

  const beginPathEditing = useCallback((nodeId: string) => {
    setState((s) => ({ ...s, editingPathId: nodeId, selectedNodeId: nodeId, selectedNodeIds: new Set() }));
  }, []);

  const endPathEditing = useCallback(() => {
    setState((s) => (s.editingPathId === null ? s : { ...s, editingPathId: null }));
  }, []);

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

  // Helper: find siblings of a node (children of same parent)
  const findSiblings = useCallback((nodeId: string, nodes: PenNode[]): PenNode[] | null => {
    // Check top-level children
    if (nodes.some((n) => n.id === nodeId)) return nodes;
    for (const n of nodes) {
      if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
        const result = findSiblings(nodeId, (n as { children: PenNode[] }).children);
        if (result) return result;
      }
    }
    return null;
  }, []);

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z and more
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
  }, [undo, redo, deleteNode, pushUndo, findSiblings, reorderSelected, createComponent, wrapSelectionInFrame, toggleMaskSelected]);

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
    () => ({ state, selectNode, selectMultiple, toggleSelectNode, enterInsertMode, exitInsertMode, updateNode, updateNodeSilent, updateManySilent, pushUndoCheckpoint, deleteNode, replaceDocChildren, reorderSelected, reorderChildren, addNode, cloneNodesAtTop, createComponent, unmakeComponent, insertInstance, upsertVariable, removeVariable, renameVariable, setGridSnap, setGridSize, wrapSelectionInFrame, toggleMaskSelected, applyBooleanOp, upsertStyle, removeStyle, applyStyleToSelection, setActiveTool, beginEditing, endEditing, beginPathEditing, endPathEditing, selectedNode, exportPen, undo, redo, canUndo, canRedo }),
    [state, selectNode, selectMultiple, toggleSelectNode, enterInsertMode, exitInsertMode, updateNode, updateNodeSilent, updateManySilent, pushUndoCheckpoint, deleteNode, replaceDocChildren, reorderSelected, reorderChildren, addNode, cloneNodesAtTop, createComponent, unmakeComponent, insertInstance, upsertVariable, removeVariable, renameVariable, setGridSnap, setGridSize, wrapSelectionInFrame, toggleMaskSelected, applyBooleanOp, upsertStyle, removeStyle, applyStyleToSelection, setActiveTool, beginEditing, endEditing, beginPathEditing, endPathEditing, selectedNode, exportPen, undo, redo, canUndo, canRedo],
  );

  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorCtx);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
