/**
 * .pen ファイル読み込み状態を集約する reducer。
 * 3 経路(file / url / sample)を単一の state machine で扱う。
 */

import { useCallback, useReducer, useRef } from 'react';
import { parsePenText, type ParseError } from '../parser';
import { resolveRefs } from '../refs';
import { substituteVariables } from '../variables';
import { loadImports } from '../imports';
import { readBuiltinLibrary } from '../libraries';
import { layoutDocument } from '../layout';
import type { PenDocument } from '../types';
import { readFileAsText } from '../../utils/readFile';
import { fetchPenText } from '../../utils/fetchPen';
import { loadDocumentFonts } from '../../utils/fontLoader';

export type Source =
  | { kind: 'file'; name: string }
  | { kind: 'url'; url: string }
  | { kind: 'sample'; name: string }
  /** 招待リンク (?room=) 経由の空ドキュメント起動 */
  | { kind: 'collab' };

export interface LoadError {
  summary: string;
  detail?: ParseError;
}

export type DocState =
  | { status: 'idle' }
  | { status: 'loading'; source: Source }
  | { status: 'ready'; source: Source; doc: PenDocument; rawDoc: PenDocument }
  | { status: 'error'; source?: Source; error: LoadError };

type Action =
  | { type: 'LOAD_START'; source: Source }
  | { type: 'LOAD_SUCCESS'; source: Source; doc: PenDocument; rawDoc: PenDocument }
  | { type: 'LOAD_FAILURE'; source?: Source; error: LoadError }
  | { type: 'RESET' };

function reducer(state: DocState, action: Action): DocState {
  switch (action.type) {
    case 'LOAD_START':
      return { status: 'loading', source: action.source };
    case 'LOAD_SUCCESS':
      return { status: 'ready', source: action.source, doc: action.doc, rawDoc: action.rawDoc };
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
  loadEmpty: () => void;
  reset: () => void;
} {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  // 読み込みは非同期なので、後から始めた読み込み(や reset)を古い読み込みの
  // 結果で上書きしないよう、最新の要求の番号を覚えておく
  const requestRef = useRef(0);
  const startRequest = useCallback(() => ++requestRef.current, []);
  const isCurrent = useCallback((id: number) => requestRef.current === id, []);

  const loadText = useCallback(async (id: number, source: Source, text: string) => {
    const result = parsePenText(text);
    if (result.ok) {
      // parse → import 読み込み → ref 展開 → variable 置換 → layout の順でパイプライン
      const libraries = await loadImports(result.doc, readBuiltinLibrary);
      if (!isCurrent(id)) return;
      const refsResolved = resolveRefs(result.doc, { components: libraries.components });
      const substituted = substituteVariables(refsResolved, undefined, libraries);
      const rawDoc = substituted; // レイアウト前の状態を保持（エクスポート用）
      const laidOut = layoutDocument(substituted);
      loadDocumentFonts(laidOut);
      dispatch({ type: 'LOAD_SUCCESS', source, doc: laidOut, rawDoc });
    } else if (isCurrent(id)) {
      dispatch({
        type: 'LOAD_FAILURE',
        source,
        error: { summary: result.error.summary, detail: result.error },
      });
    }
  }, [isCurrent]);

  const loadFile = useCallback(
    async (file: File) => {
      const source: Source = { kind: 'file', name: file.name };
      const id = startRequest();
      dispatch({ type: 'LOAD_START', source });
      try {
        const text = await readFileAsText(file);
        await loadText(id, source, text);
      } catch (e) {
        if (!isCurrent(id)) return;
        const message = e instanceof Error ? e.message : String(e);
        dispatch({
          type: 'LOAD_FAILURE',
          source,
          error: { summary: `ファイルを読み込めませんでした: ${message}` },
        });
      }
    },
    [loadText, startRequest, isCurrent],
  );

  const loadUrl = useCallback(
    async (url: string) => {
      const source: Source = { kind: 'url', url };
      const id = startRequest();
      dispatch({ type: 'LOAD_START', source });
      try {
        const text = await fetchPenText(url);
        await loadText(id, source, text);
      } catch (e) {
        if (!isCurrent(id)) return;
        const message = e instanceof Error ? e.message : String(e);
        dispatch({
          type: 'LOAD_FAILURE',
          source,
          error: { summary: message },
        });
      }
    },
    [loadText, startRequest, isCurrent],
  );

  const loadSample = useCallback(
    async (name: string) => {
      const source: Source = { kind: 'sample', name };
      const id = startRequest();
      dispatch({ type: 'LOAD_START', source });
      try {
        const text = await fetchPenText(`${import.meta.env.BASE_URL}samples/${name}`);
        await loadText(id, source, text);
      } catch (e) {
        if (!isCurrent(id)) return;
        const message = e instanceof Error ? e.message : String(e);
        dispatch({
          type: 'LOAD_FAILURE',
          source,
          error: { summary: message },
        });
      }
    },
    [loadText, startRequest, isCurrent],
  );

  /** 空ドキュメントで起動する (招待リンク経由の共同編集参加者用)。
   *  実際の内容は接続後に他ユーザーから同期される。 */
  const loadEmpty = useCallback(() => {
    startRequest();
    const doc: PenDocument = { version: '1.0', children: [] };
    dispatch({ type: 'LOAD_SUCCESS', source: { kind: 'collab' }, doc, rawDoc: doc });
  }, [startRequest]);

  const reset = useCallback(() => {
    startRequest();
    dispatch({ type: 'RESET' });
  }, [startRequest]);

  return { state, loadFile, loadUrl, loadSample, loadEmpty, reset };
}
