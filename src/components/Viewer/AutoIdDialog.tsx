/**
 * フレーム自動ID割り振りダイアログ。
 * 距離が近いフレームを行/列でグループ化し、連番の name を付与する。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

interface FrameInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function collectTopFrames(nodes: PenNode[]): FrameInfo[] {
  const result: FrameInfo[] = [];
  for (const node of nodes) {
    if (node.type === 'frame') {
      const w = typeof node.width === 'number' ? node.width : 0;
      const h = typeof node.height === 'number' ? node.height : 0;
      if (w > 0 && h > 0) {
        result.push({
          id: node.id,
          name: node.name ?? node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          width: w,
          height: h,
        });
      }
    }
  }
  return result;
}

/** Y座標が近いフレームを同じ行としてグループ化 */
function groupByRow(frames: FrameInfo[], threshold: number): FrameInfo[][] {
  if (frames.length === 0) return [];
  const sorted = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: FrameInfo[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const lastRow = rows[rows.length - 1];
    const lastY = lastRow[0].y;
    if (Math.abs(sorted[i].y - lastY) <= threshold) {
      lastRow.push(sorted[i]);
    } else {
      rows.push([sorted[i]]);
    }
  }
  // 各行内をX座標でソート
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }
  return rows;
}

interface Props {
  onClose: () => void;
}

export function AutoIdDialog({ onClose }: Props) {
  const { state, updateNode } = useEditor();
  const [prefix, setPrefix] = useState('WF-');
  const [suffix, setSuffix] = useState('');
  const [startNum, setStartNum] = useState(1);
  const [groupThreshold, setGroupThreshold] = useState(100);
  const [direction, setDirection] = useState<'row' | 'column'>('row');
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const frames = useMemo(
    () => collectTopFrames(state.doc.children),
    [state.doc],
  );

  const filteredFrames = useMemo(() => {
    if (!filter) return frames;
    const q = filter.toLowerCase();
    return frames.filter((f) => f.name.toLowerCase().includes(q));
  }, [frames, filter]);

  const grouped = useMemo(() => {
    if (direction === 'row') {
      return groupByRow(filteredFrames, groupThreshold);
    }
    // column: X座標でグループ化してY順
    const sorted = [...filteredFrames].sort((a, b) => a.x - b.x || a.y - b.y);
    if (sorted.length === 0) return [];
    const cols: FrameInfo[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      const lastCol = cols[cols.length - 1];
      const lastX = lastCol[0].x;
      if (Math.abs(sorted[i].x - lastX) <= groupThreshold) {
        lastCol.push(sorted[i]);
      } else {
        cols.push([sorted[i]]);
      }
    }
    for (const col of cols) {
      col.sort((a, b) => a.y - b.y);
    }
    return cols;
  }, [filteredFrames, groupThreshold, direction]);

  // Preview: generate the names that will be assigned
  const preview = useMemo(() => {
    const result: { id: string; oldName: string; newName: string }[] = [];
    let num = startNum;
    for (const group of grouped) {
      for (const f of group) {
        result.push({
          id: f.id,
          oldName: f.name,
          newName: `${prefix}${num}${suffix}`,
        });
        num++;
      }
    }
    return result;
  }, [grouped, prefix, suffix, startNum]);

  const apply = () => {
    for (const p of preview) {
      updateNode(p.id, { name: p.newName } as Partial<PenNode>);
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={handleBackdrop}>
      <div className="dialog" style={{ width: 560, maxHeight: '80vh' }}>
        <div className="dialog__header">
          <span className="dialog__title">Auto ID / Rename Frames</span>
          <button type="button" className="dialog__close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="dialog__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Settings */}
          <div className="auto-id__settings">
            <div className="auto-id__row">
              <label>Prefix</label>
              <input
                ref={inputRef}
                className="prop-panel__input"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="WF-"
              />
            </div>
            <div className="auto-id__row">
              <label>Suffix</label>
              <input
                className="prop-panel__input"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder=""
              />
            </div>
            <div className="auto-id__row">
              <label>Start #</label>
              <input
                className="prop-panel__input prop-panel__input--num"
                type="number"
                value={startNum}
                min={0}
                onChange={(e) => setStartNum(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="auto-id__row">
              <label>Direction</label>
              <select
                className="prop-panel__select"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'row' | 'column')}
              >
                <option value="row">Row (Y then X)</option>
                <option value="column">Column (X then Y)</option>
              </select>
            </div>
            <div className="auto-id__row">
              <label>Group threshold</label>
              <input
                className="prop-panel__input prop-panel__input--num"
                type="number"
                value={groupThreshold}
                min={0}
                onChange={(e) => setGroupThreshold(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="auto-id__row">
              <label>Filter</label>
              <input
                className="prop-panel__input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name..."
              />
            </div>
          </div>

          {/* Preview */}
          <div className="auto-id__preview-header">
            Preview ({preview.length} frames)
          </div>
          <div className="auto-id__preview">
            {grouped.map((group, gi) => (
              <div key={gi} className="auto-id__group">
                <div className="auto-id__group-label">
                  {direction === 'row' ? 'Row' : 'Column'} {gi + 1}
                </div>
                {group.map((f) => {
                  const p = preview.find((pp) => pp.id === f.id);
                  return (
                    <div key={f.id} className="auto-id__item">
                      <span className="auto-id__old">{f.name}</span>
                      <span className="auto-id__arrow">&rarr;</span>
                      <span className="auto-id__new">{p?.newName}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" onClick={apply}>
              Apply ({preview.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
