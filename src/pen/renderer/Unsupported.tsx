import type { UnsupportedNode } from '../types';

export function Unsupported({ node }: { node: UnsupportedNode }) {
  const width = typeof node.width === 'number' ? node.width : 120;
  const height = typeof node.height === 'number' ? node.height : 60;
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#FFF5F5"
        stroke="#FF6B6B"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        rx={6}
        ry={6}
      />
      <text
        x={x + 8}
        y={y + 18}
        fontSize={11}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="#991B1B"
      >
        ⚠ {node.originalType}
      </text>
    </g>
  );
}
