/**
 * ペンツール: クリックでアンカーを追加、ドラッグで bezier ハンドル、
 * 初期点クリック or Enter / ダブルクリックで path ノードを確定する。
 *
 * 状態遷移（activeTool === 'pen' のとき）:
 *   idle
 *     └─ pointer-down on canvas → 最初のアンカーを置き、outgoing handle 追跡開始
 *        └─ pointer-up (drag無し) → そのアンカーはコーナー（handle なし）
 *        └─ pointer-up (drag有り) → outgoing handle を決定 (inHandle を対称位置)
 *     → drawing (anchors: 1)
 *   drawing
 *     └─ pointer-down → 新アンカー追加、inHandle は前アンカーの outHandle 反対側
 *        └─ drag → 新アンカーの outHandle 作成
 *     └─ Enter / Escape / 先頭アンカー click → 確定 (Enter/Esc=open, 先頭click=closed)
 *
 * 確定時: anchors の bbox 左上を x,y、幅/高さを width/height にして
 *   path ノードを EditorContext に追加。geometry (d) はローカル座標系に平行移動済。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';
import { anchorsBBox, buildPathD, type PathAnchor } from '../../pen/renderer/buildPath';

interface Props {
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** 現在の SVG scale（アンカーのサイズ計算用） */
  svgScale: number;
}

function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return { x: (clientX - ctm.e) / ctm.a, y: (clientY - ctm.f) / ctm.d };
}

const CLOSE_SNAP_PX = 8; // 先頭アンカーに近づいたら閉じるヒントを出す閾値

