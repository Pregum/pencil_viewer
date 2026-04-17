/**
 * Pages パネル: トップレベルの frame ノードを「ページ」として一覧・操作する。
 * - ページ選択 → zoomToFrame で画面全体にフィット
 * - 新規ページ追加（空の Frame を末尾に作成）
 * - リネーム（ダブルクリック）
 * - 削除
 * - 並び替え (HTML5 DnD)
 *
 * 非破壊: 特別なデータ構造は導入せず、doc.children 内の frame を "page" として扱う。
 */

import { useCallback, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { FrameNode, PenNode } from '../../pen/types';

export interface PagesPanelProps {
  collapsed?: boolean;
  onTogglePanel?: () => void;
  /** ページ選択時のズーム先指示（undefined ならそのまま選択のみ） */
  onZoomToPage?: (rect: { x: number; y: number; width: number; height: number; id: string; name: string }) => void;
}

function isFramePage(n: PenNode): n is FrameNode {
  return n.type === 'frame';
}

const ADD_ICON = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const PAGE_ICON = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.2" fill="none" />
  </svg>
);

const TRASH_ICON = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M4 5H12L11.5 13H4.5L4 5Z" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6 5V3.5A1 1 0 0 1 7 2.5H9A1 1 0 0 1 10 3.5V5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M2.5 5H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export function PagesPanel({ collapsed, onTogglePanel, onZoomToPage }: PagesPanelProps) {
  const { state, selectNode, addNode, updateNode, deleteNode, reorderChildren } = useEditor();
  const pages = state.doc.children.filter(isFramePage);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dropInfo, setDropInfo] = useState<{ id: string; pos: 'above' | 'below' } | null>(null);

  const handleSelectPage = useCallback((p: FrameNode) => {
    selectNode(p.id);
    const w = typeof p.width === 'number' ? p.width : 0;
    const h = typeof p.height === 'number' ? p.height : 0;
    if (w > 0 && h > 0) {
      onZoomToPage?.({ id: p.id, name: p.name ?? p.id, x: p.x ?? 0, y: p.y ?? 0, width: w, height: h });
    }
  }, [selectNode, onZoomToPage]);

  const handleAddPage = useCallback(() => {
    // 既存ページの右側に新規フレームを配置
    const gap = 80;
    let rightMostEdge = 0;
    for (const p of pages) {
      const w = typeof p.width === 'number' ? p.width : 375;
      rightMostEdge = Math.max(rightMostEdge, (p.x ?? 0) + w);
    }
    const newPage: FrameNode = {
      type: 'frame',
      id: `page_${Date.now()}`,
      name: `Page ${pages.length + 1}`,
      x: pages.length === 0 ? 0 : rightMostEdge + gap,
      y: 0,
      width: 375,
      height: 812,
      layout: 'none',
      fill: '#FFFFFF',
      stroke: { thickness: 1, fill: '#E5E7EB' },
      children: [],
    };
    addNode(newPage);
    // ズームフィット
    handleSelectPage(newPage);
  }, [pages, addNode, handleSelectPage]);

  const commitRename = () => {
    if (!renameId) return;
    updateNode(renameId, { name: renameValue.trim() || renameId } as Partial<PenNode>);
    setRenameId(null);
  };

  if (collapsed) {
    return (
      <div className="pages-panel pages-panel--collapsed">
        <button className="pages-panel__toggle-btn" onClick={onTogglePanel} title="Show Pages">
          {PAGE_ICON}
        </button>
      </div>
    );
  }

  return (
    <div className="pages-panel">
      <div className="pages-panel__header">
        <span>Pages</span>
        <span className="pages-panel__count">{pages.length}</span>
        <button className="pages-panel__icon-btn" onClick={handleAddPage} title="New page">
          {ADD_ICON}
        </button>
        {onTogglePanel && (
          <button className="pages-panel__icon-btn" onClick={onTogglePanel} title="Hide Pages">
            ✕
          </button>
        )}
      </div>
      <div className="pages-panel__list">
        {pages.length === 0 && (
          <div className="pages-panel__empty">
            No pages yet. Click <strong>+</strong> to add.
          </div>
        )}
        {pages.map((p, idx) => {
          const active = state.selectedNodeId === p.id;
          const dropping = dropInfo?.id === p.id;
          return (
            <div
              key={p.id}
              className={`pages-panel__item${active ? ' pages-panel__item--active' : ''}${dropping ? ` pages-panel__item--drop-${dropInfo.pos}` : ''}`}
              draggable
              onClick={() => handleSelectPage(p)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenameId(p.id);
                setRenameValue(p.name ?? p.id);
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/pencil-page', JSON.stringify({ fromIdx: state.doc.children.indexOf(p) }));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                setDropInfo({ id: p.id, pos: e.clientY < midY ? 'above' : 'below' });
              }}
              onDragLeave={() => setDropInfo(null)}
              onDrop={(e) => {
                e.preventDefault();
                const pos = dropInfo?.pos;
                setDropInfo(null);
                const raw = e.dataTransfer.getData('application/pencil-page');
                if (!raw) return;
                try {
                  const payload = JSON.parse(raw) as { fromIdx: number };
                  const targetFrameIdx = state.doc.children.indexOf(p);
                  const toIdx = pos === 'below' ? targetFrameIdx + 1 : targetFrameIdx;
                  reorderChildren(null, payload.fromIdx, toIdx);
                } catch { /* ignore */ }
              }}
            >
              <span className="pages-panel__item-icon">{PAGE_ICON}</span>
              {renameId === p.id ? (
                <input
                  autoFocus
                  className="pages-panel__rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                    if (e.key === 'Escape') { e.preventDefault(); setRenameId(null); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="pages-panel__item-name" title={p.name ?? p.id}>
                  {p.name ?? p.id}
                </span>
              )}
              <div className="pages-panel__item-size">
                {typeof p.width === 'number' && typeof p.height === 'number'
                  ? `${Math.round(p.width)}×${Math.round(p.height)}`
                  : ''}
              </div>
              <button
                type="button"
                className="pages-panel__icon-btn pages-panel__item-delete"
                title="Delete page"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${p.name ?? p.id}"?`)) deleteNode(p.id);
                }}
              >
                {TRASH_ICON}
              </button>
              {/* idx reference to avoid unused warning */}
              <span hidden>{idx}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
