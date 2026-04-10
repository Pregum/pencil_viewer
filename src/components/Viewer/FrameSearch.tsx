import { useEffect, useRef, useState } from 'react';

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
  onSelect: (frame: FrameEntry) => void;
  onClose: () => void;
}

export function FrameSearch({ frames, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = frames.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected item into view
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
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
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
          {filtered.map((f, i) => (
            <div
              key={f.id}
              className={`frame-search__item ${i === selectedIdx ? 'frame-search__item--active' : ''}`}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => {
                onSelect(f);
                onClose();
              }}
            >
              <span className="frame-search__name">{f.name}</span>
              <span className="frame-search__meta">
                {Math.round(f.width)} x {Math.round(f.height)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
