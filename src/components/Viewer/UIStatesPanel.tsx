/**
 * Five UI States 分析結果パネル。
 * フレーム名から各画面の UI State カバー率を表示。
 */

import { useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { analyzeUIStates, UI_STATE_LABELS, type ScreenGroup, type UIState } from '../../analysis/uiStates';

interface Props {
  onClose: () => void;
  locale: 'en' | 'ja' | 'zh';
}

const titles = {
  en: 'Five UI States Audit',
  ja: 'Five UI States 監査',
  zh: 'Five UI States 审计',
};

const labels = {
  en: { detected: 'Detected', missing: 'Missing', coverage: 'Coverage', allCovered: 'All states covered!', tip: 'Tip: Name frames with suffixes like "- Empty", "- Loading", "- Error" for auto-detection.' },
  ja: { detected: '検出済み', missing: '不足', coverage: 'カバー率', allCovered: '全状態カバー済み！', tip: 'ヒント: フレーム名に「- Empty」「- Loading」「- Error」等のサフィックスを付けると自動検出されます。' },
  zh: { detected: '已检测', missing: '缺失', coverage: '覆盖率', allCovered: '所有状态已覆盖！', tip: '提示：在画框名称中添加"- Empty"、"- Loading"、"- Error"等后缀可自动检测。' },
};

function StateBadge({ state, detected }: { state: UIState; detected: boolean }) {
  const info = UI_STATE_LABELS[state];
  return (
    <span
      className={`ui-state-badge ${detected ? 'ui-state-badge--detected' : 'ui-state-badge--missing'}`}
      style={{ borderColor: detected ? info.color : undefined }}
      title={`${info.en}: ${detected ? 'Detected' : 'Missing'}`}
    >
      {info.icon} {info.en}
    </span>
  );
}

function CoverageBar({ coverage }: { coverage: number }) {
  const color = coverage === 100 ? '#22c55e' : coverage >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="ui-states__bar">
      <div className="ui-states__bar-fill" style={{ width: `${coverage}%`, background: color }} />
      <span className="ui-states__bar-label">{coverage}%</span>
    </div>
  );
}

function ScreenRow({ group, locale }: { group: ScreenGroup; locale: 'en' | 'ja' | 'zh' }) {
  const [expanded, setExpanded] = useState(false);
  const l = labels[locale];
  const allStates: UIState[] = ['ideal', 'empty', 'loading', 'error', 'partial'];

  return (
    <div className="ui-states__screen">
      <div className="ui-states__screen-header" onClick={() => setExpanded((v) => !v)}>
        <span className="ui-states__screen-toggle">{expanded ? '▾' : '▸'}</span>
        <span className="ui-states__screen-name">{group.screenName}</span>
        <CoverageBar coverage={group.coverage} />
      </div>
      {expanded && (
        <div className="ui-states__screen-detail">
          <div className="ui-states__badges">
            {allStates.map((s) => (
              <StateBadge key={s} state={s} detected={group.detectedStates.has(s)} />
            ))}
          </div>
          {group.missingStates.length > 0 && (
            <p className="ui-states__missing-hint">
              {l.missing}: {group.missingStates.map((s) => UI_STATE_LABELS[s][locale]).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function UIStatesPanel({ onClose, locale }: Props) {
  const { state } = useEditor();
  const results = useMemo(() => analyzeUIStates(state.doc), [state.doc]);

  const totalScreens = results.length;
  const fullCoverage = results.filter((r) => r.coverage === 100).length;
  const avgCoverage = totalScreens > 0
    ? Math.round(results.reduce((sum, r) => sum + r.coverage, 0) / totalScreens)
    : 0;

  const l = labels[locale];

  return (
    <div className="dialog-backdrop" onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) onClose();
    }}>
      <div className="dialog" style={{ width: 600, maxHeight: '80vh' }}>
        <div className="dialog__header">
          <span className="dialog__title">{titles[locale]}</span>
          <button type="button" className="dialog__close" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Summary */}
          <div className="ui-states__summary">
            <div className="ui-states__stat">
              <span className="ui-states__stat-value">{totalScreens}</span>
              <span className="ui-states__stat-label">Screens</span>
            </div>
            <div className="ui-states__stat">
              <span className="ui-states__stat-value">{fullCoverage}</span>
              <span className="ui-states__stat-label">Full {l.coverage}</span>
            </div>
            <div className="ui-states__stat">
              <span className="ui-states__stat-value">{avgCoverage}%</span>
              <span className="ui-states__stat-label">Avg {l.coverage}</span>
            </div>
          </div>

          {/* Screen list */}
          <div className="ui-states__list">
            {results.map((group) => (
              <ScreenRow key={group.screenName} group={group} locale={locale} />
            ))}
          </div>

          <p className="ui-states__tip">{l.tip}</p>
        </div>
      </div>
    </div>
  );
}
