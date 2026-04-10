import { describe, expect, it } from 'vitest';
import { layoutDocument } from '../src/pen/layout';
import type { FrameNode, PenDocument, PenNode } from '../src/pen/types';

function makeDoc(children: PenNode[]): PenDocument {
  return { version: '2.10', children };
}

function frame(partial: Partial<FrameNode> & { id: string }): FrameNode {
  return {
    type: 'frame',
    width: 400,
    height: 200,
    children: [],
    ...partial,
  } as FrameNode;
}

function rect(id: string, width: number, height: number): PenNode {
  return { type: 'rectangle', id, width, height } as PenNode;
}

describe('layoutDocument', () => {
  describe('layout: none', () => {
    it('keeps children x/y as authored', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'none',
          children: [
            { type: 'rectangle', id: 'r1', x: 10, y: 20, width: 50, height: 30 } as PenNode,
            { type: 'rectangle', id: 'r2', x: 100, y: 80, width: 40, height: 40 } as PenNode,
          ],
        }),
      ]);
      const result = layoutDocument(doc);
      const f1 = result.children[0] as FrameNode;
      const [r1, r2] = f1.children ?? [];
      expect(r1.x).toBe(10);
      expect(r1.y).toBe(20);
      expect(r2.x).toBe(100);
      expect(r2.y).toBe(80);
    });
  });

  describe('layout: horizontal', () => {
    it('stacks children on x axis with gap, ignores authored x/y', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'horizontal',
          width: 500,
          height: 100,
          gap: 10,
          children: [
            rect('r1', 100, 50),
            { ...rect('r2', 80, 40), x: 999, y: 999 } as PenNode,
            rect('r3', 60, 60),
          ],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [r1, r2, r3] = f1.children!;
      expect(r1.x).toBe(0);
      expect(r2.x).toBe(100 + 10); // after r1 + gap
      expect(r3.x).toBe(100 + 10 + 80 + 10); // after r2 + gap
      expect(r2.y).toBe(0); // authored 999 overridden
    });

    it('applies padding on both axes', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'horizontal',
          width: 500,
          height: 100,
          padding: [12, 20],
          children: [rect('r1', 100, 40)],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [r1] = f1.children!;
      expect(r1.x).toBe(20); // left padding
      expect(r1.y).toBe(12); // top padding (align: start)
    });

    it('justifyContent: center shifts children horizontally', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'horizontal',
          width: 300,
          height: 100,
          justifyContent: 'center',
          children: [rect('r1', 100, 40)],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const r1 = f1.children![0];
      expect(r1.x).toBe(100); // (300 - 100) / 2
    });

    it('justifyContent: end aligns to right', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'horizontal',
          width: 300,
          height: 100,
          justifyContent: 'end',
          children: [rect('r1', 100, 40)],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const r1 = f1.children![0];
      expect(r1.x).toBe(200);
    });

    it('alignItems: center centers on cross axis', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'horizontal',
          width: 500,
          height: 200,
          alignItems: 'center',
          children: [rect('r1', 100, 60)],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const r1 = f1.children![0];
      expect(r1.y).toBe(70); // (200 - 60) / 2
    });

    it('fill_container distributes remaining main-axis space', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'horizontal',
          width: 400,
          height: 100,
          gap: 10,
          children: [
            rect('r1', 80, 40),
            { type: 'rectangle', id: 'r2', width: 'fill_container', height: 40 } as PenNode,
            rect('r3', 60, 40),
          ],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [r1, r2, r3] = f1.children!;
      // fill の分 = 400 - 80 - 60 - 10*2 = 240
      expect(r1.width).toBe(80);
      expect(r2.width).toBe(240);
      expect(r3.width).toBe(60);
      // positions
      expect(r1.x).toBe(0);
      expect(r2.x).toBe(90);
      expect(r3.x).toBe(340);
    });
  });

  describe('layout: vertical', () => {
    it('stacks children on y axis with gap', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 200,
          height: 500,
          gap: 8,
          children: [rect('r1', 100, 60), rect('r2', 100, 80), rect('r3', 100, 50)],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [r1, r2, r3] = f1.children!;
      expect(r1.y).toBe(0);
      expect(r2.y).toBe(68);
      expect(r3.y).toBe(68 + 80 + 8);
    });

    it('alignItems: center centers on x', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 200,
          height: 300,
          alignItems: 'center',
          children: [rect('r1', 80, 40)],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const r1 = f1.children![0];
      expect(r1.x).toBe(60); // (200 - 80) / 2
    });
  });

  describe('fit_content', () => {
    it('frame with fit_content takes size of children + padding', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'horizontal',
          width: 'fit_content',
          height: 'fit_content',
          padding: 10,
          gap: 5,
          children: [rect('r1', 50, 40), rect('r2', 30, 30)],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      // width = 10 + 50 + 5 + 30 + 10 = 105
      // height = 10 + max(40, 30) + 10 = 60
      expect(f1.width).toBe(105);
      expect(f1.height).toBe(60);
    });
  });

  describe('text intrinsic size', () => {
    it('estimates text width and height when not explicitly set', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 400,
          height: 200,
          gap: 8,
          children: [
            { type: 'text', id: 't1', content: 'Hello', fontSize: 20 } as PenNode,
            { type: 'text', id: 't2', content: 'World', fontSize: 20 } as PenNode,
          ],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [t1, t2] = f1.children!;
      // 0-size であってはならない(文字数 × fontSize × 0.55 程度に近い値)
      expect(typeof t1.width === 'number' && t1.width > 0).toBe(true);
      expect(typeof t1.height === 'number' && t1.height > 0).toBe(true);
      // 2 つのテキストは別々の y に配置される(縦に積まれる)
      expect(t1.y).toBe(0);
      expect(t2.y).toBeGreaterThan(0);
    });

    it('respects explicit width on fixed-width text', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 400,
          height: 200,
          children: [
            {
              type: 'text',
              id: 't1',
              content: 'Hello',
              fontSize: 20,
              width: 250,
              textGrowth: 'fixed-width',
            } as PenNode,
          ],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [t1] = f1.children!;
      expect(t1.width).toBe(250);
    });

    it('handles empty string content without producing 0-size box', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 400,
          height: 200,
          children: [{ type: 'text', id: 't1', content: '', fontSize: 16 } as PenNode],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [t1] = f1.children!;
      expect(typeof t1.width === 'number' && t1.width >= 1).toBe(true);
      expect(typeof t1.height === 'number' && t1.height >= 1).toBe(true);
    });

    it('multi-line content increases the measured height', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 400,
          height: 200,
          children: [
            { type: 'text', id: 'one', content: 'one line', fontSize: 16 } as PenNode,
            { type: 'text', id: 'three', content: 'a\nb\nc', fontSize: 16 } as PenNode,
          ],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [one, three] = f1.children!;
      const oneH = typeof one.height === 'number' ? one.height : 0;
      const threeH = typeof three.height === 'number' ? three.height : 0;
      expect(threeH).toBeGreaterThan(oneH * 2);
    });

    it('fontSize 0 still yields a >= 1px box (no zero-size regression)', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 400,
          height: 200,
          children: [{ type: 'text', id: 't1', content: 'hello', fontSize: 0 } as PenNode],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [t1] = f1.children!;
      expect(typeof t1.height === 'number' && t1.height >= 1).toBe(true);
      expect(typeof t1.width === 'number' && t1.width >= 1).toBe(true);
    });

    it('fixed-width-height text honors both explicit dimensions', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 400,
          height: 200,
          children: [
            {
              type: 'text',
              id: 't1',
              content: 'hello world ' + 'x'.repeat(200),
              fontSize: 14,
              width: 100,
              height: 40,
              textGrowth: 'fixed-width-height',
            } as PenNode,
          ],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [t1] = f1.children!;
      expect(t1.width).toBe(100);
      expect(t1.height).toBe(40);
    });

    it('icon_font defaults to 24x24 when size is not set', () => {
      const doc = makeDoc([
        frame({
          id: 'f1',
          layout: 'vertical',
          width: 400,
          height: 200,
          children: [
            {
              type: 'icon_font',
              id: 'i1',
              iconFontFamily: 'Material Symbols Outlined',
              iconFontName: 'home',
            } as PenNode,
          ],
        }),
      ]);
      const f1 = layoutDocument(doc).children[0] as FrameNode;
      const [i1] = f1.children!;
      expect(i1.width).toBe(24);
      expect(i1.height).toBe(24);
    });
  });

  describe('default layout fallback', () => {
    it('frame without an explicit layout field defaults to horizontal (Pencil spec)', () => {
      // Pencil's schema says: "Frames default to horizontal, groups default to none."
      // Pre-fix, this test would have failed because the implementation defaulted
      // to "none", leaving children at their authored (0, 0).
      const f1: FrameNode = {
        type: 'frame',
        id: 'f1',
        width: 400,
        height: 100,
        gap: 10,
        children: [rect('r1', 100, 40), rect('r2', 80, 40)],
      };
      delete (f1 as { layout?: string }).layout;
      const out = (layoutDocument(makeDoc([f1])).children[0] as FrameNode).children!;
      const [r1, r2] = out;
      expect(r1.x).toBe(0);
      expect(r2.x).toBe(110); // 100 + gap 10, i.e. laid out horizontally
    });

    it('frame with justifyContent=center but no layout centers its children (regression)', () => {
      // Regression: a button frame (qasg0 in museum_journey) with
      // justifyContent=center + alignItems=center but no explicit layout was
      // being treated as layout="none", leaving the label text at x=0.
      const btn: FrameNode = {
        type: 'frame',
        id: 'btn',
        width: 320,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        children: [
          { type: 'text', id: 'label', content: 'Login', fontSize: 14 } as PenNode,
        ],
      };
      delete (btn as { layout?: string }).layout;
      const laidOut = layoutDocument(makeDoc([btn])).children[0] as FrameNode;
      const [label] = laidOut.children!;
      // Estimated width of "Login" ≈ 5 * 14 * 0.55 = 38.5.
      // Center position ≈ (320 - 38.5) / 2 ≈ 140.75.
      // Must be a number clearly inside the centered band, not x=0 (left edge)
      // nor x=320 (right edge).
      expect(typeof label.x).toBe('number');
      expect(label.x as number).toBeGreaterThan(100);
      expect(label.x as number).toBeLessThan(180);
    });

    it('group with an explicit layout=horizontal honors gap and centering', () => {
      // GroupNode now carries the same Layout mixin as FrameNode. Verify that
      // opting into flex on a group actually lays children out (previously the
      // layoutContainer hardcoded group gap/justify/align to 0/'start').
      const doc = makeDoc([
        {
          type: 'group',
          id: 'g',
          width: 300,
          height: 50,
          layout: 'horizontal',
          gap: 10,
          justifyContent: 'center',
          children: [
            { type: 'rectangle', id: 'r1', width: 40, height: 40 } as PenNode,
            { type: 'rectangle', id: 'r2', width: 40, height: 40 } as PenNode,
          ],
        } as PenNode,
      ]);
      const g = layoutDocument(doc).children[0] as { children: PenNode[] };
      const [r1, r2] = g.children;
      // total main = 40 + 10 + 40 = 90. center start = (300 - 90) / 2 = 105.
      expect(r1.x).toBe(105);
      expect(r2.x).toBe(155); // 105 + 40 + 10
    });

    it('group without an explicit layout field still defaults to none', () => {
      // Pencil spec: groups default to `none` even when the same spec applies
      // to frames being horizontal.
      const doc = makeDoc([
        {
          type: 'group',
          id: 'g',
          children: [
            { type: 'rectangle', id: 'r1', x: 10, y: 20, width: 30, height: 30 } as PenNode,
            { type: 'rectangle', id: 'r2', x: 100, y: 50, width: 30, height: 30 } as PenNode,
          ],
        } as PenNode,
      ]);
      const g = layoutDocument(doc).children[0] as { children: PenNode[] };
      const [r1, r2] = g.children;
      expect(r1.x).toBe(10);
      expect(r1.y).toBe(20);
      expect(r2.x).toBe(100);
      expect(r2.y).toBe(50);
    });
  });

  describe('layoutPosition: absolute', () => {
    it('excludes absolute children from a fit_content parent sizing', () => {
      // Regression: intrinsicSize must also skip absolute children, otherwise
      // a fit_content vertical parent inflates its height by the absolute
      // child's (intrinsic or authored) size.
      const doc = makeDoc([
        {
          type: 'frame',
          id: 'fitParent',
          layout: 'vertical',
          width: 'fit_content',
          height: 'fit_content',
          gap: 0,
          padding: 0,
          children: [
            rect('a', 50, 100),
            rect('b', 50, 60),
            {
              type: 'rectangle',
              id: 'floating',
              x: 0,
              y: 500, // would inflate fit_content height if counted in flow
              width: 50,
              height: 200,
              layoutPosition: 'absolute',
            } as unknown as PenNode,
          ],
        } as unknown as PenNode,
      ]);
      const parent = layoutDocument(doc).children[0] as FrameNode;
      // height should be 100 + 60 = 160 (flow only, not 700)
      expect(parent.height).toBe(160);
    });

    it('keeps absolute children out of the flex flow', () => {
      // Regression: a floating bottom tab bar inside a layout:vertical
      // container should honor its own x/y, not be stacked with the other
      // children. Flow siblings should lay out as if the absolute child
      // was not there.
      const doc = makeDoc([
        frame({
          id: 'screen',
          layout: 'vertical',
          width: 375,
          height: 812,
          gap: 0,
          children: [
            rect('header', 375, 64),
            rect('body', 375, 500),
            {
              type: 'frame',
              id: 'tabbar',
              x: 0,
              y: 728,
              width: 375,
              height: 62,
              layout: 'horizontal',
              layoutPosition: 'absolute',
              children: [],
            } as unknown as PenNode,
          ],
        }),
      ]);
      const screen = layoutDocument(doc).children[0] as FrameNode;
      const kids = screen.children!;
      const header = kids.find((c) => c.id === 'header')!;
      const body = kids.find((c) => c.id === 'body')!;
      const tabbar = kids.find((c) => c.id === 'tabbar')!;
      // header + body stack as if tabbar did not exist
      expect(header.y).toBe(0);
      expect(body.y).toBe(64);
      // tabbar keeps its authored absolute position
      expect(tabbar.x).toBe(0);
      expect(tabbar.y).toBe(728);
    });
  });

  describe('nested layouts', () => {
    it('recursively lays out nested flex frames', () => {
      const doc = makeDoc([
        frame({
          id: 'outer',
          layout: 'vertical',
          width: 400,
          height: 300,
          gap: 20,
          padding: 16,
          children: [
            rect('top', 100, 40),
            frame({
              id: 'inner',
              layout: 'horizontal',
              width: 200,
              height: 80,
              gap: 4,
              children: [rect('a', 50, 50), rect('b', 50, 50)],
            }),
          ],
        }),
      ]);
      const outer = layoutDocument(doc).children[0] as FrameNode;
      const [top, inner] = outer.children!;
      expect(top.x).toBe(16);
      expect(top.y).toBe(16);
      expect(inner.y).toBe(16 + 40 + 20);
      // inner's children
      const innerFrame = inner as FrameNode;
      const [a, b] = innerFrame.children!;
      expect(a.x).toBe(0);
      expect(b.x).toBe(54);
    });
  });
});
