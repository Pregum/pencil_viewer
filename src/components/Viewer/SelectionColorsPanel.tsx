/**
 * Selection Colors: 選択セット（空なら全ドキュメント）のノードで
 * 使われている色を集計して一覧。クリックで一括置換、色ごとのノード数を表示。
 * Figma の Selection colors / Document colors に相当。
 */

import { useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';
import { ColorPicker } from './ColorPicker';

interface Props {
  onClose: () => void;
}

interface ColorUse {
  color: string;
  /** node.id の一覧 */
  nodeIds: string[];
  /** fill / stroke どちらで使われているか */
  kinds: Set<'fill' | 'stroke'>;
}

function flatten(nodes: PenNode[], out: PenNode[] = []): PenNode[] {
  for (const n of nodes) {
    out.push(n);
    const children = (n as { children?: PenNode[] }).children;
    if (children) flatten(children, out);
  }
  return out;
}

function extractColor(value: unknown): string | null {
  if (typeof value === 'string' && value.startsWith('#')) return value.toUpperCase();
  if (Array.isArray(value)) {
    for (const v of value) {
      const c = extractColor(v);
      if (c) return c;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const f = value as { type?: string; color?: string };
    if (f.type === 'color' && typeof f.color === 'string') return f.color.toUpperCase();
  }
  return null;
}

function collect(nodes: PenNode[]): Map<string, ColorUse> {
  const map = new Map<string, ColorUse>();
  const add = (color: string, id: string, kind: 'fill' | 'stroke') => {
    const cur = map.get(color);
    if (cur) {
      if (!cur.nodeIds.includes(id)) cur.nodeIds.push(id);
      cur.kinds.add(kind);
    } else {
      map.set(color, { color, nodeIds: [id], kinds: new Set([kind]) });
    }
  };
  for (const n of flatten(nodes)) {
    const fill = (n as { fill?: unknown }).fill;
    if (fill != null) {
      const c = extractColor(fill);
      if (c) add(c, n.id, 'fill');
    }
    const stroke = (n as { stroke?: { fill?: unknown } }).stroke;
    if (stroke?.fill != null) {
      const c = extractColor(stroke.fill);
      if (c) add(c, n.id, 'stroke');
    }
  }
  return map;
}

/**
 * 指定色をもつノードの fill / stroke.fill を新色に置換（再帰）。
 * 純粋にノードツリーのクローンを返す。
 */
function replaceColor(nodes: PenNode[], oldColor: string, newColor: string): { nodes: PenNode[]; replaced: number } {
  let replaced = 0;
  const upper = oldColor.toUpperCase();
  const walkVal = (v: unknown): unknown => {
    if (typeof v === 'string' && v.toUpperCase() === upper) { replaced++; return newColor; }
    if (Array.isArray(v)) return v.map(walkVal);
    if (v && typeof v === 'object') {
      const o = v as { type?: string; color?: string };
      if (o.type === 'color' && typeof o.color === 'string' && o.color.toUpperCase() === upper) {
        replaced++;
        return { ...o, color: newColor };
      }
    }
    return v;
  };
  const walk = (n: PenNode): PenNode => {
    const copy: Record<string, unknown> = { ...(n as object) };
    if (copy.fill !== undefined) copy.fill = walkVal(copy.fill);
    const stroke = copy.stroke as { fill?: unknown } | undefined;
    if (stroke && typeof stroke === 'object' && stroke.fill !== undefined) {
      copy.stroke = { ...(stroke as object), fill: walkVal(stroke.fill) };
    }
    if ('children' in copy && Array.isArray(copy.children)) {
      copy.children = (copy.children as PenNode[]).map(walk);
    }
    return copy as PenNode;
  };
  return { nodes: nodes.map(walk), replaced };
}

export { replaceColor, collect as collectSelectionColors };

export function SelectionColorsPanel({ onClose }: Props) {
  const { state, selectMultiple, replaceDocChildren } = useEditor();
  const [picker, setPicker] = useState<{ color: string; rect: DOMRect | null } | null>(null);

  // 選択セットがあればそれだけ集計、なければドキュメント全体
  const scopeIds = useMemo(() => {
    const s = new Set<string>(state.selectedNodeIds);
    if (state.selectedNodeId) s.add(state.selectedNodeId);
    return s;
  }, [state.selectedNodeId, state.selectedNodeIds]);

  const nodesToCollect = useMemo(() => {
    if (scopeIds.size === 0) return state.rawDoc.children;
    // 選択ノードとその子孫を集める
    const selected = flatten(state.rawDoc.children).filter((n) => scopeIds.has(n.id));
    // 子ノードは flatten でも入るので、そのまま selected を渡せば十分
    return selected;
  }, [state.rawDoc, scopeIds]);

  const colors = useMemo(() => {
    const m = collect(nodesToCollect);
    return Array.from(m.values()).sort((a, b) => b.nodeIds.length - a.nodeIds.length);
  }, [nodesToCollect]);

  const selectAllUsingColor = (color: string) => {
    const m = collect(state.rawDoc.children);
    const ids = m.get(color.toUpperCase())?.nodeIds ?? [];
    if (ids.length > 0) selectMultiple(ids);
  };

  const replaceAll = (oldColor: string, newColor: string) => {
    const res = replaceColor(state.rawDoc.children, oldColor, newColor);
    replaceDocChildren(res.nodes);
  };

  return (
    <div className="variables-panel-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="variables-panel">
        <div className="variables-panel__header">
          <span>{scopeIds.size > 0 ? 'Selection Colors' : 'Document Colors'}</span>
          <span className="variables-panel__count">{colors.length}</span>
          <button className="variables-panel__close" onClick={onClose}>✕</button>
        </div>

        <div className="variables-panel__list">
          {colors.length === 0 && (
            <div className="variables-panel__empty">
              No colors found in the current {scopeIds.size > 0 ? 'selection' : 'document'}.
            </div>
          )}
          {colors.map((c) => (
            <div key={c.color} className="variables-panel__item">
              <div className="variables-panel__row">
                <button
                  className="variables-panel__swatch"
                  style={{ background: c.color }}
                  onClick={(e) => setPicker({ color: c.color, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                  title="Edit color"
                />
                <span className="variables-panel__input variables-panel__input--name variables-panel__input--mono" style={{ border: 'none', background: 'transparent' }}>
                  {c.color}
                </span>
                <span className="variables-panel__type">
                  {c.nodeIds.length}×
                </span>
                <button
                  className="variables-panel__apply"
                  title="Select all nodes using this color"
                  onClick={() => selectAllUsingColor(c.color)}
                >
                  Select
                </button>
                <button
                  className="variables-panel__apply"
                  title="Replace all with..."
                  onClick={(e) => setPicker({ color: c.color, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                >
                  Replace
                </button>
              </div>
              <div className="variables-panel__row" style={{ paddingLeft: 6, opacity: 0.7, fontSize: 10 }}>
                {[...c.kinds].join(' + ')}
              </div>
            </div>
          ))}
        </div>

        {picker && (
          <ColorPicker
            color={picker.color}
            anchorRect={picker.rect}
            onChange={(hex) => replaceAll(picker.color, hex)}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    </div>
  );
}