export function PenToolCreator({ svgRef, svgScale }: Props) {
  const { state, addNode, setActiveTool } = useEditor();
  const active = state.activeTool === 'pen';

  const [anchors, setAnchors] = useState<PathAnchor[]>([]);
  /** 現在ドラッグ中の outgoing handle 位置（undefined = ドラッグしていない） */
  const [dragHandle, setDragHandle] = useState<{ x: number; y: number } | null>(null);
  /** マウスのホバー位置（次セグメントのゴースト用） */
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const pointerDown = useRef(false);

  // ツール抜ける時に state リセット
  useEffect(() => {
    if (!active) {
      setAnchors([]);
      setDragHandle(null);
      setHover(null);
      pointerDown.current = false;
    }
  }, [active]);

  // 確定して path ノードを作成
  const commit = useCallback((closed: boolean) => {
    if (anchors.length < 2) {
      setAnchors([]);
      setDragHandle(null);
      setHover(null);
      return;
    }
    const bbox = anchorsBBox(anchors);
    // 原点を bbox 左上に揃えてローカル座標化
    const localized = anchors.map((a) => ({
      position: { x: a.position.x - bbox.x, y: a.position.y - bbox.y },
      inHandle: a.inHandle ? { x: a.inHandle.x - bbox.x, y: a.inHandle.y - bbox.y } : undefined,
      outHandle: a.outHandle ? { x: a.outHandle.x - bbox.x, y: a.outHandle.y - bbox.y } : undefined,
    }));
    const d = buildPathD(localized, closed);
    const id = `path_${Date.now()}`;
    const node = {
      type: 'path' as const,
      id,
      name: id,
      x: Math.round(bbox.x),
      y: Math.round(bbox.y),
      width: Math.max(1, Math.round(bbox.width)),
      height: Math.max(1, Math.round(bbox.height)),
      geometry: d,
      fill: closed ? '#E5E7EB' : 'none',
      stroke: { thickness: 2, fill: '#111827' },
    } as PenNode;
    addNode(node);
    // ツールは select に戻す (Figma 的 UX)
    setAnchors([]);
    setDragHandle(null);
    setHover(null);
    setActiveTool('select');
  }, [anchors, addNode, setActiveTool]);

  // pointerdown: アンカー追加 or 先頭クリックで閉じる
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (!active) return;
    if (e.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    if (
      e.clientX < svgRect.left || e.clientX > svgRect.right ||
      e.clientY < svgRect.top || e.clientY > svgRect.bottom
    ) return;
    // 背景のみ反応
    const target = e.target as Element;
    const tag = target.tagName.toLowerCase();
    const isBackground =
      tag === 'svg' ||
      (tag === 'rect' && target.getAttribute('fill') === 'transparent') ||
      target.classList.contains('pen-tool__anchor-hit');
    if (!isBackground) return;

    e.preventDefault();
    e.stopPropagation();

    const pt = screenToSvg(svg, e.clientX, e.clientY);
    // 先頭アンカーに近ければ閉じて確定
    if (anchors.length >= 2) {
      const first = anchors[0].position;
      const scale = Math.max(svgScale, 0.001);
      const snapSvg = CLOSE_SNAP_PX / scale;
      if (Math.hypot(pt.x - first.x, pt.y - first.y) <= snapSvg) {
        commit(true);
        return;
      }
    }

    setAnchors((prev) => [...prev, { position: pt }]);
    setDragHandle({ x: pt.x, y: pt.y });
    pointerDown.current = true;
  }, [active, svgRef, svgScale, anchors, commit]);

  // pointermove: ドラッグ中なら outgoing handle 更新、そうでなければ hover
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!active) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = screenToSvg(svg, e.clientX, e.clientY);
    if (pointerDown.current) {
      setDragHandle(pt);
    } else {
      setHover(pt);
    }
  }, [active, svgRef]);

  // pointerup: drag によって outgoing handle 確定 or コーナー
  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!active) return;
    if (!pointerDown.current) return;
    pointerDown.current = false;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = screenToSvg(svg, e.clientX, e.clientY);

    setAnchors((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const moved = Math.hypot(pt.x - last.position.x, pt.y - last.position.y);
      if (moved < 2) {
        // ほぼクリック → コーナーアンカー（handle なし）
        return prev;
      }
      // drag 有り: outHandle = 現在の pt、inHandle = 対称位置（smooth anchor）
      const next = [...prev];
      next[next.length - 1] = {
        ...last,
        outHandle: { x: pt.x, y: pt.y },
        inHandle: { x: last.position.x * 2 - pt.x, y: last.position.y * 2 - pt.y },
      };
      return next;
    });
    setDragHandle(null);
  }, [active, svgRef]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [active, handlePointerDown, handlePointerMove, handlePointerUp]);

  // Enter で確定（open path）、Esc でキャンセル
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setAnchors([]);
        setDragHandle(null);
        setHover(null);
        setActiveTool('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, commit, setActiveTool]);

  if (!active) return null;

  // プレビュー描画: 完成までの d、アンカー、ハンドル、次セグメントのゴースト
  const inprog = [...anchors];
  // ドラッグ中なら最後のアンカーの outHandle を一時的にあてがう
  if (dragHandle && inprog.length > 0) {
    const last = inprog[inprog.length - 1];
    inprog[inprog.length - 1] = {
      ...last,
      outHandle: { x: dragHandle.x, y: dragHandle.y },
      inHandle: { x: last.position.x * 2 - dragHandle.x, y: last.position.y * 2 - dragHandle.y },
    };
  }
  const confirmedD = buildPathD(inprog, false);

  // ゴースト（hover 位置への次セグメント）
  let ghostD = '';
  if (hover && inprog.length >= 1 && !pointerDown.current) {
    const last = inprog[inprog.length - 1];
    const ghost: PathAnchor[] = [last, { position: hover }];
    ghostD = buildPathD(ghost, false);
  }

  const anchorR = 4 / Math.max(svgScale, 0.001);
  const anchorHitR = 10 / Math.max(svgScale, 0.001);
  const sw = 1.5 / Math.max(svgScale, 0.001);
  const handleR = 3 / Math.max(svgScale, 0.001);

  return (
    <g pointerEvents="none">
      {/* ゴースト次セグメント */}
      {ghostD && (
        <path d={ghostD} stroke="#4F46E5" strokeOpacity={0.5} strokeDasharray={`${3 / svgScale} ${3 / svgScale}`} strokeWidth={sw} fill="none" />
      )}
      {/* 確定済み path */}
      {confirmedD && (
        <path d={confirmedD} stroke="#4F46E5" strokeWidth={sw} fill="none" />
      )}
      {/* アンカーとハンドル */}
      {inprog.map((a, i) => (
        <g key={i}>
          {a.inHandle && (
            <>
              <line x1={a.position.x} y1={a.position.y} x2={a.inHandle.x} y2={a.inHandle.y}
                stroke="#4F46E5" strokeWidth={sw * 0.6} strokeOpacity={0.7} />
              <circle cx={a.inHandle.x} cy={a.inHandle.y} r={handleR} fill="#4F46E5" />
            </>
          )}
          {a.outHandle && (
            <>
              <line x1={a.position.x} y1={a.position.y} x2={a.outHandle.x} y2={a.outHandle.y}
                stroke="#4F46E5" strokeWidth={sw * 0.6} strokeOpacity={0.7} />
              <circle cx={a.outHandle.x} cy={a.outHandle.y} r={handleR} fill="#4F46E5" />
            </>
          )}
          <circle
            cx={a.position.x}
            cy={a.position.y}
            r={anchorR}
            fill="#FFFFFF"
            stroke="#4F46E5"
            strokeWidth={sw}
          />
          {/* 大きめの透明ヒット領域 (先頭アンカーに戻れるように。背景 rect 扱いで pointerdown 検出) */}
          {i === 0 && anchors.length >= 2 && (
            <rect
              x={a.position.x - anchorHitR}
              y={a.position.y - anchorHitR}
              width={anchorHitR * 2}
              height={anchorHitR * 2}
              fill="transparent"
              className="pen-tool__anchor-hit"
              pointerEvents="all"
            />
          )}
        </g>
      ))}
    </g>
  );
}
