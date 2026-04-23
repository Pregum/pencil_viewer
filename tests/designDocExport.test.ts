import { describe, expect, it } from 'vitest';
import { generateDesignDoc } from '../src/analysis/designDocExport';
import type { FrameNode, PenDocument, PenNode } from '../src/pen/types';

function frame(id: string, name: string, w = 375, h = 812, children: PenNode[] = []): FrameNode {
  return { type: 'frame', id, name, x: 0, y: 0, width: w, height: h, children } as FrameNode;
}

function doc(children: PenNode[], variables?: unknown): PenDocument {
  return { version: '2.10', children, ...(variables ? { variables } : {}) };
}

describe('generateDesignDoc', () => {
  it('emits title and iso date header', () => {
    const md = generateDesignDoc(doc([frame('f', 'Home')]), { projectName: 'My Proj' });
    expect(md).toContain('# 📐 My Proj');
    // ISO date YYYY-MM-DD
    expect(md).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('uses default projectName when not provided', () => {
    const md = generateDesignDoc(doc([frame('f', 'Home')]));
    expect(md).toContain('Design Document');
  });

  it('includes summary table headers (ja)', () => {
    const md = generateDesignDoc(doc([frame('f', 'Home')]), { locale: 'ja' });
    expect(md).toContain('画面サマリー');
    expect(md).toContain('画面名');
    expect(md).toContain('カバー率');
  });

  it('includes summary table headers (en)', () => {
    const md = generateDesignDoc(doc([frame('f', 'Home')]), { locale: 'en' });
    expect(md).toContain('Screen Summary');
    expect(md).toContain('Screen');
    expect(md).toContain('Coverage');
  });

  it('emits screen statistics', () => {
    const md = generateDesignDoc(doc([
      frame('f1', 'Home'),
      frame('f2', 'Home - Empty'),
      frame('f3', 'Settings'),
    ]));
    // screens=2, avg=(40 + 20)/2 = 30
    expect(md).toMatch(/全画面数.*: 2/);
    expect(md).toMatch(/平均カバー率.*: 30%/);
  });

  it('emits Design Tokens section when variables exist', () => {
    const md = generateDesignDoc(
      doc([frame('f', 'Home')]),
      undefined,
    );
    expect(md).not.toContain('🔧');

    const md2 = generateDesignDoc(
      { ...doc([frame('f', 'Home')]), variables: { primary: { type: 'color', value: '#FF0000' } } } as unknown as PenDocument,
    );
    expect(md2).toContain('デザイントークン');
    expect(md2).toContain('"primary"');
  });

  it('no frames produces valid empty-ish document', () => {
    const md = generateDesignDoc(doc([]));
    // 少なくとも title と summary ヘッダは出る
    expect(md).toContain('# 📐');
    expect(md).toContain('全画面数');
  });
});
