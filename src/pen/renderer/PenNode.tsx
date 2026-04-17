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
import { Note } from './Note';
import { Connection } from './Connection';
import { Unsupported } from './Unsupported';
import { SelectableNode } from './SelectableNode';
import { TextEditor } from '../../components/Viewer/TextEditor';
import { useEditor } from '../state/EditorContext';

function renderNode(node: PenNode, editingNodeId: string | null) {
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
      return editingNodeId === node.id ? <TextEditor node={node} /> : <Text node={node} />;
    case 'frame':
      return <Frame node={node} />;
    case 'group':
      return <Group node={node} />;
    case 'icon_font':
      return <IconFont node={node} />;
    case 'image':
      return <Image node={node} />;
    case 'ref':
      // ref は resolveRefs で展開済み。未解決の場合のフォールバック
      return (
        <Unsupported
          node={{
            type: 'unsupported',
            id: node.id,
            x: node.x ?? 0,
            y: node.y ?? 0,
            width: typeof node.width === 'number' ? node.width : 120,
            height: typeof node.height === 'number' ? node.height : 60,
            originalType: `ref:${node.ref}`,
            raw: node,
          }}
        />
      );
    case 'note':
      return <Note node={node} />;
    case 'connection':
      return <Connection node={node} />;
    case 'unsupported':
      return <Unsupported node={node} />;
    default:
      node satisfies never;
      return null;
  }
}

export function PenNodeView({ node }: { node: PenNode }) {
  const { state } = useEditor();
  return (
    <SelectableNode node={node}>
      {renderNode(node, state.editingNodeId)}
    </SelectableNode>
  );
}
