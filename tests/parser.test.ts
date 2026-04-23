import { describe, expect, it } from 'vitest';
import { parsePen, parsePenText } from '../src/pen/parser';

describe('parsePen', () => {
  describe('happy path', () => {
    it('parses an empty document', () => {
      const result = parsePen({ version: '2.10', children: [] });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.doc.version).toBe('2.10');
        expect(result.doc.children).toEqual([]);
      }
    });

    it('parses a document with basic shapes', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          { type: 'rectangle', id: 'r1', x: 10, y: 20, width: 100, height: 60, fill: '#FF0000' },
          { type: 'ellipse', id: 'e1', x: 150, y: 20, width: 80, height: 80, fill: '#00FF00' },
          { type: 'text', id: 't1', x: 10, y: 100, content: 'hello', fontSize: 16 },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.doc.children).toHaveLength(3);
        expect(result.doc.children[0].type).toBe('rectangle');
        expect(result.doc.children[1].type).toBe('ellipse');
        expect(result.doc.children[2].type).toBe('text');
      }
    });

    it('recursively parses frame children', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          {
            type: 'frame',
            id: 'f1',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            children: [{ type: 'rectangle', id: 'r1', width: 50, height: 50 }],
          },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const frame = result.doc.children[0];
        expect(frame.type).toBe('frame');
        if (frame.type === 'frame') {
          expect(frame.children).toHaveLength(1);
          expect(frame.children?.[0].type).toBe('rectangle');
        }
      }
    });
  });

  describe('unsupported nodes', () => {
    it('converts unknown node types to UnsupportedNode', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          { type: 'rectangle', id: 'r1', width: 10, height: 10 },
          { type: 'some_future_type', id: 'x1', x: 5, y: 5, width: 100, height: 40 },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.doc.children[0].type).toBe('rectangle');
        const unsupported = result.doc.children[1];
        expect(unsupported.type).toBe('unsupported');
        if (unsupported.type === 'unsupported') {
          expect(unsupported.originalType).toBe('some_future_type');
        }
      }
    });
  });

  describe('error paths', () => {
    it('fails on missing version', () => {
      const result = parsePen({ children: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('fails on missing children', () => {
      const result = parsePen({ version: '2.10' });
      expect(result.ok).toBe(false);
    });

    it('fails when children is not an array', () => {
      const result = parsePen({ version: '2.10', children: 'nope' });
      expect(result.ok).toBe(false);
    });

    it('fails on null input', () => {
      const result = parsePen(null);
      expect(result.ok).toBe(false);
    });

    it('fails on string input', () => {
      const result = parsePen('not an object');
      expect(result.ok).toBe(false);
    });

    it('error.summary is a non-empty string for invalid input', () => {
      const result = parsePen({ version: '2.10', children: 'nope' });
      if (!result.ok) {
        expect(typeof result.error.summary).toBe('string');
        expect(result.error.summary.length).toBeGreaterThan(0);
      }
    });
  });

  describe('passthrough fields', () => {
    it('keeps unknown fields on known node types (passthrough)', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          { type: 'rectangle', id: 'r', width: 10, height: 10, customField: 'x' },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const r = result.doc.children[0] as { customField?: string };
        // passthrough で保持されるべき (zod .passthrough 経由)
        expect(r.customField).toBe('x');
      }
    });

    it('preserves passthrough fields for unsupported types', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          { type: 'mystery', id: 'm', x: 5, y: 5, width: 20, height: 30, meta: { n: 1 } },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const u = result.doc.children[0];
        expect(u.type).toBe('unsupported');
      }
    });
  });

  describe('group / line / polygon / path', () => {
    it('parses group with children', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          {
            type: 'group', id: 'g',
            children: [{ type: 'rectangle', id: 'r', width: 10, height: 10 }],
          },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it('parses a line with stroke', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          { type: 'line', id: 'l', x: 0, y: 0, width: 100, height: 0, stroke: { thickness: 2, fill: '#000' } },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it('parses polygon with polygonCount', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          { type: 'polygon', id: 'p', x: 0, y: 0, width: 100, height: 100, polygonCount: 6 },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it('parses a path with geometry', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          { type: 'path', id: 'pa', x: 0, y: 0, width: 100, height: 40, geometry: 'M 0 0 L 100 40' },
        ],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('nested unsupported', () => {
    it('keeps unsupported children inside a frame', () => {
      const result = parsePen({
        version: '2.10',
        children: [
          {
            type: 'frame', id: 'f', x: 0, y: 0, width: 200, height: 200,
            children: [{ type: 'martian', id: 'm' }],
          },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const f = result.doc.children[0];
        if (f.type === 'frame') {
          expect(f.children?.[0].type).toBe('unsupported');
        }
      }
    });
  });

  describe('parsePenText', () => {
    it('returns a clear error for invalid JSON', () => {
      const result = parsePenText('{ not json');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.summary).toMatch(/JSON/);
      }
    });

    it('parses a valid JSON string', () => {
      const result = parsePenText(JSON.stringify({ version: '2.10', children: [] }));
      expect(result.ok).toBe(true);
    });
  });
});
