import { useEffect } from 'react';
import { useEditor } from '../../pen/state/EditorContext';

export function ExportButton() {
  const { exportPen } = useEditor();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        exportPen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportPen]);

  return (
    <button
      type="button"
      className="viewer__zoom-btn"
      title="Export .pen (Cmd+S)"
      onClick={exportPen}
      style={{ fontSize: 12, width: 'auto', padding: '0 8px' }}
    >
      Export
    </button>
  );
}
