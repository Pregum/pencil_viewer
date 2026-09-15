import { useI18n } from '../i18n/I18nContext';
import { DropZone } from './Loader/DropZone';
import { UrlInput } from './Loader/UrlInput';
import { SampleList } from './Loader/SampleList';

/**
 * ランディング。
 *
 * 主張は 1 つだけ:「.pen はあなたのリポジトリに置く」。
 * 製図用紙の方眼を地にして、左に repo の中のファイル、右にそれが描く画面を
 * 並べた 1 枚を hero に据える。それ以外の節は意図的に静かにしてある。
 */
export function Landing({
  onFile,
  onUrl,
  onSample,
  onGitHub,
  githubConnected,
}: {
  onFile: (f: File) => void;
  onUrl: (url: string) => void;
  onSample: (name: string) => void;
  onGitHub: () => void;
  githubConnected: boolean;
}) {
  const { t } = useI18n();

  const capabilities = ['repo', 'edit', 'render', 'history', 'phone', 'extras'] as const;

  return (
    <div className="lp">
      <section className="lp__hero">
        <h1 className="lp__title">{t('lp.title')}</h1>
        <p className="lp__lede">
          <RichText html={t('lp.lede')} />
        </p>

        <div className="lp__actions">
          <button type="button" className="lp__action lp__action--solid" onClick={onGitHub}>
            {githubConnected ? t('lp.cta.repo') : t('lp.cta.github')}
          </button>
          <a href="#try" className="lp__action lp__action--quiet">
            {t('lp.cta.open')}
          </a>
        </div>

        <RepoToScreen
          path="design/checkout.pen"
          branch="main"
          commits={[
            { sha: 'a1c9f2e', message: t('lp.log.1'), added: true },
            { sha: '7e02b41', message: t('lp.log.2') },
            { sha: '3fd6c08', message: t('lp.log.3') },
          ]}
          caption={t('lp.proof.caption')}
        />
      </section>

      <section className="lp__section">
        <h2 className="lp__h2">{t('lp.what.title')}</h2>
        <dl className="lp__list">
          {capabilities.map((key) => (
            <div className="lp__list-row" key={key}>
              <dt>{t(`lp.what.${key}.title`)}</dt>
              <dd>{t(`lp.what.${key}.desc`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="lp__section lp__cost">
        <h2 className="lp__h2">{t('lp.cost.title')}</h2>
        <p className="lp__prose">{t('lp.cost.body')}</p>
        <ul className="lp__facts">
          <li>{t('lp.cost.fact1')}</li>
          <li>{t('lp.cost.fact2')}</li>
          <li>{t('lp.cost.fact3')}</li>
        </ul>
      </section>

      <section className="lp__section lp__try" id="try">
        <h2 className="lp__h2">{t('lp.try.title')}</h2>
        <p className="lp__prose">{t('lp.try.note')}</p>

        <div className="idle">
          <button type="button" className="lp__repo-entry" onClick={onGitHub}>
            <span className="lp__repo-entry-mark" aria-hidden="true">
              <GitHubMark />
            </span>
            <span className="lp__repo-entry-text">
              <strong>{githubConnected ? t('lp.entry.repo') : t('lp.entry.connect')}</strong>
              <small>{t('lp.entry.desc')}</small>
            </span>
          </button>

          <div className="idle__divider">
            <span>{t('lp.or')}</span>
          </div>

          <DropZone onFile={onFile} />
          <UrlInput onSubmit={onUrl} />
          <SampleList onPick={onSample} />
        </div>
      </section>

      <footer className="lp__footer">
        <a href="https://github.com/Pregum/pencil_viewer" target="_blank" rel="noopener noreferrer">
          {t('lp.footer.source')}
        </a>
        <a href="https://www.pencil.dev/" target="_blank" rel="noopener noreferrer">
          Pencil.dev
        </a>
        <span>{t('lp.footer.license')}</span>
      </footer>
    </div>
  );
}

interface Commit {
  sha: string;
  message: string;
  added?: boolean;
}

/**
 * hero の 1 枚。左が repo の中のファイル、右がそれが描く画面。
 * テキストは SVG ではなく HTML で組んである（選択・翻訳・読み上げが効くように）。
 */
function RepoToScreen({
  path,
  branch,
  commits,
  caption,
}: {
  path: string;
  branch: string;
  commits: Commit[];
  caption: string;
}) {
  return (
    <figure className="lp__proof">
      <div className="lp__proof-repo">
        <div className="lp__proof-head">
          <code className="lp__proof-path">{path}</code>
          <code className="lp__proof-branch">{branch}</code>
        </div>
        <ol className="lp__proof-log">
          {commits.map((c) => (
            <li key={c.sha} className={c.added ? 'is-latest' : undefined}>
              <code>{c.sha}</code>
              <span>{c.message}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="lp__proof-join" aria-hidden="true">
        <svg viewBox="0 0 64 24" preserveAspectRatio="none">
          <path d="M0 12 H52" />
          <path d="M46 6 L54 12 L46 18" fill="none" />
        </svg>
      </div>

      <div className="lp__proof-screen">
        <WireframePreview />
      </div>

      <figcaption className="lp__proof-caption">{caption}</figcaption>
    </figure>
  );
}

/**
 * 右側に置くワイヤーフレーム。中身は「その .pen が描く画面」の見立てで、
 * 直近のコミットで足された行だけ色を変えてある。
 */
function WireframePreview() {
  return (
    <svg viewBox="0 0 220 272" className="lp__wire" role="img" aria-hidden="true">
      <rect className="lp__wire-sheet" x="0.5" y="0.5" width="219" height="271" rx="10" />

      {/* ヘッダー */}
      <rect className="lp__wire-bar" x="20" y="20" width="70" height="9" rx="2" />
      <circle className="lp__wire-bar" cx="192" cy="25" r="7" />

      {/* 商品行 */}
      <rect className="lp__wire-box" x="20" y="46" width="180" height="48" rx="6" />
      <rect className="lp__wire-fill" x="30" y="55" width="30" height="30" rx="4" />
      <rect className="lp__wire-bar" x="70" y="59" width="86" height="7" rx="2" />
      <rect className="lp__wire-bar-soft" x="70" y="72" width="52" height="7" rx="2" />

      <rect className="lp__wire-box" x="20" y="102" width="180" height="48" rx="6" />
      <rect className="lp__wire-fill" x="30" y="111" width="30" height="30" rx="4" />
      <rect className="lp__wire-bar" x="70" y="115" width="70" height="7" rx="2" />
      <rect className="lp__wire-bar-soft" x="70" y="128" width="60" height="7" rx="2" />

      {/* 直近のコミットで足された行 */}
      <g className="lp__wire-new">
        <rect x="20" y="158" width="180" height="48" rx="6" />
        <rect className="lp__wire-new-fill" x="30" y="167" width="30" height="30" rx="4" />
        <rect className="lp__wire-new-bar" x="70" y="171" width="78" height="7" rx="2" />
        <rect className="lp__wire-new-bar" x="70" y="184" width="44" height="7" rx="2" opacity="0.55" />
      </g>

      {/* 合計と支払い */}
      <rect className="lp__wire-bar-soft" x="20" y="219" width="54" height="7" rx="2" />
      <rect className="lp__wire-bar" x="150" y="217" width="50" height="10" rx="2" />
      <rect className="lp__wire-cta" x="20" y="238" width="180" height="18" rx="9" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

/** 文言中の <link>…</link> と <br/> だけを React 要素にする（HTML は差し込まない） */
function RichText({ html }: { html: string }) {
  const parts = html.split(/(<link>.*?<\/link>|<br\/>)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part === '<br/>') return <br key={i} />;
        const linkMatch = part.match(/^<link>(.*?)<\/link>$/);
        if (linkMatch) {
          return (
            <a key={i} href="https://www.pencil.dev/" target="_blank" rel="noopener noreferrer">
              {linkMatch[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
