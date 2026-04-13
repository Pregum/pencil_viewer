/**
 * AI デザインレビュー結果パネル。
 * Cloudflare Workers AI からのレビュー結果を表示。
 */

import { useCallback, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { requestAIReview, type ReviewMode, type ReviewResult } from '../../utils/aiReview';

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

export function AIReviewPanel({ onClose, locale }: Props) {
  const { state } = useEditor();
  const [mode, setMode] = useState<ReviewMode>('full');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
