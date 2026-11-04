import { afterEach, describe, expect, it } from 'vitest';
import { loadDocumentFonts } from '../src/utils/fontLoader';
import type { PenDocument } from '../src/pen/types';

function doc(...fonts: string[]): PenDocument {
  return {
    version: '2.10',
    children: fonts.map((fontFamily, i) => ({ type: 'text', id: `t${i}`, fontFamily })),
  } as unknown as PenDocument;
}

function fontLinks(): HTMLLinkElement[] {
  return [...document.head.querySelectorAll<HTMLLinkElement>('link[href*="fonts.googleapis"]')];
}

describe('loadDocumentFonts', () => {
  afterEach(() => fontLinks().forEach((l) => l.remove()));

  it('requests each family separately so one failure cannot affect the others', () => {
    loadDocumentFonts(doc('Alpha Sans', 'Beta Serif'));
    const hrefs = fontLinks().map((l) => l.href);
    expect(hrefs).toHaveLength(2);
    expect(hrefs[0]).toContain('family=Alpha%20Sans:wght@100..900');
    expect(hrefs[1]).toContain('family=Beta%20Serif:wght@100..900');
  });

  it('falls back to narrower weights when Google Fonts rejects the request', () => {
    loadDocumentFonts(doc('Gamma Mono'));
    fontLinks()[0].dispatchEvent(new Event('error'));
    expect(fontLinks()).toHaveLength(1);
    expect(fontLinks()[0].href).toContain('family=Gamma%20Mono:wght@400;700&');

    fontLinks()[0].dispatchEvent(new Event('error'));
    expect(fontLinks()).toHaveLength(1);
    expect(fontLinks()[0].href).toContain('family=Gamma%20Mono&');
    expect(fontLinks()[0].onerror).toBeNull(); // last attempt: nothing left to retry
  });

  it('skips system fonts and fonts that were already requested', () => {
    loadDocumentFonts(doc('system-ui, sans-serif', 'Delta'));
    loadDocumentFonts(doc('Delta'));
    expect(fontLinks()).toHaveLength(1);
  });
});
