import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

export interface SampleMeta {
  name: string;
  label: string;
  description?: string;
}

export function SampleList({ onPick }: { onPick: (name: string) => void }) {
  const { t } = useI18n();
  const [samples, setSamples] = useState<SampleMeta[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}samples/index.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        setSamples(Array.isArray(data) ? (data as SampleMeta[]) : []);
      })
      .catch(() => {
        if (!cancelled) setSamples([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!samples || samples.length === 0) return null;

  return (
    <section className="samples">
      <h3 className="samples__title">{t('samples.title')}</h3>
      <div className="samples__grid">
        {samples.map((s) => (
          <button
            key={s.name}
            type="button"
            className="sample-card"
            onClick={() => onPick(s.name)}
          >
            <div className="sample-card__thumb" aria-hidden>
              🧩
            </div>
            <div className="sample-card__name">{s.label}</div>
            {s.description && <div className="sample-card__desc">{s.description}</div>}
          </button>
        ))}
      </div>
    </section>
  );
}
