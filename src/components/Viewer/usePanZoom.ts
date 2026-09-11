/**
 * キャンバスのカメラ（パン / ズーム / フィット）をまとめた hook。
 *
 * PenViewer から切り出した (#71)。切り出す前は 1 ファイルに
 * カメラ操作・フレームナビゲーション・キーボード・各種パネルが同居していて、
 * 「ズームの計算を直したい」だけでも 1400 行を読む必要があった。
 *
 * ここが持つのはカメラだけ。フレームの選択やナビゲーション履歴は
 * カメラの上に載る別の関心事なので PenViewer に残してある。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PenDocument } from '../../pen/types';
import type { ViewBox } from '../../pen/renderer/viewBox';
import { fitCamera, viewportOf } from './fitCamera';

/** SVG 座標系でのカメラ。縦幅は svgWidth とビューポート比から決まる。 */
export interface Camera {
  cx: number; // center x in SVG coords
  cy: number; // center y in SVG coords
  /** How many SVG units fit in the viewport width */
  svgWidth: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 64;
const ZOOM_SENSITIVITY = 0.005;
/** フレームへズームするときに周囲へ足す余白 */
export const FRAME_PADDING_RATIO = 0.1;
/** ドキュメント全体に合わせるときの余白。computeViewBox が既に MARGIN を持つので控えめに。 */
const DOC_FIT_PADDING_RATIO = 0.02;

export interface PanZoom {
  /** キャンバス要素。ズーム計算とパネル実測に使う */
  containerRef: React.RefObject<HTMLDivElement | null>;
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;
  /** キャンバスの実寸（ルーラー用） */
  clientSize: { width: number; height: number };
  /** camera から導いた実際の viewBox */
  viewBox: ViewBox;
  /** baseVb 基準の表示倍率 */
  scale: number;
  zoomPercent: number;
  clampSvgWidth: (w: number) => number;
  /** 任意の矩形に寄る（フレームへのズーム等） */
  zoomToRect: (rect: ViewBox) => void;
  /** ドキュメント全体を表示する */
  fitToDocument: () => void;
  zoomByFactor: (factor: number) => void;
  zoomTo100: () => void;
  /** パン中か（カーソル表示の判定に使う） */
  isPanning: React.RefObject<boolean>;
  /** Space 押下中か */
  isSpaceHeld: React.RefObject<boolean>;
  handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * @param doc     表示中のドキュメント。差し替わったら全体にフィットし直す
 * @param baseVb  doc 全体を囲う viewBox（倍率 100% の基準）
 */
export function usePanZoom(doc: PenDocument, baseVb: ViewBox): PanZoom {
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera in SVG coordinate space
  // 初期値は暫定（この時点では containerRef が null でビューポート比が分からない）。
  // マウント直後の ResizeObserver で実寸を得てから全体にフィットさせる。
  const [camera, setCamera] = useState<Camera>(() => ({
    cx: baseVb.x + baseVb.width / 2,
    cy: baseVb.y + baseVb.height / 2,
    svgWidth: baseVb.width,
  }));

  /** どの doc に対して初回フィット済みか。doc が差し替わったら合わせ直す。 */
  const fittedDocRef = useRef<PenDocument | null>(null);

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

  const [clientSize, setClientSize] = useState({ width: 0, height: 0 });

  // camera から実際の viewBox を組み立てる。
  // アスペクト比は ResizeObserver が拾った clientSize から取る。レンダー中に
  // ref を読まずに済むうえ、リサイズにも素直に追随する (react-hooks/refs)。
  const aspect =
    clientSize.width > 0 && clientSize.height > 0 ? clientSize.width / clientSize.height : 16 / 9;
  const currentVb: ViewBox = useMemo(() => {
    const svgHeight = camera.svgWidth / aspect;
    return {
      x: camera.cx - camera.svgWidth / 2,
      y: camera.cy - svgHeight / 2,
      width: camera.svgWidth,
      height: svgHeight,
    };
  }, [camera, aspect]);
  const scale = baseVb.width / camera.svgWidth;
  const zoomPercent = Math.round(scale * 100);

  // ズーム倍率の上下限。関数として毎レンダー作り直すと、これを使う
  // callback / effect の依存が毎回変わるので useCallback で固定する (#78)。
  const clampSvgWidth = useCallback(
    (w: number) => {
      const minW = baseVb.width / MAX_SCALE;
      const maxW = baseVb.width / MIN_SCALE;
      return Math.min(maxW, Math.max(minW, w));
    },
    [baseVb],
  );

  // Zoom camera to an arbitrary rect in SVG coords
  const zoomToRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const fit = fitCamera(rect, viewportOf(containerRef.current), FRAME_PADDING_RATIO);
      setCamera({ ...fit, svgWidth: clampSvgWidth(fit.svgWidth) });
    },
    [clampSvgWidth],
  );

  // キャンバスのクライアントサイズ追跡（ルーラー用）＋ 初回フィット。
  //
  // 初期表示でドキュメント全体が見えるようにする処理をここに置いているのは、
  // 実際のビューポート比が分かるのが「マウント後」だから。useState の初期化子や
  // 別の effect では clientWidth/Height がまだ 0 で、幅だけ合わせた結果
  // 縦長のドキュメントが上下にはみ出していた。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      setClientSize({ width, height });
      if (width > 0 && height > 0 && fittedDocRef.current !== doc) {
        fittedDocRef.current = doc;
        const fit = fitCamera(baseVb, viewportOf(el), DOC_FIT_PADDING_RATIO);
        setCamera({ ...fit, svgWidth: clampSvgWidth(fit.svgWidth) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc, baseVb, clampSvgWidth]);

  // Collab: 参加者が初回 doc を受信したら、その doc 全体にカメラを合わせる
  useEffect(() => {
    const onFit = (e: Event) => {
      const vb = (e as CustomEvent<ViewBox>).detail;
      if (!vb || vb.width <= 0) return;
      const fit = fitCamera(vb, viewportOf(containerRef.current), DOC_FIT_PADDING_RATIO);
      setCamera({ ...fit, svgWidth: clampSvgWidth(fit.svgWidth) });
    };
    window.addEventListener('pencil-collab-fit', onFit);
    return () => window.removeEventListener('pencil-collab-fit', onFit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [camera.svgWidth, clampSvgWidth]);

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
        e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && isSpaceHeld.current);
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
    [clampSvgWidth],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
    },
    [camera],
  );

  // Zoom to center helper
  const zoomByFactor = useCallback(
    (factor: number) => {
      setCamera((prev) => ({
        ...prev,
        svgWidth: clampSvgWidth(prev.svgWidth / factor),
      }));
    },
    [clampSvgWidth],
  );

  /** 「全体を表示」。初期表示と同じ計算に揃える。 */
  const fitToDocument = useCallback(() => {
    const fit = fitCamera(baseVb, viewportOf(containerRef.current), DOC_FIT_PADDING_RATIO);
    setCamera({ ...fit, svgWidth: clampSvgWidth(fit.svgWidth) });
  }, [baseVb, clampSvgWidth]);

  const zoomTo100 = useCallback(() => {
    setCamera((prev) => ({
      ...prev,
      svgWidth: baseVb.width,
    }));
  }, [baseVb]);

  return {
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
  };
}
