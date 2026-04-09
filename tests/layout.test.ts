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
