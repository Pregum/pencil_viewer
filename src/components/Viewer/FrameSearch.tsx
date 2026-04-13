import { useEffect, useMemo, useRef, useState } from 'react';

interface FrameEntry {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  frames: FrameEntry[];
  activeFrameId: string | null;
  cameraCx: number;
  cameraCy: number;
  onSelect: (frame: FrameEntry) => void;
  onClose: () => void;
}

function frameCenterDist(f: FrameEntry, cx: number, cy: number): number {
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
  return Math.sqrt((fx - cx) ** 2 + (fy - cy) ** 2);
}

function formatDist(d: number): string {
  if (d < 1000) return `${Math.round(d)}`;
  return `${(d / 1000).toFixed(1)}k`;
}

/** フレーム名からカテゴリを推定 */
function categorize(name: string): { label: string; color: string } {
  const n = name.toLowerCase();
  if (n.startsWith('wf:') || n.startsWith('wf ')) return { label: 'WF', color: '#2563eb' };
  if (n.startsWith('section:') || n.startsWith('section')) return { label: 'SEC', color: '#d97706' };
  if (n.startsWith('label:') || n.startsWith('label')) return { label: 'LBL', color: '#9333ea' };
  if (n.includes('login') || n.includes('sign')) return { label: 'AUTH', color: '#dc2626' };
  if (n.includes('管理') || n.includes('admin') || n.includes('management')) return { label: 'ADM', color: '#059669' };
  if (n.includes('nav') || n.includes('ナビ')) return { label: 'NAV', color: '#0891b2' };
  if (n.includes('guide') || n.includes('ガイド') || n.includes('memo')) return { label: 'DOC', color: '#6b7280' };
  return { label: 'FRM', color: '#4f46e5' };
}

export function FrameSearch({ frames, activeFrameId, cameraCx, cameraCy, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const matched = frames.filter((f) => f.name.toLowerCase().includes(q));
    return matched.sort(
      (a, b) => frameCenterDist(a, cameraCx, cameraCy) - frameCenterDist(b, cameraCx, cameraCy),
    );
  }, [frames, query, cameraCx, cameraCy]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      // Block Ctrl+P/N and Cmd+P from propagating to PenViewer while search is open
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'p' || e.key === 'n')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    // capture phase to intercept before PenViewer's listener
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IME 変換中のキー入力は無視（日本語確定 Enter で閉じない）
    if (e.nativeEvent.isComposing || e.key === 'Process') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        onSelect(filtered[selectedIdx]);
        onClose();
      }
    }
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) {
      onClose();
    }
  };

  // Minimap bounds
  const minimap = useMemo(() => {
    if (frames.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of frames) {
      minX = Math.min(minX, f.x);
      minY = Math.min(minY, f.y);
      maxX = Math.max(maxX, f.x + f.width);
      maxY = Math.max(maxY, f.y + f.height);
    }
    const pad = 40;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [frames]);

  const hoveredFrame = filtered[selectedIdx] ?? null;

  return (
    <div className="dialog-backdrop" onClick={handleBackdrop}>
      <div className="frame-search" style={{ width: 560 }}>
        <input
          ref={inputRef}
          className="frame-search__input"
          type="text"
          placeholder="Search frames..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Minimap */}
        {minimap && (
          <div className="frame-search__minimap">
            <svg
              viewBox={`${minimap.x} ${minimap.y} ${minimap.w} ${minimap.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="frame-search__minimap-svg"
            >
              {frames.map((f) => {
                const isHovered = hoveredFrame?.id === f.id;
                const isActive = f.id === activeFrameId;
                return (
                  <rect
                    key={f.id}
                    x={f.x}
                    y={f.y}
                    width={f.width}
                    height={f.height}
                    fill={isHovered ? '#4f46e5' : isActive ? '#7c3aed' : '#e5e7eb'}
                    stroke={isHovered ? '#4f46e5' : '#d1d5db'}
                    strokeWidth={minimap.w / 400}
                    rx={minimap.w / 200}
                    opacity={isHovered ? 1 : 0.7}
                  />
                );
              })}
              {/* Camera crosshair */}
              <circle cx={cameraCx} cy={cameraCy} r={minimap.w / 80} fill="#dc2626" opacity={0.6} />
            </svg>
          </div>
        )}

        <div className="frame-search__list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="frame-search__empty">No frames found</div>
          )}
          {filtered.map((f, i) => {
            const dist = frameCenterDist(f, cameraCx, cameraCy);
            const cat = categorize(f.name);
            return (
              <div
                key={f.id}
                className={`frame-search__item ${i === selectedIdx ? 'frame-search__item--active' : ''} ${f.id === activeFrameId ? 'frame-search__item--current' : ''}`}
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => {
                  onSelect(f);
                  onClose();
                }}
              >
                <span
                  className="frame-search__cat"
                  style={{ background: cat.color + '20', color: cat.color }}
                >
                  {cat.label}
                </span>
                <span className="frame-search__name">
                  {f.id === activeFrameId && <span className="frame-search__current-dot" />}
                  {f.name}
                </span>
                <span className="frame-search__right">
                  <span className="frame-search__dist">{formatDist(dist)}</span>
                  <span className="frame-search__meta">
                    {Math.round(f.width)} x {Math.round(f.height)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
