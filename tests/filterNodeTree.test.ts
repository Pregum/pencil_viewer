import { describe, expect, it } from 'vitest';
import { filterNodeTree } from '../src/utils/filterNodeTree';
import type { PenNode } from '../src/pen/types';

const doc: PenNode[] = [
  {
    type: 'frame',
    id: 'home',
    name: 'Home Screen',
    x: 0,
    y: 0,
    width: 400,
    height: 400,
    children: [
      { type: 'text', id: 'title', content: 'Welcome back', x: 0, y: 0 } as PenNode,
      { type: 'rectangle', id: 'btn-primary', name: 'Primary Button', x: 0, y: 0, width: 120, height: 40 } as PenNode,
      {
        type: 'frame',
        id: 'sidebar',
        name: 'Nav',
        x: 0,
        y: 0,
        width: 200,
        height: 400,
        children: [
          { type: 'text', id: 'logo', content: 'Acme', x: 0, y: 0 } as PenNode,
        ],
      },
    ],
  },
  {
    type: 'frame',
    id: 'login',
    name: 'Login',
    x: 0,
    y: 0,
    width: 400,
    height: 400,
    children: [
      { type: 'text', id: 'welcome', content: 'Welcome', x: 0, y: 0 } as PenNode,
    ],
  },
];

describe('filterNodeTree', () => {
  it('returns empty sets when query is empty or whitespace', () => {
    expect(filterNodeTree(doc, '').visible.size).toBe(0);
    expect(filterNodeTree(doc, '   ').visible.size).toBe(0);
    expect(filterNodeTree(doc, '').matchCount).toBe(0);
  });

  it('matches by node id (case-insensitive)', () => {
    const r = filterNodeTree(doc, 'BTN');
    expect(r.visible.has('btn-primary')).toBe(true);
    expect(r.visible.has('home')).toBe(true); // ancestor
    expect(r.visible.has('login')).toBe(false);
  });

  it('matches by name', () => {
    const r = filterNodeTree(doc, 'primary');
    expect(r.visible.has('btn-primary')).toBe(true);
    expect(r.visible.has('home')).toBe(true);
    expect(r.matchCount).toBe(1);
  });

  it('matches by type', () => {
    const r = filterNodeTree(doc, 'rectangle');
    expect(r.visible.has('btn-primary')).toBe(true);
    expect(r.matchCount).toBe(1);
  });

  it('matches text content', () => {
    const r = filterNodeTree(doc, 'welcome');
    expect(r.visible.has('title')).toBe(true);
    expect(r.visible.has('welcome')).toBe(true);
    expect(r.visible.has('home')).toBe(true);
    expect(r.visible.has('login')).toBe(true);
    expect(r.matchCount).toBe(2);
  });

  it('autoExpand includes all ancestors of matches, not the match itself', () => {
    const r = filterNodeTree(doc, 'logo');
    expect(r.autoExpand.has('home')).toBe(true);
    expect(r.autoExpand.has('sidebar')).toBe(true);
    expect(r.autoExpand.has('logo')).toBe(false);
  });

  it('returns zero match count with no match but empty visible', () => {
    const r = filterNodeTree(doc, 'zzzzz');
    expect(r.matchCount).toBe(0);
    expect(r.visible.size).toBe(0);
  });

  it('a match hides siblings that do not match', () => {
    const r = filterNodeTree(doc, 'primary');
    // login branch not visible
    expect(r.visible.has('login')).toBe(false);
    expect(r.visible.has('welcome')).toBe(false);
    // sibling at same level as match: title should NOT be visible
    expect(r.visible.has('title')).toBe(false);
    expect(r.visible.has('sidebar')).toBe(false);
  });
});
