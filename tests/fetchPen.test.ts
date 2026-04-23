import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchPenText } from '../src/utils/fetchPen';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchPenText', () => {
  it('rejects javascript: URLs', async () => {
    await expect(fetchPenText('javascript:alert(1)')).rejects.toThrow(/許可/);
  });

  it('rejects data: URLs', async () => {
    await expect(fetchPenText('data:application/json,foo')).rejects.toThrow(/許可/);
  });

  it('resolves relative paths against current origin and fetches ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{"version":"2.10","children":[]}',
    });
    vi.stubGlobal('fetch', fetchMock);
    const text = await fetchPenText('/samples/foo.pen');
    expect(text).toContain('version');
    expect(fetchMock).toHaveBeenCalledWith('/samples/foo.pen');
  });

  it('passes through https URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    });
    vi.stubGlobal('fetch', fetchMock);
    const text = await fetchPenText('https://example.com/design.pen');
    expect(text).toBe('ok');
  });

  it('throws descriptive error on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPenText('https://example.com/missing.pen')).rejects.toThrow(/HTTP 404/);
  });

  it('throws CORS hint on fetch TypeError', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPenText('https://example.com/design.pen')).rejects.toThrow(/CORS/);
  });
});
