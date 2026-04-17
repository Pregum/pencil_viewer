/**
 * Dev Mode Inspect: 選択ノードのプロパティを CSS / Tailwind / SwiftUI /
 * Jetpack Compose のスニペットに変換して表示、コピーボタン付き。
 *
 * Figma の Dev Mode Inspect Panel 相当（MVP）。
 */

import { useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode, Fill, Fills } from '../../pen/types';

type Lang = 'css' | 'tailwind' | 'swiftui' | 'compose';

interface Props {
  onClose: () => void;
}

function firstColor(fill: Fills | undefined): string | null {
  if (!fill) return null;
  const single: Fill | undefined = Array.isArray(fill) ? fill[0] : fill;
  if (!single) return null;
  if (typeof single === 'string') return single;
  if (single.type === 'color') return single.color;
  if (single.type === 'gradient') return single.colors?.[0]?.color ?? null;
  return null;
}

function toGradientCSS(fill: Fills | undefined): string | null {
  if (!fill) return null;
  const single: Fill | undefined = Array.isArray(fill) ? fill[0] : fill;
  if (!single || typeof single === 'string') return null;
  if (single.type !== 'gradient') return null;
  const stops = (single.colors ?? []).map((c) => `${c.color} ${Math.round(c.position * 100)}%`).join(', ');
  const angle = single.rotation ?? 0;
  if (single.gradientType === 'radial') return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${angle}deg, ${stops})`;
}

function formatHex(color: string | null | undefined): string | null {
  if (!color) return null;
  return color.startsWith('#') ? color.toUpperCase() : color;
}

function generateCSS(n: PenNode): string {
  const w = typeof (n as { width?: unknown }).width === 'number' ? `${(n as { width: number }).width}px` : 'auto';
  const h = typeof (n as { height?: unknown }).height === 'number' ? `${(n as { height: number }).height}px` : 'auto';
  const lines: string[] = [];
  lines.push(`width: ${w};`);
  lines.push(`height: ${h};`);
  const fillColor = firstColor((n as { fill?: Fills }).fill);
  const gradient = toGradientCSS((n as { fill?: Fills }).fill);
  if (gradient) {
    lines.push(`background: ${gradient};`);
  } else if (fillColor) {
    if (n.type === 'text') lines.push(`color: ${formatHex(fillColor)};`);
    else lines.push(`background: ${formatHex(fillColor)};`);
  }
  const cr = (n as { cornerRadius?: unknown }).cornerRadius;
  if (typeof cr === 'number' && cr > 0) {
    lines.push(`border-radius: ${cr}px;`);
  } else if (Array.isArray(cr) && cr.length === 4) {
    lines.push(`border-radius: ${cr.join('px ')}px;`);
  }
  const stroke = (n as { stroke?: { thickness?: number; fill?: Fills } }).stroke;
  if (stroke?.thickness && typeof stroke.thickness === 'number' && stroke.thickness > 0) {
    const sc = formatHex(firstColor(stroke.fill));
    if (sc) lines.push(`border: ${stroke.thickness}px solid ${sc};`);
  }
  const op = (n as { opacity?: number }).opacity;
  if (op != null && op !== 1) lines.push(`opacity: ${op};`);
  const rot = (n as { rotation?: number }).rotation;
  if (rot != null && rot !== 0) lines.push(`transform: rotate(${-rot}deg);`);
  // text 固有
  if (n.type === 'text') {
    const t = n as PenNode & { fontSize?: number; fontFamily?: string; fontWeight?: string; lineHeight?: number; letterSpacing?: number; textAlign?: string };
    if (t.fontFamily) lines.push(`font-family: "${t.fontFamily}";`);
    if (t.fontSize) lines.push(`font-size: ${t.fontSize}px;`);
    if (t.fontWeight) lines.push(`font-weight: ${t.fontWeight};`);
    if (t.lineHeight) lines.push(`line-height: ${t.lineHeight};`);
    if (t.letterSpacing) lines.push(`letter-spacing: ${t.letterSpacing}px;`);
    if (t.textAlign) lines.push(`text-align: ${t.textAlign};`);
  }
  // flex (frame)
  if (n.type === 'frame') {
    const f = n as PenNode & { layout?: string; gap?: number; padding?: unknown; justifyContent?: string; alignItems?: string };
    if (f.layout === 'horizontal' || f.layout === 'vertical') {
      lines.push(`display: flex;`);
      lines.push(`flex-direction: ${f.layout === 'vertical' ? 'column' : 'row'};`);
      if (f.gap) lines.push(`gap: ${f.gap}px;`);
      if (typeof f.padding === 'number') lines.push(`padding: ${f.padding}px;`);
      if (f.justifyContent) {
        const mapped = f.justifyContent === 'space_between' ? 'space-between'
          : f.justifyContent === 'space_around' ? 'space-around'
          : f.justifyContent;
        lines.push(`justify-content: ${mapped};`);
      }
      if (f.alignItems) lines.push(`align-items: ${f.alignItems};`);
    }
  }
  return lines.join('\n');
}

function generateTailwind(n: PenNode): string {
  const cls: string[] = [];
  const w = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : null;
  const h = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : null;
  if (w != null) cls.push(`w-[${w}px]`);
  if (h != null) cls.push(`h-[${h}px]`);
  const fillColor = formatHex(firstColor((n as { fill?: Fills }).fill));
  if (fillColor) {
    if (n.type === 'text') cls.push(`text-[${fillColor}]`);
    else cls.push(`bg-[${fillColor}]`);
  }
  const cr = (n as { cornerRadius?: unknown }).cornerRadius;
  if (typeof cr === 'number' && cr > 0) cls.push(`rounded-[${cr}px]`);
  const op = (n as { opacity?: number }).opacity;
  if (op != null && op !== 1) cls.push(`opacity-[${op}]`);
  const rot = (n as { rotation?: number }).rotation;
  if (rot != null && rot !== 0) cls.push(`rotate-[${-rot}deg]`);
  // stroke
  const stroke = (n as { stroke?: { thickness?: number; fill?: Fills } }).stroke;
  if (stroke?.thickness && typeof stroke.thickness === 'number' && stroke.thickness > 0) {
    cls.push(`border-[${stroke.thickness}px]`);
    const sc = formatHex(firstColor(stroke.fill));
    if (sc) cls.push(`border-[${sc}]`);
  }
  if (n.type === 'text') {
    const t = n as PenNode & { fontSize?: number; fontWeight?: string; textAlign?: string };
    if (t.fontSize) cls.push(`text-[${t.fontSize}px]`);
    if (t.fontWeight === 'bold' || t.fontWeight === '700') cls.push(`font-bold`);
    if (t.textAlign === 'center') cls.push(`text-center`);
    if (t.textAlign === 'right') cls.push(`text-right`);
  }
  if (n.type === 'frame') {
    const f = n as PenNode & { layout?: string; gap?: number; padding?: unknown };
    if (f.layout === 'horizontal') cls.push(`flex flex-row`);
    if (f.layout === 'vertical') cls.push(`flex flex-col`);
    if (f.gap) cls.push(`gap-[${f.gap}px]`);
    if (typeof f.padding === 'number') cls.push(`p-[${f.padding}px]`);
  }
  return cls.join(' ');
}

function generateSwiftUI(n: PenNode): string {
  const w = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : null;
  const h = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : null;
  const fillColor = formatHex(firstColor((n as { fill?: Fills }).fill));
  const cr = typeof (n as { cornerRadius?: unknown }).cornerRadius === 'number' ? (n as { cornerRadius: number }).cornerRadius : 0;

  if (n.type === 'text') {
    const t = n as PenNode & { content?: string; fontSize?: number; fontWeight?: string };
    const lines: string[] = [
      `Text("${(t.content ?? '').replace(/"/g, '\\"')}")`,
    ];
    if (t.fontSize) lines.push(`    .font(.system(size: ${t.fontSize}${t.fontWeight === 'bold' ? ', weight: .bold' : ''}))`);
    if (fillColor) lines.push(`    .foregroundColor(Color(hex: "${fillColor}"))`);
    return lines.join('\n');
  }

  const shape = n.type === 'ellipse' ? 'Circle()' : 'Rectangle()';
  const lines: string[] = [shape];
  if (cr > 0) lines[0] = `RoundedRectangle(cornerRadius: ${cr})`;
  if (fillColor) lines.push(`    .fill(Color(hex: "${fillColor}"))`);
  if (w != null && h != null) lines.push(`    .frame(width: ${w}, height: ${h})`);
  return lines.join('\n');
}

