/**
 * Present モード (Cmd+Enter) と Smart Animate。PenViewer.tsx から切り出した (#71)。
 *
 * - presentIdx のフレームにカメラを自動で合わせる
 * - ←/→ / PageUp / PageDown / Space でフレームを送る、Esc で終了
 * - onTap 付きノードをクリックすると onTap 先のフレームへ遷移。
 *   onTapTransition.duration があれば from/to の bbox を補間しながら
 *   rAF で progress を進め、完了時に presentIdx を切り替える
 *
 * ヒットテスト (findTapHit) と onTapTransition の探索は純関数として
 * 外に出してあり、hook 本体は effect の束になっている。
 */

import { useEffect, useRef, useState } from 'react';
import type { PenNode } from '../../pen/types';
import type { ViewBox } from '../../pen/renderer/viewBox';
import type { FrameEntry } from './frames';

export type TransitionEasing = 'linear' | 'ease-out' | 'ease-in' | 'ease-in-out';

export interface PresentTransition {
  fromIdx: number;
  toIdx: number;
  duration: number;
  easing: TransitionEasing;
  smartAnimate: boolean;
  progress: number;
  startTime: number;
}

interface OnTapTransition {
  duration?: number;
  easing?: TransitionEasing;
  smartAnimate?: boolean;
}

export interface PresentModeDeps {
  docChildren: PenNode[];
  frames: FrameEntry[];
  svgRef: React.RefObject<SVGSVGElement | null>;
  zoomToRect: (rect: ViewBox) => void;
  setActiveFrameId: (id: string | null) => void;
}

export interface PresentMode {
  presentMode: boolean;
  setPresentMode: React.Dispatch<React.SetStateAction<boolean>>;
  /** Smart Animate 中のみ非 null。SmartAnimateOverlay の描画に使う */
  transition: PresentTransition | null;
}

function sizeOf(n: PenNode): { w: number; h: number } {
  return {
    w: typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : 0,
    h: typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : 0,
  };
}

/** node tree から id → onTap (遷移先フレーム id) を引く */
export function collectTapMap(nodes: PenNode[], out = new Map<string, string>()): Map<string, string> {
  for (const n of nodes) {
    const t = (n as { onTap?: string }).onTap;
    if (t) out.set(n.id, t);
    const children = (n as { children?: PenNode[] }).children;
    if (children) collectTapMap(children, out);
  }
  return out;
}

