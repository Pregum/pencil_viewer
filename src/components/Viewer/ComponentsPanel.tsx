/**
 * Components パネル: doc 内の reusable=true ノードを一覧表示し、
 * インスタンス挿入 / 元ノード選択 / 解除を行う。
 *
 * 下部の PagesPanel と並ぶ左下セクション。
 */

import { useMemo } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

const COMP_ICON = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <path d="M2 5L8 9L14 5M8 9V15" stroke="currentColor" strokeWidth="1.2" fill="none" />
  </svg>
);
const PLUS_ICON = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const UNMAKE_ICON = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

function walk(nodes: PenNode[], out: PenNode[] = []): PenNode[] {
  for (const n of nodes) {
    if ((n as { reusable?: boolean }).reusable) out.push(n);
    const children = (n as { children?: PenNode[] }).children;
    if (children) walk(children, out);
  }
  return out;
}

interface Props {
  collapsed?: boolean;
  onTogglePanel?: () => void;
  onZoomToNode?: (rect: { x: number; y: number; width: number; height: number; id: string }) => void;
}

export function ComponentsPanel({ collapsed, onTogglePanel, onZoomToNode }: Props) {
  const { state, selectNode, insertInstance, unmakeComponent, createComponent } = useEditor();
  const components = useMemo(() => walk(state.rawDoc.children), [state.rawDoc]);

  // variantOf でグルーピング。null グループはグループ無し単品コンポーネント。
  const grouped = useMemo(() => {
    const groups = new Map<string | null, PenNode[]>();
    for (const c of components) {
      const key = (c as { variantOf?: string }).variantOf ?? null;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }
    return groups;
  }, [components]);

  const selectedIsNonComponent = !!(
    state.selectedNodeId &&
    !components.some((c) => c.id === state.selectedNodeId)
  );

  if (collapsed) {
    return (
      <div className="components-panel components-panel--collapsed">
        <button className="components-panel__toggle-btn" onClick={onTogglePanel} title="Show Components">
          {COMP_ICON}
        </button>
      </div>
    );
  }

  return (
    <div className="components-panel">
      <div className="components-panel__header">
        <span>Components</span>
        <span className="components-panel__count">{components.length}</span>
        <button
          className="components-panel__icon-btn"
          title="Create component from selection (Cmd+Alt+K)"
          disabled={!selectedIsNonComponent}
          onClick={() => createComponent()}
        >
          {PLUS_ICON}
        </button>
        {onTogglePanel && (
          <button className="components-panel__icon-btn" onClick={onTogglePanel} title="Hide Components">
            ✕
          </button>
        )}
      </div>
      <div className="components-panel__list">
        {components.length === 0 && (
          <div className="components-panel__empty">
            No components yet. Select a node and click <strong>+</strong> or press <kbd>Cmd+Alt+K</kbd>.
          </div>
        )}
        {/* variant グループをまとめて表示、null グループは最後に flat で */}
        {Array.from(grouped.entries())
          .sort((a, b) => {
            if (a[0] === null) return 1;
            if (b[0] === null) return -1;
            return a[0].localeCompare(b[0]);
          })
          .map(([groupName, items]) => (
            <div key={groupName ?? '__flat__'} className={groupName ? 'components-panel__group' : ''}>
              {groupName && (
                <div className="components-panel__group-header">
                  <span className="components-panel__group-name">{groupName}</span>
                  <span className="components-panel__group-count">{items.length}</span>
                </div>
              )}
              {items.map((c) => {
                const w = typeof (c as { width?: unknown }).width === 'number' ? (c as { width: number }).width : 0;
                const h = typeof (c as { height?: unknown }).height === 'number' ? (c as { height: number }).height : 0;
                const variantProps = (c as { variantProps?: Record<string, string> }).variantProps;
                const variantLabel = variantProps
                  ? Object.entries(variantProps).map(([k, v]) => `${k}=${v}`).join(', ')
                  : null;
                return (
                  <div
                    key={c.id}
                    className="components-panel__item"
                    onClick={() => {
                      selectNode(c.id);
                      if (w > 0 && h > 0) {
                        onZoomToNode?.({ id: c.id, x: c.x ?? 0, y: c.y ?? 0, width: w, height: h });
                      }
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/pencil-component', c.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <span className="components-panel__item-icon">{COMP_ICON}</span>
                    <span className="components-panel__item-name" title={c.name ?? c.id}>
                      {variantLabel ?? c.name ?? c.id}
                    </span>
                    <span className="components-panel__item-size">
                      {w > 0 && h > 0 ? `${Math.round(w)}×${Math.round(h)}` : c.type}
                    </span>
                    <button
                      type="button"
                      className="components-panel__icon-btn"
                      title="Insert instance"
                      onClick={(e) => {
                        e.stopPropagation();
                        insertInstance(c.id);
                      }}
                    >
                      {PLUS_ICON}
                    </button>
                    <button
                      type="button"
                      className="components-panel__icon-btn components-panel__item-unmake"
                      title="Detach (remove reusable flag)"
                      onClick={(e) => {
                        e.stopPropagation();
                        unmakeComponent(c.id);
                      }}
                    >
                      {UNMAKE_ICON}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
