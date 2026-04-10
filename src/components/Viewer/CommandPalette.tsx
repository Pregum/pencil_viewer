/**
 * コマンドパレット (Cmd+Shift+P)。
 * VS Code 風のコマンド検索・実行UI。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

interface Props {
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        filtered[selectedIdx].action();
        onClose();
      }
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) onClose();
      }}
    >
      <div className="frame-search">
        <input
          ref={inputRef}
          className="frame-search__input"
          type="text"
          placeholder="> Type a command..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="frame-search__list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="frame-search__empty">No commands found</div>
          )}
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`frame-search__item ${i === selectedIdx ? 'frame-search__item--active' : ''}`}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => {
                cmd.action();
                onClose();
              }}
            >
              <span className="frame-search__name">{cmd.label}</span>
              {cmd.shortcut && (
                <span className="frame-search__meta">{cmd.shortcut}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
