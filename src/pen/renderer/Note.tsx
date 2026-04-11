import type { NoteNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import { resolveFill } from './paint';

/**
 * 付箋メモノード。Pencil の note はアノテーション用の黄色い付箋。
 * エディタ上では開発者メモとして表示される。ビュワーでも薄い表示で再現する。
 */
export function Note({ node }: { node: NoteNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : 200;
  const height = typeof node.height === 'number' ? node.height : 100;
  const fontSize = node.fontSize ?? 12;
  const fill = resolveFill(node.fill, ctx);
  const bgFill = fill !== 'none' ? fill : '#FEF9C3';

  return (
    <g transform={`translate(${x} ${y})`} opacity={0.7}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={4}
        ry={4}
        fill={bgFill}
        stroke="#FDE68A"
        strokeWidth={1}
      />
      {node.content && (
        <text
          x={8}
          y={8}
          fontSize={fontSize}
          fontFamily={node.fontFamily ?? 'Inter, system-ui, sans-serif'}
          fill="#92400E"
          dominantBaseline="text-before-edge"
          style={{ whiteSpace: 'pre' }}
        >
          {node.content.split('\n').map((line, i) => (
            <tspan key={i} x={8} dy={i === 0 ? 0 : fontSize * 1.3}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      )}
    </g>
  );
}
