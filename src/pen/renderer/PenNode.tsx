/**
 * ノード種別で dispatch する共通エントリ。
 *
 * Step 5 までで対応: rectangle / ellipse / line / polygon / path / text /
 * frame (layout 計算なし) / group / icon_font 一部
 *
 * 未対応 type は `Unsupported` でプレースホルダ表示(全体描画は停止しない)。
 */

import type { PenNode } from '../types';
import { Rectangle } from './Rectangle';
import { Ellipse } from './Ellipse';
import { Line } from './Line';
import { Polygon } from './Polygon';
import { Path } from './Path';
import { Text } from './Text';
import { Frame } from './Frame';
import { Group } from './Group';
import { IconFont } from './IconFont';
import { Unsupported } from './Unsupported';

export function PenNodeView({ node }: { node: PenNode }) {
  switch (node.type) {
    case 'rectangle':
      return <Rectangle node={node} />;
    case 'ellipse':
      return <Ellipse node={node} />;
    case 'line':
      return <Line node={node} />;
    case 'polygon':
      return <Polygon node={node} />;
    case 'path':
      return <Path node={node} />;
    case 'text':
      return <Text node={node} />;
    case 'frame':
      return <Frame node={node} />;
    case 'group':
      return <Group node={node} />;
    case 'icon_font':
      return <IconFont node={node} />;
    case 'unsupported':
      return <Unsupported node={node} />;
    default:
      // ここに来るのは型の網羅漏れ。型エラーを出すため never に代入
      node satisfies never;
      return null;
  }
}