/** id のノードの onTapTransition を探す */
function findTransition(nodes: PenNode[], id: string): OnTapTransition | undefined {
  for (const n of nodes) {
    if (n.id === id) return (n as { onTapTransition?: OnTapTransition }).onTapTransition;
    const children = (n as { children?: PenNode[] }).children;
    if (children) {
      const v = findTransition(children, id);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

/**
 * SVG 座標 (x, y) を含み、かつ onTap を持つノードの id を前面優先で探す。
 * frame の子はローカル座標に変換して再帰する。
 */
export function findTapHit(
  nodes: PenNode[],
  x: number,
  y: number,
  tapMap: Map<string, string>,
): string | null {
  // top-level から逆順（前面優先）で探す
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const nx = n.x ?? 0;
    const ny = n.y ?? 0;
    const { w: nw, h: nh } = sizeOf(n);
    if (nw > 0 && nh > 0 && x >= nx && x <= nx + nw && y >= ny && y <= ny + nh) {
      // children から先にヒットしたら優先
      const children = (n as { children?: PenNode[] }).children;
      if (children) {
        // frame の場合は子のローカル座標に変換
        const localX = x - nx;
        const localY = y - ny;
        const hit = (function findLocal(ns: PenNode[]): string | null {
          for (let j = ns.length - 1; j >= 0; j--) {
            const m = ns[j];
            const mx = m.x ?? 0;
            const my = m.y ?? 0;
            const { w: mw, h: mh } = sizeOf(m);
            if (mw > 0 && mh > 0 && localX >= mx && localX <= mx + mw && localY >= my && localY <= my + mh) {
              const gc = (m as { children?: PenNode[] }).children;
              if (gc) {
                // さらに深く探す
                const deeper = findLocal(gc);
                if (deeper && tapMap.has(deeper)) return deeper;
              }
              if (tapMap.has(m.id)) return m.id;
            }
          }
          return null;
        })(children);
        if (hit) return hit;
      }
      if (tapMap.has(n.id)) return n.id;
    }
  }
  return null;
}

export function usePresentMode({
  docChildren,
  frames,
  svgRef,
  zoomToRect,
  setActiveFrameId,
}: PresentModeDeps): PresentMode {
  const [presentMode, setPresentMode] = useState(false);
  const [presentIdx, setPresentIdx] = useState(0);
  /** presentMode 中のクリックリスナーから最新のスライド番号を読むための控え */
  const presentIdxRef = useRef(presentIdx);
  useEffect(() => {
    presentIdxRef.current = presentIdx;
  }, [presentIdx]);
  // Smart Animate トランジション状態
  const [transition, setTransition] = useState<PresentTransition | null>(null);

  // Present モード: active frame に自動ズーム（transition 中はスキップ）
  useEffect(() => {
    if (!presentMode) return;
    if (transition) return;
    if (frames.length === 0) return;
    const target = frames[Math.max(0, Math.min(frames.length - 1, presentIdx))];
    if (!target) return;
    zoomToRect({ x: target.x, y: target.y, width: target.width, height: target.height });
    setActiveFrameId(target.id);
  }, [presentMode, presentIdx, frames, zoomToRect, transition, setActiveFrameId]);

  // transition 中は from/to bbox を補間したビューを camera に設定
  useEffect(() => {
    if (!transition) return;
    const from = frames[transition.fromIdx];
    const to = frames[transition.toIdx];
    if (!from || !to) return;
    const t = transition.progress;
    const ix = from.x + (to.x - from.x) * t;
    const iy = from.y + (to.y - from.y) * t;
    const iw = from.width + (to.width - from.width) * t;
    const ih = from.height + (to.height - from.height) * t;
    zoomToRect({ x: ix, y: iy, width: iw, height: ih });
  }, [transition, frames, zoomToRect]);

  // Present モード時に onTap 付きノードをクリックで遷移
  useEffect(() => {
    if (!presentMode) return;
    const svg = svgRef.current;
    if (!svg) return;

    const tapMap = collectTapMap(docChildren);
    if (tapMap.size === 0) return;

    const onClick = (e: PointerEvent) => {
      // SVG 座標に変換して doc を走査し、クリック点を含むノードを探す
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const x = (e.clientX - ctm.e) / ctm.a;
      const y = (e.clientY - ctm.f) / ctm.d;
      const hitId = findTapHit(docChildren, x, y, tapMap);
      if (!hitId) return;
      const target = tapMap.get(hitId);
      if (!target) return;
      const idx = frames.findIndex((f) => f.id === target);
      if (idx < 0) return;

      e.preventDefault();
      e.stopPropagation();
      // 当該ノードの onTapTransition を取り出して transition を開始
      const trans = findTransition(docChildren, hitId);
      const duration = trans?.duration ?? 0;
      if (duration > 0) {
        setTransition({
          // リスナーは presentMode 中に貼りっぱなしなので、クリック時点の
          // 最新スライド番号を ref から読む（deps に入れると貼り直しになる）
          fromIdx: presentIdxRef.current,
          toIdx: idx,
          duration,
          easing: trans?.easing ?? 'ease-out',
          smartAnimate: trans?.smartAnimate ?? true,
          progress: 0,
          startTime: performance.now(),
        });
      } else {
        setPresentIdx(idx);
      }
    };
    svg.addEventListener('pointerdown', onClick as EventListener, true);
    return () => svg.removeEventListener('pointerdown', onClick as EventListener, true);
  }, [presentMode, docChildren, frames, svgRef]);

  // Smart Animate: rAF ループで progress を更新、完了したら presentIdx を切替
  useEffect(() => {
    if (!transition) return;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const elapsed = now - transition.startTime;
      const p = Math.max(0, Math.min(1, elapsed / transition.duration));
      setTransition((prev) => (prev ? { ...prev, progress: p } : null));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        // 完了: presentIdx を切替して transition クリア
        setPresentIdx(transition.toIdx);
        setTransition(null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // startTime が変わったとき (= 新しい transition が始まったとき) だけ
    // ループを張り直す。progress の更新で再実行させない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transition?.startTime]);

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

  return { presentMode, setPresentMode, transition };
}
