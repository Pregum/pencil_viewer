/**
 * Click-to-edit zoom percentage label.
 * Shows the current zoom %, clicking opens an input to type a custom value.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  zoomPercent: number;
  onZoomChange: (percent: number) => void;
}

export function ZoomInput({ zoomPercent, onZoomChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setValue(String(zoomPercent));
    setEditing(true);
  }, [zoomPercent]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 6400) {
      onZoomChange(parsed);
    }
    setEditing(false);
  }, [value, onZoomChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(false);
      }
    },
    [commit],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="viewer__zoom-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={{
          width: '48px',
          textAlign: 'center',
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: '2px 4px',
          border: '1px solid var(--color-accent)',
          borderRadius: '4px',
          outline: 'none',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
        }}
      />
    );
  }

  return (
    <span
      className="viewer__zoom-label"
      title="Click to set zoom %"
      onClick={startEditing}
    >
      {zoomPercent}%
    </span>
  );
}
