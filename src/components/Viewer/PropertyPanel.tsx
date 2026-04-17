/**
 * プロパティパネル: 選択ノードの情報を表示・編集する。
 * 値を編集するとリアルタイムで SVG に反映される。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';
import { ColorPicker } from './ColorPicker';

function formatColor(fill: unknown): string | null {
  if (typeof fill === 'string') return fill;
  if (fill && typeof fill === 'object') {
    const f = fill as Record<string, unknown>;
    if (f.type === 'color' && typeof f.color === 'string') return f.color;
    if (f.type === 'gradient') return '(gradient)';
    if (f.type === 'image') return '(image)';
  }
  if (Array.isArray(fill) && fill.length > 0) return formatColor(fill[0]);
  return null;
}

function EditableField({
  label,
  value,
  onChange,
  onFocus,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  type?: 'text' | 'number' | 'color';
}) {
  return (
    <div className="prop-panel__field">
      <label>{label}</label>
      <input
        className="prop-panel__input"
        type={type}
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onFocus?: () => void;
}) {
  return (
    <div className="prop-panel__field-inline">
      <label>{label}</label>
      <input
        className="prop-panel__input prop-panel__input--num"
        type="number"
        value={Math.round(value * 100) / 100}
        onFocus={onFocus}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
      />
    </div>
  );
}

export function PropertyPanel({ collapsed, onTogglePanel }: { collapsed?: boolean; onTogglePanel?: () => void }) {
  const { selectedNode, selectNode, updateNode, updateNodeSilent, pushUndoCheckpoint, state, enterInsertMode, exitInsertMode } = useEditor();

  // カラーピッカー用: ドラッグ中は silent、確定時に undo に積む
  const patchSilent = useCallback(
    (p: Partial<PenNode>) => {
      if (selectedNode) updateNodeSilent(selectedNode.id, p);
    },
    [selectedNode, updateNodeSilent],
  );
  const startColorChange = useCallback(() => {
    if (selectedNode) pushUndoCheckpoint();
  }, [selectedNode, pushUndoCheckpoint]);

  // カスタムカラーピッカー popover の状態
  const [picker, setPicker] = useState<{ kind: 'fill' | 'stroke'; rect: DOMRect | null } | null>(null);
  const openedUndoRef = useRef(false);
  const openPicker = (kind: 'fill' | 'stroke', rect: DOMRect) => {
    if (!openedUndoRef.current) {
      startColorChange();
      openedUndoRef.current = true;
    }
    setPicker({ kind, rect });
  };
  const closePicker = () => {
    setPicker(null);
    openedUndoRef.current = false;
  };

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  /** 通常の更新（undo に積む） */
  const patch = useCallback(
    (p: Partial<PenNode>) => {
      if (selectedNode) updateNode(selectedNode.id, p);
    },
    [selectedNode, updateNode],
  );

  /** テキスト/数値入力用: focus でチェックポイント、入力中は silent */
  const patchInput = useCallback(
    (p: Partial<PenNode>) => {
      if (selectedNode) updateNodeSilent(selectedNode.id, p);
    },
    [selectedNode, updateNodeSilent],
  );
  const onInputFocus = useCallback(() => {
    if (selectedNode) pushUndoCheckpoint();
  }, [selectedNode, pushUndoCheckpoint]);

  // i / I key: enter insert mode and focus the first editable field
  useEffect(() => {
    const handler = () => {
      if (!selectedNode) return;
      const hasContent = (selectedNode as { content?: string }).content != null;
      enterInsertMode();
      // Focus the appropriate input after render
      requestAnimationFrame(() => {
        if (hasContent && contentRef.current) {
          contentRef.current.focus();
          contentRef.current.select();
        } else if (nameInputRef.current) {
          nameInputRef.current.focus();
          nameInputRef.current.select();
        }
      });
    };
    window.addEventListener('pencil-enter-insert', handler);
    return () => window.removeEventListener('pencil-enter-insert', handler);
  }, [selectedNode, enterInsertMode]);

  // Exit insert mode when textarea/input loses focus
  const handleBlur = useCallback(() => {
    if (state.insertMode) exitInsertMode();
  }, [state.insertMode, exitInsertMode]);

  if (collapsed) {
    return (
      <div className="prop-panel prop-panel--collapsed">
        <button className="prop-panel__toggle-btn" onClick={onTogglePanel} title="Show Properties">
          ⚙
        </button>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="prop-panel prop-panel--empty">
        {onTogglePanel && (
          <button className="prop-panel__toggle-btn prop-panel__toggle-btn--top" onClick={onTogglePanel} title="Hide Properties">
            ✕
          </button>
        )}
        <p className="prop-panel__hint">Click a node to inspect</p>
      </div>
    );
  }

  const n = selectedNode;
  const fillColor = formatColor((n as { fill?: unknown }).fill);
  const strokeFill = (n as { stroke?: { fill?: unknown } }).stroke?.fill;
  const strokeColor = formatColor(strokeFill);
  const opacity = (n as { opacity?: number }).opacity ?? 1;
  const fontFamily = (n as { fontFamily?: string }).fontFamily;
  const fontSize = (n as { fontSize?: number }).fontSize;
  const content = (n as { content?: string }).content;
  const width = (n as { width?: unknown }).width;
  const height = (n as { height?: unknown }).height;

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <span className="prop-panel__type">{n.type}</span>
        <span className="prop-panel__name">{n.name ?? n.id}</span>
        <button
          className="prop-panel__close"
          onClick={() => selectNode(null)}
          title="Deselect (Esc)"
        >
          &times;
        </button>
        {onTogglePanel && (
          <button className="prop-panel__close" onClick={onTogglePanel} title="Hide Properties">
            ⚙
          </button>
        )}
      </div>

      {/* Position & Size */}
      <div className="prop-panel__section">
        <div className="prop-panel__title">Position & Size</div>
        <div className="prop-panel__pos-grid">
          <NumberField label="X" value={n.x ?? 0} onFocus={onInputFocus} onChange={(v) => patchInput({ x: v } as Partial<PenNode>)} />
          <NumberField label="Y" value={n.y ?? 0} onFocus={onInputFocus} onChange={(v) => patchInput({ y: v } as Partial<PenNode>)} />
          {typeof width === 'number' && (
            <NumberField label="W" value={width} onFocus={onInputFocus} onChange={(v) => patchInput({ width: v } as Partial<PenNode>)} />
          )}
          {typeof width === 'string' && (
            <div className="prop-panel__field-inline">
              <label>W</label>
              <span className="prop-panel__readonly">{width}</span>
            </div>
          )}
          {typeof height === 'number' && (
            <NumberField label="H" value={height} onFocus={onInputFocus} onChange={(v) => patchInput({ height: v } as Partial<PenNode>)} />
          )}
          {typeof height === 'string' && (
            <div className="prop-panel__field-inline">
              <label>H</label>
              <span className="prop-panel__readonly">{height}</span>
            </div>
          )}
        </div>
      </div>

      {/* Fill */}
      {fillColor && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Fill</div>
          <div className="prop-panel__color-row">
            {fillColor.startsWith('#') && (
              <button
                type="button"
                className="prop-panel__color-swatch"
                style={{ background: fillColor.slice(0, 7) }}
                title="Open color picker"
                onClick={(e) => openPicker('fill', (e.currentTarget as HTMLElement).getBoundingClientRect())}
              />
            )}
            <span className="prop-panel__color-label">{fillColor}</span>
          </div>
        </div>
      )}

      {/* Stroke */}
      {strokeColor && strokeColor !== '(gradient)' && strokeColor !== '(image)' && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Stroke</div>
          <div className="prop-panel__color-row">
            {strokeColor.startsWith('#') && (
              <button
                type="button"
                className="prop-panel__color-swatch"
                style={{ background: strokeColor.slice(0, 7) }}
                title="Open color picker"
                onClick={(e) => openPicker('stroke', (e.currentTarget as HTMLElement).getBoundingClientRect())}
              />
            )}
            <span className="prop-panel__color-label">{strokeColor}</span>
          </div>
        </div>
      )}

      {/* Opacity */}
      <div className="prop-panel__section">
        <div className="prop-panel__title">Opacity</div>
        <div className="prop-panel__opacity-row">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            className="prop-panel__slider"
            onMouseDown={startColorChange}
            onInput={(e) => patchSilent({ opacity: parseFloat((e.target as HTMLInputElement).value) } as Partial<PenNode>)}
            onChange={(e) => patchSilent({ opacity: parseFloat(e.target.value) } as Partial<PenNode>)}
          />
          <span className="prop-panel__opacity-val">{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      {/* Font */}
      {fontFamily && fontSize != null && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Font</div>
          <EditableField
            label="Family"
            value={fontFamily}
            onFocus={onInputFocus}
            onChange={(v) => patchInput({ fontFamily: v } as Partial<PenNode>)}
          />
          <NumberField
            label="Size"
            value={fontSize}
            onFocus={onInputFocus}
            onChange={(v) => patchInput({ fontSize: v } as Partial<PenNode>)}
          />
        </div>
      )}

      {/* Content */}
      {content != null && (
        <div className="prop-panel__section">
          <div className="prop-panel__title">Content</div>
          <textarea
            ref={contentRef}
            className="prop-panel__textarea"
            value={content}
            rows={Math.min(8, content.split('\n').length + 1)}
            onFocus={onInputFocus}
            onChange={(e) => patchInput({ content: e.target.value } as Partial<PenNode>)}
            onBlur={handleBlur}
          />
        </div>
      )}

      {/* Layout Grids (frame only) */}
      {n.type === 'frame' && (() => {
        const grids = ((n as { layoutGrids?: unknown }).layoutGrids as Array<Record<string, unknown>> | undefined) ?? [];
        const updateGrids = (next: Array<Record<string, unknown>>) => {
          patch({ layoutGrids: next } as unknown as Partial<PenNode>);
        };
        const addGrid = (pattern: 'columns' | 'rows' | 'grid') => {
          const preset = pattern === 'grid'
            ? { pattern, size: 8, color: '#F472B6', opacity: 0.15, visible: true }
            : {
              pattern,
              count: pattern === 'columns' ? 12 : 6,
              gutter: 16,
              offset: 24,
              alignment: 'stretch',
              color: '#F472B6',
              opacity: 0.15,
              visible: true,
            };
          updateGrids([...grids, preset]);
        };
        return (
          <div className="prop-panel__section">
            <div className="prop-panel__title">Layout Grids ({grids.length})</div>
            <div className="auto-layout__row">
              <button type="button" className="auto-layout__btn auto-layout__btn--sm" onClick={() => addGrid('columns')}>+ Col</button>
              <button type="button" className="auto-layout__btn auto-layout__btn--sm" onClick={() => addGrid('rows')}>+ Row</button>
              <button type="button" className="auto-layout__btn auto-layout__btn--sm" onClick={() => addGrid('grid')}>+ Grid</button>
            </div>
            {grids.map((g, idx) => (
              <div key={idx} className="layout-grid-item">
                <div className="layout-grid-item__row">
                  <span className="layout-grid-item__label">{String(g.pattern)}</span>
                  <button
                    type="button"
                    className="layout-grid-item__toggle"
                    title={g.visible === false ? 'Show' : 'Hide'}
                    onClick={() => {
                      const next = [...grids];
                      next[idx] = { ...g, visible: g.visible === false };
                      updateGrids(next);
                    }}
                  >
                    {g.visible === false ? '◯' : '●'}
                  </button>
                  <button
                    type="button"
                    className="layout-grid-item__delete"
                    title="Remove grid"
                    onClick={() => {
                      const next = grids.filter((_, i) => i !== idx);
                      updateGrids(next);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="layout-grid-item__row">
                  {g.pattern !== 'grid' && (
                    <>
                      <input
                        type="number"
                        className="layout-grid-item__input"
                        placeholder="count"
                        value={(g.count as number | undefined) ?? 12}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v)) {
                            const next = [...grids];
                            next[idx] = { ...g, count: Math.max(1, v) };
                            updateGrids(next);
                          }
                        }}
                        title="Count"
                      />
                      <input
                        type="number"
                        className="layout-grid-item__input"
                        placeholder="gutter"
                        value={(g.gutter as number | undefined) ?? 16}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) {
                            const next = [...grids];
                            next[idx] = { ...g, gutter: Math.max(0, v) };
                            updateGrids(next);
                          }
                        }}
                        title="Gutter"
                      />
                      <input
                        type="number"
                        className="layout-grid-item__input"
                        placeholder="offset"
                        value={(g.offset as number | undefined) ?? 24}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) {
                            const next = [...grids];
                            next[idx] = { ...g, offset: Math.max(0, v) };
                            updateGrids(next);
                          }
                        }}
                        title="Offset"
                      />
                    </>
                  )}
                  {g.pattern === 'grid' && (
                    <input
                      type="number"
                      className="layout-grid-item__input"
                      value={(g.size as number | undefined) ?? 8}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) {
                          const next = [...grids];
                          next[idx] = { ...g, size: Math.max(2, v) };
                          updateGrids(next);
                        }
                      }}
                      title="Cell size"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Constraints (子要素が absolute 配置される親内で有効) */}
      {(() => {
        const cs = (n as { constraints?: { horizontal?: string; vertical?: string } }).constraints;
        const h = cs?.horizontal ?? 'left';
        const v = cs?.vertical ?? 'top';
        return (
          <div className="prop-panel__section">
            <div className="prop-panel__title">Constraints</div>
            <div className="auto-layout__row auto-layout__row--nums">
              <div className="auto-layout__num-field">
                <label>Horizontal</label>
                <select
                  className="prop-panel__select"
                  value={h}
                  onChange={(e) => {
                    const cur = ((n as { constraints?: object }).constraints ?? {}) as Record<string, string>;
                    patch({ constraints: { ...cur, horizontal: e.target.value } } as Partial<PenNode>);
                  }}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="center">Center</option>
                  <option value="stretch">Left &amp; Right</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
              <div className="auto-layout__num-field">
                <label>Vertical</label>
                <select
                  className="prop-panel__select"
                  value={v}
                  onChange={(e) => {
                    const cur = ((n as { constraints?: object }).constraints ?? {}) as Record<string, string>;
                    patch({ constraints: { ...cur, vertical: e.target.value } } as Partial<PenNode>);
                  }}
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="center">Center</option>
                  <option value="stretch">Top &amp; Bottom</option>
                  <option value="scale">Scale</option>
                </select>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Layout (frame / group) */}
      {(n.type === 'frame' || n.type === 'group') && (() => {
        const layout = (n as { layout?: string }).layout ?? (n.type === 'frame' ? 'horizontal' : 'none');
        const gap = (n as { gap?: number }).gap ?? 0;
        const padding = (n as { padding?: unknown }).padding;
        const paddingNum = typeof padding === 'number' ? padding : 0;
        const justify = (n as { justifyContent?: string }).justifyContent ?? 'start';
        const align = (n as { alignItems?: string }).alignItems ?? 'start';
        const isFlex = layout === 'vertical' || layout === 'horizontal';

        return (
          <div className="prop-panel__section">
            <div className="prop-panel__title">Auto Layout</div>
            {/* layout 方向: 3 ボタン */}
            <div className="auto-layout__row">
              {[
                { v: 'horizontal', label: 'H', title: 'Horizontal', icon: '⇢' },
                { v: 'vertical', label: 'V', title: 'Vertical', icon: '⇣' },
                { v: 'none', label: 'None', title: 'No layout (absolute)', icon: '◇' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  className={`auto-layout__btn${layout === opt.v ? ' auto-layout__btn--active' : ''}`}
                  title={opt.title}
                  onClick={() => patch({ layout: opt.v } as Partial<PenNode>)}
                >
                  <span className="auto-layout__btn-icon">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            {isFlex && (
              <>
                {/* Gap + Padding */}
                <div className="auto-layout__row auto-layout__row--nums">
                  <div className="auto-layout__num-field" title="Gap between children">
                    <label>Gap</label>
                    <input
                      type="number"
                      value={gap}
                      onFocus={onInputFocus}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) patchInput({ gap: Math.max(0, v) } as Partial<PenNode>);
                      }}
                    />
                  </div>
                  <div className="auto-layout__num-field" title="Padding (all sides)">
                    <label>Pad</label>
                    <input
                      type="number"
                      value={paddingNum}
                      onFocus={onInputFocus}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) patchInput({ padding: Math.max(0, v) } as Partial<PenNode>);
                      }}
                    />
                  </div>
                </div>

                {/* Justify (main axis) */}
                <div className="auto-layout__row-title">Main axis ({layout === 'horizontal' ? '↔' : '↕'})</div>
                <div className="auto-layout__row">
                  {[
                    { v: 'start', title: 'Start' },
                    { v: 'center', title: 'Center' },
                    { v: 'end', title: 'End' },
                    { v: 'space_between', title: 'Space between' },
                    { v: 'space_around', title: 'Space around' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      className={`auto-layout__btn auto-layout__btn--sm${justify === opt.v ? ' auto-layout__btn--active' : ''}`}
                      title={opt.title}
                      onClick={() => patch({ justifyContent: opt.v } as Partial<PenNode>)}
                    >
                      {opt.title === 'Space between' ? 'S-B' : opt.title === 'Space around' ? 'S-A' : opt.title.slice(0, 3)}
                    </button>
                  ))}
                </div>

                {/* Align (cross axis) */}
                <div className="auto-layout__row-title">Cross axis ({layout === 'horizontal' ? '↕' : '↔'})</div>
                <div className="auto-layout__row">
                  {[
                    { v: 'start', title: 'Start' },
                    { v: 'center', title: 'Center' },
                    { v: 'end', title: 'End' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      className={`auto-layout__btn auto-layout__btn--sm${align === opt.v ? ' auto-layout__btn--active' : ''}`}
                      title={opt.title}
                      onClick={() => patch({ alignItems: opt.v } as Partial<PenNode>)}
                    >
                      {opt.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Component / Variant controls */}
      {(() => {
        // reusable なノード: variantOf / variantProps 編集
        const reusable = (n as { reusable?: boolean }).reusable === true;
        const refType = n.type === 'ref';
        if (!reusable && !refType) return null;

        // ドキュメント内の全 reusable と variantOf をマップ
        const allReusable: Array<PenNode & { variantOf?: string; variantProps?: Record<string, string> }> = [];
        const walkReusable = (nodes: PenNode[]) => {
          for (const nn of nodes) {
            if ((nn as { reusable?: boolean }).reusable) allReusable.push(nn as PenNode & { variantOf?: string });
            const children = (nn as { children?: PenNode[] }).children;
            if (children) walkReusable(children);
          }
        };
        walkReusable(state.rawDoc.children);

        if (reusable) {
          const vOf = (n as { variantOf?: string }).variantOf ?? '';
          const props = (n as { variantProps?: Record<string, string> }).variantProps ?? {};
          return (
            <div className="prop-panel__section">
              <div className="prop-panel__title">Component</div>
              <div className="auto-layout__num-field">
                <label>Variant group</label>
                <input
                  type="text"
                  className="prop-panel__input"
                  placeholder="e.g. Button"
                  value={vOf}
                  onChange={(e) => patch({ variantOf: e.target.value || undefined } as Partial<PenNode>)}
                />
              </div>
              <div className="auto-layout__num-field" style={{ marginTop: 6 }}>
                <label>Variant props (e.g. size=lg,state=default)</label>
                <input
                  type="text"
                  className="prop-panel__input"
                  placeholder="size=lg, state=default"
                  value={Object.entries(props).map(([k, v]) => `${k}=${v}`).join(', ')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next: Record<string, string> = {};
                    for (const seg of raw.split(',')) {
                      const [k, v] = seg.split('=').map((s) => s.trim());
                      if (k && v) next[k] = v;
                    }
                    patch({ variantProps: Object.keys(next).length > 0 ? next : undefined } as Partial<PenNode>);
                  }}
                />
              </div>
            </div>
          );
        }

        // ref ノード: 参照先を表示 + variant スワップ
        if (refType) {
          const refId = (n as { ref?: string }).ref ?? '';
          const target = allReusable.find((r) => r.id === refId);
          const variantsInGroup = target?.variantOf
            ? allReusable.filter((r) => r.variantOf === target.variantOf)
            : [];
          return (
            <div className="prop-panel__section">
              <div className="prop-panel__title">Instance</div>
              <div className="auto-layout__num-field">
                <label>References</label>
                <span className="prop-panel__readonly prop-panel__mono">{refId || '(unset)'}</span>
              </div>
              {target?.variantOf && variantsInGroup.length > 1 && (
                <div className="auto-layout__num-field" style={{ marginTop: 6 }}>
                  <label>Variant ({target.variantOf})</label>
                  <select
                    className="prop-panel__select"
                    value={refId}
                    onChange={(e) => patch({ ref: e.target.value } as unknown as Partial<PenNode>)}
                  >
                    {variantsInGroup.map((v) => {
                      const label = v.variantProps
                        ? Object.entries(v.variantProps).map(([k, val]) => `${k}=${val}`).join(', ')
                        : (v.name ?? v.id);
                      return <option key={v.id} value={v.id}>{label}</option>;
                    })}
                  </select>
                </div>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Node ID (read-only) */}
      <div className="prop-panel__section">
        <div className="prop-panel__title">Node ID</div>
        <span className="prop-panel__readonly prop-panel__mono">{n.id}</span>
      </div>

      {/* カラーピッカー popover */}
      {picker && (
        <ColorPicker
          color={(picker.kind === 'fill' ? fillColor : strokeColor)?.slice(0, 7) || '#000000'}
          anchorRect={picker.rect}
          onChange={(hex) => {
            if (picker.kind === 'fill') {
              patchSilent({ fill: hex } as Partial<PenNode>);
            } else {
              const current = (n as { stroke?: object }).stroke ?? {};
              patchSilent({ stroke: { ...current, fill: hex } } as Partial<PenNode>);
            }
          }}
          onClose={closePicker}
        />
      )}
    </div>
  );
}
