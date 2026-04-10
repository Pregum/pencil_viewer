/**
 * ノード種別で dispatch する共通エントリ。
 * SelectableNode でラップしてクリック選択を有効化する。
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
import { Image } from './Image';
import { Unsupported } from './Unsupported';
import { SelectableNode } from './SelectableNode';

function renderNode(node: PenNode) {
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
    case 'image':
      return <Image node={node} />;
    case 'unsupported':
      return <Unsupported node={node} />;
    default:
      node satisfies never;
      return null;
  }
}

export function PenNodeView({ node }: { node: PenNode }) {
  return (
    <SelectableNode node={node}>
      {renderNode(node)}
    </SelectableNode>
  );
}
