/**
 * スマートガイドのスナップ計算（純粋関数）。
 *
 * ドラッグ中のノード矩形 (moving) と、他の静止矩形群 (statics) を比較し、
 * 左 / 中央 / 右 / 上 / 中央 / 下 の主要 6 ラインがしきい値内に接近したら吸着させる。
 *
 * - threshold は SVG 座標系での距離（呼び出し側で画面 px から変換して渡す）
 * - 返り値: 吸着後の {x, y} と、表示すべきガイド配列
 */

export interface SnapRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuide {
  /** 'v' = 縦線 / 'h' = 横線 */
  orientation: 'v' | 'h';
  /** 縦線なら x 座標、横線なら y 座標 */
  pos: number;
  /** ガイドの始点・終点（反対軸） */
  from: number;
  to: number;
  /** 参照した静止ノードID */
  targetId: string;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/** moving の x/y を static の各ラインに吸着させる */
export function computeSnap(
  moving: SnapRect,
  statics: SnapRect[],
  threshold: number,
): SnapResult {
  const guides: SnapGuide[] = [];
  let bestDx: { delta: number; guide: SnapGuide } | null = null;
  let bestDy: { delta: number; guide: SnapGuide } | null = null;

  const mLeft = moving.x;
  const mRight = moving.x + moving.width;
  const mCenterX = moving.x + moving.width / 2;
  const mTop = moving.y;
  const mBottom = moving.y + moving.height;
  const mCenterY = moving.y + moving.height / 2;

  for (const s of statics) {
    if (s.id === moving.id) continue;
    const sLeft = s.x;
    const sRight = s.x + s.width;
    const sCenterX = s.x + s.width / 2;
    const sTop = s.y;
    const sBottom = s.y + s.height;
    const sCenterY = s.y + s.height / 2;

    const vLines: Array<{ m: number; t: number }> = [
      { m: mLeft, t: sLeft },
      { m: mLeft, t: sRight },
      { m: mRight, t: sLeft },
      { m: mRight, t: sRight },
      { m: mCenterX, t: sCenterX },
    ];
    for (const { m, t } of vLines) {
      const diff = t - m;
      if (Math.abs(diff) < threshold) {
        const guide: SnapGuide = {
          orientation: 'v',
          pos: t,
          from: Math.min(moving.y, s.y),
          to: Math.max(moving.y + moving.height, s.y + s.height),
          targetId: s.id,
        };
        if (!bestDx || Math.abs(diff) < Math.abs(bestDx.delta)) {
          bestDx = { delta: diff, guide };
        } else if (Math.abs(diff) === Math.abs(bestDx.delta) && diff === bestDx.delta) {
          guides.push(guide);
        }
      }
    }

    const hLines: Array<{ m: number; t: number }> = [
      { m: mTop, t: sTop },
      { m: mTop, t: sBottom },
      { m: mBottom, t: sTop },
      { m: mBottom, t: sBottom },
      { m: mCenterY, t: sCenterY },
    ];
    for (const { m, t } of hLines) {
      const diff = t - m;
      if (Math.abs(diff) < threshold) {
        const guide: SnapGuide = {
          orientation: 'h',
          pos: t,
          from: Math.min(moving.x, s.x),
          to: Math.max(moving.x + moving.width, s.x + s.width),
          targetId: s.id,
        };
        if (!bestDy || Math.abs(diff) < Math.abs(bestDy.delta)) {
          bestDy = { delta: diff, guide };
        } else if (Math.abs(diff) === Math.abs(bestDy.delta) && diff === bestDy.delta) {
          guides.push(guide);
        }
      }
    }
  }

  const outGuides: SnapGuide[] = [];
  let outX = moving.x;
  let outY = moving.y;
  if (bestDx) {
    outX = moving.x + bestDx.delta;
    outGuides.push(bestDx.guide);
  }
  if (bestDy) {
    outY = moving.y + bestDy.delta;
    outGuides.push(bestDy.guide);
  }
  // 同ベスト距離の競合候補も表示（複数ガイドが一致する場合）
  for (const g of guides) {
    if (outGuides.some((og) => og.orientation === g.orientation && og.pos === g.pos)) continue;
    if (bestDx && g.orientation === 'v' && Math.abs(g.pos - (moving.x + bestDx.delta)) < 0.5) {
      outGuides.push(g);
    } else if (bestDy && g.orientation === 'h' && Math.abs(g.pos - (moving.y + bestDy.delta)) < 0.5) {
      outGuides.push(g);
    }
  }
  return { x: outX, y: outY, guides: outGuides };
}

/**
 * 等間隔スナップ: moving の両側にある static ノードの「間に収まる位置」に
 * 左右（上下）のギャップを等しくするよう吸着させる。
 * 水平は moving と y 方向に重なる static、垂直は x 方向に重なる static が対象。
 */
export interface EqualSpaceGuide {
  orientation: 'h' | 'v';
  /** 表示距離（整数丸め済み） */
  spacing: number;
  /** 左右 or 上下のギャップセグメント（描画用: { start, end, perp }）*/
  segments: Array<{ start: number; end: number; perp: number }>;
}

export interface EqualSpaceResult {
  x: number;
  y: number;
  guides: EqualSpaceGuide[];
}

function overlaps1D(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2;
}

export function computeEqualSpaceSnap(
  moving: SnapRect,
  statics: SnapRect[],
  threshold: number,
): EqualSpaceResult {
  let outX = moving.x;
  let outY = moving.y;
  const guides: EqualSpaceGuide[] = [];

  // --- 水平方向 (左右に static が挟む) ---
  const mTop = moving.y;
  const mBottom = moving.y + moving.height;
  const hStatics = statics.filter(
    (s) => s.id !== moving.id && overlaps1D(mTop, mBottom, s.y, s.y + s.height),
  );
  let bestH: { targetX: number; diff: number; guide: EqualSpaceGuide } | null = null;
  for (const left of hStatics) {
    for (const right of hStatics) {
      if (left.id === right.id) continue;
      const leftRight = left.x + left.width;
      const rightLeft = right.x;
      if (leftRight >= rightLeft) continue; // 左右の関係
      const gap = rightLeft - leftRight;
      if (gap <= moving.width + 4) continue; // moving が収まらない
      const spacing = (gap - moving.width) / 2;
      const targetX = leftRight + spacing;
      const diff = Math.abs(moving.x - targetX);
      if (diff < threshold && (!bestH || diff < Math.abs(bestH.diff))) {
        const perp = (Math.max(mTop, left.y, right.y) + Math.min(mBottom, left.y + left.height, right.y + right.height)) / 2;
        bestH = {
          targetX,
          diff: moving.x - targetX,
          guide: {
            orientation: 'h',
            spacing: Math.round(spacing),
            segments: [
              { start: leftRight, end: targetX, perp },
              { start: targetX + moving.width, end: rightLeft, perp },
            ],
          },
        };
      }
    }
  }
  if (bestH) {
    outX = bestH.targetX;
    guides.push(bestH.guide);
  }

  // --- 垂直方向 (上下に static が挟む) ---
  const mLeft = moving.x;
  const mRight = moving.x + moving.width;
  const vStatics = statics.filter(
    (s) => s.id !== moving.id && overlaps1D(mLeft, mRight, s.x, s.x + s.width),
  );
  let bestV: { targetY: number; diff: number; guide: EqualSpaceGuide } | null = null;
  for (const top of vStatics) {
    for (const bottom of vStatics) {
      if (top.id === bottom.id) continue;
      const topBottom = top.y + top.height;
      const bottomTop = bottom.y;
      if (topBottom >= bottomTop) continue;
      const gap = bottomTop - topBottom;
      if (gap <= moving.height + 4) continue;
      const spacing = (gap - moving.height) / 2;
      const targetY = topBottom + spacing;
      const diff = Math.abs(moving.y - targetY);
      if (diff < threshold && (!bestV || diff < Math.abs(bestV.diff))) {
        const perp = (Math.max(mLeft, top.x, bottom.x) + Math.min(mRight, top.x + top.width, bottom.x + bottom.width)) / 2;
        bestV = {
          targetY,
          diff: moving.y - targetY,
          guide: {
            orientation: 'v',
            spacing: Math.round(spacing),
            segments: [
              { start: topBottom, end: targetY, perp },
              { start: targetY + moving.height, end: bottomTop, perp },
            ],
          },
        };
      }
    }
  }
  if (bestV) {
    outY = bestV.targetY;
    guides.push(bestV.guide);
  }

  return { x: outX, y: outY, guides };
}

export interface ResizeSnapResult {
  /** 調整後の矩形（top-left + size） */
  x: number;
  y: number;
  width: number;
  height: number;
  guides: SnapGuide[];
}

/**
 * リサイズ中のスナップ。handle はどの辺を動かしているか（'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'）。
 * 動いている辺だけを、static の edge/center にスナップさせる。最小幅/高さは 1 で clamp。
 */
export function computeResizeSnap(
  moving: SnapRect,
  statics: SnapRect[],
  handle: string,
  threshold: number,
): ResizeSnapResult {
  const movingRight = handle.includes('e');
  const movingLeft = handle.includes('w');
  const movingBottom = handle.includes('s');
  const movingTop = handle.includes('n');

  const mLeft = moving.x;
  const mRight = moving.x + moving.width;
  const mTop = moving.y;
  const mBottom = moving.y + moving.height;

  let bestDx: { delta: number; guide: SnapGuide } | null = null;
  let bestDy: { delta: number; guide: SnapGuide } | null = null;

  for (const s of statics) {
    if (s.id === moving.id) continue;
    const sLines = [s.x, s.x + s.width, s.x + s.width / 2];
    const sHLines = [s.y, s.y + s.height, s.y + s.height / 2];

    if (movingRight) {
      for (const t of sLines) {
        const diff = t - mRight;
        if (Math.abs(diff) < threshold && (!bestDx || Math.abs(diff) < Math.abs(bestDx.delta))) {
          bestDx = {
            delta: diff,
            guide: {
              orientation: 'v',
              pos: t,
              from: Math.min(moving.y, s.y),
              to: Math.max(moving.y + moving.height, s.y + s.height),
              targetId: s.id,
            },
          };
        }
      }
    }
    if (movingLeft) {
      for (const t of sLines) {
        const diff = t - mLeft;
        if (Math.abs(diff) < threshold && (!bestDx || Math.abs(diff) < Math.abs(bestDx.delta))) {
          bestDx = {
            delta: diff,
            guide: {
              orientation: 'v',
              pos: t,
              from: Math.min(moving.y, s.y),
              to: Math.max(moving.y + moving.height, s.y + s.height),
              targetId: s.id,
            },
          };
        }
      }
    }
    if (movingBottom) {
      for (const t of sHLines) {
        const diff = t - mBottom;
        if (Math.abs(diff) < threshold && (!bestDy || Math.abs(diff) < Math.abs(bestDy.delta))) {
          bestDy = {
            delta: diff,
            guide: {
              orientation: 'h',
              pos: t,
              from: Math.min(moving.x, s.x),
              to: Math.max(moving.x + moving.width, s.x + s.width),
              targetId: s.id,
            },
          };
        }
      }
    }
    if (movingTop) {
      for (const t of sHLines) {
        const diff = t - mTop;
        if (Math.abs(diff) < threshold && (!bestDy || Math.abs(diff) < Math.abs(bestDy.delta))) {
          bestDy = {
            delta: diff,
            guide: {
              orientation: 'h',
              pos: t,
              from: Math.min(moving.x, s.x),
              to: Math.max(moving.x + moving.width, s.x + s.width),
              targetId: s.id,
            },
          };
        }
      }
    }
  }

  let outX = moving.x;
  let outY = moving.y;
  let outW = moving.width;
  let outH = moving.height;
  const guides: SnapGuide[] = [];

  if (bestDx) {
    if (movingRight) outW = Math.max(1, outW + bestDx.delta);
    if (movingLeft) {
      outW = Math.max(1, outW - bestDx.delta);
      outX = outX + bestDx.delta;
    }
    guides.push(bestDx.guide);
  }
  if (bestDy) {
    if (movingBottom) outH = Math.max(1, outH + bestDy.delta);
    if (movingTop) {
      outH = Math.max(1, outH - bestDy.delta);
      outY = outY + bestDy.delta;
    }
    guides.push(bestDy.guide);
  }

  return { x: outX, y: outY, width: outW, height: outH, guides };
}
