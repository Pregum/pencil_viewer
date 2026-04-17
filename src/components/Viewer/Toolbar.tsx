/**
 * ツールバー: ドラッグでシェイプを作成するツール群。
 * select / rectangle / ellipse / line / text / frame の切り替えボタンと
 * キーボードショートカットを提供する。
 */

import { useEditor, type ActiveTool } from '../../pen/state/EditorContext';

interface ToolDef {
  tool: ActiveTool;
  label: string;
  shortcut: string;
  icon: JSX.Element;
}

const SELECT_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 2L13 9L8.5 10L10 14L7.5 15L6 11L3 14V2Z" fill="currentColor" />
  </svg>
);

const RECTANGLE_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="2.5" y="3.5" width="11" height="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const ELLIPSE_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <ellipse cx="8" cy="8" rx="5.5" ry="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const LINE_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TEXT_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 3H13V5H12V4H8.75V12H10V13H6V12H7.25V4H4V5H3V3Z" fill="currentColor" />
  </svg>
);

const FRAME_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 1V15M12 1V15M1 4H15M1 12H15" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const TOOLS: ToolDef[] = [
  { tool: 'select', label: 'Select (V)', shortcut: 'V', icon: SELECT_ICON },
  { tool: 'frame', label: 'Frame (F)', shortcut: 'F', icon: FRAME_ICON },
  { tool: 'rectangle', label: 'Rectangle (R)', shortcut: 'R', icon: RECTANGLE_ICON },
  { tool: 'ellipse', label: 'Ellipse (O)', shortcut: 'O', icon: ELLIPSE_ICON },
  { tool: 'line', label: 'Line (L)', shortcut: 'L', icon: LINE_ICON },
  { tool: 'text', label: 'Text (T)', shortcut: 'T', icon: TEXT_ICON },
];

export function Toolbar() {
  const { state, setActiveTool } = useEditor();
  return (
    <div className="viewer__tools" role="toolbar" aria-label="Shape tools">
      {TOOLS.map((t) => {
        const active = state.activeTool === t.tool;
        return (
          <button
            key={t.tool}
            type="button"
            className={`viewer__zoom-btn viewer__tool-btn${active ? ' viewer__zoom-btn--active' : ''}`}
            title={t.label}
            aria-pressed={active}
            onClick={() => setActiveTool(t.tool)}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
}
