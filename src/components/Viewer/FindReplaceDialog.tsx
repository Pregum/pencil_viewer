/**
 * Cmd+F で開く Find & Replace ダイアログ。
 * 全 text ノードの content を対象に、検索・順送り・個別/一括置換を行う。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

interface Props {
  onClose: () => void;
  onFocusNode?: (rect: { x: number; y: number; width: number; height: number }) => void;
}

function flatten(nodes: PenNode[], out: PenNode[] = []): PenNode[] {
  for (const n of nodes) {
    out.push(n);
    const children = (n as { children?: PenNode[] }).children;
    if (children) flatten(children, out);
  }
  return out;
}

export function FindReplaceDialog({ onClose, onFocusNode }: Props) {
  const { state, selectNode, updateNode } = useEditor();
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    if (!query) return [] as PenNode[];
    const q = caseSensitive ? query : query.toLowerCase();
    return flatten(state.doc.children).filter((n) => {
      if (n.type !== 'text') return false;
      const content = (n as { content?: string }).content ?? '';
      return caseSensitive ? content.includes(q) : content.toLowerCase().includes(q);
    });
  }, [query, caseSensitive, state.doc]);

  const count = matches.length;
  const current = count > 0 ? matches[idx % count] : null;

  // 検索結果が変わったら idx を reset
  useEffect(() => {
    setIdx(0);
  }, [query, caseSensitive]);

  const focusOn = (node: PenNode) => {
    selectNode(node.id);
    const w = typeof (node as { width?: unknown }).width === 'number' ? (node as { width: number }).width : 0;
    const h = typeof (node as { height?: unknown }).height === 'number' ? (node as { height: number }).height : 0;
    if (w > 0 && h > 0 && onFocusNode) {
      onFocusNode({ x: node.x ?? 0, y: node.y ?? 0, width: w, height: h });
    }
  };

  const next = () => {
    if (count === 0) return;
    const n = (idx + 1) % count;
    setIdx(n);
    focusOn(matches[n]);
  };

  const prev = () => {
    if (count === 0) return;
    const n = (idx - 1 + count) % count;
    setIdx(n);
    focusOn(matches[n]);
  };

  const replaceOne = () => {
    if (!current || !query) return;
    const content = (current as { content?: string }).content ?? '';
    const flags = caseSensitive ? '' : 'i';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaced = content.replace(new RegExp(escaped, flags), replace);
    updateNode(current.id, { content: replaced } as Partial<PenNode>);
    // 次に進む
    setTimeout(next, 0);
  };

  const replaceAll = () => {
    if (count === 0 || !query) return;
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, flags);
    for (const m of matches) {
      const content = (m as { content?: string }).content ?? '';
      const replaced = content.replace(re, replace);
      if (replaced !== content) {
        updateNode(m.id, { content: replaced } as Partial<PenNode>);
      }
    }
  };

  return (
    <div className="find-replace">
      <div className="find-replace__row">
        <input
          ref={inputRef}
          className="find-replace__input"
          placeholder="Find…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) prev(); else next();
            }
          }}
        />
        <span className="find-replace__count">
          {query ? `${count === 0 ? 0 : idx + 1} / ${count}` : ''}
        </span>
        <button className="find-replace__btn" title="Previous (Shift+Enter)" onClick={prev} disabled={count === 0}>↑</button>
        <button className="find-replace__btn" title="Next (Enter)" onClick={next} disabled={count === 0}>↓</button>
        <button className="find-replace__close" title="Close (Esc)" onClick={onClose}>✕</button>
      </div>
      <div className="find-replace__row">
        <input
          className="find-replace__input"
          placeholder="Replace with…"
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
        />
        <label className="find-replace__case" title="Case sensitive">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Aa
        </label>
        <button className="find-replace__btn" onClick={replaceOne} disabled={count === 0 || !query}>Replace</button>
        <button className="find-replace__btn find-replace__btn--primary" onClick={replaceAll} disabled={count === 0 || !query}>All</button>
      </div>
    </div>
  );
}
