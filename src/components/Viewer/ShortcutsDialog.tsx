import { useEffect, useRef } from 'react';

const SHORTCUTS = [
  { keys: 'Cmd + Scroll', desc: 'Zoom in / out' },
  { keys: 'Scroll / 2-finger', desc: 'Pan' },
  { keys: 'Space + Drag', desc: 'Hand tool (pan)' },
  { keys: 'Alt + Drag', desc: 'Pan' },
  { keys: 'Cmd + +', desc: 'Zoom in' },
  { keys: 'Cmd + -', desc: 'Zoom out' },
  { keys: 'Cmd + 0', desc: 'Fit to view' },
  { keys: 'Cmd + 1', desc: '100%' },
  { keys: 'Cmd + [', desc: 'Back (previous view)' },
  { keys: 'Cmd + ]', desc: 'Forward' },
  { keys: 'Cmd + P', desc: 'Quick frame search' },
  { keys: 'Cmd + I', desc: 'Auto ID / Rename frames' },
  { keys: 'Cmd + S', desc: 'Export .pen file' },
  { keys: 'Cmd + Shift + S', desc: 'Save As (rename)' },
  { keys: 'Cmd + /', desc: 'Show this dialog' },
  { keys: 'Esc', desc: 'Close dialog / Deselect' },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === ref.current) onClose();
  };

  return (
    <div className="dialog-backdrop" ref={ref} onClick={handleBackdrop}>
      <div className="dialog">
        <div className="dialog__header">
          <span className="dialog__title">Keyboard Shortcuts</span>
          <button type="button" className="dialog__close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="dialog__body">
          <table className="shortcuts-table">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td className="shortcuts-table__key">
                    {s.keys.split(' + ').map((k, i) => (
                      <span key={i}>
                        {i > 0 && <span className="shortcuts-table__plus">+</span>}
                        <kbd>{k}</kbd>
                      </span>
                    ))}
                  </td>
                  <td className="shortcuts-table__desc">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
