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

export function FrameSearch({ frames, activeFrameId, cameraCx, cameraCy, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const matched = frames.filter((f) => f.name.toLowerCase().includes(q));
    // Sort by distance from current camera center
    return matched.sort(
      (a, b) => frameCenterDist(a, cameraCx, cameraCy) - frameCenterDist(b, cameraCx, cameraCy),
    );
  }, [frames, query, cameraCx, cameraCy]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  return (
    <div className="dialog-backdrop" onClick={handleBackdrop}>
      <div className="frame-search">
        <input
          ref={inputRef}
          className="frame-search__input"
          type="text"
          placeholder="Search frames..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="frame-search__list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="frame-search__empty">No frames found</div>
          )}
          {filtered.map((f, i) => {
            const dist = frameCenterDist(f, cameraCx, cameraCy);
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
