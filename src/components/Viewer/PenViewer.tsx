import { useEffect, useMemo, useRef, useState } from 'react';
import type { PenDocument, PenNode } from '../../pen/types';
import { computeViewBox } from '../../pen/renderer/viewBox';
import { CanvasContent } from './CanvasContent';
import { usePanZoom } from './usePanZoom';
import { collectFrames } from './frames';
import { useFrameNavigation } from './useFrameNavigation';
import { usePresentMode } from './usePresentMode';
import { useViewerShortcuts } from './useViewerShortcuts';
import { ShortcutsDialog } from './ShortcutsDialog';
import { FrameSearch } from './FrameSearch';
import { EditorProvider, useEditor as useEditorInternal } from '../../pen/state/EditorContext';
import { PropertyPanel } from './PropertyPanel';
import { ExportButton } from './ExportButton';
import { CommitButton } from '../../github/CommitButton';
import { GitHubDirtyTracker } from '../../github/GitHubDirtyTracker';
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
import { CollabSync } from '../../collab/CollabSync';
import { RemoteCursors } from '../../collab/RemoteCursors';
import { ContextMenu } from './ContextMenu';
import { AIReviewPanel } from './AIReviewPanel';
import { isAIReviewEnabled } from '../../utils/aiReview';
import { AIGeneratorPanel } from './AIGeneratorPanel';
import { isAIGenerateEnabled } from '../../utils/aiGenerate';
import { FloatingTextToolbar } from './FloatingTextToolbar';
import { ImageDropHandler } from './ImageDropHandler';
import { FindReplaceDialog } from './FindReplaceDialog';
import { VariablesPanel } from './VariablesPanel';
import { DevInspectPanel } from './DevInspectPanel';
import { StylesPanel } from './StylesPanel';
import { SelectionColorsPanel } from './SelectionColorsPanel';
import { GridSnapToggle } from './GridSnapToggle';
import { ZoomInput } from './ZoomInput';
import { Toolbar } from './Toolbar';
import { ShapeCreator } from './ShapeCreator';
import { PenToolCreator } from './PenToolCreator';
import { PathEditor } from './PathEditor';
import { CommentsLayer } from './CommentsLayer';
import { SmartAnimateOverlay } from './SmartAnimateOverlay';
import { ToolShortcuts } from './ToolShortcuts';
import { SnapGuides } from './SnapGuides';
import { DistanceMeasure } from './DistanceMeasure';
import { AlignToolbar } from './AlignToolbar';
import { Rulers } from './Rulers';
import { PagesPanel } from './PagesPanel';
import { ComponentsPanel } from './ComponentsPanel';

export type { FrameEntry } from './frames';

function VimBadge() {
  const { state } = useEditorInternal();
  return (
    <div className={`viewer__vim-badge ${state.insertMode ? 'viewer__vim-badge--insert' : ''}`}>
      {state.insertMode ? '-- INSERT --' : '-- NORMAL --'}
    </div>
  );
}

