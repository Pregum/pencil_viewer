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
