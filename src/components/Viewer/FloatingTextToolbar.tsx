/**
 * インラインテキスト編集中に表示されるフロートツールバー。
 * editingNodeId のテキストノードに対し、フォントサイズ / 太字 / 斜体 / 下線 /
 * 揃え / カラー を即座に編集できる。
 *
 * 編集ノードの左上 (クライアント座標) に絶対配置される。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode, TextNode } from '../../pen/types';
import { ColorPicker } from './ColorPicker';

interface Props {
  /** SVG 内 → スクリーン座標変換に使う */
  svgRef: React.RefObject<SVGSVGElement | null>;
}

function findNode(nodes: PenNode[], id: string): PenNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const f = findNode((n as { children: PenNode[] }).children, id);
      if (f) return f;
    }
  }
  return null;
}

export function FloatingTextToolbar({ svgRef }: Props) {
  const { state, updateNodeSilent } = useEditor();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const swatchRef = useRef<HTMLButtonElement>(null);

  const editingId = state.editingNodeId;
  const node = useMemo(() => (editingId ? findNode(state.doc.children, editingId) : null), [editingId, state.doc]);
  const textNode = node?.type === 'text' ? (node as TextNode) : null;

  // 編集ノードの左上スクリーン座標を SVG CTM から計算してツールバー位置を更新
  useEffect(() => {
    if (!textNode || !svgRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const x = (textNode.x ?? 0);
      const y = (textNode.y ?? 0);
      const clientX = ctm.a * x + ctm.e;
      const clientY = ctm.d * y + ctm.f;
      // ツールバーはノード上端から 42px 上に配置
      setPos({ left: clientX, top: clientY - 42 });
    };
    update();
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [textNode, state.doc, svgRef]);

  if (!textNode || !pos) return null;

  const fontSize = textNode.fontSize ?? 14;
  const fontWeight = textNode.fontWeight ?? 'normal';
  const isBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '600';
  const isItalic = textNode.fontStyle === 'italic';
  const isUnderline = textNode.underline === true;
  const fill = typeof textNode.fill === 'string' ? textNode.fill : '#111827';
  const textAlign = textNode.textAlign ?? 'left';

  const patch = (p: Partial<TextNode>) => updateNodeSilent(textNode.id, p as Partial<PenNode>);

  return (
    <div
      className="float-text-toolbar"
      style={{ left: pos.left, top: Math.max(10, pos.top) }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="number"
        className="float-text-toolbar__num"
        value={Math.round(fontSize)}
        min={4}
        max={512}
        title="Font size"
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) patch({ fontSize: Math.max(4, Math.min(512, v)) });
        }}
      />
      <button
        type="button"
        className={`float-text-toolbar__btn${isBold ? ' float-text-toolbar__btn--active' : ''}`}
        title="Bold"
        onClick={() => patch({ fontWeight: isBold ? 'normal' : 'bold' })}
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`float-text-toolbar__btn${isItalic ? ' float-text-toolbar__btn--active' : ''}`}
        title="Italic"
        onClick={() => patch({ fontStyle: isItalic ? undefined : 'italic' })}
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={`float-text-toolbar__btn${isUnderline ? ' float-text-toolbar__btn--active' : ''}`}
        title="Underline"
        onClick={() => patch({ underline: !isUnderline })}
      >
        <span style={{ textDecoration: 'underline' }}>U</span>
      </button>
      <span className="float-text-toolbar__sep" />
      <button
        type="button"
        className={`float-text-toolbar__btn${textAlign === 'left' ? ' float-text-toolbar__btn--active' : ''}`}
        title="Align left"
        onClick={() => patch({ textAlign: 'left' })}
      >
        <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 3h12M2 6h8M2 9h12M2 12h8" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      <button
        type="button"
        className={`float-text-toolbar__btn${textAlign === 'center' ? ' float-text-toolbar__btn--active' : ''}`}
        title="Align center"
        onClick={() => patch({ textAlign: 'center' })}
      >
        <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 3h12M4 6h8M2 9h12M4 12h8" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      <button
        type="button"
        className={`float-text-toolbar__btn${textAlign === 'right' ? ' float-text-toolbar__btn--active' : ''}`}
        title="Align right"
        onClick={() => patch({ textAlign: 'right' })}
      >
        <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 3h12M6 6h8M2 9h12M6 12h8" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      <span className="float-text-toolbar__sep" />
      <button
        ref={swatchRef}
        type="button"
        className="float-text-toolbar__color"
        style={{ background: fill }}
        title={`Color: ${fill}`}
        onClick={() => setColorOpen((v) => !v)}
      />
      {colorOpen && (
        <ColorPicker
          color={fill.startsWith('#') ? fill.slice(0, 7) : '#111827'}
          anchorRect={swatchRef.current?.getBoundingClientRect() ?? null}
          onChange={(hex) => patch({ fill: hex })}
          onClose={() => setColorOpen(false)}
        />
      )}
    </div>
  );
}
