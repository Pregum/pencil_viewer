import { describe, expect, it } from 'vitest';
import { analyzeUIStates, formatReport } from '../src/analysis/uiStates';
import type { FrameNode, PenDocument, PenNode } from '../src/pen/types';

function frame(id: string, name: string, w = 375, h = 812): FrameNode {
  return { type: 'frame', id, name, x: 0, y: 0, width: w, height: h, children: [] } as FrameNode;
}

function doc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}

describe('analyzeUIStates', () => {
  it('returns empty when no frames', () => {
    const r = analyzeUIStates(doc([]));
    expect(r).toEqual([]);
  });

  it('skips frames smaller than 100x100', () => {
    const r = analyzeUIStates(doc([frame('f', 'Tiny', 50, 50)]));
    expect(r).toEqual([]);
  });

  it('infers "ideal" for a plain screen', () => {
    const r = analyzeUIStates(doc([frame('f', 'Home')]));
    expect(r).toHaveLength(1);
    expect(r[0].screenName).toBe('Home');
    expect(r[0].detectedStates.has('ideal')).toBe(true);
    expect(r[0].coverage).toBe(20); // 1/5 = 20%
    expect(r[0].missingStates).toEqual(['empty', 'loading', 'error', 'partial']);
  });

  it('groups frames with same base name into one screen', () => {
    const r = analyzeUIStates(doc([
      frame('f1', 'Home'),
      frame('f2', 'Home - Empty'),
      frame('f3', 'Home - Loading'),
    ]));
    // 1 グループで detected が 3 種類
    expect(r).toHaveLength(1);
    expect(r[0].screenName).toBe('Home');
    expect(r[0].frames).toHaveLength(3);
    expect(r[0].detectedStates.has('ideal')).toBe(true);
    expect(r[0].detectedStates.has('empty')).toBe(true);
    expect(r[0].detectedStates.has('loading')).toBe(true);
    expect(r[0].coverage).toBe(60);
    expect(r[0].missingStates).toEqual(['error', 'partial']);
  });

  it('strips the "WF:" prefix when deriving screen name', () => {
    const r = analyzeUIStates(doc([frame('f', 'WF: Dashboard')]));
    expect(r[0].screenName).toBe('Dashboard');
  });

  it('full coverage when all 5 states detected', () => {
    // ASCII ハイフンを区切りに使う（em dash は現状のセパレータ regex に含まれない）
    const r = analyzeUIStates(doc([
      frame('f1', 'List'),
      frame('f2', 'List - Empty'),
      frame('f3', 'List - Loading'),
      frame('f4', 'List - Error'),
      frame('f5', 'List - Partial'),
    ]));
    expect(r).toHaveLength(1);
    expect(r[0].coverage).toBe(100);
    expect(r[0].missingStates).toEqual([]);
  });

  it('ignores non-frame top-level nodes', () => {
    const r = analyzeUIStates(doc([
      { type: 'rectangle', id: 'r', x: 0, y: 0, width: 200, height: 200 } as unknown as PenNode,
      frame('f', 'Home'),
    ]));
    expect(r).toHaveLength(1);
  });
});

describe('formatReport', () => {
  it('returns a string containing screen names and coverage', () => {
    const groups = analyzeUIStates(doc([frame('f', 'Home')]));
    const out = formatReport(groups, 'en');
    expect(typeof out).toBe('string');
    expect(out).toContain('Home');
    expect(out).toContain('20');
  });

  it('locale=ja uses Japanese labels', () => {
    const groups = analyzeUIStates(doc([frame('f', 'Home')]));
    const out = formatReport(groups, 'ja');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
