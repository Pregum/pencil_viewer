import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadRecent,
  pushRecent,
  reorderWithRecent,
  saveRecent,
} from '../src/utils/recentCommands';

beforeEach(() => {
  localStorage.clear();
});

describe('pushRecent', () => {
  it('puts new id at front', () => {
    expect(pushRecent([], 'a')).toEqual(['a']);
    expect(pushRecent(['b', 'c'], 'a')).toEqual(['a', 'b', 'c']);
  });

  it('moves existing id to front (dedup)', () => {
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
    expect(pushRecent(['a', 'b', 'c'], 'a')).toEqual(['a', 'b', 'c']);
  });

  it('caps at 8 entries', () => {
    const long = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const next = pushRecent(long, '9');
    expect(next).toHaveLength(8);
    expect(next[0]).toBe('9');
    expect(next).not.toContain('8');
  });
});

describe('reorderWithRecent', () => {
  const items = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
    { id: 'd', label: 'D' },
  ];

  it('returns original order when no recents', () => {
    expect(reorderWithRecent(items, [])).toEqual(items);
  });

  it('promotes recent ids to top in recency order', () => {
    const res = reorderWithRecent(items, ['c', 'a']);
    expect(res.map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores recent ids that no longer exist', () => {
    const res = reorderWithRecent(items, ['ghost', 'b']);
    expect(res.map((x) => x.id)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('keeps non-recent items in original order', () => {
    const res = reorderWithRecent(items, ['d']);
    expect(res.map((x) => x.id)).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('loadRecent / saveRecent', () => {
  it('round-trips through localStorage', () => {
    saveRecent(['x', 'y']);
    expect(loadRecent()).toEqual(['x', 'y']);
  });

  it('returns [] when nothing stored', () => {
    expect(loadRecent()).toEqual([]);
  });

  it('returns [] when stored value is corrupt', () => {
    localStorage.setItem('pencilViewer.recentCommands', 'not json');
    expect(loadRecent()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem('pencilViewer.recentCommands', '{"foo":1}');
    expect(loadRecent()).toEqual([]);
  });

  it('filters non-string entries', () => {
    localStorage.setItem('pencilViewer.recentCommands', JSON.stringify(['a', 2, null, 'b']));
    expect(loadRecent()).toEqual(['a', 'b']);
  });

  it('truncates load to max 8', () => {
    const many = Array.from({ length: 20 }, (_, i) => `id${i}`);
    localStorage.setItem('pencilViewer.recentCommands', JSON.stringify(many));
    expect(loadRecent()).toHaveLength(8);
  });
});
