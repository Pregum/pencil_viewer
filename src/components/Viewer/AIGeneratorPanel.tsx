/**
 * AI Generator パネル: プロンプトを入力して Cloudflare Workers AI に
 * .pen Frame JSON を生成させ、結果を新規ページとしてドキュメントに挿入する。
 *
 * 無料枠 (Workers AI 10,000 neurons/日) 超過時は普通に HTTP エラーが返るだけ。
 */

import { useCallback, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import { requestAIGenerate, isAIGenerateEnabled, type GenerateKind } from '../../utils/aiGenerate';
import type { PenNode } from '../../pen/types';

interface Props {
  onClose: () => void;
  onZoomToNode?: (rect: { x: number; y: number; width: number; height: number }) => void;
}

const EXAMPLES: { prompt: string; kind: GenerateKind }[] = [
  { prompt: 'モバイルのログイン画面（メール・パスワード・ソーシャルログイン）', kind: 'mobile' },
  { prompt: 'iOS の設定画面（セクション区切り・トグルスイッチ・アイコン付き項目）', kind: 'mobile' },
  { prompt: '商品一覧画面（グリッドレイアウト、画像プレースホルダ、価格タグ）', kind: 'mobile' },
  { prompt: '管理画面のダッシュボード（KPI カード 4 枚、サイドナビ、ヘッダー）', kind: 'desktop' },
  { prompt: 'ランディングページのヒーロー（タイトル・説明文・CTA ボタン・ヒーロー画像エリア）', kind: 'desktop' },
  { prompt: 'タスクアプリの Today 画面（ToDo リスト、完了チェックボックス、追加ボタン）', kind: 'mobile' },
];

export function AIGeneratorPanel({ onClose, onZoomToNode }: Props) {
  const { state, addNode } = useEditor();
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<GenerateKind>('mobile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ prompt: string; ok: boolean; info?: string }>>([]);

  const enabled = isAIGenerateEnabled();

  const computeNextOffsetX = useCallback(() => {
    const topLevelFrames = state.doc.children.filter((n) => n.type === 'frame');
    let maxRight = 0;
    for (const f of topLevelFrames) {
      const w = typeof (f as { width?: unknown }).width === 'number' ? (f as { width: number }).width : 0;
      maxRight = Math.max(maxRight, (f.x ?? 0) + w);
    }
    return topLevelFrames.length === 0 ? 0 : maxRight + 80;
  }, [state.doc.children]);

  const generate = useCallback(async (p: string, k: GenerateKind) => {
    if (!p.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const offsetX = computeNextOffsetX();
      const res = await requestAIGenerate(p.trim(), k, 'ja', offsetX);
      const node = res.node as PenNode;
      addNode(node);
      setHistory((h) => [{ prompt: p.trim(), ok: true, info: res.meta.model }, ...h].slice(0, 10));
      // ズームで新規ノードに寄せる
      const nw = typeof (node as { width?: unknown }).width === 'number' ? (node as { width: number }).width : 0;
      const nh = typeof (node as { height?: unknown }).height === 'number' ? (node as { height: number }).height : 0;
      if (nw > 0 && nh > 0) {
        onZoomToNode?.({ x: (node.x ?? 0), y: (node.y ?? 0), width: nw, height: nh });
      }
      setPrompt('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setHistory((h) => [{ prompt: p.trim(), ok: false, info: msg }, ...h].slice(0, 10));
    } finally {
      setLoading(false);
    }
  }, [addNode, computeNextOffsetX, onZoomToNode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generate(prompt, kind);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog ai-gen">
        <div className="dialog__header">
          <span className="dialog__title">🪄 AI Design Generator</span>
          <button type="button" className="dialog__close" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog__body">
          {!enabled && (
            <div className="ai-gen__notice">
              <strong>AI が未設定です。</strong><br />
              <code>VITE_AI_REVIEW_URL</code> 環境変数に Cloudflare Workers のエンドポイント URL を設定してください。
            </div>
          )}

          <form onSubmit={handleSubmit} className="ai-gen__form">
            <textarea
              className="ai-gen__prompt"
              placeholder="例: モバイルのログイン画面、メール・パスワード・ソーシャルログイン"
              rows={3}
              value={prompt}
              maxLength={500}
              disabled={!enabled || loading}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  generate(prompt, kind);
                }
              }}
            />
            <div className="ai-gen__controls">
              <label className="ai-gen__kind">
                Kind:
                <select
                  value={kind}
                  disabled={!enabled || loading}
                  onChange={(e) => setKind(e.target.value as GenerateKind)}
                >
                  <option value="mobile">Mobile (375×812)</option>
                  <option value="tablet">Tablet (768×1024)</option>
                  <option value="desktop">Desktop (1440×900)</option>
                </select>
              </label>
              <span className="ai-gen__count">{prompt.length}/500</span>
              <button
                type="submit"
                className="ai-gen__submit"
                disabled={!enabled || loading || !prompt.trim()}
              >
                {loading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </form>

          {error && (
            <div className="ai-gen__error" role="alert">
              ⚠️ {error}
              <div className="ai-gen__error-hint">
                Cloudflare 無料枠 (Workers AI 10,000 neurons/日) に到達している可能性があります。時間を置いて再試行してください。
              </div>
            </div>
          )}

          <div className="ai-gen__section">
            <div className="ai-gen__section-title">Try an example</div>
            <div className="ai-gen__examples">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.prompt}
                  type="button"
                  className="ai-gen__example"
                  disabled={!enabled || loading}
                  onClick={() => {
                    setPrompt(ex.prompt);
                    setKind(ex.kind);
                    generate(ex.prompt, ex.kind);
                  }}
                  title={`Generate: ${ex.prompt}`}
                >
                  <span className="ai-gen__example-kind">{ex.kind}</span>
                  {ex.prompt}
                </button>
              ))}
            </div>
          </div>

          {history.length > 0 && (
            <div className="ai-gen__section">
              <div className="ai-gen__section-title">History</div>
              <ul className="ai-gen__history">
                {history.map((h, i) => (
                  <li key={i} className={h.ok ? 'ai-gen__history-ok' : 'ai-gen__history-err'}>
                    {h.ok ? '✅' : '❌'} {h.prompt}
                    {h.info && <span className="ai-gen__history-info"> — {h.info}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
