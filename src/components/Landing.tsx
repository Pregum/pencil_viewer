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

      {/* --- Featured: AI Design Review --- */}
      <section className="lp__airev-banner">
        <div className="lp__airev-content">
          <span className="lp__airev-badge">{t('lp.airev.badge')}</span>
          <h2 className="lp__airev-title">{t('lp.airev.title')}</h2>
          <p className="lp__airev-tagline">{t('lp.airev.tagline')}</p>
          <p className="lp__airev-desc">{t('lp.airev.desc')}</p>
          <ul className="lp__airev-bullets">
            <li>{t('lp.airev.bullet1')}</li>
            <li>{t('lp.airev.bullet2')}</li>
            <li>{t('lp.airev.bullet3')}</li>
          </ul>
          <a href="#try" className="lp__airev-cta">{t('lp.airev.cta')}</a>
        </div>
        <div className="lp__airev-visual" aria-hidden="true">
          <svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg">
            {/* Original screen */}
            <rect x="20" y="30" width="120" height="180" rx="12" fill="#1C1C1C" stroke="#7c3aed" strokeWidth="1.5" />
            <rect x="32" y="42" width="60" height="8" rx="2" fill="#FFFFFF" opacity="0.9" />
            <rect x="32" y="58" width="96" height="40" rx="4" fill="#7c3aed" opacity="0.4" />
            <rect x="32" y="106" width="96" height="14" rx="2" fill="#FFFFFF" opacity="0.2" />
            <rect x="32" y="126" width="96" height="14" rx="2" fill="#FFFFFF" opacity="0.2" />
            <rect x="32" y="146" width="64" height="14" rx="2" fill="#FFFFFF" opacity="0.2" />
            {/* Arrow */}
            <path d="M150 120 L180 120" stroke="#a855f7" strokeWidth="2" markerEnd="url(#arrow)" />
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill="#a855f7" />
              </marker>
            </defs>
            {/* AI generated empty state */}
            <rect x="190" y="30" width="120" height="180" rx="12" fill="#1C1C1C" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4 3" />
            <rect x="202" y="42" width="60" height="8" rx="2" fill="#FFFFFF" opacity="0.9" />
            <text x="250" y="120" fontSize="32" textAnchor="middle">📭</text>
            <rect x="218" y="138" width="64" height="6" rx="1" fill="#FFFFFF" opacity="0.5" />
            <rect x="226" y="160" width="48" height="20" rx="10" fill="#7c3aed" />
            {/* Sparkle */}
            <text x="295" y="48" fontSize="18">✨</text>
          </svg>
        </div>
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
