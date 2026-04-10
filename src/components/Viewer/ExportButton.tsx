import { useEffect, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';

export function ExportButton() {
  const { exportPen } = useEditor();
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [fileName, setFileName] = useState('exported.pen');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key === 's') {
        // Cmd+Shift+S: Save As
        e.preventDefault();
        setShowSaveAs(true);
      } else if (mod && e.key === 's') {
        // Cmd+S: Quick export
        e.preventDefault();
        exportPen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportPen]);

  const handleSaveAs = () => {
    exportPen(fileName);
    setShowSaveAs(false);
  };

  return (
    <>
      <button
        type="button"
        className="viewer__zoom-btn"
        title="Export .pen (Cmd+S)"
        onClick={() => exportPen()}
        style={{ fontSize: 12, width: 'auto', padding: '0 8px' }}
      >
        Export
      </button>
      {showSaveAs && (
        <div
          className="dialog-backdrop"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains('dialog-backdrop'))
              setShowSaveAs(false);
          }}
        >
          <div className="dialog" style={{ width: 400 }}>
            <div className="dialog__header">
              <span className="dialog__title">Save As</span>
              <button
                type="button"
                className="dialog__close"
                onClick={() => setShowSaveAs(false)}
              >
                &times;
              </button>
            </div>
            <div className="dialog__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  File Name
                </label>
                <input
                  className="prop-panel__input"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAs();
                    if (e.key === 'Escape') setShowSaveAs(false);
                  }}
                  autoFocus
                  style={{ marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="button" onClick={() => setShowSaveAs(false)}>
                  Cancel
                </button>
                <button className="button button--primary" onClick={handleSaveAs}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
