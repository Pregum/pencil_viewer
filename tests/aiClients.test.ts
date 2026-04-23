/**
 * aiReview / aiGenerate クライアントのテスト。
 *
 * 環境変数 VITE_AI_REVIEW_URL と fetch を vi でスタブして、
 * 正常系 / 異常系 / 未設定の 3 パターンを検証する。
 *
 * import.meta.env は module load 時に評価されるので、テスト毎に
 * vi.stubEnv → dynamic import し直して分離している。
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('requestAIReview / requestAIGenerate (mocked)', () => {
  const mockUrl = 'https://mock.workers.dev';

  beforeEach(() => {
    vi.stubEnv('VITE_AI_REVIEW_URL', mockUrl);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('isAIReviewEnabled / isAIGenerateEnabled', () => {
    it('returns true when VITE_AI_REVIEW_URL is set', async () => {
      const { isAIReviewEnabled } = await import('../src/utils/aiReview');
      const { isAIGenerateEnabled } = await import('../src/utils/aiGenerate');
      expect(isAIReviewEnabled()).toBe(true);
      expect(isAIGenerateEnabled()).toBe(true);
    });

    it('returns false when VITE_AI_REVIEW_URL is empty', async () => {
      vi.stubEnv('VITE_AI_REVIEW_URL', '');
      vi.resetModules();
      const { isAIReviewEnabled } = await import('../src/utils/aiReview');
      const { isAIGenerateEnabled } = await import('../src/utils/aiGenerate');
      expect(isAIReviewEnabled()).toBe(false);
      expect(isAIGenerateEnabled()).toBe(false);
    });
  });

  describe('requestAIReview', () => {
    it('POSTs the children array and returns parsed json', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          review: 'Looks good.',
          meta: { mode: 'full', locale: 'ja', screenCount: 1, model: 'x' },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const { requestAIReview } = await import('../src/utils/aiReview');
      const r = await requestAIReview({ version: '2.10', children: [] }, 'full', 'ja');
      expect(r.review).toBe('Looks good.');
      expect(fetchMock).toHaveBeenCalledWith(mockUrl, expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.mode).toBe('full');
      expect(body.locale).toBe('ja');
      expect(Array.isArray(body.children)).toBe(true);
    });

    it('throws with error.error when response not ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'invalid body' }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const { requestAIReview } = await import('../src/utils/aiReview');
      await expect(requestAIReview({ version: '2.10', children: [] })).rejects.toThrow('invalid body');
    });

    it('uses statusText when response json is not parseable', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => { throw new Error('nope'); },
      });
      vi.stubGlobal('fetch', fetchMock);
      const { requestAIReview } = await import('../src/utils/aiReview');
      await expect(requestAIReview({ version: '2.10', children: [] })).rejects.toThrow('Internal Server Error');
    });
  });

  describe('requestAIGenerate', () => {
    it('sends mode:generate with prompt and kind', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          node: { type: 'frame', id: 'gen', x: 0, y: 0, width: 375, height: 812 },
          meta: { mode: 'generate', kind: 'mobile', locale: 'ja', prompt: 'x', model: 'y' },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const { requestAIGenerate } = await import('../src/utils/aiGenerate');
      const r = await requestAIGenerate('hello', 'mobile', 'ja', 100);
      expect(r.node.type).toBe('frame');
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body).toEqual({
        mode: 'generate',
        prompt: 'hello',
        kind: 'mobile',
        locale: 'ja',
        offsetX: 100,
      });
    });

    it('attaches HTTP status on thrown error', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'children array required' }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const { requestAIGenerate } = await import('../src/utils/aiGenerate');
      try {
        await requestAIGenerate('x');
        throw new Error('did not throw');
      } catch (e) {
        expect((e as Error).message).toMatch(/HTTP 400/);
        expect((e as Error).message).toMatch(/children array required/);
        expect((e as Error & { status?: number }).status).toBe(400);
      }
    });

    it('throws config error when URL is not set', async () => {
      vi.stubEnv('VITE_AI_REVIEW_URL', '');
      vi.resetModules();
      const { requestAIGenerate } = await import('../src/utils/aiGenerate');
      await expect(requestAIGenerate('x')).rejects.toThrow(/not configured/);
    });
  });
});
