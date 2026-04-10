import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PenDocument, PenNode } from '../../pen/types';
import { computeViewBox, type ViewBox } from '../../pen/renderer/viewBox';
import { CanvasContent } from './CanvasContent';
import { ShortcutsDialog } from './ShortcutsDialog';
import { FrameSearch } from './FrameSearch';
import { EditorProvider } from '../../pen/state/EditorContext';
import { PropertyPanel } from './PropertyPanel';
import { ExportButton } from './ExportButton';
import { AutoIdDialog } from './AutoIdDialog';
import { CommandPalette, type Command } from './CommandPalette';
import { NodeTree } from './NodeTree';
import { VimTextObjects } from './VimTextObjects';
import { ZoomToSelected } from './ZoomToSelected';
import { HintLabels } from './HintLabels';

const MIN_SCALE = 0.05;
const MAX_SCALE = 64;
const ZOOM_SENSITIVITY = 0.002;
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

export function PenViewer({ doc }: { doc: PenDocument }) {
  const baseVb = computeViewBox(doc);
  const frames = useMemo(() => collectFrames(doc.children), [doc]);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Active frame highlight
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);

  // Navigation history
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFrameSearch, setShowFrameSearch] = useState(false);
  const [showAutoId, setShowAutoId] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [vimMode, setVimMode] = useState(false);

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

  // Pan: space+drag, middle-button drag, or alt+drag
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
      if (!isPanning.current) return;
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

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

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
  const vimTimeout = useRef<ReturnType<typeof setTimeout>>();

  const navigateVim = useCallback(
    (direction: 'h' | 'j' | 'k' | 'l', count: number) => {
      if (frames.length === 0) return;

      // Sort frames by position for directional navigation
      const sortedByX = [...frames].sort((a, b) => a.x - b.x || a.y - b.y);
      const sortedByY = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);

      // Find current frame index
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
      if (target) zoomToFrame(target);
    },
    [frames, activeFrameId, zoomToFrame],
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
      } else if (!mod && !isInput) {
        // Vim-style: [count]h/j/k/l navigation
        if (/^[0-9]$/.test(e.key)) {
          vimCount.current += e.key;
          clearTimeout(vimTimeout.current);
          vimTimeout.current = setTimeout(() => { vimCount.current = ''; }, 1500);
          return;
        }
        if (e.key === 'h' || e.key === 'j' || e.key === 'k' || e.key === 'l') {
          e.preventDefault();
          const count = Math.max(1, parseInt(vimCount.current) || 1);
          vimCount.current = '';
          clearTimeout(vimTimeout.current);
          navigateVim(e.key, count);
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
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomByFactor, resetView, zoomTo100, navigateBack, navigateForward, navigateVim]);

  const cursor = isSpaceHeld.current || isPanning.current ? 'grab' : 'default';

  return (
    <EditorProvider doc={doc}>
    <div className="viewer">
      <div className="viewer__toolbar">
        <button
          type="button"
          className="viewer__zoom-btn"
          title="Zoom out (Cmd+-)"
          onClick={() => zoomByFactor(1 / 1.25)}
        >
          -
        </button>
        <span className="viewer__zoom-label" title="Click to reset" onClick={resetView}>
          {zoomPercent}%
        </span>
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
          className="viewer__svg"
          viewBox={`${currentVb.x} ${currentVb.y} ${currentVb.width} ${currentVb.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <CanvasContent />
          {/* Active frame highlight */}
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
          <HintLabels vimMode={vimMode} svgScale={scale} />
        </svg>
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
      <NodeTree />
      <PropertyPanel />
      {showAutoId && <AutoIdDialog onClose={() => setShowAutoId(false)} />}
      {showCommandPalette && (
        <CommandPalette
          commands={[
            { id: 'vim-toggle', label: `Vim Mode: ${vimMode ? 'ON → OFF' : 'OFF → ON'}`, action: () => setVimMode((v) => !v) },
            { id: 'frame-search', label: 'Search Frames', shortcut: 'Cmd+P', action: () => setShowFrameSearch(true) },
            { id: 'auto-id', label: 'Auto ID / Rename Frames', shortcut: 'Cmd+I', action: () => setShowAutoId(true) },
            { id: 'fit-view', label: 'Fit to View', shortcut: 'Cmd+0', action: resetView },
            { id: 'zoom-100', label: 'Zoom to 100%', shortcut: 'Cmd+1', action: zoomTo100 },
            { id: 'shortcuts', label: 'Show Keyboard Shortcuts', shortcut: 'Cmd+/', action: () => setShowShortcuts(true) },
            { id: 'export', label: 'Export .pen', shortcut: 'Cmd+S', action: () => {} },
            { id: 'save-as', label: 'Save As...', shortcut: 'Cmd+Shift+S', action: () => {} },
          ] satisfies Command[]}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
      <ZoomToSelected onZoomTo={zoomToRect} />
      <VimTextObjects vimMode={vimMode} />
      {vimMode && (
        <div className="viewer__vim-badge">VIM</div>
      )}
    </div>
    </EditorProvider>
  );
}
