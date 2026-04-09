import type { LoadError, Source } from '../pen/state/useDocument';

export function ErrorView({
  error,
  source,
  onRetry,
  onSample,
}: {
  error: LoadError;
  source?: Source;
  onRetry: () => void;
  onSample: () => void;
}) {
  return (
    <div className="error-view">
      <div className="error-card">
        <div className="error-card__header">
          <span className="error-card__icon">⚠</span>
          <strong>読み込みに失敗しました</strong>
        </div>
        <div className="error-card__summary">{error.summary}</div>
        {error.detail?.issues && error.detail.issues.length > 0 && (
          <ul className="error-card__issues">
            {error.detail.issues.slice(0, 3).map((issue, i) => (
              <li key={i}>
                <code>{issue.path}</code>: {issue.message}
              </li>
            ))}
          </ul>
        )}
        {source?.kind === 'url' && (
          <p className="error-card__hint">
            CORS で拒否された可能性もあります。別のファイルを選ぶかサンプルで動作確認してください。
          </p>
        )}
        <div className="error-card__actions">
          <button type="button" className="button button--primary" onClick={onRetry}>
            別のファイルを選ぶ
          </button>
          <button type="button" className="button" onClick={onSample}>
            サンプルを見る
          </button>
        </div>
      </div>
    </div>
  );
}