export function PenViewer({ doc, rawDoc }: { doc: PenDocument; rawDoc?: PenDocument }) {
  // doc が変わったときだけ計算し直す。毎レンダーで新しいオブジェクトを作ると
  // これを deps に持つ useCallback/useEffect が毎回作り直しになる。
  const baseVb = useMemo(() => computeViewBox(doc), [doc]);
  const frames = useMemo(() => collectFrames(doc.children), [doc]);

  // カメラ（パン / ズーム / フィット）は usePanZoom に切り出してある (#71)
  const {
    containerRef,
    camera,
    setCamera,
    clientSize,
    viewBox: currentVb,
    scale,
    zoomPercent,
    clampSvgWidth,
    zoomToRect,
    fitToDocument,
    zoomByFactor,
    zoomTo100,
    isPanning,
    isSpaceHeld,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = usePanZoom(doc, baseVb);

  const svgRef = useRef<SVGSVGElement>(null);

  // フレーム単位のナビゲーション (ハイライト / 履歴 / Vim 移動) (#71)
  const {
    activeFrameId,
    setActiveFrameId,
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
    zoomToFrame,
    resetView,
    navigateVim,
  } = useFrameNavigation({ frames, camera, setCamera, zoomToRect, fitToDocument });

  // Present モード + Smart Animate (#71)
  const { presentMode, setPresentMode, transition } = usePresentMode({
    docChildren: doc.children,
    frames,
    svgRef,
    zoomToRect,
    setActiveFrameId,
  });

  // P2P Collab
  const {
    collab,
    createRoom,
    joinRoom,
    disconnect,
    getRoomUrl,
    syncDoc: syncCollabDoc,
    setRemoteHandler,
    setLocalCursor,
    setLocalSelection,
  } = useCollab();
  const { bridge, connectBridge, disconnectBridge } = useBridge();

  /** 招待リンク (?room=) 経由で開いたか。マウント時に一度だけ判定する */
  const [joinedViaUrl] = useState(() => new URLSearchParams(window.location.search).has('room'));

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
  const [showDevInspect, setShowDevInspect] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const [showSelectionColors, setShowSelectionColors] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Collab: 招待リンク (?room=) で開いた場合は自動で入室
  useEffect(() => {
    const room = new URLSearchParams(window.location.search).get('room');
    if (room) joinRoom(room, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collab: 接続中はポインタ移動を SVG 座標に変換して自分のカーソルを配信
  useEffect(() => {
    if (!collab.connected) return;
    const el = containerRef.current;
    if (!el) return;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < 45) return;
      last = now;
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!ctm) return;
      setLocalCursor({ x: (e.clientX - ctm.e) / ctm.a, y: (e.clientY - ctm.f) / ctm.d });
    };
    const onLeave = () => setLocalCursor(null);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [collab.connected, setLocalCursor, containerRef]);

  // Keyboard shortcuts (#71)
  useViewerShortcuts({
    vimMode,
    containerRef,
    setCamera,
    setActiveFrameId,
    navigateBack,
    navigateForward,
    navigateVim,
    resetView,
    zoomTo100,
    zoomByFactor,
    setShowCommandPalette,
    setShowFrameSearch,
    setShowAutoId,
    setShowShortcuts,
    setShowRulers,
    setShowFindReplace,
    setShowAIGenerate,
    setShowDevInspect,
    setPresentMode,
    setFocusMode,
  });

  const cursor = isSpaceHeld.current || isPanning.current ? 'grab' : 'default';

  return (
    <EditorProvider doc={doc} rawDoc={rawDoc}>
      <GitHubDirtyTracker />
      <CollabSync
        connected={collab.connected}
        joining={joinedViaUrl}
        syncDoc={syncCollabDoc}
        setRemoteHandler={setRemoteHandler}
        setLocalSelection={setLocalSelection}
      />
      <div className={`viewer${presentMode ? ' viewer--present' : ''}${focusMode ? ' viewer--focus' : ''}`}>
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
          <button type="button" className="viewer__zoom-btn" title="Fit to view (Cmd+0)" onClick={resetView}>
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
                  disabled={!canGoBack}
                  onClick={navigateBack}
                >
                  &#9664;
                </button>
                <button
                  type="button"
                  className="viewer__zoom-btn"
                  title="Forward (Cmd+])"
                  disabled={!canGoForward}
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
            onStartCollab={() => createRoom(rawDoc ?? doc)}
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
          <CommitButton />
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
        <div
          className={`viewer__body${showPages ? ' viewer__body--has-pages' : ' viewer__body--has-pages-collapsed'}`}
        >
          <div className={`viewer__canvas-wrap${showRulers ? ' viewer__canvas-wrap--rulers' : ''}`}>
            {showRulers && <Rulers viewBox={currentVb} clientSize={clientSize} show={showRulers} />}
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
                {collab.connected && <RemoteCursors peers={collab.peers} scale={scale} />}
                {activeFrameId &&
                  frames.map((f) =>
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
                <HintLabels
                  vimMode={vimMode}
                  svgScale={scale}
                  cameraCx={camera.cx}
                  cameraCy={camera.cy}
                  viewBox={currentVb}
                />
                <MarqueeSelect viewBox={currentVb} svgRef={svgRef} />
                <ShapeCreator svgRef={svgRef} />
                <PenToolCreator svgRef={svgRef} svgScale={scale} />
                <PathEditor svgRef={svgRef} svgScale={scale} />
                <CommentsLayer svgRef={svgRef} svgScale={scale} />
                <SnapGuides svgScale={scale} />
                <DistanceMeasure svgRef={svgRef} svgScale={scale} />
                <EditAnimation />
                {transition &&
                  frames[transition.fromIdx] &&
                  frames[transition.toIdx] &&
                  (() => {
                    // Smart Animate オーバーレイ: 元フレームを探して補間描画
                    const fromFrameId = frames[transition.fromIdx].id;
                    const toFrameId = frames[transition.toIdx].id;
                    const findFrame = (nodes: PenNode[], id: string): PenNode | null => {
                      for (const n of nodes) {
                        if (n.id === id) return n;
                      }
                      return null;
                    };
                    const f = findFrame(doc.children, fromFrameId);
                    const t = findFrame(doc.children, toFrameId);
                    if (f?.type !== 'frame' || t?.type !== 'frame') return null;
                    return (
                      <g style={{ mixBlendMode: 'normal' }}>
                        {/* 裏の元フレーム / 遷移先フレームを隠すため、黒背景の rect をフレーム位置に置く */}
                        <SmartAnimateOverlay
                          fromFrame={f}
                          toFrame={t}
                          progress={transition.progress}
                          easing={transition.easing}
                          smartAnimate={transition.smartAnimate}
                        />
                      </g>
                    );
                  })()}
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
          <AIGeneratorPanel onClose={() => setShowAIGenerate(false)} onZoomToNode={(r) => zoomToRect(r)} />
        )}
        {showFindReplace && (
          <FindReplaceDialog onClose={() => setShowFindReplace(false)} onFocusNode={(r) => zoomToRect(r)} />
        )}
        {showVariables && <VariablesPanel onClose={() => setShowVariables(false)} />}
        {showDevInspect && <DevInspectPanel onClose={() => setShowDevInspect(false)} />}
        {showStyles && <StylesPanel onClose={() => setShowStyles(false)} />}
        {showSelectionColors && <SelectionColorsPanel onClose={() => setShowSelectionColors(false)} />}
        {showCommandPalette && (
          <CommandPaletteWrapper
            baseCommands={
              [
                {
                  id: 'vim-toggle',
                  label: `Vim Mode: ${vimMode ? 'ON → OFF' : 'OFF → ON'}`,
                  action: () => setVimMode((v) => !v),
                },
                {
                  id: 'frame-search',
                  label: 'Search Frames',
                  shortcut: 'Cmd+P',
                  action: () => setShowFrameSearch(true),
                },
                {
                  id: 'auto-id',
                  label: 'Auto ID / Rename Frames',
                  shortcut: 'Cmd+I',
                  action: () => setShowAutoId(true),
                },
                { id: 'ui-states', label: 'Five UI States Audit', action: () => setShowUIStates(true) },
                {
                  id: 'variables',
                  label: '🎨 Variables (Design Tokens)',
                  action: () => setShowVariables(true),
                },
                {
                  id: 'dev-inspect',
                  label: '🧑‍💻 Dev Mode / Inspect',
                  shortcut: 'Cmd+Shift+D',
                  action: () => setShowDevInspect(true),
                },
                {
                  id: 'styles',
                  label: '💠 Styles (Color / Text / Effect)',
                  action: () => setShowStyles(true),
                },
                {
                  id: 'selection-colors',
                  label: '🎨 Selection / Document Colors',
                  action: () => setShowSelectionColors(true),
                },
                {
                  id: 'bool-union',
                  label: 'Boolean: Union',
                  action: () => window.dispatchEvent(new CustomEvent('pencil-bool-op', { detail: 'union' })),
                },
                {
                  id: 'bool-subtract',
                  label: 'Boolean: Subtract',
                  action: () =>
                    window.dispatchEvent(new CustomEvent('pencil-bool-op', { detail: 'subtract' })),
                },
                {
                  id: 'bool-intersect',
                  label: 'Boolean: Intersect',
                  action: () =>
                    window.dispatchEvent(new CustomEvent('pencil-bool-op', { detail: 'intersect' })),
                },
                {
                  id: 'bool-exclude',
                  label: 'Boolean: Exclude (XOR)',
                  action: () =>
                    window.dispatchEvent(new CustomEvent('pencil-bool-op', { detail: 'exclude' })),
                },
                {
                  id: 'flatten',
                  label: 'Flatten selection (union → single path)',
                  action: () => window.dispatchEvent(new Event('pencil-flatten')),
                },
                {
                  id: 'outline-stroke',
                  label: 'Outline stroke (stroke → filled path)',
                  action: () => window.dispatchEvent(new Event('pencil-outline-stroke')),
                },
                ...(isAIReviewEnabled()
                  ? [{ id: 'ai-review', label: '🤖 AI Design Review', action: () => setShowAIReview(true) }]
                  : []),
                ...(isAIGenerateEnabled()
                  ? [
                      {
                        id: 'ai-generate',
                        label: '🪄 AI Design Generator',
                        shortcut: 'Cmd+K',
                        action: () => setShowAIGenerate(true),
                      },
                    ]
                  : []),
                { id: 'fit-view', label: 'Fit to View', shortcut: 'Cmd+0', action: resetView },
                { id: 'zoom-100', label: 'Zoom to 100%', shortcut: 'Cmd+1', action: zoomTo100 },
                {
                  id: 'shortcuts',
                  label: 'Show Keyboard Shortcuts',
                  shortcut: 'Cmd+/',
                  action: () => setShowShortcuts(true),
                },
                { id: 'export', label: 'Export .pen', shortcut: 'Cmd+S', action: () => {} },
                { id: 'save-as', label: 'Save As...', shortcut: 'Cmd+Shift+S', action: () => {} },
              ] satisfies Command[]
            }
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
