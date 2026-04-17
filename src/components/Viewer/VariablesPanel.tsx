/**
 * Variables パネル: ドキュメントの変数辞書 (doc.variables) を UI 経由で CRUD する。
 *
 * Pencil の変数参照 `$name` は parse 時に literal に置換される（現状）。
 * このパネルは辞書自体を編集する機能を提供する。ノードの fill/stroke 欄に
 * "$name" と書けば書き出し後に参照として残る。
 *
 * 「Apply to matching values」ボタンで、変数の元の値と等しい literal を
 * 持つノードをまとめて新しい値に置換できる（MVP の live 反映の代替）。
 */

import { useCallback, useMemo, useState } from 'react';
import { useEditor, type VariableDef, type VariableType } from '../../pen/state/EditorContext';
import type { PenDocument, PenNode } from '../../pen/types';
import { ColorPicker } from './ColorPicker';

interface Props {
  onClose?: () => void;
}

function listVariables(doc: PenDocument): Array<{ name: string; def: VariableDef }> {
  const raw = doc.variables;
  if (!raw || typeof raw !== 'object') return [];
  const entries: Array<{ name: string; def: VariableDef }> = [];
  for (const [name, rawDef] of Object.entries(raw as Record<string, unknown>)) {
    if (!rawDef || typeof rawDef !== 'object') continue;
    const d = rawDef as { type?: unknown; value?: unknown };
    const t = d.type;
    let value: unknown = d.value;
    if (Array.isArray(value)) {
      const first = value[0];
      value = first && typeof first === 'object' && 'value' in first ? (first as { value: unknown }).value : undefined;
    }
    if (
      (t === 'color' && typeof value === 'string') ||
      (t === 'number' && typeof value === 'number') ||
      (t === 'boolean' && typeof value === 'boolean') ||
      (t === 'string' && typeof value === 'string')
    ) {
      entries.push({ name, def: { type: t, value } });
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** doc 内のノードで fill/stroke/fill の color が `oldValue` と等しいものを newValue に書き換える */
function replaceColorLiteral(nodes: PenNode[], oldValue: string, newValue: string): { nodes: PenNode[]; replaced: number } {
  let replaced = 0;
  const walk = (n: PenNode): PenNode => {
    const copy: Record<string, unknown> = { ...(n as object) };
    if (copy.fill === oldValue) { copy.fill = newValue; replaced++; }
    if (copy.fill && typeof copy.fill === 'object' && (copy.fill as { color?: string }).color === oldValue) {
      copy.fill = { ...(copy.fill as object), color: newValue };
      replaced++;
    }
    const stroke = copy.stroke as { fill?: unknown } | undefined;
    if (stroke && typeof stroke === 'object') {
      if (stroke.fill === oldValue) {
        copy.stroke = { ...(stroke as object), fill: newValue };
        replaced++;
      } else if (stroke.fill && typeof stroke.fill === 'object' && (stroke.fill as { color?: string }).color === oldValue) {
        copy.stroke = { ...(stroke as object), fill: { ...(stroke.fill as object), color: newValue } };
        replaced++;
      }
    }
    if ('children' in copy && Array.isArray(copy.children)) {
      copy.children = (copy.children as PenNode[]).map(walk);
    }
    return copy as PenNode;
  };
  return { nodes: nodes.map(walk), replaced };
}

export function VariablesPanel({ onClose }: Props) {
  const { state, upsertVariable, removeVariable, renameVariable, replaceDocChildren } = useEditor();
  const variables = useMemo(() => listVariables(state.rawDoc), [state.rawDoc]);
  const [picker, setPicker] = useState<{ name: string; rect: DOMRect | null } | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<VariableType>('color');

  const addNew = useCallback(() => {
    if (!newName.trim()) return;
    const name = newName.trim().replace(/^\$/, '');
    const def: VariableDef = newType === 'color'
      ? { type: 'color', value: '#4F46E5' }
      : newType === 'number'
      ? { type: 'number', value: 16 }
      : newType === 'boolean'
      ? { type: 'boolean', value: true }
      : { type: 'string', value: '' };
    upsertVariable(name, def);
    setNewName('');
  }, [newName, newType, upsertVariable]);

  const applyToMatching = useCallback((name: string, oldValue: string, newValue: string) => {
    if (!oldValue || oldValue === newValue) return;
    const res = replaceColorLiteral(state.doc.children, oldValue, newValue);
    replaceDocChildren(res.nodes);
    if (res.replaced > 0) {
      window.alert(`"${name}" を ${res.replaced} 個のノードに適用しました。`);
    } else {
      window.alert(`"${oldValue}" に一致するノードは見つかりませんでした。`);
    }
  }, [state.doc.children, replaceDocChildren]);

  return (
    <div className="variables-panel-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="variables-panel">
        <div className="variables-panel__header">
          <span>Variables</span>
          <span className="variables-panel__count">{variables.length}</span>
          {onClose && (
            <button className="variables-panel__close" onClick={onClose}>✕</button>
          )}
        </div>

        {/* 新規追加フォーム */}
        <div className="variables-panel__add">
          <input
            className="variables-panel__input"
            placeholder="new-variable-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
          />
          <select
            className="variables-panel__select"
            value={newType}
            onChange={(e) => setNewType(e.target.value as VariableType)}
          >
            <option value="color">color</option>
            <option value="number">number</option>
            <option value="string">string</option>
            <option value="boolean">boolean</option>
          </select>
          <button className="variables-panel__add-btn" onClick={addNew} disabled={!newName.trim()}>Add</button>
        </div>

        <div className="variables-panel__list">
          {variables.length === 0 && (
            <div className="variables-panel__empty">
              No variables yet. Add one above, then reference it in a fill field by typing <code>$name</code>.
            </div>
          )}
          {variables.map(({ name, def }) => (
            <div key={name} className="variables-panel__item">
              <div className="variables-panel__row">
                {def.type === 'color' && typeof def.value === 'string' && (
                  <button
                    className="variables-panel__swatch"
                    style={{ background: def.value }}
                    onClick={(e) => setPicker({ name, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() })}
                    title={def.value}
                  />
                )}
                <input
                  className="variables-panel__input variables-panel__input--name"
                  defaultValue={name}
                  onBlur={(e) => {
                    const nn = e.currentTarget.value.trim().replace(/^\$/, '');
                    if (nn && nn !== name) renameVariable(name, nn);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                />
                <span className="variables-panel__type">{def.type}</span>
                <button
                  className="variables-panel__delete"
                  title="Delete"
                  onClick={() => {
                    if (window.confirm(`Delete $${name}?`)) removeVariable(name);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="variables-panel__row">
                {def.type === 'color' && typeof def.value === 'string' && (
                  <input
                    className="variables-panel__input variables-panel__input--val variables-panel__input--mono"
                    value={def.value}
                    onChange={(e) => upsertVariable(name, { type: 'color', value: e.target.value })}
                  />
                )}
                {def.type === 'number' && typeof def.value === 'number' && (
                  <input
                    type="number"
                    className="variables-panel__input variables-panel__input--val variables-panel__input--mono"
                    value={def.value}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) upsertVariable(name, { type: 'number', value: v });
                    }}
                  />
                )}
                {def.type === 'string' && typeof def.value === 'string' && (
                  <input
                    className="variables-panel__input variables-panel__input--val"
                    value={def.value}
                    onChange={(e) => upsertVariable(name, { type: 'string', value: e.target.value })}
                  />
                )}
                {def.type === 'boolean' && typeof def.value === 'boolean' && (
                  <label className="variables-panel__bool">
                    <input
                      type="checkbox"
                      checked={def.value}
                      onChange={(e) => upsertVariable(name, { type: 'boolean', value: e.target.checked })}
                    />
                    {String(def.value)}
                  </label>
                )}
                {def.type === 'color' && typeof def.value === 'string' && (
                  <button
                    className="variables-panel__apply"
                    title="全ノードの一致する色を新しい値に置換"
                    onClick={() => {
                      const newVal = window.prompt('Apply to matching literal color. New value:', def.value as string);
                      if (!newVal) return;
                      applyToMatching(name, def.value as string, newVal);
                      upsertVariable(name, { type: 'color', value: newVal });
                    }}
                  >
                    Apply to matching
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {picker && (
          <ColorPicker
            color={(variables.find((v) => v.name === picker.name)?.def.value as string) ?? '#4F46E5'}
            anchorRect={picker.rect}
            onChange={(hex) => {
              upsertVariable(picker.name, { type: 'color', value: hex });
            }}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    </div>
  );
}
