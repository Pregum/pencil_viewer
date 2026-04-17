/**
 * TextNode インライン編集: foreignObject 内に contentEditable な div をオーバーレイし、
 * ユーザ入力を直接 content に反映する。
 *
 * - editingNodeId に一致する TextNode のみ編集可能
 * - マウント時に全選択 & フォーカス
 * - Enter で改行（通常テキスト挙動）、Escape / Blur で編集終了
 * - 編集終了時に現在の DOM テキストを updateNode({ content })
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { TextNode } from '../../pen/types';
import { useEditor } from '../../pen/state/EditorContext';

interface Props {
  node: TextNode;
}

export function TextEditor({ node }: Props) {
  const { updateNode, endEditing } = useEditor();
  const divRef = useRef<HTMLDivElement>(null);

  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const fontSize = node.fontSize ?? 14;
  const lineHeight = node.lineHeight ?? 1.2;
  const fontFamily = node.fontFamily ?? 'Inter, system-ui, sans-serif';
  const fontWeight = node.fontWeight ?? 'normal';
  const letterSpacing = node.letterSpacing ?? 0;
  const isFixedWidth =
    node.textGrowth === 'fixed-width' || node.textGrowth === 'fixed-width-height';
  const w = typeof node.width === 'number' ? node.width : 0;
  const h = typeof node.height === 'number' ? node.height : 0;
  // auto growth では幅を決めず内容で伸びる。最低限の編集スペースを確保。
  const editWidth = isFixedWidth && w > 0 ? w : Math.max(w, 400);
  const editHeight = Math.max(h, fontSize * lineHeight * 3);
  const fill = typeof node.fill === 'string' ? node.fill : '#111827';

  // マウント時: フォーカス + 全選択
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    el.focus();
    // 全選択
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  // Escape で編集終了（blur 経由で最終 content を保存）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        divRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const commit = () => {
    const el = divRef.current;
    const newContent = el?.innerText ?? '';
    if (newContent !== (node.content ?? '')) {
      updateNode(node.id, { content: newContent } as Partial<TextNode>);
    }
    endEditing();
  };

  return (
    <foreignObject
      x={x}
      y={y}
      width={editWidth}
      height={editHeight}
      style={{ overflow: 'visible' }}
    >
      <div
        ref={divRef}
        // @ts-expect-error xmlns is valid for foreignObject children
        xmlns="http://www.w3.org/1999/xhtml"
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // 編集中のキー入力がグローバルショートカット（v/r/t 等）に奪われないよう隔離
          e.stopPropagation();
        }}
        style={{
          fontSize: `${fontSize}px`,
          fontFamily,
          fontWeight,
          color: fill,
          lineHeight,
          letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          outline: '2px solid #4F46E5',
          outlineOffset: '2px',
          minHeight: `${fontSize * lineHeight}px`,
          margin: 0,
          padding: 0,
          cursor: 'text',
          background: 'rgba(79, 70, 229, 0.03)',
          textAlign: node.textAlign ?? 'left',
          fontStyle: node.fontStyle ?? undefined,
          userSelect: 'text',
          WebkitUserSelect: 'text',
          textDecoration: [
            node.underline ? 'underline' : '',
            node.strikethrough ? 'line-through' : '',
          ]
            .filter(Boolean)
            .join(' ') || undefined,
        }}
      >
        {node.content ?? ''}
      </div>
    </foreignObject>
  );
}
