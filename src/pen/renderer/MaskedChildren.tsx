/**
 * mask?: true のノードを含む子配列を SVG 上で正しくマスクして描画する。
 *
 * Figma の "Use as mask": mask ノードは自身は描画されず、後続兄弟を alpha
 * クリップする。同じ親内で複数 mask があれば独立したセグメントに分かれる。
 *
 * SVG 実装:
 *   <defs>
 *     <mask id="mask-<id>" mask-type="alpha">
 *       <renderedMaskNode />   { fill は元のまま使う — mask-type=alpha なので alpha で抜ける }
 *     </mask>
 *   </defs>
 *   <g mask="url(#mask-<id>)">
 *     <followingSiblings />
 *   </g>
 */

import type { PenNode } from '../types';
import { PenNodeView } from './PenNode';

interface Segment {
  maskId?: string;
  maskNode?: PenNode;
  children: PenNode[];
}

function splitByMasks(children: PenNode[]): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = { children: [] };
  for (const c of children) {
    const isMask = (c as { mask?: boolean }).mask === true;
    if (isMask) {
      // 直前のセグメントを閉じる
      if (current.children.length > 0 || current.maskNode) segments.push(current);
      current = {
        maskId: `mask-${c.id}`,
        maskNode: c,
        children: [],
      };
    } else {
      current.children.push(c);
    }
  }
  if (current.children.length > 0 || current.maskNode) segments.push(current);
  return segments;
}

/**
 * 子配列を描画する。mask ノードが無ければ単純な列挙。
 * mask がある場合、<defs> にマスクを追加して後続兄弟を <g mask> でラップする。
 */
export function renderMaskedChildren(children: PenNode[]): JSX.Element[] | JSX.Element {
  const segments = splitByMasks(children);
  // mask が全く無い早道
  if (segments.length === 1 && !segments[0].maskNode) {
    return children.map((c) => <PenNodeView key={c.id} node={c} />);
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.maskNode) {
          return (
            <g key={`seg-${i}`}>
              {seg.children.map((c) => <PenNodeView key={c.id} node={c} />)}
            </g>
          );
        }
        return (
          <g key={`seg-${i}`}>
            <defs>
              <mask id={seg.maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
                {/* mask-type=alpha 相当: content の alpha を使う */}
                <g style={{ maskType: 'alpha' } as React.CSSProperties}>
                  <PenNodeView node={seg.maskNode} />
                </g>
              </mask>
            </defs>
            <g mask={`url(#${seg.maskId})`}>
              {seg.children.map((c) => <PenNodeView key={c.id} node={c} />)}
            </g>
          </g>
        );
      })}
    </>
  );
}
