/**
 * ノードをクリック選択、ドラッグ移動、リサイズ可能にするラッパー。
 */

import { useCallback, useRef, useState } from 'react';
import type { PenNode } from '../types';
import { useEditor } from '../state/EditorContext';
import { computeSnap, computeResizeSnap, computeEqualSpaceSnap, type SnapGuide, type SnapRect, type EqualSpaceGuide } from '../state/snapEngine';
import { applyConstraints, type ChildGeom } from '../layout/constraints';
import type { NodeConstraints } from '../types';

interface Props {
  node: PenNode;
  children: React.ReactNode;
}

const HANDLE_SIZE = 8;

export function SelectableNode({ node, children }: Props) {
  const { state, selectNode, toggleSelectNode, updateNodeSilent, updateManySilent, pushUndoCheckpoint, beginEditing, cloneNodesAtTop } = useEditor();
  const isLocked = (node as { locked?: boolean }).locked === true;
  const isSelected = state.selectedNodeId === node.id && !isLocked;
  const isMultiSelected = state.selectedNodeIds.has(node.id) && !isLocked;
  const isEditing = state.editingNodeId === node.id;
  const isDragging = useRef(false);
  const isResizing = useRef<string | null>(null);
  const isRotating = useRef(false);
  const isRadiusing = useRef(false);
  /** ドラッグ中ラベル表示用のモード。null / 'drag' / 'resize' / 'rotate' / 'radius' */
  const [activityLabel, setActivityLabel] = useState<'drag' | 'resize' | 'rotate' | 'radius' | null>(null);
  const radiusStart = useRef({ radius: 0, cornerX: 0, cornerY: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const nodeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  /** 回転時: 開始角度（度）とピボット（SVG 座標） */
  const rotateStart = useRef({ startAngle: 0, originalRotation: 0, pivotSvg: { x: 0, y: 0 } });
  /** マルチ選択ドラッグ時、選択全ノードの開始 x,y,w,h */
  const multiStart = useRef<Array<{ id: string; x0: number; y0: number; w: number; h: number }>>([]);
  /** リサイズ時、この node の直接の子の開始 geom + constraints（frame のみ） */
  const childrenStart = useRef<Array<{ id: string; x: number; y: number; w: number; h: number; constraints?: NodeConstraints }>>([]);

  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof (node as { width?: unknown }).width === 'number'
    ? ((node as { width: number }).width)
    : 0;
  const height = typeof (node as { height?: unknown }).height === 'number'
    ? ((node as { height: number }).height)
    : 0;
  // NodeBase.rotation(度)を SVG rotate(angle, cx, cy) で適用。
  // ピボットはノード自身の中心 (x+w/2, y+h/2)。
  // 子孫レンダラ(Frame の translate(x, y) など)はこの回転の内側にあるため、
  // 自動的に正しい位置で回転する。選択枠/ハンドルも一緒に回るので追加の補正は不要。
  const rotation = (node as { rotation?: number }).rotation ?? 0;
  const groupTransform =
    rotation !== 0 && width > 0 && height > 0
      ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})`
      : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging.current || isResizing.current) return;
    if (isLocked) return; // ロック中のノードは選択できない
    // Inner-first: stopPropagation so the deepest (innermost) node wins.
    // SVG bubble order: innermost → outermost. We stop at the first handler.
    e.stopPropagation();
    if (e.shiftKey) {
      toggleSelectNode(node.id);
    } else {
      selectNode(node.id);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // テキストノードのみダブルクリックでインライン編集
    if (node.type !== 'text' || isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    beginEditing(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('pencil-context-menu', {
        detail: { nodeId: node.id, x: e.clientX, y: e.clientY },
      }),
    );
  };

  // Tooltip text: "name (type) — W×H"
  const tooltipName = node.name ?? node.id;
  const tooltipText =
    width > 0 && height > 0
      ? `${tooltipName} (${node.type}) — ${Math.round(width)}×${Math.round(height)}`
      : `${tooltipName} (${node.type})`;

  // Convert screen delta to SVG delta using the SVG's CTM
  const screenToSvgDelta = useCallback((dx: number, dy: number, svg: SVGSVGElement) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { dx, dy };
    return { dx: dx / ctm.a, dy: dy / ctm.d };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, handle?: string) => {
      if (!isSelected && !isMultiSelected) return;
      e.stopPropagation();
      e.preventDefault();

      // Undo チェックポイント: ドラッグ開始時に1回だけ
      pushUndoCheckpoint();

      if (handle === 'radius') {
        const svg = (e.target as SVGElement).closest('svg') as SVGSVGElement | null;
        const ctm = svg?.getScreenCTM();
        const cornerClientX = ctm ? ctm.a * x + ctm.e : 0;
        const cornerClientY = ctm ? ctm.d * y + ctm.f : 0;
        const rNow = typeof (node as { cornerRadius?: unknown }).cornerRadius === 'number'
          ? (node as { cornerRadius: number }).cornerRadius
          : 0;
        isRadiusing.current = true;
        radiusStart.current = { radius: rNow, cornerX: cornerClientX, cornerY: cornerClientY };
        dragStart.current = { x: e.clientX, y: e.clientY };
        setActivityLabel('radius');
        (e.target as SVGElement).setPointerCapture(e.pointerId);
        return;
      }
      if (handle === 'rotate') {
        // 回転開始: ピボット(中心)からカーソルへの角度を基準に
        const svg = (e.target as SVGElement).closest('svg') as SVGSVGElement | null;
        const ctm = svg?.getScreenCTM();
        const pivotClientX = ctm ? ctm.a * (x + width / 2) + ctm.e : 0;
        const pivotClientY = ctm ? ctm.d * (y + height / 2) + ctm.f : 0;
        const startAngle = Math.atan2(e.clientY - pivotClientY, e.clientX - pivotClientX) * (180 / Math.PI);
        isRotating.current = true;
        rotateStart.current = {
          startAngle,
          originalRotation: rotation,
          pivotSvg: { x: pivotClientX, y: pivotClientY },
        };
        setActivityLabel('rotate');
        (e.target as SVGElement).setPointerCapture(e.pointerId);
        return;
      }
      if (handle) {
        isResizing.current = handle;
        setActivityLabel('resize');
        // frame / group リサイズ時: layout='none' の direct children をスナップショット
        if (node.type === 'frame' || node.type === 'group') {
          const layout = (node as { layout?: string }).layout ?? (node.type === 'group' ? 'none' : 'horizontal');
          const children = (node as { children?: PenNode[] }).children ?? [];
          if (layout === 'none' && children.length > 0) {
            childrenStart.current = children
              .map((c) => {
                const cw = typeof (c as { width?: unknown }).width === 'number' ? (c as { width: number }).width : 0;
                const ch = typeof (c as { height?: unknown }).height === 'number' ? (c as { height: number }).height : 0;
                if (cw <= 0 || ch <= 0) return null;
                return {
                  id: c.id,
                  x: c.x ?? 0,
                  y: c.y ?? 0,
                  w: cw,
                  h: ch,
                  constraints: (c as { constraints?: NodeConstraints }).constraints,
                };
              })
              .filter((r): r is NonNullable<typeof r> => r !== null);
          } else {
            childrenStart.current = [];
          }
        } else {
          childrenStart.current = [];
        }
      } else {
        isDragging.current = true;
        setActivityLabel('drag');
      }
      dragStart.current = { x: e.clientX, y: e.clientY };
      nodeStart.current = { x, y, w: width, h: height };

      // Alt+ドラッグ: 選択ノード（単一/複数）をクローン → クローン側をドラッグ対象に
      if (!handle && e.altKey) {
        const ids =
          state.selectedNodeIds.size > 0 && state.selectedNodeIds.has(node.id)
            ? Array.from(state.selectedNodeIds)
            : [node.id];
        const clones = cloneNodesAtTop(ids);
        if (clones.length > 0) {
          multiStart.current = clones;
          // クローンの代表として nodeStart を先頭クローンに合わせる（単一経路フォールバック用）
          nodeStart.current = { x: clones[0].x0, y: clones[0].y0, w: clones[0].w, h: clones[0].h };
          (e.target as SVGElement).setPointerCapture(e.pointerId);
          return;
        }
      }

      // マルチ選択ドラッグの準備: selectedNodeIds に含まれる全トップレベルノードの開始座標を記録
      if (!handle && state.selectedNodeIds.size > 1 && state.selectedNodeIds.has(node.id)) {
        multiStart.current = state.doc.children
          .filter((n) => state.selectedNodeIds.has(n.id))
          .map((n) => ({
            id: n.id,
            x0: n.x ?? 0,
            y0: n.y ?? 0,
            w: typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : 0,
            h: typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : 0,
          }));
      } else {
        multiStart.current = [];
      }

      (e.target as SVGElement).setPointerCapture(e.pointerId);
    },
    [isSelected, isMultiSelected, x, y, width, height, rotation, pushUndoCheckpoint, cloneNodesAtTop, state.doc.children, state.selectedNodeIds, node.id, node.type],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current && !isResizing.current && !isRotating.current && !isRadiusing.current) return;
      const svg = (e.target as SVGElement).closest('svg') as SVGSVGElement | null;
      if (!svg) return;

      // --- 角丸ハンドル ---
      if (isRadiusing.current) {
        const ctm = svg.getScreenCTM();
        const svgPerPx = ctm ? 1 / ctm.a : 1;
        // コーナーからカーソルまでの距離（左上から右下方向に移動するほど radius 増）
        const dxPx = e.clientX - radiusStart.current.cornerX;
        const dyPx = e.clientY - radiusStart.current.cornerY;
        // x,y どちらかの小さい方を radius にすると対角線で自然
        const delta = Math.min(Math.abs(dxPx), Math.abs(dyPx)) * svgPerPx;
        const maxR = Math.min(width, height) / 2;
        const nextR = Math.max(0, Math.min(maxR, Math.round(delta)));
        updateNodeSilent(node.id, { cornerRadius: nextR } as Partial<PenNode>);
        return;
      }

      // --- 回転 ---
      if (isRotating.current) {
        const pivot = rotateStart.current.pivotSvg;
        const currentAngle = Math.atan2(e.clientY - pivot.y, e.clientX - pivot.x) * (180 / Math.PI);
        let nextRotation = rotateStart.current.originalRotation + (currentAngle - rotateStart.current.startAngle);
        // Shift で 15 度スナップ
        if (e.shiftKey) {
          nextRotation = Math.round(nextRotation / 15) * 15;
        }
        // -180〜180 に正規化
        nextRotation = ((nextRotation + 540) % 360) - 180;
        updateNodeSilent(node.id, { rotation: Math.round(nextRotation * 10) / 10 } as Partial<PenNode>);
        return;
      }

      const rawDx = e.clientX - dragStart.current.x;
      const rawDy = e.clientY - dragStart.current.y;
      let { dx, dy } = screenToSvgDelta(rawDx, rawDy, svg);

      // Shift+ドラッグで軸ロック: 大きい方の軸だけ有効化（リサイズは対象外）
      if (e.shiftKey && isDragging.current) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }

      if (isDragging.current) {
        // スナップ: 画面上 6px 相当の閾値を SVG 座標に変換
        const ctm = svg.getScreenCTM();
        const svgUnitsPerPixel = ctm ? 1 / ctm.a : 1;
        const threshold = 6 * svgUnitsPerPixel;

        if (multiStart.current.length >= 1 && (multiStart.current.length > 1 || multiStart.current[0].id !== node.id)) {
          // --- マルチ選択 or Alt+ドラッグ複製（1件でもクローンID側を動かす） ---
          const movingIds = new Set(multiStart.current.map((m) => m.id));
          // 選択セット全体の bounding box（開始位置から delta 適用後）を計算してスナップ
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const m of multiStart.current) {
            const nx = m.x0 + dx;
            const ny = m.y0 + dy;
            minX = Math.min(minX, nx);
            minY = Math.min(minY, ny);
            maxX = Math.max(maxX, nx + m.w);
            maxY = Math.max(maxY, ny + m.h);
          }
          const unionMoving: SnapRect = { id: '__multi__', x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          const statics = state.doc.children
            .filter((n) => !movingIds.has(n.id))
            .map((n) => {
              const nw = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : 0;
              const nh = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : 0;
              if (nw <= 0 || nh <= 0) return null;
              return { id: n.id, x: n.x ?? 0, y: n.y ?? 0, width: nw, height: nh } as SnapRect;
            })
            .filter((r): r is SnapRect => r !== null);
          const snap = computeSnap(unionMoving, statics, threshold);
          const snapDx = snap.x - minX;
          const snapDy = snap.y - minY;

          updateManySilent(
            multiStart.current.map((m) => ({
              nodeId: m.id,
              patch: { x: Math.round(m.x0 + dx + snapDx), y: Math.round(m.y0 + dy + snapDy) } as Partial<PenNode>,
            })),
          );
          window.dispatchEvent(
            new CustomEvent<SnapGuide[]>('pencil-snap-guides', { detail: snap.guides }),
          );
        } else {
          // --- 単一選択ドラッグ ---
          const rawX = nodeStart.current.x + dx;
          const rawY = nodeStart.current.y + dy;
          const staticsRaw = state.doc.children
            .filter((n) => n.id !== node.id)
            .map((n) => {
              const nw = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : 0;
              const nh = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : 0;
              if (nw <= 0 || nh <= 0) return null;
              return { id: n.id, x: n.x ?? 0, y: n.y ?? 0, width: nw, height: nh } as SnapRect;
            })
            .filter((r): r is SnapRect => r !== null);

          const moving: SnapRect = { id: node.id, x: rawX, y: rawY, width: nodeStart.current.w, height: nodeStart.current.h };
          const snap = computeSnap(moving, staticsRaw, threshold);

          // 等間隔スナップ（エッジスナップが効いてない軸のみ補完適用）
          const equal = computeEqualSpaceSnap(
            { id: node.id, x: snap.x, y: snap.y, width: nodeStart.current.w, height: nodeStart.current.h },
            staticsRaw,
            threshold,
          );
          // エッジスナップ優先: エッジガイドが出ている軸は等間隔を適用しない
          const hasVEdge = snap.guides.some((g) => g.orientation === 'v');
          const hasHEdge = snap.guides.some((g) => g.orientation === 'h');
          const finalX = hasVEdge ? snap.x : equal.x;
          const finalY = hasHEdge ? snap.y : equal.y;
          const equalGuides = equal.guides.filter(
            (g) => (g.orientation === 'h' && !hasVEdge) || (g.orientation === 'v' && !hasHEdge),
          );

          updateNodeSilent(node.id, {
            x: Math.round(finalX),
            y: Math.round(finalY),
          } as Partial<PenNode>);

          window.dispatchEvent(
            new CustomEvent<SnapGuide[]>('pencil-snap-guides', { detail: snap.guides }),
          );
          window.dispatchEvent(
            new CustomEvent<EqualSpaceGuide[]>('pencil-equal-space-guides', { detail: equalGuides }),
          );
        }
      } else if (isResizing.current) {
        const h = isResizing.current;
        let newW = nodeStart.current.w;
        let newH = nodeStart.current.h;
        let newX = nodeStart.current.x;
        let newY = nodeStart.current.y;

        if (h.includes('e')) newW = Math.max(1, nodeStart.current.w + dx);
        if (h.includes('s')) newH = Math.max(1, nodeStart.current.h + dy);
        if (h.includes('w')) {
          newW = Math.max(1, nodeStart.current.w - dx);
          newX = nodeStart.current.x + dx;
        }
        if (h.includes('n')) {
          newH = Math.max(1, nodeStart.current.h - dy);
          newY = nodeStart.current.y + dy;
        }

        // Shift+リサイズ: コーナー時に元 w/h 比率を維持
        const isCorner = h.length === 2;
        if (e.shiftKey && isCorner && nodeStart.current.w > 0 && nodeStart.current.h > 0) {
          const ratio = nodeStart.current.w / nodeStart.current.h;
          // width 変化量が大きければ width 優先、でなければ height 優先
          const wChange = Math.abs(newW - nodeStart.current.w);
          const hChange = Math.abs(newH - nodeStart.current.h);
          if (wChange > hChange) {
            const nextH = Math.max(1, newW / ratio);
            // north 側の場合は newY を調整
            if (h.includes('n')) newY = nodeStart.current.y + (nodeStart.current.h - nextH);
            newH = nextH;
          } else {
            const nextW = Math.max(1, newH * ratio);
            if (h.includes('w')) newX = nodeStart.current.x + (nodeStart.current.w - nextW);
            newW = nextW;
          }
        }

        // リサイズ時のスナップ
        const ctm = svg.getScreenCTM();
        const svgUnitsPerPixel = ctm ? 1 / ctm.a : 1;
        const threshold = 6 * svgUnitsPerPixel;
        const staticsRaw = state.doc.children
          .filter((n) => n.id !== node.id)
          .map((n) => {
            const nw = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : 0;
            const nh = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : 0;
            if (nw <= 0 || nh <= 0) return null;
            return { id: n.id, x: n.x ?? 0, y: n.y ?? 0, width: nw, height: nh } as SnapRect;
          })
          .filter((r): r is SnapRect => r !== null);
        const snapped = computeResizeSnap(
          { id: node.id, x: newX, y: newY, width: newW, height: newH },
          staticsRaw,
          h,
          threshold,
        );

        updateNodeSilent(node.id, {
          x: Math.round(snapped.x),
          y: Math.round(snapped.y),
          width: Math.round(snapped.width),
          height: Math.round(snapped.height),
        } as Partial<PenNode>);

        // 子ノードに constraints を適用
        if (childrenStart.current.length > 0) {
          const oldW = nodeStart.current.w;
          const oldH = nodeStart.current.h;
          const patches = childrenStart.current.map((cs) => {
            const geom: ChildGeom = {
              x: cs.x, y: cs.y, width: cs.w, height: cs.h,
              constraints: cs.constraints,
            };
            const r = applyConstraints(geom, oldW, oldH, snapped.width, snapped.height);
            return {
              nodeId: cs.id,
              patch: {
                x: Math.round(r.x),
                y: Math.round(r.y),
                width: Math.round(r.width),
                height: Math.round(r.height),
              } as Partial<PenNode>,
            };
          });
          updateManySilent(patches);
        }

        window.dispatchEvent(
          new CustomEvent<SnapGuide[]>('pencil-snap-guides', { detail: snapped.guides }),
        );
      }
    },
    [node.id, updateNodeSilent, updateManySilent, screenToSvgDelta, state.doc.children],
  );

  const handlePointerUp = useCallback(() => {
    if (isDragging.current || isResizing.current) {
      // ドラッグ/リサイズ終了時にガイドを消去
      window.dispatchEvent(new CustomEvent<SnapGuide[]>('pencil-snap-guides', { detail: [] }));
      window.dispatchEvent(new CustomEvent<EqualSpaceGuide[]>('pencil-equal-space-guides', { detail: [] }));
    }
    isDragging.current = false;
    isResizing.current = null;
    isRotating.current = false;
    isRadiusing.current = false;
    setActivityLabel(null);
  }, []);

  // Resize handle positions
  const handles = isSelected && width > 0 && height > 0
    ? [
        { id: 'nw', cx: x, cy: y, cursor: 'nw-resize' },
        { id: 'ne', cx: x + width, cy: y, cursor: 'ne-resize' },
        { id: 'sw', cx: x, cy: y + height, cursor: 'sw-resize' },
        { id: 'se', cx: x + width, cy: y + height, cursor: 'se-resize' },
      ]
    : [];

  return (
    <g
      transform={groupTransform}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={(isSelected || isMultiSelected) && !isEditing ? (e) => handlePointerDown(e) : undefined}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: isSelected ? 'move' : 'pointer' }}
    >
      <title>{tooltipText}</title>
      {children}

      {/* Multi-selection highlight */}
      {!isSelected && isMultiSelected && width > 0 && height > 0 && (
        <rect
          x={x - 1}
          y={y - 1}
          width={width + 2}
          height={height + 2}
          fill="rgba(79, 70, 229, 0.05)"
          stroke="#818CF8"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          rx={2}
          pointerEvents="none"
        />
      )}
      {/* ドラッグ/リサイズ/回転中のフローティングラベル */}
      {activityLabel && width > 0 && height > 0 && (() => {
        const text =
          activityLabel === 'drag'
            ? `${Math.round(x)}, ${Math.round(y)}`
            : activityLabel === 'resize'
            ? `${Math.round(width)} × ${Math.round(height)}`
            : activityLabel === 'rotate'
            ? `${Math.round(rotation)}°`
            : activityLabel === 'radius'
            ? `r ${typeof (node as { cornerRadius?: unknown }).cornerRadius === 'number' ? (node as { cornerRadius: number }).cornerRadius : 0}`
            : '';
        const padding = 6;
        // テキスト長に応じてバッジ幅を概算
        const charW = 7;
        const boxW = text.length * charW + padding * 2;
        const boxH = 18;
        const cx = x + width / 2 - boxW / 2;
        const cy = y + height + 8;
        return (
          <g pointerEvents="none">
            <rect
              x={cx}
              y={cy}
              width={boxW}
              height={boxH}
              rx={3}
              fill="#4F46E5"
              opacity={0.95}
            />
            <text
              x={cx + boxW / 2}
              y={cy + boxH / 2 + 4}
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fontWeight={600}
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {text}
            </text>
          </g>
        );
      })()}
      {/* Selection outline (pointerEvents=none so children stay clickable) */}
      {isSelected && width > 0 && height > 0 && (
        <>
          <rect
            x={x - 1}
            y={y - 1}
            width={width + 2}
            height={height + 2}
            fill="none"
            stroke="#4F46E5"
            strokeWidth={2}
            rx={2}
            pointerEvents="none"
          />
          {/* Resize handles */}
          {handles.map((h) => (
            <rect
              key={h.id}
              x={h.cx - HANDLE_SIZE / 2}
              y={h.cy - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              fill="#FFFFFF"
              stroke="#4F46E5"
              strokeWidth={1.5}
              rx={2}
              style={{ cursor: h.cursor }}
              onPointerDown={(e) => handlePointerDown(e, h.id)}
            />
          ))}
          {/* 角丸ハンドル: rectangle / frame / image のみ。左上の内側に小さなオレンジ丸。*/}
          {(node.type === 'rectangle' || node.type === 'frame' || node.type === 'image') &&
            width > 20 &&
            height > 20 && (() => {
              const rNow = typeof (node as { cornerRadius?: unknown }).cornerRadius === 'number'
                ? (node as { cornerRadius: number }).cornerRadius
                : 0;
              const offset = Math.max(10, rNow);
              return (
                <circle
                  cx={x + offset}
                  cy={y + offset}
                  r={4}
                  fill="#F97316"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  style={{ cursor: 'nwse-resize' }}
                  onPointerDown={(e) => handlePointerDown(e, 'radius')}
                >
                  <title>Corner radius: {rNow}</title>
                </circle>
              );
            })()}
          {/* Rotation handle: top-center から 16px 上に円 */}
          <line
            x1={x + width / 2}
            y1={y}
            x2={x + width / 2}
            y2={y - 18}
            stroke="#4F46E5"
            strokeWidth={1}
            pointerEvents="none"
          />
          <circle
            cx={x + width / 2}
            cy={y - 22}
            r={HANDLE_SIZE / 2 + 1}
            fill="#FFFFFF"
            stroke="#4F46E5"
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => handlePointerDown(e, 'rotate')}
          >
            <title>Rotate (Shift = 15°スナップ)</title>
          </circle>
        </>
      )}
    </g>
  );
}
