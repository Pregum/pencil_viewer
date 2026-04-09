import { useEffect, useState } from 'react';
import { parsePenText, type ParseError } from './pen/parser';
import type { PenDocument } from './pen/types';
import { PenViewer } from './components/Viewer/PenViewer';

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; doc: PenDocument }
  | { kind: 'error'; error: ParseError | { summary: string; issues: [] } };

export function App() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}samples/shapes.pen`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const result = parsePenText(text);
        if (result.ok) setStatus({ kind: 'ready', doc: result.doc });
        else setStatus({ kind: 'error', error: result.error });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setStatus({
          kind: 'error',
          error: { summary: `サンプルの取得に失敗しました: ${message}`, issues: [] },
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <span className="brand">✏️ Pencil Viewer</span>
        <span className="header__file">
          {status.kind === 'ready' ? 'samples/shapes.pen' : ''}
        </span>
      </header>
      <main className="main">
        {status.kind === 'loading' && <p className="muted">読み込み中…</p>}
        {status.kind === 'error' && (
          <div className="error-card">
            <strong>⚠ 読み込みに失敗しました</strong>
            <p>{status.error.summary}</p>
          </div>
        )}
        {status.kind === 'ready' && <PenViewer doc={status.doc} />}
      </main>
    </div>
  );
}
