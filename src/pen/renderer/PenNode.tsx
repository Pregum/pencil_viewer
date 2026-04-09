/**
 * ノード種別で dispatch する共通エントリ。
 *
 * MVP では rectangle / ellipse のみ実装し、その他は `Unsupported` でプレース
 * ホルダ表示(全体描画は停止しない)。Step 5 で line / polygon / path / text /
 * group / frame を追加する。
 */

import type { PenNode } from '../types';
import { Rectangle } from './Rectangle';
import { Ellipse } from './Ellipse';
import { Unsupported } from './Unsupported';

export function PenNodeView({ node }: { node: PenNode }) {
  switch (node.type) {
    case 'rectangle':
      return <Rectangle node={node} />;
    case 'ellipse':
      return <Ellipse node={node} />;
    case 'unsupported':
      return <Unsupported node={node} />;
    default:
      // Step 5 で対応するまでは未実装ノードは警告表示
      return (
        <Unsupported
          node={{
            type: 'unsupported',
            id: node.id,
            x: (node as { x?: number }).x ?? 0,
            y: (node as { y?: number }).y ?? 0,
            width: (node as { width?: number | string }).width ?? 120,
            height: (node as { height?: number | string }).height ?? 60,
            originalType: node.type,
            raw: node,
          }}
        />
      );
  }
}
