import type { LoadError, Source } from '../pen/state/useDocument';
import { useI18n } from '../i18n/I18nContext';

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
  const { t } = useI18n();
  return (
    <div className="error-view">
      <div className="error-card">
        <div className="error-card__header">
          <span className="error-card__icon">⚠</span>
          <strong>{t('error.title')}</strong>
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
          <p className="error-card__hint">{t('error.cors.hint')}</p>
        )}
        <div className="error-card__actions">
          <button type="button" className="button button--primary" onClick={onRetry}>
            {t('error.retry')}
          </button>
          <button type="button" className="button" onClick={onSample}>
            {t('error.sample')}
          </button>
        </div>
      </div>
    </div>
  );
}
