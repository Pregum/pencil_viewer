import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PenDocument, PenNode } from '../../pen/types';
import { PenNodeView } from '../../pen/renderer/PenNode';
import { computeViewBox } from '../../pen/renderer/viewBox';
import { buildPaintRegistry } from '../../pen/paint/registry';
import { Defs } from '../../pen/paint/Defs';
import { PaintRegistryProvider } from '../../pen/paint/PaintContext';
import { ShortcutsDialog } from './ShortcutsDialog';
import { FrameSearch } from './FrameSearch';

const MIN_SCALE = 0.05;
const MAX_SCALE = 64;
const ZOOM_SENSITIVITY = 0.002;
const FRAME_PADDING = 60; // px padding when zooming to a frame

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Collect all frame/group nodes with absolute bounds */
interface FrameEntry {
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

interface ViewState {
  scale: number;
  tx: number;
  ty: number;
  frameId: string | null;
}

export function PenViewer({ doc }: { doc: PenDocument }) {
  const vb = computeViewBox(doc);
  const registry = useMemo(() => buildPaintRegistry(doc), [doc]);
  const frames = useMemo(() => collectFrames(doc.children), [doc]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const isSpaceHeld = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Navigation history
  const [history, setHistory] = useState<ViewState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFrameSearch, setShowFrameSearch] = useState(false);

  // Push current view to history
  const pushHistory = useCallback(
    (frameId: string | null) => {
      const entry: ViewState = { scale, tx: translate.x, ty: translate.y, frameId };
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIndex + 1);
        return [...truncated, entry];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [scale, translate, historyIndex],
  );

  const applyViewState = useCallback((vs: ViewState) => {
    setScale(vs.scale);
    setTranslate({ x: vs.tx, y: vs.ty });
  }, []);

  const navigateBack = useCallback(() => {
    if (historyIndex <= 0) return;
    // Save current state if we're at the end
    if (historyIndex === history.length - 1) {
      setHistory((prev) => [
        ...prev,
        { scale, tx: translate.x, ty: translate.y, frameId: null },
      ]);
    }
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    applyViewState(history[newIdx]);
  }, [historyIndex, history, scale, translate, applyViewState]);

  const navigateForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    applyViewState(history[newIdx]);
  }, [historyIndex, history, applyViewState]);

  // Zoom to a specific frame
  const zoomToFrame = useCallback(
    (frame: FrameEntry) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      // Save current view before navigating
      pushHistory(frame.id);

      // Calculate scale to fit the frame with padding
      const scaleX = (rect.width - FRAME_PADDING * 2) / frame.width;
      const scaleY = (rect.height - FRAME_PADDING * 2) / frame.height;
      const newScale = clampScale(Math.min(scaleX, scaleY));

      // SVG coordinate → screen coordinate needs viewBox mapping
      // SVG viewBox maps vb to the full container size at scale=1
      const svgScaleX = rect.width / vb.width;
      const svgScaleY = rect.height / vb.height;
      const svgScale = Math.min(svgScaleX, svgScaleY);

      // Frame position in "unscaled SVG pixel" coordinates
      const frameSvgX = (frame.x - vb.x) * svgScale;
      const frameSvgY = (frame.y - vb.y) * svgScale;
      const frameSvgW = frame.width * svgScale;
      const frameSvgH = frame.height * svgScale;

      // Center the frame
      const tx = rect.width / 2 - (frameSvgX + frameSvgW / 2) * newScale;
      const ty = rect.height / 2 - (frameSvgY + frameSvgH / 2) * newScale;

      setScale(newScale);
      setTranslate({ x: tx, y: ty });
    },
    [pushHistory, vb],
  );

  // Space key for hand tool (Figma style)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isSpaceHeld.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceHeld.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Ctrl+wheel zoom (pinch-to-zoom on trackpad also fires ctrlKey)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = containerRef.current!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      setScale((prev) => {
        const next = clampScale(prev * (1 + delta));
        const ratio = next / prev;
        setTranslate((t) => ({
          x: cursorX - ratio * (cursorX - t.x),
          y: cursorY - ratio * (cursorY - t.y),
        }));
        return next;
      });
      return;
    }

    // plain wheel / two-finger scroll = pan
    e.preventDefault();
    setTranslate((t) => ({
      x: t.x - e.deltaX,
      y: t.y - e.deltaY,
    }));
  }, []);

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
      translateStart.current = { ...translate };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [translate],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning.current) return;
    setTranslate({
      x: translateStart.current.x + (e.clientX - panStart.current.x),
      y: translateStart.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Zoom to center helper
  const zoomTo = useCallback((newScale: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setScale((prev) => {
      const clamped = clampScale(newScale);
      const ratio = clamped / prev;
      setTranslate((t) => ({
        x: cx - ratio * (cx - t.x),
        y: cy - ratio * (cy - t.y),
      }));
      return clamped;
    });
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Cmd+[ : navigate back
      if (mod && e.key === '[') {
        e.preventDefault();
        navigateBack();
        return;
      }
      // Cmd+] : navigate forward
      if (mod && e.key === ']') {
        e.preventDefault();
        navigateForward();
        return;
      }
      // Cmd+P : frame search
      if (mod && e.key === 'p') {
        e.preventDefault();
        setShowFrameSearch((v) => !v);
        return;
      }
      // Cmd+/ : show shortcuts
      if (mod && e.key === '/') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        resetView();
      } else if (mod && e.key === '1') {
        e.preventDefault();
        zoomTo(1);
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomTo(scale * 1.25);
      } else if (mod && e.key === '-') {
        e.preventDefault();
        zoomTo(scale / 1.25);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scale, zoomTo, resetView, navigateBack, navigateForward]);

  const zoomPercent = Math.round(scale * 100);
  const cursor = isSpaceHeld.current || isPanning.current ? 'grab' : 'default';

  return (
    <div className="viewer">
      <div className="viewer__toolbar">
        <button
          type="button"
          className="viewer__zoom-btn"
          title="Zoom out (Cmd+-)"
          onClick={() => zoomTo(scale / 1.25)}
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
          onClick={() => zoomTo(scale * 1.25)}
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
                value=""
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
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor }}
      >
        <svg
          className="viewer__svg"
          viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <Defs registry={registry} />
          <PaintRegistryProvider value={registry}>
            {doc.children.map((node) => (
              <PenNodeView key={node.id} node={node} />
            ))}
          </PaintRegistryProvider>
        </svg>
      </div>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {showFrameSearch && (
        <FrameSearch
          frames={frames}
          onSelect={zoomToFrame}
          onClose={() => setShowFrameSearch(false)}
        />
      )}
    </div>
  );
}
