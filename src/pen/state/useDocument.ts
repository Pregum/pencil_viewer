/**
 * .pen ファイル読み込み状態を集約する reducer。
 * 3 経路(file / url / sample)を単一の state machine で扱う。
 */

import { useCallback, useReducer } from 'react';
import { parsePenText, type ParseError } from '../parser';
import { substituteVariables } from '../variables';
import { layoutDocument } from '../layout';
import type { PenDocument } from '../types';
import { readFileAsText } from '../../utils/readFile';
import { fetchPenText } from '../../utils/fetchPen';

export type Source =
  | { kind: 'file'; name: string }
  | { kind: 'url'; url: string }
  | { kind: 'sample'; name: string };

export interface LoadError {
  summary: string;
  detail?: ParseError;
}

export type DocState =
  | { status: 'idle' }
  | { status: 'loading'; source: Source }
  | { status: 'ready'; source: Source; doc: PenDocument }
  | { status: 'error'; source?: Source; error: LoadError };

type Action =
  | { type: 'LOAD_START'; source: Source }
  | { type: 'LOAD_SUCCESS'; source: Source; doc: PenDocument }
  | { type: 'LOAD_FAILURE'; source?: Source; error: LoadError }
  | { type: 'RESET' };

function reducer(state: DocState, action: Action): DocState {
  switch (action.type) {
    case 'LOAD_START':
      return { status: 'loading', source: action.source };
    case 'LOAD_SUCCESS':
      return { status: 'ready', source: action.source, doc: action.doc };
    case 'LOAD_FAILURE':
      return { status: 'error', source: action.source, error: action.error };
    case 'RESET':
      return { status: 'idle' };
    default:
      return state;
  }
}

export function useDocument(): {
  state: DocState;
  loadFile: (file: File) => Promise<void>;
  loadUrl: (url: string) => Promise<void>;
  loadSample: (name: string) => Promise<void>;
  reset: () => void;
} {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  const loadText = useCallback(async (source: Source, text: string) => {
    const result = parsePenText(text);
    if (result.ok) {
      // parse → variable 置換 → layout の順でパイプライン
      const substituted = substituteVariables(result.doc);
      const laidOut = layoutDocument(substituted);
      dispatch({ type: 'LOAD_SUCCESS', source, doc: laidOut });
    } else {
      dispatch({
        type: 'LOAD_FAILURE',
        source,
        error: { summary: result.error.summary, detail: result.error },
      });
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const source: Source = { kind: 'file', name: file.name };
      dispatch({ type: 'LOAD_START', source });
      try {
        const text = await readFileAsText(file);
        await loadText(source, text);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        dispatch({
          type: 'LOAD_FAILURE',
          source,
          error: { summary: `ファイルを読み込めませんでした: ${message}` },
        });
      }
    },
    [loadText],
  );

  const loadUrl = useCallback(
    async (url: string) => {
      const source: Source = { kind: 'url', url };
      dispatch({ type: 'LOAD_START', source });
      try {
        const text = await fetchPenText(url);
        await loadText(source, text);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        dispatch({
          type: 'LOAD_FAILURE',
          source,
          error: { summary: message },
        });
      }
    },
    [loadText],
  );

  const loadSample = useCallback(
    async (name: string) => {
      const source: Source = { kind: 'sample', name };
      dispatch({ type: 'LOAD_START', source });
      try {
        const text = await fetchPenText(`${import.meta.env.BASE_URL}samples/${name}`);
        await loadText(source, text);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        dispatch({
          type: 'LOAD_FAILURE',
          source,
          error: { summary: message },
        });
      }
    },
    [loadText],
  );

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return { state, loadFile, loadUrl, loadSample, reset };
}
