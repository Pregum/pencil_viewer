import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useDocument } from './pen/state/useDocument';
import { PenViewer } from './components/Viewer/PenViewer';
import { Landing } from './components/Landing';
import { ErrorView } from './components/ErrorView';
// Docs と Vision は初期表示では開かれないうえ、docsContent.ts だけで
// 1500 行ある。初期バンドルから外して開いたときに取りに行く。
const Docs = lazy(() => import('./components/Docs').then((m) => ({ default: m.Docs })));
const Vision = lazy(() => import('./components/Vision').then((m) => ({ default: m.Vision })));
import { useI18n } from './i18n/I18nContext';
import type { SupportedLocale } from './i18n/detectLocale';
import { isShareEnabled, uploadPen, fetchSharedPen } from './utils/shareApi';
import { useGitHub } from './github/GitHubContext';
import { GitHubPanel } from './github/GitHubPanel';
import { HistoryPanel } from './github/HistoryPanel';
import { getPenFile, type GitHubFileRef } from './github/githubApi';

const LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'zh', label: 'ZH' },
];

export function App() {
  const { state, loadFile, loadUrl, loadSample, loadEmpty, reset } = useDocument();
  const { locale, setLocale, t } = useI18n();
  const {
    panelOpen,
    openPanel,
    closePanel,
    setCurrentFile,
    connected,
    currentFile,
    dirty,
    setForceDirty,
    registerReloadHandler,
    token,
    historyOpen,
    openHistory,
    closeHistory,
  } = useGitHub();

  const [showDocs, setShowDocs] = useState(false);
  const [showVision, setShowVision] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  // ロードのたびに増やすキー。これを PenViewer の key にして EditorProvider を
  // 確実に remount させる（別ファイルを開く/最新を再取得しても editor が stale にならない）。
  const [loadNonce, setLoadNonce] = useState(0);

  // GitHub から .pen を開く: テキストを File 化して loadFile に流し、参照を記録する
  const handleOpenFromGitHub = useCallback(
    (text: string, ref: GitHubFileRef, fileName: string) => {
      const file = new File([text], fileName, { type: 'application/json' });
      void loadFile(file);
      setCurrentFile(ref);
      setForceDirty(false);
      setLoadNonce((n) => n + 1);
    },
    [loadFile, setCurrentFile, setForceDirty],
  );

  // 履歴からの復元: 旧版をエディタに読み込む。repo tip はまだ別なので forceDirty を立て、
  // Commit して初めて「その版に戻す」コミットが作られる。
  const handleRestore = useCallback(
    (text: string, ref: GitHubFileRef, fileName: string) => {
      const file = new File([text], fileName, { type: 'application/json' });
      void loadFile(file);
      setCurrentFile(ref);
      setForceDirty(true);
      setLoadNonce((n) => n + 1);
    },
    [loadFile, setCurrentFile, setForceDirty],
  );

  // 競合時にエディタへ「最新を取得」するハンドラを GitHubContext に登録
  useEffect(() => {
    registerReloadHandler(async () => {
      if (!token || !currentFile) return;
      const f = await getPenFile(token, currentFile.owner, currentFile.repo, currentFile.path, currentFile.branch);
      const name = currentFile.path.split('/').pop() ?? currentFile.path;
      handleOpenFromGitHub(f.text, { ...currentFile, sha: f.sha }, name);
    });
    return () => registerReloadHandler(null);
  }, [registerReloadHandler, token, currentFile, handleOpenFromGitHub]);

  // ?src= または ?id= クエリから自動読み込み
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const id = params.get('id');
    const room = params.get('room');
    if (src) {
      void loadUrl(src);
    } else if (room) {
      // 招待リンク経由: 空ドキュメントで起動し、ビューア側でルームに入室する
      loadEmpty();
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
    if (s.kind === 'collab') return '🔴 Live collaboration';
    return `samples/${s.name}`;
  })();

  return (
    <div className="app">
      <header className="header">
        <span className="brand">✏️ Pencil Viewer</span>
        {state.status === 'ready' && (
          <div className="header__file">
            {currentFile ? (
              <button
                type="button"
                className={`header__gh-file${dirty ? ' header__gh-file--dirty' : ''}`}
                onClick={openHistory}
                title={`${currentFile.owner}/${currentFile.repo} @ ${currentFile.branch}${dirty ? '（未コミットの変更あり）' : ''} — クリックで履歴`}
              >
                <span className="header__gh-file-dot" aria-hidden>
                  {dirty ? '●' : '✓'}
                </span>
                <span className="header__gh-file-path">{currentFile.path}</span>
                <span className="header__gh-file-branch">@{currentFile.branch}</span>
                <span className="header__gh-file-hist">🕑</span>
              </button>
            ) : (
              <span>{sourceLabel}</span>
            )}
            {isShareEnabled() && (
              <button
                type="button"
                className="button button--primary button--sm header__share-btn"
                onClick={() => void handleShare()}
                disabled={shareStatus === 'uploading'}
                title={t('header.share') ?? 'Share'}
                aria-label={t('header.share') ?? 'Share'}
              >
                {shareStatus === 'uploading' ? (
                  <span className="button__icon">…</span>
                ) : shareStatus === 'done' ? (
                  <>
                    <span className="button__icon">✓</span>
                    <span className="button__label">Copied!</span>
                  </>
                ) : (
                  <>
                    <span className="button__icon">🔗</span>
                    <span className="button__label">Share</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              className="button button--ghost header__back-btn"
              onClick={() => { reset(); setCurrentFile(null); }}
              title={t('header.back')}
              aria-label={t('header.back')}
            >
              <span className="button__icon">←</span>
              <span className="button__label">{t('header.back')}</span>
            </button>
          </div>
        )}
        <div className="header__links">
          <button
            type="button"
            className={`button button--ghost button--sm header__docs-btn${connected ? ' header__gh-connected' : ''}`}
            onClick={openPanel}
            title="GitHub に .pen を読み書き"
          >
            {connected ? '🟢 GitHub' : 'GitHub'}
          </button>
          <button
            type="button"
            className="button button--ghost button--sm header__docs-btn"
            onClick={() => { setShowVision(true); setShowDocs(false); }}
          >
            Vision
          </button>
          <button
            type="button"
            className="button button--ghost button--sm header__docs-btn"
            onClick={() => { setShowDocs(true); setShowVision(false); }}
          >
            Docs
          </button>
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
          {/* 共有 URL 経由の不具合報告で、どのビルドの話か切り分けるため */}
          <span className="header__version" title="Pencil Viewer version">
            v{__APP_VERSION__}
          </span>
        </div>
      </header>

      <main className="main">
        {showVision && (
          <Suspense fallback={<div className="lazy-fallback" />}>
            <Vision onBack={() => setShowVision(false)} locale={locale} />
          </Suspense>
        )}

        {showDocs && !showVision && (
          <Suspense fallback={<div className="lazy-fallback" />}>
            <Docs onBack={() => setShowDocs(false)} locale={locale} />
          </Suspense>
        )}

        {!showDocs && !showVision && state.status === 'idle' && (
          <Landing
            onFile={(f) => void loadFile(f)}
            onUrl={(url) => void loadUrl(url)}
            onSample={(name) => void loadSample(name)}
            onGitHub={openPanel}
            githubConnected={connected}
          />
        )}

        {!showDocs && !showVision && state.status === 'loading' && (
          <p className="muted">
            {t('loading')}{' '}
            {state.source.kind === 'file'
              ? state.source.name
              : state.source.kind === 'url'
              ? state.source.url
              : state.source.kind === 'sample'
              ? `samples/${state.source.name}`
              : ''}
          </p>
        )}

        {!showDocs && !showVision && state.status === 'error' && (
          <ErrorView
            error={state.error}
            source={state.source}
            onRetry={reset}
            onSample={() => void loadSample('shapes.pen')}
          />
        )}

        {!showDocs && !showVision && state.status === 'ready' && (
          <PenViewer key={loadNonce} doc={state.doc} rawDoc={state.rawDoc} />
        )}
      </main>

      <GitHubPanel open={panelOpen} onClose={closePanel} onOpenFile={handleOpenFromGitHub} />
      <HistoryPanel open={historyOpen} onClose={closeHistory} onRestore={handleRestore} />
    </div>
  );
}
