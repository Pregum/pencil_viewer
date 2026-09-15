/**
 * Selection Colors: 選択セット（空なら全ドキュメント）のノードで
 * 使われている色を集計して一覧。クリックで一括置換、色ごとのノード数を表示。
 * Figma の Selection colors / Document colors に相当。
 */

import { useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { ColorPicker } from './ColorPicker';
import { collect, flatten, replaceColor } from './selectionColors';

interface Props {
  onClose: () => void;
}

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
    <div
      className="variables-panel-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="variables-panel">
        <div className="variables-panel__header">
          <span>{scopeIds.size > 0 ? 'Selection Colors' : 'Document Colors'}</span>
          <span className="variables-panel__count">{colors.length}</span>
          <button className="variables-panel__close" onClick={onClose}>
            ✕
          </button>
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
                  onClick={(e) =>
                    setPicker({
                      color: c.color,
                      rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                    })
                  }
                  title="Edit color"
                />
                <span
                  className="variables-panel__input variables-panel__input--name variables-panel__input--mono"
                  style={{ border: 'none', background: 'transparent' }}
                >
                  {c.color}
                </span>
                <span className="variables-panel__type">{c.nodeIds.length}×</span>
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
                  onClick={(e) =>
                    setPicker({
                      color: c.color,
                      rect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                    })
                  }
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
