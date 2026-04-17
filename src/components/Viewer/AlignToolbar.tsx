/**
 * 整列・分散ツールバー: マルチ選択（2+ ノード）のとき PenViewer のトップバーに表示。
 * 左/中央/右/上/中央/下 揃え + 水平/垂直分散。
 */

import { useAlignActions } from './AlignCommands';

interface BtnProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function Btn({ title, onClick, disabled, children }: BtnProps) {
  return (
    <button
      type="button"
      className="viewer__zoom-btn viewer__tool-btn"
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// --- SVG アイコン（16px viewBox） ---
const ALIGN_LEFT = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="2" y1="1" x2="2" y2="15" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3.5" y="3" width="8" height="3" fill="currentColor" />
    <rect x="3.5" y="10" width="11" height="3" fill="currentColor" />
  </svg>
);
const ALIGN_CENTER_H = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" />
    <rect x="4" y="3" width="8" height="3" fill="currentColor" />
    <rect x="2.5" y="10" width="11" height="3" fill="currentColor" />
  </svg>
);
const ALIGN_RIGHT = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="14" y1="1" x2="14" y2="15" stroke="currentColor" strokeWidth="1.5" />
    <rect x="4.5" y="3" width="8" height="3" fill="currentColor" />
    <rect x="1.5" y="10" width="11" height="3" fill="currentColor" />
  </svg>
);
const ALIGN_TOP = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="1" y1="2" x2="15" y2="2" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3" y="3.5" width="3" height="8" fill="currentColor" />
    <rect x="10" y="3.5" width="3" height="11" fill="currentColor" />
  </svg>
);
const ALIGN_CENTER_V = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3" y="4" width="3" height="8" fill="currentColor" />
    <rect x="10" y="2.5" width="3" height="11" fill="currentColor" />
  </svg>
);
const ALIGN_BOTTOM = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <line x1="1" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="1.5" />
    <rect x="3" y="4.5" width="3" height="8" fill="currentColor" />
    <rect x="10" y="1.5" width="3" height="11" fill="currentColor" />
  </svg>
);
const DISTRIBUTE_H = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="3.5" width="3" height="9" fill="currentColor" />
    <rect x="6.5" y="3.5" width="3" height="9" fill="currentColor" />
    <rect x="12" y="3.5" width="3" height="9" fill="currentColor" />
  </svg>
);
const DISTRIBUTE_V = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="3.5" y="1" width="9" height="3" fill="currentColor" />
    <rect x="3.5" y="6.5" width="9" height="3" fill="currentColor" />
    <rect x="3.5" y="12" width="9" height="3" fill="currentColor" />
  </svg>
);

export function AlignToolbar() {
  const a = useAlignActions();
  if (a.selectedCount < 2) return null;

  const can2 = a.selectedCount >= 2;
  const can3 = a.selectedCount >= 3;

  return (
    <div className="viewer__tools" role="toolbar" aria-label="Align and distribute">
      <Btn title="Align Left" onClick={a.alignLeft} disabled={!can2}>{ALIGN_LEFT}</Btn>
      <Btn title="Align Horizontal Center" onClick={a.alignCenterH} disabled={!can2}>{ALIGN_CENTER_H}</Btn>
      <Btn title="Align Right" onClick={a.alignRight} disabled={!can2}>{ALIGN_RIGHT}</Btn>
      <Btn title="Align Top" onClick={a.alignTop} disabled={!can2}>{ALIGN_TOP}</Btn>
      <Btn title="Align Vertical Center" onClick={a.alignCenterV} disabled={!can2}>{ALIGN_CENTER_V}</Btn>
      <Btn title="Align Bottom" onClick={a.alignBottom} disabled={!can2}>{ALIGN_BOTTOM}</Btn>
      <Btn title="Distribute Horizontally (3+)" onClick={a.distributeH} disabled={!can3}>{DISTRIBUTE_H}</Btn>
      <Btn title="Distribute Vertically (3+)" onClick={a.distributeV} disabled={!can3}>{DISTRIBUTE_V}</Btn>
    </div>
  );
}
