import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PenDocument, PenNode } from '../../pen/types';
import { computeViewBox, type ViewBox } from '../../pen/renderer/viewBox';
import { CanvasContent } from './CanvasContent';
import { ShortcutsDialog } from './ShortcutsDialog';
import { FrameSearch } from './FrameSearch';
import { EditorProvider, useEditor as useEditorInternal } from '../../pen/state/EditorContext';
import { PropertyPanel } from './PropertyPanel';
import { ExportButton } from './ExportButton';
import { AutoIdDialog } from './AutoIdDialog';
import { type Command } from './CommandPalette';
import { CommandPaletteWrapper } from './CommandPaletteWrapper';
import { NodeTree } from './NodeTree';
import { VimTextObjects } from './VimTextObjects';
import { ZoomToSelected } from './ZoomToSelected';
import { HintLabels } from './HintLabels';
import { NudgeHandler } from './NudgeHandler';
import { MarqueeSelect } from './MarqueeSelect';
import { EditAnimation } from './EditAnimation';
import { UIStatesPanel } from './UIStatesPanel';
import { CollabBar } from './CollabBar';
import { useCollab } from '../../collab/useCollab';
import { useBridge } from '../../collab/useBridge';
import { ContextMenu } from './ContextMenu';
import { AIReviewPanel } from './AIReviewPanel';
import { isAIReviewEnabled } from '../../utils/aiReview';
import { AIGeneratorPanel } from './AIGeneratorPanel';
import { isAIGenerateEnabled } from '../../utils/aiGenerate';
import { FloatingTextToolbar } from './FloatingTextToolbar';
import { ImageDropHandler } from './ImageDropHandler';
import { FindReplaceDialog } from './FindReplaceDialog';
import { VariablesPanel } from './VariablesPanel';
import { GridSnapToggle } from './GridSnapToggle';
import { ZoomInput } from './ZoomInput';
import { Toolbar } from './Toolbar';
import { ShapeCreator } from './ShapeCreator';
import { ToolShortcuts } from './ToolShortcuts';
import { SnapGuides } from './SnapGuides';
import { DistanceMeasure } from './DistanceMeasure';
import { AlignToolbar } from './AlignToolbar';
import { Rulers } from './Rulers';
import { PagesPanel } from './PagesPanel';
import { ComponentsPanel } from './ComponentsPanel';

const MIN_SCALE = 0.05;
const MAX_SCALE = 64;
const ZOOM_SENSITIVITY = 0.005;
const FRAME_PADDING_RATIO = 0.1; // 10% padding around frame when zooming to it

