/**
 * Grid Snap のトグル + サイズ入力。ツールバー右側に表示。
 */

import { useEditor } from '../../pen/state/EditorContext';

const GRID_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 5H14M2 8H14M2 11H14M5 2V14M8 2V14M11 2V14" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export function GridSnapToggle() {
  const { state, setGridSnap, setGridSize } = useEditor();
  return (
    <div className="grid-snap">
      <button
        type="button"
        className={`viewer__zoom-btn grid-snap__btn${state.gridSnap ? ' viewer__zoom-btn--active' : ''}`}
        title={`Grid snap (${state.gridSize}px) — Cmd+'`}
        onClick={() => setGridSnap(!state.gridSnap)}
      >
        {GRID_ICON}
      </button>
      {state.gridSnap && (
        <input
          type="number"
          className="grid-snap__size"
          value={state.gridSize}
          min={1}
          max={512}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) setGridSize(v);
          }}
          title="Grid size (px)"
        />
      )}
    </div>
  );
}
