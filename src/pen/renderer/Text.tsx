import type { TextNode } from '../types';
import { resolveSolidFill } from './paint';

export function Text({ node }: { node: TextNode }) {
  const fontSize = node.fontSize ?? 14;
  const lineHeight = node.lineHeight ?? 1.2;
  const fontFamily = node.fontFamily ?? 'Inter, system-ui, sans-serif';
  const fontWeight = node.fontWeight ?? 'normal';
  const fill = resolveSolidFill(node.fill);
  // Pencil の text は left/top アンカー。SVG <text> は baseline アンカーなので
  // dominantBaseline="text-before-edge" を付けて挙動を合わせる。
  const lines = (node.content ?? '').split('\n');
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const textAnchor = (() => {
    switch (node.textAlign) {
      case 'center':
        return 'middle';
      case 'right':
        return 'end';
      default:
        return 'start';
    }
  })();

  return (
    <text
      x={x}
      y={y}
      fill={fill === 'none' ? '#111827' : fill}
      fontSize={fontSize}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      dominantBaseline="text-before-edge"
      textAnchor={textAnchor}
      style={{ whiteSpace: 'pre' }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : fontSize * lineHeight}>
          {line || ' '}
        </tspan>
      ))}
    </text>
  );
}