function generateCompose(n: PenNode): string {
  const w = typeof (n as { width?: unknown }).width === 'number' ? (n as { width: number }).width : null;
  const h = typeof (n as { height?: unknown }).height === 'number' ? (n as { height: number }).height : null;
  const fillColor = formatHex(firstColor((n as { fill?: Fills }).fill));
  const cr = typeof (n as { cornerRadius?: unknown }).cornerRadius === 'number' ? (n as { cornerRadius: number }).cornerRadius : 0;

  if (n.type === 'text') {
    const t = n as PenNode & { content?: string; fontSize?: number; fontWeight?: string };
    const args: string[] = [`text = "${(t.content ?? '').replace(/"/g, '\\"')}"`];
    if (t.fontSize) args.push(`fontSize = ${t.fontSize}.sp`);
    if (t.fontWeight === 'bold') args.push(`fontWeight = FontWeight.Bold`);
    if (fillColor) args.push(`color = Color(0xFF${fillColor.replace('#', '').slice(0, 6)})`);
    return `Text(\n    ${args.join(',\n    ')}\n)`;
  }

  const modifiers: string[] = [];
  if (w != null && h != null) modifiers.push(`.size(${w}.dp, ${h}.dp)`);
  if (cr > 0) modifiers.push(`.clip(RoundedCornerShape(${cr}.dp))`);
  if (fillColor) modifiers.push(`.background(Color(0xFF${fillColor.replace('#', '').slice(0, 6)}))`);
  return `Box(modifier = Modifier\n    ${modifiers.join('\n    ')}\n) {}`;
}

