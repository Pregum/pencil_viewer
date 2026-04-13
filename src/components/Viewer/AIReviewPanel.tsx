/**
 * AI デザインレビュー結果パネル。
 * Cloudflare Workers AI からのレビュー結果を表示。
 * five-states モードでは、不足している state を AI 生成して doc に追加できる「修復」機能も提供。
 */

import { useCallback, useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import {
  requestAIReview,
  requestStateRepair,
  type ReviewMode,
  type ReviewResult,
  type RepairState,
} from '../../utils/aiReview';
import { analyzeUIStates, UI_STATE_LABELS, type ScreenGroup, type UIState } from '../../analysis/uiStates';
import type { PenNode } from '../../pen/types';

interface Props {
  onClose: () => void;
  locale: 'en' | 'ja' | 'zh';
}

const MODE_OPTIONS: { value: ReviewMode; label: { en: string; ja: string } }[] = [
  { value: 'full', label: { en: 'Full Review', ja: '総合レビュー' } },
  { value: 'five-states', label: { en: 'Five UI States', ja: 'Five UI States' } },
  { value: 'accessibility', label: { en: 'Accessibility', ja: 'アクセシビリティ' } },
  { value: 'quick', label: { en: 'Quick (3-5 points)', ja: 'クイック (3-5 点)' } },
];

/** screenName + state をキーにした repair の進行状況管理 */
type RepairKey = string;
type RepairStatus = 'idle' | 'pending' | 'done' | 'error';

export function AIReviewPanel({ onClose, locale }: Props) {
  const { state, replaceDocChildren, pushUndoCheckpoint, selectNode } = useEditor();
  const [mode, setMode] = useState<ReviewMode>('full');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repairs, setRepairs] = useState<Record<RepairKey, RepairStatus>>({});
  const [repairErrors, setRepairErrors] = useState<Record<RepairKey, string>>({});

  // 修復候補は doc を毎回スキャンして最新状態を取る
  const screens: ScreenGroup[] = useMemo(() => analyzeUIStates(state.doc), [state.doc]);

  const runReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await requestAIReview(state.doc, mode, locale === 'zh' ? 'zh' : locale === 'ja' ? 'ja' : 'en');
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [state.doc, mode, locale]);

  /**
   * 不足している state を AI 生成して doc に追加。
   * - スクリーンの「ideal」状態を持つフレームを source として使う(なければ最初のフレーム)
   * - AI から返ってきたノードを doc.children の末尾に append
   * - Undo 可能
   */
  const handleRepair = useCallback(
    async (group: ScreenGroup, missing: RepairState) => {
      const key = `${group.screenName}::${missing}`;
      // source: ideal 状態のフレームを優先
      const sourceInfo = group.frames.find((f) => f.inferredState === 'ideal') ?? group.frames[0];
      if (!sourceInfo) {
        setRepairErrors((p) => ({ ...p, [key]: 'No source frame found' }));
        return;
      }
      // doc から実際のノードを引っ張ってくる(rawDoc を使う方が安全 — レイアウト計算前のオリジナル)
      const findById = (nodes: PenNode[], id: string): PenNode | null => {
        for (const n of nodes) {
          if (n.id === id) return n;
          const ch = (n as { children?: PenNode[] }).children;
          if (Array.isArray(ch)) {
            const f = findById(ch, id);
            if (f) return f;
          }
        }
        return null;
      };
      const sourceNode = findById(state.rawDoc.children, sourceInfo.id) ?? findById(state.doc.children, sourceInfo.id);
      if (!sourceNode) {
        setRepairErrors((p) => ({ ...p, [key]: 'Source node not found in doc' }));
        return;
      }

      setRepairs((p) => ({ ...p, [key]: 'pending' }));
      setRepairErrors((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });

      try {
        const apiLocale = locale === 'zh' ? 'zh' : locale === 'ja' ? 'ja' : 'en';
        const r = await requestStateRepair(sourceNode, missing, apiLocale);
        // 既存 doc の children 末尾に append (Undo 可能)
        pushUndoCheckpoint();
        replaceDocChildren([...state.doc.children, r.node]);
        // 追加したノードを選択して、カメラを自動的にそこへ移動
        // (PenViewer の baseVb は初期マウント時の doc から計算されるため、
        //  Fit ボタンでは新フレームを含まない。ZoomToSelected 経由で確実に表示する)
        selectNode(r.node.id);
        // selectNode 後の state 反映を待ってからイベントを dispatch
        setTimeout(() => {
          window.dispatchEvent(new Event('pencil-zoom-to-selected'));
        }, 50);
        setRepairs((p) => ({ ...p, [key]: 'done' }));
      } catch (e) {
        setRepairs((p) => ({ ...p, [key]: 'error' }));
        setRepairErrors((p) => ({ ...p, [key]: String(e) }));
      }
    },
    [state.doc, state.rawDoc, locale, replaceDocChildren, pushUndoCheckpoint, selectNode],
  );

  const handleCopy = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result.review).catch(() => {});
    }
  }, [result]);

  const l = locale === 'ja' ? 'ja' : 'en';

  return (
    <div className="dialog-backdrop" onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) onClose();
    }}>
      <div className="dialog" style={{ width: 640, maxHeight: '85vh' }}>
        <div className="dialog__header">
          <span className="dialog__title">
            {l === 'ja' ? '🤖 AI デザインレビュー' : '🤖 AI Design Review'}
          </span>
          <button type="button" className="dialog__close" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="prop-panel__select"
              value={mode}
              onChange={(e) => setMode(e.target.value as ReviewMode)}
              style={{ flex: 1 }}
            >
              {MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label[l]}
                </option>
              ))}
            </select>
            <button
              className="button button--primary"
              onClick={() => void runReview()}
              disabled={loading}
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading
                ? (l === 'ja' ? '分析中…' : 'Analyzing…')
                : (l === 'ja' ? 'レビュー実行' : 'Run Review')}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="ai-review__error">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="ai-review__result">
              <div className="ai-review__meta">
                <span>{result.meta.screenCount} {l === 'ja' ? '画面を分析' : 'screens analyzed'}</span>
                <span>{result.meta.model}</span>
                <button className="button button--ghost" onClick={handleCopy} style={{ marginLeft: 'auto', fontSize: 11 }}>
                  {l === 'ja' ? 'コピー' : 'Copy'}
                </button>
              </div>
              <div className="ai-review__body">
                {result.review}
              </div>
            </div>
          )}

          {/* Repair candidates — five-states モードの場合に表示 */}
          {result && mode === 'five-states' && screens.some((g) => g.missingStates.some((s) => s !== 'ideal')) && (
            <div className="ai-review__repair">
              <h4 className="ai-review__repair-title">
                {l === 'ja' ? '🔧 修復候補(AI で生成)' : '🔧 Repair Candidates (AI-generated)'}
              </h4>
              <p className="ai-review__repair-hint">
                {l === 'ja'
                  ? '不足している state を AI で生成して右隣に追加します(Undo 可能)。'
                  : 'AI generates missing states and appends them next to the original (undoable).'}
              </p>
              {screens.map((group) => {
                const missingRepairable = group.missingStates.filter((s): s is RepairState => s !== 'ideal');
                if (missingRepairable.length === 0) return null;
                return (
                  <div key={group.screenName} className="ai-review__repair-group">
                    <div className="ai-review__repair-screen">
                      <strong>{group.screenName}</strong>
                      <span className="ai-review__repair-coverage">{group.coverage}%</span>
                    </div>
                    <div className="ai-review__repair-buttons">
                      {missingRepairable.map((missing) => {
                        const key = `${group.screenName}::${missing}`;
                        const status = repairs[key] ?? 'idle';
                        const err = repairErrors[key];
                        const label = UI_STATE_LABELS[missing as UIState];
                        return (
                          <button
                            key={missing}
                            type="button"
                            className={`button button--sm ai-review__repair-btn ai-review__repair-btn--${status}`}
                            onClick={() => void handleRepair(group, missing)}
                            disabled={status === 'pending' || status === 'done'}
                            title={err ?? `${label[l]} state を生成`}
                            style={{ borderColor: status === 'done' ? '#22c55e' : status === 'error' ? '#ef4444' : undefined }}
                          >
                            {status === 'pending' ? '…' : status === 'done' ? '✓' : status === 'error' ? '✗' : '+'}{' '}
                            {label.icon} {label[l]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!result && !loading && !error && (
            <div className="ai-review__empty">
              <p>{l === 'ja'
                ? 'レビューモードを選んで「レビュー実行」を押してください。\nAI がデザインを分析し、改善点を提案します。'
                : 'Choose a review mode and click "Run Review".\nAI will analyze your design and suggest improvements.'
              }</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 8 }}>
                Powered by Cloudflare Workers AI (Llama 3.1)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
