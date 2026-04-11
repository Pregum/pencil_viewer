import { useI18n } from '../i18n/I18nContext';
import { DropZone } from './Loader/DropZone';
import { UrlInput } from './Loader/UrlInput';
import { SampleList } from './Loader/SampleList';

export function Landing({
  onFile,
  onUrl,
  onSample,
}: {
  onFile: (f: File) => void;
  onUrl: (url: string) => void;
  onSample: (name: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="lp">
      {/* --- Hero --- */}
      <section className="lp__hero">
        <div className="lp__hero-badge">{t('lp.badge')}</div>
        <h1 className="lp__title">
          {t('lp.title.1')} <span className="lp__title-accent">{t('lp.title.2')}</span>
        </h1>
        <p className="lp__subtitle">
          {t('lp.subtitle')
            .replace(/<link>(.*?)<\/link>/g, '')
            .replace(/<br\/>/g, '')
            .split(/(<link>.*?<\/link>|<br\/>)/g)
            .length // just use dangerouslySetInnerHTML for simplicity
            ? null
            : null}
          <SubtitleHtml html={t('lp.subtitle')} />
        </p>
        <div className="lp__hero-visual">
          <svg viewBox="0 0 480 200" className="lp__deco-svg" aria-hidden>
            <rect x="20" y="20" width="120" height="80" rx="12" fill="#7C3AED" opacity="0.15" />
            <rect x="30" y="30" width="100" height="60" rx="8" fill="none" stroke="#7C3AED" strokeWidth="2" strokeDasharray="6 4" />
            <rect x="180" y="40" width="140" height="120" rx="16" fill="#10B981" opacity="0.12" />
            <circle cx="250" cy="100" r="30" fill="none" stroke="#10B981" strokeWidth="2" />
            <text x="235" y="106" fontSize="14" fill="#10B981" fontWeight="700">Aa</text>
            <rect x="350" y="20" width="110" height="70" rx="10" fill="#F59E0B" opacity="0.12" />
            <rect x="360" y="30" width="90" height="14" rx="3" fill="#F59E0B" opacity="0.3" />
            <rect x="360" y="50" width="60" height="14" rx="3" fill="#F59E0B" opacity="0.2" />
            <rect x="360" y="70" width="75" height="8" rx="2" fill="#F59E0B" opacity="0.15" />
            <path d="M20 160 Q120 130 240 150 T460 140" stroke="#7C3AED" strokeWidth="2" fill="none" opacity="0.3" />
          </svg>
        </div>
        <a href="#try" className="lp__cta">{t('lp.cta')} &darr;</a>
      </section>

      {/* --- Features --- */}
      <section className="lp__features">
        {(['drag', 'render', 'privacy', 'mobile', 'token', 'oss'] as const).map((key) => (
          <div className="lp__feature" key={key}>
            <div className="lp__feature-icon">
              {key === 'drag' ? '📂' : key === 'render' ? '🎨' : key === 'privacy' ? '🔐' : key === 'mobile' ? '📱' : key === 'token' ? '🧩' : '⚡'}
            </div>
            <h3>{t(`lp.feat.${key}.title`)}</h3>
            <p>{t(`lp.feat.${key}.desc`)}</p>
          </div>
        ))}
      </section>

      {/* --- How it works --- */}
      <section className="lp__how">
        <h2 className="lp__section-title">{t('lp.how.title')}</h2>
        <div className="lp__steps">
          {[1, 2, 3].map((n) => (
            <div className="lp__step" key={n}>
              <div className="lp__step-num">{n}</div>
              <div className="lp__step-text">
                <strong>{t(`lp.how.step${n}.title`)}</strong>
                <span>{t(`lp.how.step${n}.desc`)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- Try it --- */}
      <section className="lp__try" id="try">
        <h2 className="lp__section-title">{t('lp.try.title')}</h2>
        <div className="idle">
          <DropZone onFile={onFile} />
          <div className="idle__divider"><span>or</span></div>
          <UrlInput onSubmit={onUrl} />
          <SampleList onPick={onSample} />
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="lp__footer">
        <a href="https://github.com/Pregum/pencil_viewer" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span>&middot;</span>
        <a href="https://www.pencil.dev/" target="_blank" rel="noopener noreferrer">Pencil.dev</a>
        <span>&middot;</span>
        <span>MIT License</span>
      </footer>
    </div>
  );
}

/** subtitle の <link>...</link> と <br/> を安全に React 要素に変換する */
function SubtitleHtml({ html }: { html: string }) {
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