export function DevInspectPanel({ onClose }: Props) {
  const { state } = useEditor();
  const n = state.selectedNodeId
    ? state.doc.children.find((c) => c.id === state.selectedNodeId)
      ?? (function find(nodes: PenNode[]): PenNode | null {
        for (const nn of nodes) {
          if (nn.id === state.selectedNodeId) return nn;
          const children = (nn as { children?: PenNode[] }).children;
          if (children) { const f = find(children); if (f) return f; }
        }
        return null;
      })(state.doc.children)
    : null;

  const [lang, setLang] = useState<Lang>('css');

  const snippet = useMemo(() => {
    if (!n) return '';
    switch (lang) {
      case 'css': return generateCSS(n);
      case 'tailwind': return generateTailwind(n);
      case 'swiftui': return generateSwiftUI(n);
      case 'compose': return generateCompose(n);
    }
  }, [n, lang]);

  return (
    <div className="dev-inspect">
      <div className="dev-inspect__header">
        <span className="dev-inspect__title">🧑‍💻 Inspect</span>
        <button className="dev-inspect__close" onClick={onClose}>✕</button>
      </div>
      {!n ? (
        <div className="dev-inspect__empty">Select a node to see code snippets.</div>
      ) : (
        <>
          <div className="dev-inspect__tabs">
            {(['css', 'tailwind', 'swiftui', 'compose'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                className={`dev-inspect__tab${lang === l ? ' dev-inspect__tab--active' : ''}`}
                onClick={() => setLang(l)}
              >
                {l === 'css' ? 'CSS' : l === 'tailwind' ? 'Tailwind' : l === 'swiftui' ? 'SwiftUI' : 'Compose'}
              </button>
            ))}
          </div>
          <div className="dev-inspect__info">
            <strong>{n.name ?? n.id}</strong>
            <span className="dev-inspect__type">{n.type}</span>
          </div>
          <pre className="dev-inspect__code">{snippet || '// no properties to show'}</pre>
          <button
            className="dev-inspect__copy"
            onClick={() => {
              void navigator.clipboard.writeText(snippet);
            }}
          >
            Copy to clipboard
          </button>
        </>
      )}
    </div>
  );
}
