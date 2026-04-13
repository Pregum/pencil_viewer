import { useState, useEffect } from 'react';
import type { SupportedLocale } from '../i18n/detectLocale';

interface VisionProps {
  onBack: () => void;
  locale: SupportedLocale;
}

/* ------------------------------------------------------------------ */
/*  Bilingual content                                                  */
/* ------------------------------------------------------------------ */

interface VisionContent {
  back: string;
  title: string;
  subtitle: string;
  sections: { id: string; title: string }[];

  vision: {
    title: string;
    items: { heading: string; desc: string }[];
  };
  problem: {
    title: string;
    items: string[];
  };
  solution: {
    title: string;
    roles: { role: string; color: string; items: string[] }[];
  };
  workflow: {
    title: string;
    steps: { label: string; sub: string }[];
  };
  roadmap: {
    title: string;
    phases: { phase: string; status: string; statusLabel: string; desc: string }[];
  };
}

function content(locale: SupportedLocale): VisionContent {
  if (locale === 'ja') return jaContent;
  return enContent;
}

const enContent: VisionContent = {
  back: 'Back',
  title: 'Vision & Use Cases',
  subtitle: 'How Pencil Viewer bridges design and engineering',
  sections: [
    { id: 'vision', title: 'Product Vision' },
    { id: 'problem', title: 'The Problem' },
    { id: 'solution', title: 'How We Solve It' },
    { id: 'workflow', title: 'Workflow Integration' },
    { id: 'roadmap', title: 'Roadmap' },
  ],
  vision: {
    title: 'Product Vision',
    items: [
      {
        heading: 'Design Quality Gate',
        desc: 'Catch missing UI states before they reach engineering. Every screen is audited against the Five UI States (Empty, Loading, Error, Partial, Ideal) so specification leaks never make it to implementation.',
      },
      {
        heading: 'No trace, no server, no cost',
        desc: 'Privacy-first collaborative design review. P2P WebRTC editing means your designs never touch a third-party server. Zero infrastructure, zero cost, zero data exposure.',
      },
      {
        heading: 'Bridge Figma and Engineering',
        desc: 'Pencil Viewer sits between design tools and implementation. Import from Figma, audit completeness, fill gaps with AI, and export specs that engineers can trust.',
      },
    ],
  },
  problem: {
    title: 'The Problem',
    items: [
      'The Figma WF \u2192 Design \u2192 Implementation flow has specification leaks at every handoff point.',
      'Five UI States (Empty / Loading / Error / Partial / Ideal) are often missing from design files.',
      'Engineers discover these gaps during implementation, causing rework cycles and delayed releases.',
      'Design documents in Notion get stale and outdated \u2014 the source of truth drifts from the actual design files.',
    ],
  },
  solution: {
    title: 'How Pencil Viewer Solves It',
    roles: [
      {
        role: 'PMs',
        color: 'var(--color-accent)',
        items: [
          'Review wireframe completeness with Five UI States audit',
          'Track design coverage at a glance (coverage %)',
          'Share designs via URL without any setup',
        ],
      },
      {
        role: 'Designers',
        color: '#059669',
        items: [
          'Get automated feedback on missing states',
          'Vim mode for power-user efficiency',
          'Export edited .pen files back to Pencil',
        ],
      },
      {
        role: 'Engineers',
        color: '#2563eb',
        items: [
          'MCP / REST API integration with Claude Code',
          'AI-assisted UI state generation',
          'Design specs that stay in sync with the actual design files',
          'Reduce "spec not defined" back-and-forth',
        ],
      },
    ],
  },
  workflow: {
    title: 'Workflow Integration',
    steps: [
      { label: 'Figma (WF)', sub: 'Export .pen file' },
      { label: 'Pencil Viewer', sub: 'Five UI States Audit' },
      { label: 'Claude Code', sub: 'AI fills gaps via MCP' },
      { label: 'Export .pen', sub: 'Updated design file' },
      { label: 'Notion', sub: 'Auto-generated design doc' },
      { label: 'Engineering', sub: 'Fewer gaps, less rework' },
    ],
  },
  roadmap: {
    title: 'Roadmap',
    phases: [
      { phase: 'Viewer', status: 'done', statusLabel: 'Done', desc: 'Core .pen rendering' },
      { phase: 'Editor', status: 'done', statusLabel: 'Done', desc: 'Node editing, Vim mode' },
      { phase: 'Collab', status: 'done', statusLabel: 'Done', desc: 'P2P WebRTC editing' },
      { phase: 'AI Integration', status: 'done', statusLabel: 'Done', desc: 'MCP bridge, REST API' },
      { phase: 'Quality Gate', status: 'done', statusLabel: 'Done', desc: 'Five UI States audit' },
      { phase: 'Figma Import', status: 'next', statusLabel: 'Next', desc: 'Figma API \u2192 .pen conversion' },
      { phase: 'Notion Export', status: 'next', statusLabel: 'Next', desc: 'Auto-generate design docs' },
      { phase: 'CI Integration', status: 'next', statusLabel: 'Next', desc: 'GitHub Actions design review' },
    ],
  },
};

