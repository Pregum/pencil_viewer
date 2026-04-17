/**
 * Smart Animate 遷移オーバーレイ。
 *
 * 2 つの frame (from / to) を受け取り、t ∈ [0,1] の進行度で補間した子孫を描画する。
 *
 *   - from/to の直接の子を id で match（id 同じ = 同じノード扱い）
 *   - 両方にある → interpolateNode で値を補間して描画（opacity 1）
 *   - from のみ → 残置 + opacity を (1 - t) に fade
 *   - to のみ    → 出現 + opacity を t に fade
 *
 *   互換: Variables / Styles 等は state.doc に含まれるので、<CanvasContent/> の
 *   resolveRefs は別途適用される前提。ここではローカルな子ノードの見た目のみ扱う。
 */

import { useMemo } from 'react';
import type { FrameNode, PenNode } from '../../pen/types';
import { ease, interpolateNode } from '../../pen/renderer/interpolate';
import { PenNodeView } from '../../pen/renderer/PenNode';

interface Props {
  fromFrame: FrameNode;
  toFrame: FrameNode;
  /** 0..1 の進行度 */
  progress: number;
  easing?: 'linear' | 'ease-out' | 'ease-in' | 'ease-in-out';
  /** true: smart animate（id マッチで補間）、false: crossfade のみ */
  smartAnimate?: boolean;
}

function childrenOf(f: FrameNode): PenNode[] {
  return f.children ?? [];
}

export function SmartAnimateOverlay({ fromFrame, toFrame, progress, easing = 'ease-out', smartAnimate = true }: Props) {
  const t = ease(progress, easing);

  // from / to 両方に渡る id をマッチ
  const matched = useMemo(() => {
    const fromCh = childrenOf(fromFrame);
    const toCh = childrenOf(toFrame);
    const fromMap = new Map(fromCh.map((c) => [c.id, c]));
    const toMap = new Map(toCh.map((c) => [c.id, c]));
    const common: Array<{ id: string; from: PenNode; to: PenNode }> = [];
    const fromOnly: PenNode[] = [];
    const toOnly: PenNode[] = [];
    for (const c of fromCh) {
      const b = toMap.get(c.id);
      if (b) common.push({ id: c.id, from: c, to: b });
      else fromOnly.push(c);
    }
    for (const c of toCh) {
      if (!fromMap.has(c.id)) toOnly.push(c);
    }
    return { common, fromOnly, toOnly };
  }, [fromFrame, toFrame]);

  // from frame の位置（子ノードは frame 内ローカル座標で保存されているため、
  // frame 自身の translate を当てる）
  const fx = fromFrame.x ?? 0;
  const fy = fromFrame.y ?? 0;
  const tx = toFrame.x ?? 0;
  const ty = toFrame.y ?? 0;
  // 親 frame 座標も補間して、フレーム全体の移動も再現
  const ox = fx + (tx - fx) * t;
  const oy = fy + (ty - fy) * t;

  return (
    <g transform={`translate(${ox} ${oy})`}>
      {smartAnimate ? (
        <>
          {matched.common.map(({ id, from, to }) => {
            const interp = interpolateNode(from, to, t);
            return <PenNodeView key={id} node={interp} />;
          })}
          {matched.fromOnly.map((c) => (
            <g key={`from-${c.id}`} opacity={1 - t}>
              <PenNodeView node={c} />
            </g>
          ))}
          {matched.toOnly.map((c) => (
            <g key={`to-${c.id}`} opacity={t}>
              <PenNodeView node={c} />
            </g>
          ))}
        </>
      ) : (
        // crossfade のみ
        <>
          <g opacity={1 - t}>
            {childrenOf(fromFrame).map((c) => <PenNodeView key={`from-${c.id}`} node={c} />)}
          </g>
          <g opacity={t}>
            {childrenOf(toFrame).map((c) => <PenNodeView key={`to-${c.id}`} node={c} />)}
          </g>
        </>
      )}
    </g>
  );
}
