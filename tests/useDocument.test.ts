import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDocument } from '../src/pen/state/useDocument';

/** import 付きのドキュメント(ライブラリの取得を待つ)と、import 無しのドキュメント */
const WITH_IMPORT = JSON.stringify({
  version: '2.21',
  imports: { ui: 'pencil:shadcn.lib.pen' },
  children: [{ type: 'frame', id: 'slow', width: 10, height: 10 }],
});
const PLAIN = JSON.stringify({
  version: '2.21',
  children: [{ type: 'frame', id: 'fast', width: 10, height: 10 }],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** ライブラリの取得だけを止めておける fetch */
function stubFetch(docFor: (url: string) => string) {
  const library = { requested: false, release: (_res: Response) => {} };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('libraries/pencil/')) {
        library.requested = true;
        return new Promise<Response>((resolve) => {
          library.release = resolve;
        });
      }
      return Promise.resolve(new Response(docFor(url)));
    }),
  );
  return library;
}

const EMPTY_LIB = '{"version":"2.8","children":[]}';

describe('useDocument', () => {
  it('does not let an older load that is still fetching libraries overwrite a newer one', async () => {
    const library = stubFetch((url) => (url.includes('slow') ? WITH_IMPORT : PLAIN));

    const { result } = renderHook(() => useDocument());
    let slow: Promise<void> = Promise.resolve();
    act(() => {
      slow = result.current.loadUrl('https://example.com/slow.pen');
    });
    await waitFor(() => expect(library.requested).toBe(true));
    await act(async () => {
      await result.current.loadUrl('https://example.com/fast.pen');
    });
    expect(result.current.state.status).toBe('ready');

    // 古い読み込みのライブラリ取得が後から終わっても、新しい方が残る
    await act(async () => {
      library.release(new Response(EMPTY_LIB));
      await slow;
    });
    const state = result.current.state;
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.source).toEqual({ kind: 'url', url: 'https://example.com/fast.pen' });
      expect(state.doc.children[0].id).toBe('fast');
    }
  });

  it('stays reset when a load finishes after reset()', async () => {
    stubFetch(() => PLAIN);
    const { result } = renderHook(() => useDocument());
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.loadUrl('https://example.com/plain.pen');
      result.current.reset();
    });
    await act(async () => {
      await pending;
    });
    expect(result.current.state.status).toBe('idle');
  });
});
