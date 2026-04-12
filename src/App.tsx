import { useCallback, useEffect, useState } from 'react';
import { useDocument } from './pen/state/useDocument';
import { PenViewer } from './components/Viewer/PenViewer';
import { Landing } from './components/Landing';
import { ErrorView } from './components/ErrorView';
import { useI18n } from './i18n/I18nContext';
import type { SupportedLocale } from './i18n/detectLocale';
import { isShareEnabled, uploadPen, fetchSharedPen } from './utils/shareApi';

const LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'zh', label: 'ZH' },
];

export function App() {
  const { state, loadFile, loadUrl, loadSample, reset } = useDocument();
  const { locale, setLocale, t } = useI18n();

  const [shareStatus, setShareStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  // ?src= または ?id= クエリから自動読み込み
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const id = params.get('id');
    if (src) {
      void loadUrl(src);
    } else if (id && isShareEnabled()) {
      void (async () => {
        try {
          const text = await fetchSharedPen(id);
          // loadText 相当の処理を loadUrl 経由では難しいので、loadFile の代替として
          // Blob → File に変換して loadFile を呼ぶ
          const file = new File([text], `shared-${id}.pen`, { type: 'application/json' });
          void loadFile(file);
        } catch (e) {
          console.error('Failed to load shared file:', e);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = useCallback(async () => {
    if (state.status !== 'ready' || !state.rawDoc) return;
    setShareStatus('uploading');
    try {
      const content = JSON.stringify(state.rawDoc, null, 2);
      const result = await uploadPen(content);
      setShareStatus('done');
      await navigator.clipboard.writeText(result.url);
      setTimeout(() => setShareStatus('idle'), 3000);
    } catch (e) {
      console.error('Share failed:', e);
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 3000);
    }
  }, [state]);

  const sourceLabel = (() => {
    if (state.status !== 'ready') return '';
    const s = state.source;
    if (s.kind === 'file') return s.name;
    if (s.kind === 'url') return s.url;
    return `samples/${s.name}`;
  })();

  return (
    <div className="app">
      <header className="header">
        <span className="brand">✏️ Pencil Viewer</span>
        {state.status === 'ready' && (
          <div className="header__file">
            <span>{sourceLabel}</span>
            {isShareEnabled() && (
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={() => void handleShare()}
                disabled={shareStatus === 'uploading'}
              >
                {shareStatus === 'uploading' ? '...' : shareStatus === 'done' ? '✓ Copied!' : '🔗 Share'}
              </button>
            )}
            <button type="button" className="button button--ghost" onClick={reset}>
              {t('header.back')}
            </button>
          </div>
        )}
        <div className="header__links">
          {/* 言語切替 */}
          <div className="lang-switcher" role="radiogroup" aria-label="Language">
            {LOCALES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                className={`lang-switcher__btn${locale === code ? ' lang-switcher__btn--active' : ''}`}
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
              >
                {label}
              </button>
            ))}
          </div>
          <a
            href="https://github.com/Pregum/pencil_viewer"
            target="_blank"
            rel="noopener noreferrer"
            className="header__gh-link"
            title="GitHub"
            aria-label="View on GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" />
            </svg>
          </a>
          <span className="header__license">MIT</span>
        </div>
      </header>

      <main className="main">
        {state.status === 'idle' && (
          <Landing
            onFile={(f) => void loadFile(f)}
            onUrl={(url) => void loadUrl(url)}
            onSample={(name) => void loadSample(name)}
          />
        )}

        {state.status === 'loading' && (
          <p className="muted">
            {t('loading')}{' '}
            {state.source.kind === 'file'
              ? state.source.name
              : state.source.kind === 'url'
              ? state.source.url
              : `samples/${state.source.name}`}
          </p>
        )}

        {state.status === 'error' && (
          <ErrorView
            error={state.error}
            source={state.source}
            onRetry={reset}
            onSample={() => void loadSample('shapes.pen')}
          />
        )}

        {state.status === 'ready' && <PenViewer doc={state.doc} rawDoc={state.rawDoc} />}
      </main>
    </div>
  );
}
