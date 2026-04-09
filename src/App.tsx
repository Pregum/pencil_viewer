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

        {state.status === 'ready' && <PenViewer doc={state.doc} />}
      </main>
    </div>
  );
}
