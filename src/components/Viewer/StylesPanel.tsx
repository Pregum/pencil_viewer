/**
 * Styles Panel: 名前付きスタイル (Color / Text / Effect) を管理、選択ノードに適用。
 * Figma の Styles 相当。Variables とは別概念（Variables=単一値 / Styles=プロパティセット）。
 */

import { useCallback, useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { NamedStyle, ColorStyle, TextStyle, EffectStyle, PenNode } from '../../pen/types';

interface Props {
  onClose: () => void;
}

type Kind = 'color' | 'text' | 'effect';

function firstColor(fill: unknown): string | null {
  if (typeof fill === 'string') return fill;
  if (Array.isArray(fill)) return firstColor(fill[0]);
  if (fill && typeof fill === 'object') {
    const f = fill as { type?: string; color?: string };
    if (f.type === 'color' && typeof f.color === 'string') return f.color;
  }
  return null;
}

export function StylesPanel({ onClose }: Props) {
  const { state, selectedNode, upsertStyle, removeStyle, applyStyleToSelection } = useEditor();
  const [tab, setTab] = useState<Kind>('color');
  const [newName, setNewName] = useState('');
  const styles = useMemo(() => state.rawDoc.styles ?? [], [state.rawDoc.styles]);

  const filtered = styles.filter((s) => s.type === tab);

  const saveCurrentAs = useCallback(() => {
    if (!selectedNode || !newName.trim()) return;
    const id = `style_${Date.now()}`;
    const name = newName.trim();
    if (tab === 'color') {
      const color = firstColor((selectedNode as { fill?: unknown }).fill);
      if (!color) return;
      upsertStyle({ id, type: 'color', name, value: color });
    } else if (tab === 'text') {
      const n = selectedNode as PenNode & { fontFamily?: string; fontSize?: number; fontWeight?: string; lineHeight?: number; letterSpacing?: number; textAlign?: TextStyle['textAlign']; fill?: unknown };
      upsertStyle({
        id, type: 'text', name,
        fontFamily: n.fontFamily,
        fontSize: n.fontSize,
        fontWeight: n.fontWeight,
        lineHeight: n.lineHeight,
        letterSpacing: n.letterSpacing,
        textAlign: n.textAlign,
        fill: firstColor(n.fill) ?? undefined,
      });
    } else {
      const n = selectedNode as PenNode & { effect?: unknown };
      if (!n.effect) return;
      upsertStyle({ id, type: 'effect', name, effects: n.effect as EffectStyle['effects'] });
    }
    setNewName('');
  }, [selectedNode, tab, newName, upsertStyle]);

  return (
    <div className="variables-panel-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="variables-panel">
        <div className="variables-panel__header">
          <span>Styles</span>
          <span className="variables-panel__count">{styles.length}</span>
          <button className="variables-panel__close" onClick={onClose}>✕</button>
        </div>

        <div className="dev-inspect__tabs">
          {(['color', 'text', 'effect'] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`dev-inspect__tab${tab === k ? ' dev-inspect__tab--active' : ''}`}
              onClick={() => setTab(k)}
            >
              {k === 'color' ? '🎨 Color' : k === 'text' ? 'T Text' : '✨ Effect'}
              <span style={{ marginLeft: 6, opacity: 0.5 }}>
                ({styles.filter((s) => s.type === k).length})
              </span>
            </button>
          ))}
        </div>

        <div className="variables-panel__add">
          <input
            className="variables-panel__input"
            placeholder={`Save current ${tab} as...`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCurrentAs(); } }}
          />
          <button
            className="variables-panel__add-btn"
            onClick={saveCurrentAs}
            disabled={!selectedNode || !newName.trim()}
            title={!selectedNode ? 'Select a node first' : 'Save'}
          >
            Save
          </button>
        </div>

        <div className="variables-panel__list">
          {filtered.length === 0 && (
            <div className="variables-panel__empty">
              No {tab} styles yet. Select a node and save above.
            </div>
          )}
          {filtered.map((s) => (
            <div key={s.id} className="variables-panel__item">
              <div className="variables-panel__row">
                {s.type === 'color' && (
                  <div className="variables-panel__swatch" style={{ background: (s as ColorStyle).value }} />
                )}
                <input
                  className="variables-panel__input variables-panel__input--name"
                  defaultValue={s.name}
                  onBlur={(e) => {
                    const nn = e.currentTarget.value.trim();
                    if (nn && nn !== s.name) upsertStyle({ ...(s as NamedStyle), name: nn });
                  }}
                />
                <span className="variables-panel__type">{s.type}</span>
                <button
                  className="variables-panel__apply"
                  title="Apply to selection"
                  onClick={() => applyStyleToSelection(s.id)}
                >
                  Apply
                </button>
                <button
                  className="variables-panel__delete"
                  onClick={() => { if (window.confirm(`Delete style "${s.name}"?`)) removeStyle(s.id); }}
                >
                  ✕
                </button>
              </div>
              {s.type === 'text' && (
                <div className="variables-panel__row" style={{ paddingLeft: 6, opacity: 0.7, fontSize: 10 }}>
                  {[
                    (s as TextStyle).fontFamily,
                    (s as TextStyle).fontSize ? `${(s as TextStyle).fontSize}px` : null,
                    (s as TextStyle).fontWeight,
                    (s as TextStyle).fill,
                  ].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