/** Collect all frame/group nodes with absolute bounds */
export interface FrameEntry {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function collectFrames(nodes: PenNode[]): FrameEntry[] {
  const result: FrameEntry[] = [];
  for (const node of nodes) {
    if (node.type === 'frame' || node.type === 'group') {
      const w = typeof node.width === 'number' ? node.width : 0;
      const h = typeof node.height === 'number' ? node.height : 0;
      if (w > 0 && h > 0) {
        result.push({
          id: node.id,
          name: node.name ?? node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          width: w,
          height: h,
        });
      }
    }
  }
  return result;
}

/**
 * Camera state: we track a "camera" viewBox in SVG coordinate space.
 * The SVG viewBox is set to this camera, so the browser re-renders
 * the vector art at full resolution at any zoom level.
 */
interface Camera {
  cx: number; // center x in SVG coords
  cy: number; // center y in SVG coords
  /** How many SVG units fit in the viewport width */
  svgWidth: number;
}

interface HistoryEntry {
  camera: Camera;
  activeFrameId: string | null;
}

function VimBadge() {
  const { state } = useEditorInternal();
  return (
    <div className={`viewer__vim-badge ${state.insertMode ? 'viewer__vim-badge--insert' : ''}`}>
      {state.insertMode ? '-- INSERT --' : '-- NORMAL --'}
    </div>
  );
}

export function PenViewer({ doc, rawDoc }: { doc: PenDocument; rawDoc?: PenDocument }) {
  const baseVb = computeViewBox(doc);
  const frames = useMemo(() => collectFrames(doc.children), [doc]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // P2P Collab
  const { collab, createRoom, disconnect, getRoomUrl } = useCollab();
  const { bridge, connectBridge, disconnectBridge } = useBridge();

  // Camera in SVG coordinate space
  const [camera, setCamera] = useState<Camera>(() => ({
    cx: baseVb.x + baseVb.width / 2,
    cy: baseVb.y + baseVb.height / 2,
    svgWidth: baseVb.width,
  }));

  const isPanning = useRef(false);
  const isSpaceHeld = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const cameraStart = useRef<Camera>(camera);

  // Touch: 複数指の追跡とピンチズーム状態
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<{
    startDist: number;
    startCenter: { x: number; y: number };
    cameraStart: Camera;
  } | null>(null);

  // Active frame highlight
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);

  // Navigation history
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFrameSearch, setShowFrameSearch] = useState(false);
  const [showAutoId, setShowAutoId] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showUIStates, setShowUIStates] = useState(false);
  const [showAIReview, setShowAIReview] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [vimMode, setVimMode] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [showPages, setShowPages] = useState(true);
  const [showComponents, setShowComponents] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [presentIdx, setPresentIdx] = useState(0);
  const [clientSize, setClientSize] = useState({ width: 0, height: 0 });

  // Compute the actual viewBox from camera
  const getViewBox = useCallback((): ViewBox => {
    const el = containerRef.current;
    const aspect = el ? el.clientWidth / el.clientHeight : 16 / 9;
    const svgHeight = camera.svgWidth / aspect;
    return {
      x: camera.cx - camera.svgWidth / 2,
      y: camera.cy - svgHeight / 2,
      width: camera.svgWidth,
      height: svgHeight,
    };
  }, [camera]);

  const currentVb = getViewBox();
  const scale = baseVb.width / camera.svgWidth;
  const zoomPercent = Math.round(scale * 100);

  // Push current state to history
  const pushHistory = useCallback(
    (frameId: string | null) => {
      const entry: HistoryEntry = { camera: { ...camera }, activeFrameId: frameId };
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), entry]);
      setHistoryIndex((prev) => prev + 1);
    },
    [camera, historyIndex],
  );

  const applyHistoryEntry = useCallback((entry: HistoryEntry) => {
    setCamera(entry.camera);
    setActiveFrameId(entry.activeFrameId);
  }, []);

  const navigateBack = useCallback(() => {
    if (historyIndex <= 0) return;
    if (historyIndex === history.length - 1) {
      setHistory((prev) => [...prev, { camera: { ...camera }, activeFrameId }]);
    }
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    applyHistoryEntry(history[newIdx]);
  }, [historyIndex, history, camera, activeFrameId, applyHistoryEntry]);

  const navigateForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    applyHistoryEntry(history[newIdx]);
  }, [historyIndex, history, applyHistoryEntry]);

  // Zoom camera to an arbitrary rect in SVG coords
  const zoomToRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const padX = rect.width * FRAME_PADDING_RATIO;
      const padY = rect.height * FRAME_PADDING_RATIO;
      const el = containerRef.current;
      const aspect = el ? el.clientWidth / el.clientHeight : 16 / 9;
      const fitWidth = rect.width + padX * 2;
      const fitHeight = rect.height + padY * 2;
      const fitByWidth = fitWidth;
      const fitByHeight = fitHeight * aspect;
      const svgWidth = Math.max(fitByWidth, fitByHeight);
      setCamera({
        cx: rect.x + rect.width / 2,
        cy: rect.y + rect.height / 2,
        svgWidth: clampSvgWidth(svgWidth),
      });
    },
    [],
  );

  // Zoom to a specific frame
  const zoomToFrame = useCallback(
    (frame: FrameEntry) => {
      pushHistory(frame.id);
      setActiveFrameId(frame.id);
      zoomToRect(frame);
    },
    [pushHistory, zoomToRect],
  );

  function clampSvgWidth(w: number) {
    const minW = baseVb.width / MAX_SCALE;
    const maxW = baseVb.width / MIN_SCALE;
    return Math.min(maxW, Math.max(minW, w));
  }

  // キャンバスのクライアントサイズ追跡（ルーラー用）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setClientSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Present モード: active frame に自動ズーム
  useEffect(() => {
    if (!presentMode) return;
    if (frames.length === 0) return;
    const target = frames[Math.max(0, Math.min(frames.length - 1, presentIdx))];
    if (!target) return;
    zoomToRect({ x: target.x, y: target.y, width: target.width, height: target.height });
    setActiveFrameId(target.id);
  }, [presentMode, presentIdx, frames, zoomToRect]);

  // Present モード時のフレーム遷移 & 終了キー
  useEffect(() => {
    if (!presentMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPresentMode(false);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setPresentIdx((i) => Math.min(frames.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPresentIdx((i) => Math.max(0, i - 1));
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentMode, frames.length]);

  // Space key for hand tool
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) isSpaceHeld.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') isSpaceHeld.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Prevent page scroll — attach native listener with passive:false
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();

      if (e.ctrlKey || e.metaKey) {
        // Zoom: adjust svgWidth (inverse of scale)
        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const factor = 1 / (1 + delta); // smaller svgWidth = zoomed in

        // Cursor position as fraction of viewport
        const fx = (e.clientX - rect.left) / rect.width;
        const fy = (e.clientY - rect.top) / rect.height;

        setCamera((prev) => {
          const aspect = rect.width / rect.height;
          const oldH = prev.svgWidth / aspect;
          const newW = clampSvgWidth(prev.svgWidth * factor);
          const newH = newW / aspect;

          // Keep the point under cursor fixed
          const oldLeft = prev.cx - prev.svgWidth / 2;
          const oldTop = prev.cy - oldH / 2;
          const cursorSvgX = oldLeft + fx * prev.svgWidth;
          const cursorSvgY = oldTop + fy * oldH;
          const newLeft = cursorSvgX - fx * newW;
          const newTop = cursorSvgY - fy * newH;

          return {
            cx: newLeft + newW / 2,
            cy: newTop + newH / 2,
            svgWidth: newW,
          };
        });
      } else {
        // Pan: convert pixel delta to SVG units
        const pixelsPerSvgUnit = rect.width / camera.svgWidth;
        setCamera((prev) => ({
          ...prev,
          cx: prev.cx + e.deltaX / pixelsPerSvgUnit,
          cy: prev.cy + e.deltaY / pixelsPerSvgUnit,
        }));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [camera.svgWidth]);

  // Pan: space+drag, middle-button drag, alt+drag, or touch drag (1 本指)
  // Pinch zoom: タッチ 2 本指
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // タッチの場合: activePointers に追加し、本数に応じてパン or ピンチを決定
      if (e.pointerType === 'touch') {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.current.size === 1) {
          // 1 本指: パン開始
          isPanning.current = true;
          pinchState.current = null;
          panStart.current = { x: e.clientX, y: e.clientY };
          cameraStart.current = { ...camera };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          e.preventDefault();
        } else if (activePointers.current.size === 2) {
          // 2 本指: パンを解除してピンチズーム開始
          isPanning.current = false;
          const pts = Array.from(activePointers.current.values());
          const dx = pts[0].x - pts[1].x;
          const dy = pts[0].y - pts[1].y;
          const dist = Math.hypot(dx, dy);
          const centerX = (pts[0].x + pts[1].x) / 2;
          const centerY = (pts[0].y + pts[1].y) / 2;
          pinchState.current = {
            startDist: dist || 1,
            startCenter: { x: centerX, y: centerY },
            cameraStart: { ...camera },
          };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          e.preventDefault();
        }
        return;
      }

      // マウス: 従来どおり Space / 中ボタン / Alt でパン
      const wantPan =
        e.button === 1 ||
        (e.button === 0 && e.altKey) ||
        (e.button === 0 && isSpaceHeld.current);
      if (!wantPan) return;

      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      cameraStart.current = { ...camera };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [camera],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // タッチでピンチ中: 距離変化からズーム、中心移動からパン
      if (e.pointerType === 'touch' && pinchState.current) {
        if (!activePointers.current.has(e.pointerId)) return;
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const pts = Array.from(activePointers.current.values());
        if (pts.length < 2) return;

        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();

        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);
        const centerX = (pts[0].x + pts[1].x) / 2;
        const centerY = (pts[0].y + pts[1].y) / 2;

        const { startDist, startCenter, cameraStart: cs } = pinchState.current;
        const zoomFactor = startDist / Math.max(dist, 1); // 指が離れる → svgWidth 縮小 → ズームイン
        const newSvgWidth = clampSvgWidth(cs.svgWidth * zoomFactor);

        const aspect = rect.width / rect.height;
        const oldH = cs.svgWidth / aspect;
        const newH = newSvgWidth / aspect;

        // ピンチ開始時の中心点(画面座標比率)を SVG 座標に変換
        const fx = (startCenter.x - rect.left) / rect.width;
        const fy = (startCenter.y - rect.top) / rect.height;
        const oldLeft = cs.cx - cs.svgWidth / 2;
        const oldTop = cs.cy - oldH / 2;
        const pinchSvgX = oldLeft + fx * cs.svgWidth;
        const pinchSvgY = oldTop + fy * oldH;

        // 中心点の移動分だけパン(画面座標差 → SVG 座標差)
        const pixelsPerSvgUnit = rect.width / newSvgWidth;
        const panDx = (centerX - startCenter.x) / pixelsPerSvgUnit;
        const panDy = (centerY - startCenter.y) / pixelsPerSvgUnit;

        // ピンチ中心点を画面上で固定しつつ新しい svgWidth を適用
        const newLeft = pinchSvgX - fx * newSvgWidth - panDx;
        const newTop = pinchSvgY - fy * newH - panDy;

        setCamera({
          cx: newLeft + newSvgWidth / 2,
          cy: newTop + newH / 2,
          svgWidth: newSvgWidth,
        });
        return;
      }

      // 通常パン(マウス Space/Alt/中ボタン or タッチ 1 本指)
      if (!isPanning.current) return;
      if (e.pointerType === 'touch') {
        if (!activePointers.current.has(e.pointerId)) return;
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pixelsPerSvgUnit = rect.width / cameraStart.current.svgWidth;
      const dx = (e.clientX - panStart.current.x) / pixelsPerSvgUnit;
      const dy = (e.clientY - panStart.current.y) / pixelsPerSvgUnit;
      setCamera({
        ...cameraStart.current,
        cx: cameraStart.current.cx - dx,
        cy: cameraStart.current.cy - dy,
      });
    },
    [],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      activePointers.current.delete(e.pointerId);
      // 2 本指 → 1 本指に戻った場合: ピンチ終了、残った指で新たにパン開始
      if (activePointers.current.size === 1 && pinchState.current) {
        pinchState.current = null;
        const [remaining] = Array.from(activePointers.current.values());
        isPanning.current = true;
        panStart.current = { x: remaining.x, y: remaining.y };
        cameraStart.current = { ...camera };
        return;
      }
      // すべての指が離れた
      if (activePointers.current.size === 0) {
        isPanning.current = false;
        pinchState.current = null;
      }
      return;
    }
    isPanning.current = false;
  }, [camera]);

  // Zoom to center helper
  const zoomByFactor = useCallback((factor: number) => {
    setCamera((prev) => ({
      ...prev,
      svgWidth: clampSvgWidth(prev.svgWidth / factor),
    }));
  }, []);

  const resetView = useCallback(() => {
    setCamera({
      cx: baseVb.x + baseVb.width / 2,
      cy: baseVb.y + baseVb.height / 2,
      svgWidth: baseVb.width,
    });
    setActiveFrameId(null);
  }, [baseVb]);

  const zoomTo100 = useCallback(() => {
    setCamera((prev) => ({
      ...prev,
      svgWidth: baseVb.width,
    }));
  }, [baseVb]);

  // Vim-like frame navigation: [count]h/j/k/l
  // Text objects (vim mode only): vif, vaf, vir, vic
  const vimCount = useRef('');
  const vimGPending = useRef(false);
  const vimTimeout = useRef<ReturnType<typeof setTimeout>>();

  const nudgeSelected = useCallback((direction: string, count: number) => {
    window.dispatchEvent(new CustomEvent('pencil-nudge', { detail: { direction, count } }));
  }, []);

  const navigateVim = useCallback(
    (direction: 'h' | 'j' | 'k' | 'l', count: number) => {
      if (frames.length === 0) return;

      const sortedByX = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
      const sortedByY = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);

      const currentId = activeFrameId;
      let sorted: FrameEntry[];
      let step: number;

      switch (direction) {
        case 'l': sorted = sortedByX; step = count; break;
        case 'h': sorted = sortedByX; step = -count; break;
        case 'j': sorted = sortedByY; step = count; break;
        case 'k': sorted = sortedByY; step = -count; break;
      }

      const currentIdx = currentId
        ? sorted.findIndex((f) => f.id === currentId)
        : -1;
      const startIdx = currentIdx >= 0 ? currentIdx : (step > 0 ? -1 : sorted.length);
      const targetIdx = Math.max(0, Math.min(sorted.length - 1, startIdx + step));
      const target = sorted[targetIdx];
      if (!target) return;

      // 少し引いたビュー: ターゲットの前後3フレーム分のバウンディングボックスを表示
      const contextRange = 3;
      const lo = Math.max(0, targetIdx - contextRange);
      const hi = Math.min(sorted.length - 1, targetIdx + contextRange);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = lo; i <= hi; i++) {
        const f = sorted[i];
        minX = Math.min(minX, f.x);
        minY = Math.min(minY, f.y);
        maxX = Math.max(maxX, f.x + f.width);
        maxY = Math.max(maxY, f.y + f.height);
      }
      const pad = 60;
      pushHistory(target.id);
      setActiveFrameId(target.id);
      zoomToRect({
        x: minX - pad,
        y: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      });
    },
    [frames, activeFrameId, pushHistory, zoomToRect],
  );

  // Keyboard shortcuts
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
          vimTimeout.current = setTimeout(() => { vimCount.current = ''; vimGPending.current = false; }, 1500);
          return;
        }
        // g prefix: next h/j/k/l will do frame jump
        if (e.key === 'g' && !vimGPending.current) {
          vimGPending.current = true;
          clearTimeout(vimTimeout.current);
          vimTimeout.current = setTimeout(() => { vimGPending.current = false; vimCount.current = ''; }, 1500);
          return;
        }
        // Shift + H/J/K/L: camera half-page scroll
        if (e.key === 'H' || e.key === 'J' || e.key === 'K' || e.key === 'L') {
          e.preventDefault();
          const dir = e.key.toLowerCase();
          const halfW = camera.svgWidth / 2;
          const el = containerRef.current;
          const aspect = el ? el.clientWidth / el.clientHeight : 16 / 9;
          const halfH = (camera.svgWidth / aspect) / 2;
          setCamera((prev) => ({
            ...prev,
            cx: prev.cx + (dir === 'l' ? halfW : dir === 'h' ? -halfW : 0),
            cy: prev.cy + (dir === 'j' ? halfH : dir === 'k' ? -halfH : 0),
          }));
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
            const step = camera.svgWidth * 0.05 * count; // 5% of view per press
            setCamera((prev) => ({
              ...prev,
              cx: prev.cx + (e.key === 'l' ? step : e.key === 'h' ? -step : 0),
              cy: prev.cy + (e.key === 'j' ? step : e.key === 'k' ? -step : 0),
            }));
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
  }, [zoomByFactor, resetView, zoomTo100, navigateBack, navigateForward, navigateVim]);

  const cursor = isSpaceHeld.current || isPanning.current ? 'grab' : 'default';

  return (
    <EditorProvider doc={doc} rawDoc={rawDoc}>
    <div className={`viewer${presentMode ? ' viewer--present' : ''}`}>
      <div className="viewer__toolbar">
        <Toolbar />
        <span className="viewer__separator" />
        <button
          type="button"
          className="viewer__zoom-btn"
          title="Zoom out (Cmd+-)"
          onClick={() => zoomByFactor(1 / 1.25)}
        >
          -
        </button>
        <ZoomInput
          zoomPercent={zoomPercent}
          onZoomChange={(percent) => {
            const newScale = percent / 100;
            setCamera((prev) => ({
              ...prev,
              svgWidth: clampSvgWidth(baseVb.width / newScale),
            }));
          }}
        />
        <button
          type="button"
          className="viewer__zoom-btn"
          title="Zoom in (Cmd++)"
          onClick={() => zoomByFactor(1.25)}
        >
          +
        </button>
        <span className="viewer__separator" />
        <button
          type="button"
          className="viewer__zoom-btn"
          title="Fit to view (Cmd+0)"
          onClick={resetView}
        >
          Fit
        </button>

        {frames.length > 0 && (
          <>
            <span className="viewer__separator" />
            <div className="viewer__frame-nav">
              <button
                type="button"
                className="viewer__zoom-btn"
                title="Back (Cmd+[)"
                disabled={historyIndex <= 0}
                onClick={navigateBack}
              >
                &#9664;
              </button>
              <button
                type="button"
                className="viewer__zoom-btn"
                title="Forward (Cmd+])"
                disabled={historyIndex >= history.length - 1}
                onClick={navigateForward}
              >
                &#9654;
              </button>
              <select
                className="viewer__frame-select"
                value={activeFrameId ?? ''}
                onChange={(e) => {
                  const frame = frames.find((f) => f.id === e.target.value);
                  if (frame) zoomToFrame(frame);
                }}
              >
                <option value="" disabled>
                  Frames
                </option>
                {frames.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <span style={{ flex: 1 }} />
        <AlignToolbar />
        <span className="viewer__separator" />
        <GridSnapToggle />
        <span className="viewer__separator" />
        {isAIGenerateEnabled() && (
          <>
            <button
              type="button"
              className="viewer__zoom-btn viewer__ai-btn"
              title="AI Design Generator (Cmd+K)"
              onClick={() => setShowAIGenerate(true)}
            >
              🪄 AI
            </button>
            <span className="viewer__separator" />
          </>
        )}
        <CollabBar
          collab={collab}
          bridge={bridge}
          onStartCollab={() => createRoom(rawDoc ?? doc, () => {})}
          onDisconnect={disconnect}
          onToggleBridge={() => {
            if (bridge.connected) {
              disconnectBridge();
            } else {
              connectBridge('ws://localhost:4567', rawDoc ?? doc, () => {});
            }
          }}
          roomUrl={getRoomUrl()}
        />
        <span className="viewer__separator" />
        <ExportButton />
        <span className="viewer__separator" />
        <button
          type="button"
          className="viewer__zoom-btn"
          title="Shortcuts (Cmd+/)"
          onClick={() => setShowShortcuts(true)}
        >
          ?
        </button>
      </div>
      <div className={`viewer__body${showPages ? ' viewer__body--has-pages' : ' viewer__body--has-pages-collapsed'}`}>
        <div className={`viewer__canvas-wrap${showRulers ? ' viewer__canvas-wrap--rulers' : ''}`}>
          {showRulers && (
            <Rulers
              viewBox={currentVb}
              clientSize={clientSize}
              show={showRulers}
            />
          )}
        <div
          ref={containerRef}
          className="viewer__canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor }}
        >
          <svg
            ref={svgRef}
            className="viewer__svg"
            viewBox={`${currentVb.x} ${currentVb.y} ${currentVb.width} ${currentVb.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <CanvasContent />
            {activeFrameId && frames.map((f) =>
              f.id === activeFrameId ? (
                <rect
                  key={`highlight-${f.id}`}
                  x={f.x}
                  y={f.y}
                  width={f.width}
                  height={f.height}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={2 / scale}
                  strokeDasharray={`${6 / scale} ${4 / scale}`}
                  rx={4 / scale}
                  pointerEvents="none"
                />
              ) : null,
            )}
            <HintLabels vimMode={vimMode} svgScale={scale} cameraCx={camera.cx} cameraCy={camera.cy} viewBox={currentVb} />
            <MarqueeSelect viewBox={currentVb} svgRef={svgRef} />
            <ShapeCreator svgRef={svgRef} />
            <SnapGuides svgScale={scale} />
            <DistanceMeasure svgRef={svgRef} svgScale={scale} />
            <EditAnimation />
          </svg>
        </div>
        </div>
        <PagesPanel
          collapsed={!showPages}
          onTogglePanel={() => setShowPages((v) => !v)}
          onZoomToPage={(p) => zoomToFrame(p)}
        />
        <ComponentsPanel
          collapsed={!showComponents}
          onTogglePanel={() => setShowComponents((v) => !v)}
          onZoomToNode={(r) => zoomToRect(r)}
        />
        <NodeTree collapsed={!showLayers} onTogglePanel={() => setShowLayers((v) => !v)} />
        <PropertyPanel collapsed={!showProperties} onTogglePanel={() => setShowProperties((v) => !v)} />
      </div>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {showFrameSearch && (
        <FrameSearch
          frames={frames}
          activeFrameId={activeFrameId}
          cameraCx={camera.cx}
          cameraCy={camera.cy}
          onSelect={zoomToFrame}
          onClose={() => setShowFrameSearch(false)}
        />
      )}
      {showAutoId && <AutoIdDialog onClose={() => setShowAutoId(false)} />}
      {showUIStates && <UIStatesPanel onClose={() => setShowUIStates(false)} locale="ja" />}
      {showAIReview && <AIReviewPanel onClose={() => setShowAIReview(false)} locale="ja" />}
      {showAIGenerate && (
        <AIGeneratorPanel
          onClose={() => setShowAIGenerate(false)}
          onZoomToNode={(r) => zoomToRect(r)}
        />
      )}
      {showFindReplace && (
        <FindReplaceDialog
          onClose={() => setShowFindReplace(false)}
          onFocusNode={(r) => zoomToRect(r)}
        />
      )}
      {showVariables && <VariablesPanel onClose={() => setShowVariables(false)} />}
      {showCommandPalette && (
        <CommandPaletteWrapper
          baseCommands={[
            { id: 'vim-toggle', label: `Vim Mode: ${vimMode ? 'ON → OFF' : 'OFF → ON'}`, action: () => setVimMode((v) => !v) },
            { id: 'frame-search', label: 'Search Frames', shortcut: 'Cmd+P', action: () => setShowFrameSearch(true) },
            { id: 'auto-id', label: 'Auto ID / Rename Frames', shortcut: 'Cmd+I', action: () => setShowAutoId(true) },
            { id: 'ui-states', label: 'Five UI States Audit', action: () => setShowUIStates(true) },
            { id: 'variables', label: '🎨 Variables (Design Tokens)', action: () => setShowVariables(true) },
            ...(isAIReviewEnabled() ? [{ id: 'ai-review', label: '🤖 AI Design Review', action: () => setShowAIReview(true) }] : []),
            ...(isAIGenerateEnabled() ? [{ id: 'ai-generate', label: '🪄 AI Design Generator', shortcut: 'Cmd+K', action: () => setShowAIGenerate(true) }] : []),
            { id: 'fit-view', label: 'Fit to View', shortcut: 'Cmd+0', action: resetView },
            { id: 'zoom-100', label: 'Zoom to 100%', shortcut: 'Cmd+1', action: zoomTo100 },
            { id: 'shortcuts', label: 'Show Keyboard Shortcuts', shortcut: 'Cmd+/', action: () => setShowShortcuts(true) },
            { id: 'export', label: 'Export .pen', shortcut: 'Cmd+S', action: () => {} },
            { id: 'save-as', label: 'Save As...', shortcut: 'Cmd+Shift+S', action: () => {} },
          ] satisfies Command[]}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
      <NudgeHandler />
      <ZoomToSelected onZoomTo={zoomToRect} />
      <VimTextObjects vimMode={vimMode} />
      {vimMode && <VimBadge />}
      <ContextMenu />
      <ToolShortcuts />
      <FloatingTextToolbar svgRef={svgRef} />
      <ImageDropHandler
        svgRef={svgRef}
        containerRef={containerRef}
        viewCenter={{ x: camera.cx, y: camera.cy }}
      />
    </div>
    </EditorProvider>
  );
}
