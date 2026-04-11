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
  return (
    <div className="lp">
      {/* --- Hero --- */}
      <section className="lp__hero">
        <div className="lp__hero-badge">Open Source</div>
        <h1 className="lp__title">
          Pencil <span className="lp__title-accent">Viewer</span>
        </h1>
        <p className="lp__subtitle">
          View &amp; inspect <a href="https://www.pencil.dev/" target="_blank" rel="noopener noreferrer">.pen</a> design files directly in your browser.
          <br />
          No account. No upload. Fully client-side.
        </p>
        <div className="lp__hero-visual">
          {/* Decorative inline SVG showing abstract wireframe shapes */}
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
        <a href="#try" className="lp__cta">
          Try it now &darr;
        </a>
      </section>

      {/* --- Features --- */}
      <section className="lp__features">
        <div className="lp__feature">
          <div className="lp__feature-icon">📂</div>
          <h3>Drag &amp; Drop</h3>
          <p>Open any <code>.pen</code> file instantly. Or paste a URL. No sign-up required.</p>
        </div>
        <div className="lp__feature">
          <div className="lp__feature-icon">🎨</div>
          <h3>Full Rendering</h3>
          <p>Shapes, text, gradients, shadows, icon fonts, flex layout &mdash; all rendered as SVG.</p>
        </div>
        <div className="lp__feature">
          <div className="lp__feature-icon">🔐</div>
          <h3>Privacy First</h3>
          <p>Everything runs in your browser. Files never leave your device.</p>
        </div>
        <div className="lp__feature">
          <div className="lp__feature-icon">📱</div>
          <h3>Mobile Ready</h3>
          <p>Responsive design. Review wireframes on your phone during commute.</p>
        </div>
        <div className="lp__feature">
          <div className="lp__feature-icon">🧩</div>
          <h3>Variable Tokens</h3>
          <p><code>$surface-primary</code> and friends are resolved automatically from the doc.</p>
        </div>
        <div className="lp__feature">
          <div className="lp__feature-icon">⚡</div>
          <h3>Free &amp; Open Source</h3>
          <p>MIT licensed. Self-host on GitHub Pages for $0. Contribute on GitHub.</p>
        </div>
      </section>

      {/* --- How it works --- */}
      <section className="lp__how">
        <h2 className="lp__section-title">How it works</h2>
        <div className="lp__steps">
          <div className="lp__step">
            <div className="lp__step-num">1</div>
            <div className="lp__step-text">
              <strong>Drop a .pen file</strong>
              <span>or paste a URL / pick a sample</span>
            </div>
          </div>
          <div className="lp__step-arrow" aria-hidden>&rarr;</div>
          <div className="lp__step">
            <div className="lp__step-num">2</div>
            <div className="lp__step-text">
              <strong>Parsed &amp; laid out</strong>
              <span>zod validation, variable resolution, flex layout</span>
            </div>
          </div>
          <div className="lp__step-arrow" aria-hidden>&rarr;</div>
          <div className="lp__step">
            <div className="lp__step-num">3</div>
            <div className="lp__step-text">
              <strong>View as SVG</strong>
              <span>zoom, pan, frame nav &mdash; Figma-like canvas</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- Try it (existing drop zone) --- */}
      <section className="lp__try" id="try">
        <h2 className="lp__section-title">Try it now</h2>
        <div className="idle">
          <DropZone onFile={onFile} />
          <div className="idle__divider"><span>or</span></div>
          <UrlInput onSubmit={onUrl} />
          <SampleList onPick={onSample} />
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="lp__footer">
        <a href="https://github.com/Pregum/pencil_viewer" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <span>&middot;</span>
        <a href="https://www.pencil.dev/" target="_blank" rel="noopener noreferrer">
          Pencil.dev
        </a>
        <span>&middot;</span>
        <span>MIT License</span>
      </footer>
    </div>
  );
}
