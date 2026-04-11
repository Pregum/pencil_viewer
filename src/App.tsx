import { useEffect } from 'react';
import { useDocument } from './pen/state/useDocument';
import { PenViewer } from './components/Viewer/PenViewer';
import { DropZone } from './components/Loader/DropZone';
import { UrlInput } from './components/Loader/UrlInput';
import { SampleList } from './components/Loader/SampleList';
import { ErrorView } from './components/ErrorView';

export function App() {
  const { state, loadFile, loadUrl, loadSample, reset } = useDocument();

  // ?src= クエリから自動読み込み
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    if (src) void loadUrl(src);
    // 意図的に初回マウントのみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <button type="button" className="button button--ghost" onClick={reset}>
              戻る
            </button>
          </div>
        )}
        <div className="header__links">
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
          <div className="idle">
            <DropZone onFile={(f) => void loadFile(f)} />
            <div className="idle__divider">
              <span>or</span>
            </div>
            <UrlInput onSubmit={(url) => void loadUrl(url)} />
            <SampleList onPick={(name) => void loadSample(name)} />
          </div>
        )}

        {state.status === 'loading' && (
          <p className="muted">
            読み込み中…{' '}
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
