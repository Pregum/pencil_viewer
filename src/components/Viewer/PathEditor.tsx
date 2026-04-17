/**
 * path ノードの編集モード。path 上のアンカー / ハンドルをドラッグで編集、
 * Alt+クリックでアンカー削除、セグメント上クリックで新規アンカー追加。
 * Esc で終了。
 *
 * - geometry (d) をパースして PathAnchor[] に、編集後は buildPathD で書き戻す。
 * - path の x/y/width/height も bbox 基準で再計算（キャンバス上の位置を保持）。
 * - 未対応 (H/V/S/Q/A 等) の path は編集不可のヒントを出す。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode, PathNode } from '../../pen/types';
import { anchorsBBox, buildPathD, parsePathD, type PathAnchor } from '../../pen/renderer/buildPath';

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
  svgScale: number;
}

function findNode(nodes: PenNode[], id: string): PenNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const f = findNode((n as { children: PenNode[] }).children, id);
      if (f) return f;
    }
  }
  return null;
}

function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return { x: (clientX - ctm.e) / ctm.a, y: (clientY - ctm.f) / ctm.d };
}

type HandleTarget =
  | { kind: 'anchor'; index: number }
  | { kind: 'in'; index: number }
  | { kind: 'out'; index: number };

export function PathEditor({ svgRef, svgScale }: Props) {
  const { state, updateNodeSilent, pushUndoCheckpoint, endPathEditing } = useEditor();
  const editingId = state.editingPathId;
  const node = editingId ? findNode(state.doc.children, editingId) : null;
  const pathNode = node?.type === 'path' ? (node as PathNode) : null;

  // geometry → ワールド座標アンカー配列
  const parsed = useMemo(() => {
    if (!pathNode || !pathNode.geometry) return null;
    const p = parsePathD(pathNode.geometry);
    if (!p) return null;
    // ローカル座標 → ワールド（path の x,y を加算）
    const ox = pathNode.x ?? 0;
    const oy = pathNode.y ?? 0;
    return {
      closed: p.closed,
      anchors: p.anchors.map((a) => ({
        position: { x: a.position.x + ox, y: a.position.y + oy },
        inHandle: a.inHandle ? { x: a.inHandle.x + ox, y: a.inHandle.y + oy } : undefined,
        outHandle: a.outHandle ? { x: a.outHandle.x + ox, y: a.outHandle.y + oy } : undefined,
      })),
    };
  }, [pathNode]);

  const [drag, setDrag] = useState<HandleTarget | null>(null);
  const lastAnchors = useRef<PathAnchor[] | null>(null);

  // ワールド座標アンカーを path ノードに書き戻す
  const persist = useCallback((anchors: PathAnchor[], closed: boolean) => {
    if (!pathNode) return;
    const bbox = anchorsBBox(anchors);
    const localized = anchors.map((a) => ({
      position: { x: a.position.x - bbox.x, y: a.position.y - bbox.y },
      inHandle: a.inHandle ? { x: a.inHandle.x - bbox.x, y: a.inHandle.y - bbox.y } : undefined,
      outHandle: a.outHandle ? { x: a.outHandle.x - bbox.x, y: a.outHandle.y - bbox.y } : undefined,
    }));
    const d = buildPathD(localized, closed);
    updateNodeSilent(pathNode.id, {
      x: Math.round(bbox.x),
      y: Math.round(bbox.y),
      width: Math.max(1, Math.round(bbox.width)),
      height: Math.max(1, Math.round(bbox.height)),
      geometry: d,
    } as Partial<PathNode> as Partial<PenNode>);
  }, [pathNode, updateNodeSilent]);

  // ドラッグ処理
  useEffect(() => {
    if (!drag || !pathNode || !parsed) return;
    const svg = svgRef.current;
    if (!svg) return;
    let moved = false;
    const working: PathAnchor[] = parsed.anchors.map((a) => ({
      position: { ...a.position },
      inHandle: a.inHandle ? { ...a.inHandle } : undefined,
      outHandle: a.outHandle ? { ...a.outHandle } : undefined,
    }));

    const onMove = (e: PointerEvent) => {
      const pt = screenToSvg(svg, e.clientX, e.clientY);
      const a = working[drag.index];
      if (!a) return;
      if (drag.kind === 'anchor') {
        // アンカー全体を移動（ハンドルも一緒にシフト）
        const dx = pt.x - a.position.x;
        const dy = pt.y - a.position.y;
        a.position = pt;
        if (a.inHandle) a.inHandle = { x: a.inHandle.x + dx, y: a.inHandle.y + dy };
        if (a.outHandle) a.outHandle = { x: a.outHandle.x + dx, y: a.outHandle.y + dy };
      } else if (drag.kind === 'in') {
        a.inHandle = pt;
        // Shift 押してない時は対称 (smooth anchor)
        if (!e.shiftKey) {
          a.outHandle = { x: a.position.x * 2 - pt.x, y: a.position.y * 2 - pt.y };
        }
      } else if (drag.kind === 'out') {
        a.outHandle = pt;
        if (!e.shiftKey) {
          a.inHandle = { x: a.position.x * 2 - pt.x, y: a.position.y * 2 - pt.y };
        }
      }
      moved = true;
      persist(working, parsed.closed);
    };

    const onUp = () => {
      if (moved) lastAnchors.current = working;
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, parsed, pathNode, svgRef, persist]);

  // Esc で終了、Delete で選択アンカー削除は未実装（MVP）
  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        endPathEditing();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, endPathEditing]);

  if (!pathNode || !parsed) return null;

  const anchorR = 5 / Math.max(svgScale, 0.001);
  const handleR = 3.5 / Math.max(svgScale, 0.001);
  const sw = 1.5 / Math.max(svgScale, 0.001);

  const handlePointerDown = (target: HandleTarget) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    pushUndoCheckpoint();
    setDrag(target);
  };

  // Alt+クリックでアンカー削除
  const handleAnchorClick = (idx: number) => (e: React.MouseEvent) => {
    if (!e.altKey) return;
    if (parsed.anchors.length <= 2) return; // 最低 2 つは残す
    e.stopPropagation();
    e.preventDefault();
    pushUndoCheckpoint();
    const next = parsed.anchors.filter((_, i) => i !== idx);
    persist(next, parsed.closed);
  };

  return (
    <g>
      {/* アンカー間の "ゴースト" 選択ストローク（編集中の視認性用） */}
      {parsed.anchors.length >= 2 && (
        <path
          d={buildPathD(parsed.anchors, parsed.closed)}
          stroke="#4F46E5"
          strokeWidth={sw}
          strokeDasharray={`${3 / svgScale} ${3 / svgScale}`}
          fill="none"
          pointerEvents="none"
        />
      )}

      {parsed.anchors.map((a, i) => (
        <g key={i}>
          {/* ハンドル line */}
          {a.inHandle && (
            <>
              <line
                x1={a.position.x}
                y1={a.position.y}
                x2={a.inHandle.x}
                y2={a.inHandle.y}
                stroke="#4F46E5"
                strokeOpacity={0.7}
                strokeWidth={sw * 0.6}
                pointerEvents="none"
              />
              <circle
                cx={a.inHandle.x}
                cy={a.inHandle.y}
                r={handleR}
                fill="#4F46E5"
                style={{ cursor: 'grab' }}
                onPointerDown={handlePointerDown({ kind: 'in', index: i })}
              />
            </>
          )}
          {a.outHandle && (
            <>
              <line
                x1={a.position.x}
                y1={a.position.y}
                x2={a.outHandle.x}
                y2={a.outHandle.y}
                stroke="#4F46E5"
                strokeOpacity={0.7}
                strokeWidth={sw * 0.6}
                pointerEvents="none"
              />
              <circle
                cx={a.outHandle.x}
                cy={a.outHandle.y}
                r={handleR}
                fill="#4F46E5"
                style={{ cursor: 'grab' }}
                onPointerDown={handlePointerDown({ kind: 'out', index: i })}
              />
            </>
          )}
          {/* アンカー本体 */}
          <rect
            x={a.position.x - anchorR}
            y={a.position.y - anchorR}
            width={anchorR * 2}
            height={anchorR * 2}
            fill="#FFFFFF"
            stroke="#4F46E5"
            strokeWidth={sw}
            style={{ cursor: 'move' }}
            onPointerDown={handlePointerDown({ kind: 'anchor', index: i })}
            onClick={handleAnchorClick(i)}
          >
            <title>
              Drag to move / Alt+click to delete
            </title>
          </rect>
        </g>
      ))}
    </g>
  );
}
