import { useEffect, useRef } from 'react';

interface Group {
  title: string;
  items: { keys: string; desc: string }[];
}

const GROUPS: Group[] = [
  {
    title: 'Tools',
    items: [
      { keys: 'V', desc: 'Select tool' },
      { keys: 'R', desc: 'Rectangle' },
      { keys: 'O', desc: 'Ellipse' },
      { keys: 'L', desc: 'Line' },
      { keys: 'T', desc: 'Text' },
      { keys: 'F', desc: 'Frame' },
      { keys: 'N', desc: 'Note (sticky)' },
      { keys: 'Esc', desc: 'Back to Select tool' },
    ],
  },
  {
    title: 'Selection & editing',
    items: [
      { keys: 'Click', desc: 'Select node' },
      { keys: 'Shift + Click', desc: 'Add / remove from selection' },
      { keys: 'Drag', desc: 'Marquee select' },
      { keys: 'Double-click', desc: 'Edit text / note inline' },
      { keys: 'Cmd + A', desc: 'Select all' },
      { keys: 'Cmd + D', desc: 'Duplicate' },
      { keys: 'Cmd + G', desc: 'Group selection' },
      { keys: 'Cmd + Shift + G', desc: 'Ungroup' },
      { keys: 'Opt + Cmd + G', desc: 'Wrap selection in frame' },
      { keys: 'Cmd + Alt + K', desc: 'Create component from selection' },
      { keys: 'Cmd + Alt + M', desc: 'Toggle "use as mask" on selection' },
      { keys: 'Cmd + F', desc: 'Find & Replace' },
      { keys: 'Backspace', desc: 'Delete selected' },
      { keys: 'Arrows', desc: 'Nudge 1px (Shift: 10px)' },
      { keys: 'Cmd + Arrows', desc: 'Resize 1px (Shift: 10px)' },
      { keys: '0-9', desc: 'Opacity (1=10%, 9=90%, 0=100%)' },
      { keys: 'Tab', desc: 'Next sibling (Shift: prev)' },
    ],
  },
  {
    title: 'Drag & resize',
    items: [
      { keys: 'Drag', desc: 'Move (with snap guides)' },
      { keys: 'Shift + Drag', desc: 'Axis-lock move' },
      { keys: 'Alt + Drag', desc: 'Duplicate while dragging' },
      { keys: 'Corner handle', desc: 'Resize' },
      { keys: 'Shift + Resize', desc: 'Maintain aspect ratio' },
      { keys: 'Top rotate handle', desc: 'Rotate (Shift: 15° snap)' },
      { keys: 'Radius handle', desc: 'Adjust corner radius' },
      { keys: 'Alt + Hover', desc: 'Measure distance to another node' },
    ],
  },
  {
    title: 'Style',
    items: [
      { keys: 'Cmd + C', desc: 'Copy node' },
      { keys: 'Cmd + V', desc: 'Paste node' },
      { keys: 'Cmd + Alt + C', desc: 'Copy style only' },
      { keys: 'Cmd + Alt + V', desc: 'Paste style onto selection' },
    ],
  },
  {
    title: 'z-order & layers',
    items: [
      { keys: 'Cmd + ]', desc: 'Bring forward' },
      { keys: 'Cmd + [', desc: 'Send backward' },
      { keys: 'Cmd + Shift + ]', desc: 'Bring to front' },
      { keys: 'Cmd + Shift + [', desc: 'Send to back' },
      { keys: 'Cmd + Shift + H', desc: 'Toggle visibility' },
      { keys: 'Cmd + Shift + L', desc: 'Toggle lock' },
      { keys: 'Layers drag', desc: 'Reorder within same parent' },
    ],
  },
  {
    title: 'View / History',
    items: [
      { keys: 'Cmd + Scroll', desc: 'Zoom in / out' },
      { keys: 'Scroll / 2-finger', desc: 'Pan' },
      { keys: 'Space + Drag', desc: 'Hand tool (pan)' },
      { keys: 'Alt + Drag (empty)', desc: 'Pan' },
      { keys: 'Cmd + +', desc: 'Zoom in' },
      { keys: 'Cmd + -', desc: 'Zoom out' },
      { keys: 'Cmd + 0', desc: 'Fit to view' },
      { keys: 'Cmd + 1', desc: '100%' },
      { keys: 'Shift + 1', desc: 'Fit to view (same)' },
      { keys: 'Shift + 2', desc: 'Zoom to selected node' },
      { keys: 'Cmd + [ / ] (no selection)', desc: 'Navigate history' },
      { keys: 'Cmd + ;', desc: "Toggle rulers" },
      { keys: "Cmd + '", desc: 'Toggle grid snap' },
      { keys: 'Cmd + Enter', desc: 'Present / Play mode' },
      { keys: 'Cmd + Z', desc: 'Undo' },
      { keys: 'Cmd + Shift + Z', desc: 'Redo' },
    ],
  },
  {
    title: 'Search & command',
    items: [
      { keys: '/', desc: 'Quick frame search' },
      { keys: 'Cmd + P', desc: 'Quick frame search' },
      { keys: 'Cmd + Shift + P', desc: 'Command palette' },
      { keys: 'Cmd + F', desc: 'Find & Replace text' },
      { keys: 'Cmd + K', desc: 'AI Design Generator' },
      { keys: 'Cmd + I', desc: 'Auto ID / Rename frames' },
      { keys: 'Cmd + S', desc: 'Export .pen file' },
      { keys: 'Cmd + Shift + S', desc: 'Save As (rename)' },
      { keys: 'Cmd + /', desc: 'Show this dialog' },
      { keys: 'Esc', desc: 'Close dialog / Deselect' },
    ],
  },
  {
    title: 'Vim mode',
    items: [
      { keys: 'h / j / k / l', desc: 'Nudge node / Pan camera' },
      { keys: 'Shift + H/J/K/L', desc: 'Half-page scroll' },
      { keys: 'g + h/j/k/l', desc: 'Jump frames' },
      { keys: '[N] + key', desc: 'Repeat N times (e.g. 5l, 3gj)' },
      { keys: 'f', desc: 'Hint labels: frames only' },
      { keys: 't', desc: 'Hint labels: all nodes' },
      { keys: 'F', desc: 'Zoom-focus on selected node' },
    ],
  },
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
          {GROUPS.map((g) => (
            <div key={g.title} className="shortcuts-group">
              <div className="shortcuts-group__title">{g.title}</div>
              <table className="shortcuts-table">
                <tbody>
                  {g.items.map((s) => (
                    <tr key={`${g.title}-${s.keys}`}>
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
          ))}
        </div>
      </div>
    </div>
  );
}