const jaContent: VisionContent = {
  back: '\u623b\u308b',
  title: '\u30d3\u30b8\u30e7\u30f3 & \u30e6\u30fc\u30b9\u30b1\u30fc\u30b9',
  subtitle: 'Pencil Viewer \u304c\u30c7\u30b6\u30a4\u30f3\u3068\u30a8\u30f3\u30b8\u30cb\u30a2\u30ea\u30f3\u30b0\u3092\u3064\u306a\u3050',
  sections: [
    { id: 'vision', title: '\u30d7\u30ed\u30c0\u30af\u30c8\u30d3\u30b8\u30e7\u30f3' },
    { id: 'problem', title: '\u8ab2\u984c' },
    { id: 'solution', title: '\u89e3\u6c7a\u7b56' },
    { id: 'workflow', title: '\u30ef\u30fc\u30af\u30d5\u30ed\u30fc\u7d71\u5408' },
    { id: 'roadmap', title: '\u30ed\u30fc\u30c9\u30de\u30c3\u30d7' },
  ],
  vision: {
    title: '\u30d7\u30ed\u30c0\u30af\u30c8\u30d3\u30b8\u30e7\u30f3',
    items: [
      {
        heading: '\u30c7\u30b6\u30a4\u30f3\u54c1\u8cea\u30b2\u30fc\u30c8',
        desc: 'UI\u72b6\u614b\u306e\u6f0f\u308c\u3092\u30a8\u30f3\u30b8\u30cb\u30a2\u30ea\u30f3\u30b0\u306b\u5c4a\u304f\u524d\u306b\u691c\u51fa\u3002\u5168\u753b\u9762\u30925\u3064\u306eUI\u72b6\u614b\uff08Empty / Loading / Error / Partial / Ideal\uff09\u3067\u76e3\u67fb\u3057\u3001\u4ed5\u69d8\u6f0f\u308c\u3092\u9632\u304e\u307e\u3059\u3002',
      },
      {
        heading: '\u30c8\u30ec\u30fc\u30b9\u306a\u3057\u30fb\u30b5\u30fc\u30d0\u30fc\u306a\u3057\u30fb\u30b3\u30b9\u30c8\u306a\u3057',
        desc: '\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc\u30d5\u30a1\u30fc\u30b9\u30c8\u306e\u5354\u8abf\u30c7\u30b6\u30a4\u30f3\u30ec\u30d3\u30e5\u30fc\u3002P2P WebRTC\u7de8\u96c6\u306b\u3088\u308a\u3001\u30c7\u30b6\u30a4\u30f3\u30c7\u30fc\u30bf\u304c\u30b5\u30fc\u30c9\u30d1\u30fc\u30c6\u30a3\u30b5\u30fc\u30d0\u30fc\u306b\u89e6\u308c\u308b\u3053\u3068\u306f\u3042\u308a\u307e\u305b\u3093\u3002',
      },
      {
        heading: 'Figma\u3068\u30a8\u30f3\u30b8\u30cb\u30a2\u30ea\u30f3\u30b0\u306e\u6a4b\u6e21\u3057',
        desc: 'Pencil Viewer\u306f\u30c7\u30b6\u30a4\u30f3\u30c4\u30fc\u30eb\u3068\u5b9f\u88c5\u306e\u9593\u306b\u4f4d\u7f6e\u3057\u307e\u3059\u3002Figma\u304b\u3089\u30a4\u30f3\u30dd\u30fc\u30c8\u3057\u3001\u5b8c\u5168\u6027\u3092\u76e3\u67fb\u3057\u3001AI\u3067\u30ae\u30e3\u30c3\u30d7\u3092\u57cb\u3081\u3001\u30a8\u30f3\u30b8\u30cb\u30a2\u304c\u4fe1\u983c\u3067\u304d\u308b\u4ed5\u69d8\u3092\u30a8\u30af\u30b9\u30dd\u30fc\u30c8\u3057\u307e\u3059\u3002',
      },
    ],
  },
  problem: {
    title: '\u8ab2\u984c',
    items: [
      'Figma WF \u2192 \u30c7\u30b6\u30a4\u30f3 \u2192 \u5b9f\u88c5\u306e\u30d5\u30ed\u30fc\u3067\u3001\u5404\u30cf\u30f3\u30c9\u30aa\u30d5\u30dd\u30a4\u30f3\u30c8\u3067\u4ed5\u69d8\u6f0f\u308c\u304c\u767a\u751f\u3057\u3066\u3044\u308b\u3002',
      '5\u3064\u306eUI\u72b6\u614b\uff08Empty / Loading / Error / Partial / Ideal\uff09\u304c\u30c7\u30b6\u30a4\u30f3\u30d5\u30a1\u30a4\u30eb\u304b\u3089\u6b20\u843d\u3057\u3066\u3044\u308b\u3053\u3068\u304c\u591a\u3044\u3002',
      '\u30a8\u30f3\u30b8\u30cb\u30a2\u304c\u5b9f\u88c5\u4e2d\u306b\u3053\u308c\u3089\u306e\u30ae\u30e3\u30c3\u30d7\u3092\u767a\u898b\u3057\u3001\u624b\u623b\u308a\u3068\u30ea\u30ea\u30fc\u30b9\u9045\u5ef6\u306e\u539f\u56e0\u3068\u306a\u3063\u3066\u3044\u308b\u3002',
      'Notion\u306e\u30c7\u30b6\u30a4\u30f3\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u304c\u9648\u8150\u5316\u3057\u3001\u4fe1\u983c\u3067\u304d\u308b\u60c5\u5831\u6e90\uff08Single Source of Truth\uff09\u304c\u5b9f\u969b\u306e\u30c7\u30b6\u30a4\u30f3\u30d5\u30a1\u30a4\u30eb\u3068\u4e56\u96e2\u3057\u3066\u3044\u308b\u3002',
    ],
  },
  solution: {
    title: 'Pencil Viewer \u306e\u89e3\u6c7a\u7b56',
    roles: [
      {
        role: 'PM',
        color: 'var(--color-accent)',
        items: [
          '5\u3064\u306eUI\u72b6\u614b\u76e3\u67fb\u3067WF\u306e\u5b8c\u5168\u6027\u3092\u30ec\u30d3\u30e5\u30fc',
          '\u30c7\u30b6\u30a4\u30f3\u30ab\u30d0\u30ec\u30c3\u30b8\u3092\u4e00\u76ee\u3067\u628a\u63e1\uff08\u30ab\u30d0\u30ec\u30c3\u30b8 %\uff09',
          'URL\u3067\u30c7\u30b6\u30a4\u30f3\u3092\u5171\u6709\u3001\u30bb\u30c3\u30c8\u30a2\u30c3\u30d7\u4e0d\u8981',
        ],
      },
      {
        role: '\u30c7\u30b6\u30a4\u30ca\u30fc',
        color: '#059669',
        items: [
          '\u6b20\u843d\u72b6\u614b\u306e\u81ea\u52d5\u30d5\u30a3\u30fc\u30c9\u30d0\u30c3\u30af',
          'Vim\u30e2\u30fc\u30c9\u3067\u30d1\u30ef\u30fc\u30e6\u30fc\u30b6\u30fc\u306e\u52b9\u7387\u6027',
          '\u7de8\u96c6\u3057\u305f.pen\u30d5\u30a1\u30a4\u30eb\u3092Pencil\u306b\u30a8\u30af\u30b9\u30dd\u30fc\u30c8',
        ],
      },
      {
        role: '\u30a8\u30f3\u30b8\u30cb\u30a2',
        color: '#2563eb',
        items: [
          'MCP / REST API\u3067Claude Code\u3068\u9023\u643a',
          'AI\u306b\u3088\u308bUI\u72b6\u614b\u306e\u81ea\u52d5\u751f\u6210',
          '\u5b9f\u969b\u306e\u30c7\u30b6\u30a4\u30f3\u30d5\u30a1\u30a4\u30eb\u3068\u540c\u671f\u3057\u305f\u8a2d\u8a08\u4ed5\u69d8',
          '\u300c\u4ed5\u69d8\u672a\u5b9a\u7fa9\u300d\u306e\u3084\u308a\u53d6\u308a\u3092\u524a\u6e1b',
        ],
      },
    ],
  },
  workflow: {
    title: '\u30ef\u30fc\u30af\u30d5\u30ed\u30fc\u7d71\u5408',
    steps: [
      { label: 'Figma (WF)', sub: '.pen\u30d5\u30a1\u30a4\u30eb\u3092\u30a8\u30af\u30b9\u30dd\u30fc\u30c8' },
      { label: 'Pencil Viewer', sub: '5\u3064\u306eUI\u72b6\u614b\u76e3\u67fb' },
      { label: 'Claude Code', sub: 'MCP\u7d4c\u7531\u3067AI\u304c\u30ae\u30e3\u30c3\u30d7\u3092\u57cb\u3081\u308b' },
      { label: '.pen\u30a8\u30af\u30b9\u30dd\u30fc\u30c8', sub: '\u66f4\u65b0\u3055\u308c\u305f\u30c7\u30b6\u30a4\u30f3\u30d5\u30a1\u30a4\u30eb' },
      { label: 'Notion', sub: '\u81ea\u52d5\u751f\u6210\u3055\u308c\u305f\u8a2d\u8a08\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8' },
      { label: '\u30a8\u30f3\u30b8\u30cb\u30a2\u30ea\u30f3\u30b0', sub: '\u30ae\u30e3\u30c3\u30d7\u6e1b\u5c11\u3001\u624b\u623b\u308a\u524a\u6e1b' },
    ],
  },
  roadmap: {
    title: '\u30ed\u30fc\u30c9\u30de\u30c3\u30d7',
    phases: [
      { phase: 'Viewer', status: 'done', statusLabel: '\u5b8c\u4e86', desc: '\u30b3\u30a2.pen\u30ec\u30f3\u30c0\u30ea\u30f3\u30b0' },
      { phase: 'Editor', status: 'done', statusLabel: '\u5b8c\u4e86', desc: '\u30ce\u30fc\u30c9\u7de8\u96c6\u3001Vim\u30e2\u30fc\u30c9' },
      { phase: 'Collab', status: 'done', statusLabel: '\u5b8c\u4e86', desc: 'P2P WebRTC\u7de8\u96c6' },
      { phase: 'AI Integration', status: 'done', statusLabel: '\u5b8c\u4e86', desc: 'MCP\u30d6\u30ea\u30c3\u30b8\u3001REST API' },
      { phase: 'Quality Gate', status: 'done', statusLabel: '\u5b8c\u4e86', desc: '5\u3064\u306eUI\u72b6\u614b\u76e3\u67fb' },
      { phase: 'Figma Import', status: 'next', statusLabel: '\u6b21\u56de', desc: 'Figma API \u2192 .pen\u5909\u63db' },
      { phase: 'Notion Export', status: 'next', statusLabel: '\u6b21\u56de', desc: '\u8a2d\u8a08\u30c9\u30ad\u30e5\u30e1\u30f3\u30c8\u81ea\u52d5\u751f\u6210' },
      { phase: 'CI Integration', status: 'next', statusLabel: '\u6b21\u56de', desc: 'GitHub Actions\u30c7\u30b6\u30a4\u30f3\u30ec\u30d3\u30e5\u30fc' },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Vision({ onBack, locale }: VisionProps) {
  const c = content(locale);
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
    <div className="docs vision">
      {/* Sidebar (reuse docs sidebar styles) */}
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

      {/* Content */}
      <article className="docs__content">
        {/* Hero */}
        <div className="vision__hero">
          <h1 className="vision__title">{c.title}</h1>
          <p className="vision__subtitle">{c.subtitle}</p>
        </div>

        {/* 1. Product Vision */}
        <section id="vision">
          <h2>{c.vision.title}</h2>
          <div className="vision__cards">
            {c.vision.items.map((item) => (
              <div key={item.heading} className="vision__card">
                <h3>{item.heading}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 2. The Problem */}
        <section id="problem">
          <h2>{c.problem.title}</h2>
          <div className="vision__problem-list">
            {c.problem.items.map((item, i) => (
              <div key={i} className="vision__problem-item">
                <span className="vision__problem-num">{i + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Solution by role */}
        <section id="solution">
          <h2>{c.solution.title}</h2>
          <div className="vision__roles">
            {c.solution.roles.map((r) => (
              <div key={r.role} className="vision__role-card" style={{ borderTopColor: r.color }}>
                <h3 style={{ color: r.color }}>{r.role}</h3>
                <ul>
                  {r.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Workflow */}
        <section id="workflow">
          <h2>{c.workflow.title}</h2>
          <div className="vision__flow">
            {c.workflow.steps.map((step, i) => (
              <div key={i} className="vision__flow-step">
                <div className="vision__flow-node">
                  <strong>{step.label}</strong>
                  <span>{step.sub}</span>
                </div>
                {i < c.workflow.steps.length - 1 && (
                  <div className="vision__flow-arrow" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 5. Roadmap */}
        <section id="roadmap">
          <h2>{c.roadmap.title}</h2>
          <div className="vision__roadmap">
            {c.roadmap.phases.map((p) => (
              <div key={p.phase} className={`vision__roadmap-row vision__roadmap-row--${p.status}`}>
                <span className={`vision__roadmap-badge vision__roadmap-badge--${p.status}`}>
                  {p.statusLabel}
                </span>
                <strong className="vision__roadmap-phase">{p.phase}</strong>
                <span className="vision__roadmap-desc">{p.desc}</span>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
