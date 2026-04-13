import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../i18n/detectLocale';
import { getDocsContent, type TableData } from './docsContent';

interface DocsProps {
  onBack: () => void;
  locale: SupportedLocale;
}

function DocsTable({ data }: { data: TableData }) {
  return (
    <table className="docs__table">
      <thead>
        <tr>
          {data.headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, ri) => (
          <tr key={ri}>
            {row.cols.map((col, ci) => (
              <td key={ci}>{col}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Docs({ onBack, locale }: DocsProps) {
  const c = getDocsContent(locale);
  const [activeSection, setActiveSection] = useState<string>(c.sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    for (const s of c.sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [c.sections]);

  return (
    <div className="docs">
      <nav className="docs__sidebar">
        <button
          type="button"
          className="button button--ghost docs__back-btn"
          onClick={onBack}
        >
          <span className="button__icon">&larr;</span>
          <span className="button__label">{c.back}</span>
        </button>
        <ul className="docs__toc">
          {c.sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`docs__toc-link${activeSection === s.id ? ' docs__toc-link--active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="docs__content">
        {/* Getting Started */}
        <section id="getting-started">
          <h2>{c.gettingStarted.title}</h2>
          <p>{c.gettingStarted.intro}</p>

          <h3>{c.gettingStarted.dragTitle}</h3>
          <p>{c.gettingStarted.dragDesc}</p>

          <h3>{c.gettingStarted.urlTitle}</h3>
          <p>{c.gettingStarted.urlDesc}</p>

          <h3>{c.gettingStarted.sampleTitle}</h3>
          <p>{c.gettingStarted.sampleDesc}</p>

          <h3>{c.gettingStarted.nodeTypesTitle}</h3>
          <p>{c.gettingStarted.nodeTypesIntro}</p>
          <ul>
            {c.gettingStarted.nodeTypes.map((nt) => (
              <li key={nt.name}>
                <strong>{nt.name}</strong> &mdash; {nt.desc}
              </li>
            ))}
          </ul>

          <h3>{c.gettingStarted.advancedTitle}</h3>
          <div className="docs__features">
            {c.gettingStarted.advancedItems.map((item) => (
              <div key={item.title} className="docs__feature-card">
                <span className="docs__feature-icon">{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Canvas Navigation */}
        <section id="canvas-navigation">
          <h2>{c.canvasNavigation.title}</h2>

          <h3>{c.canvasNavigation.zoomTitle}</h3>
          <DocsTable data={c.canvasNavigation.zoomTable} />

          <h3>{c.canvasNavigation.panTitle}</h3>
          <DocsTable data={c.canvasNavigation.panTable} />

          <h3>{c.canvasNavigation.frameSearchTitle}</h3>
          <p>{c.canvasNavigation.frameSearchDesc}</p>

          <h3>{c.canvasNavigation.frameHistoryTitle}</h3>
          <p>{c.canvasNavigation.frameHistoryDesc}</p>
        </section>

        {/* Vim Mode */}
        <section id="vim-mode">
          <h2>{c.vimMode.title}</h2>
          <p>{c.vimMode.intro}</p>

          <h3>{c.vimMode.normalTitle}</h3>
          <DocsTable data={c.vimMode.normalTable} />

          <h3>{c.vimMode.hintsTitle}</h3>
          <DocsTable data={c.vimMode.hintsTable} />

          <h3>{c.vimMode.insertTitle}</h3>
          <DocsTable data={c.vimMode.insertTable} />

          <h3>{c.vimMode.textObjectTitle}</h3>
          <p>{c.vimMode.textObjectIntro}</p>
          <DocsTable data={c.vimMode.textObjectTable} />

          <h3>{c.vimMode.numberPrefixTitle}</h3>
          <p>{c.vimMode.numberPrefixDesc}</p>
        </section>

        {/* Command Palette */}
        <section id="command-palette">
          <h2>{c.commandPalette.title}</h2>
          <p>{c.commandPalette.intro}</p>

          <h3>{c.commandPalette.availableTitle}</h3>
          <ul>
            {c.commandPalette.commands.map((cmd) => (
              <li key={cmd.name}>
                <strong>{cmd.name}</strong> &mdash; {cmd.desc}
              </li>
            ))}
          </ul>
        </section>

        {/* Node Editing */}
        <section id="node-editing">
          <h2>{c.nodeEditing.title}</h2>

          <h3>{c.nodeEditing.selectingTitle}</h3>
          <p>{c.nodeEditing.selectingDesc}</p>

          <h3>{c.nodeEditing.propertyPanelTitle}</h3>
          <p>{c.nodeEditing.propertyPanelIntro}</p>
          <ul>
            {c.nodeEditing.properties.map((prop) => (
              <li key={prop.name}>
                <strong>{prop.name}</strong> &mdash; {prop.desc}
              </li>
            ))}
          </ul>

          <h3>{c.nodeEditing.transformTitle}</h3>
          <DocsTable data={c.nodeEditing.transformTable} />

          <h3>{c.nodeEditing.undoRedoTitle}</h3>
          <p>{c.nodeEditing.undoRedoDesc}</p>
        </section>

        {/* Export */}
        <section id="export">
          <h2>{c.exportSection.title}</h2>
          <DocsTable data={c.exportSection.table} />
          <p>{c.exportSection.desc}</p>
        </section>

        {/* Keyboard Shortcuts Reference */}
        <section id="shortcuts">
          <h2>{c.shortcuts.title}</h2>

          <h3>{c.shortcuts.generalTitle}</h3>
          <DocsTable data={c.shortcuts.generalTable} />

          <h3>{c.shortcuts.zoomTitle}</h3>
          <DocsTable data={c.shortcuts.zoomTable} />

          <h3>{c.shortcuts.panTitle}</h3>
          <DocsTable data={c.shortcuts.panTable} />

          <h3>{c.shortcuts.navigationTitle}</h3>
          <DocsTable data={c.shortcuts.navigationTable} />

          <h3>{c.shortcuts.vimTitle}</h3>
          <DocsTable data={c.shortcuts.vimTable} />
        </section>

        {/* Collaborative Editing */}
        <section id="collab">
          <h2>{c.collab.title}</h2>
          <p>{c.collab.intro}</p>

          <h3>{c.collab.p2pTitle}</h3>
          <ol>
            {c.collab.p2pSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          <h3>{c.collab.howItWorksTitle}</h3>
          <p>{c.collab.howItWorksDesc}</p>

          <h3>{c.collab.noTraceTitle}</h3>
          <p>{c.collab.noTraceDesc}</p>

          <h3>{c.collab.limitationsTitle}</h3>
          <ul>
            {c.collab.limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </section>

        {/* API & CLI Integration */}
        <section id="api-integration">
          <h2>{c.apiIntegration.title}</h2>
          <p><strong>{c.apiIntegration.betaNote}</strong></p>

          <h3>{c.apiIntegration.bridgeTitle}</h3>
          <pre><code>{c.apiIntegration.bridgeSetup}</code></pre>

          <h3>{c.apiIntegration.restTitle}</h3>
          <DocsTable data={c.apiIntegration.restTable} />

          <h3>{c.apiIntegration.curlTitle}</h3>
          {c.apiIntegration.curlExamples.map((ex, i) => (
            <pre key={i}><code>{ex}</code></pre>
          ))}

          <h3>{c.apiIntegration.mcpTitle}</h3>
          <p>{c.apiIntegration.mcpDesc}</p>
          <pre><code>{c.apiIntegration.mcpConfig}</code></pre>

          <h3>{c.apiIntegration.claudeExampleTitle}</h3>
          <p>{c.apiIntegration.claudeExampleDesc}</p>
        </section>

        {/* Design Quality */}
        <section id="design-quality">
          <h2>{c.designQuality.title}</h2>
          <p>{c.designQuality.intro}</p>

          <h3>{c.designQuality.fiveStatesTitle}</h3>
          <p>{c.designQuality.fiveStatesDesc}</p>
          <p>{c.designQuality.fiveStatesConvention}</p>

          <h3>{c.designQuality.designDocTitle}</h3>
          <p>{c.designQuality.designDocDesc}</p>

          <h3>{c.designQuality.restApiTitle}</h3>
          {c.designQuality.restApiExamples.map((ex, i) => (
            <pre key={i}><code>{ex}</code></pre>
          ))}

          <h3>{c.designQuality.mcpToolsTitle}</h3>
          <p>{c.designQuality.mcpToolsDesc}</p>

          <h3>{c.designQuality.aiReviewTitle}</h3>
          <p>{c.designQuality.aiReviewDesc}</p>
          <p>{c.designQuality.aiReviewAccess}</p>
          <h4>{c.designQuality.aiReviewModesTitle}</h4>
          <DocsTable data={c.designQuality.aiReviewModesTable} />
          <p><em>{c.designQuality.aiReviewSetup}</em></p>
        </section>
      </article>
    </div>
  );
}
