/**
 * Vim text object 選択（vim mode 有効時のみ）。
 * v + i/a + f/r/c でフレームをまとめて選択。
 *
 * - vif: inner frame（選択フレームの子ノード全選択）
 * - vaf: around frame（同じ親の兄弟ノード全選択）
 * - vir: inner row（同じ Y 座標行のトップレベルフレーム全選択）
 * - vic: inner column（同じ X 座標列のトップレベルフレーム全選択）
 */

import { useEffect, useRef } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

const ROW_THRESHOLD = 100;
const COL_THRESHOLD = 100;

interface FrameInfo {
  id: string;
  x: number;
  y: number;
}

function collectTopFrames(nodes: PenNode[]): FrameInfo[] {
  return nodes
    .filter((n) => n.type === 'frame' || n.type === 'group')
    .map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 }));
}

function findParentOf(nodes: PenNode[], targetId: string): PenNode | null {
  for (const n of nodes) {
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const children = (n as { children: PenNode[] }).children;
      if (children.some((c) => c.id === targetId)) return n;
      const found = findParentOf(children, targetId);
      if (found) return found;
    }
  }
  return null;
}

function findNode(nodes: PenNode[], id: string): PenNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if ('children' in n && Array.isArray((n as { children?: PenNode[] }).children)) {
      const found = findNode((n as { children: PenNode[] }).children, id);
      if (found) return found;
    }
  }
  return null;
}

export function VimTextObjects({ vimMode }: { vimMode: boolean }) {
  const { state, selectMultiple } = useEditor();
  const seq = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!vimMode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey) return;

      const key = e.key;

      // Build sequence
      if (key === 'v' && seq.current === '') {
        seq.current = 'v';
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { seq.current = ''; }, 1500);
        return;
      }

      if (seq.current === 'v' && (key === 'i' || key === 'a')) {
        seq.current += key;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { seq.current = ''; }, 1500);
        return;
      }

      if ((seq.current === 'vi' || seq.current === 'va') && (key === 'f' || key === 'r' || key === 'c' || key === 'w')) {
        e.preventDefault();
        const mode = seq.current[1] as 'i' | 'a';
        const target = key;
        seq.current = '';
        clearTimeout(timer.current);

        handleTextObject(mode, target);
        return;
      }

      // Reset sequence on unrecognized key
      if (seq.current.length > 0 && key !== 'v') {
        seq.current = '';
        clearTimeout(timer.current);
      }
    };

    function handleTextObject(mode: 'i' | 'a', target: string) {
      const currentId = state.selectedNodeId;
      if (!currentId) return;

      const doc = state.doc;

      switch (target) {
        case 'f': {
          if (mode === 'i') {
            // vif: select all children of current node
            const node = findNode(doc.children, currentId);
            if (node && 'children' in node) {
              const children = (node as { children: PenNode[] }).children;
              selectMultiple(children.map((c) => c.id));
            }
          } else {
            // vaf: select all siblings (including self)
            const parent = findParentOf(doc.children, currentId);
            if (parent && 'children' in parent) {
              const siblings = (parent as { children: PenNode[] }).children;
              selectMultiple(siblings.map((c) => c.id));
            } else {
              // top-level: select all top-level nodes
              selectMultiple(doc.children.map((c) => c.id));
            }
          }
          break;
        }
        case 'r': {
          // vir: select frames in the same row (Y-aligned)
          const frames = collectTopFrames(doc.children);
          const current = frames.find((f) => f.id === currentId);
          if (!current) return;
          const row = frames.filter((f) => Math.abs(f.y - current.y) <= ROW_THRESHOLD);
          selectMultiple(row.map((f) => f.id));
          break;
        }
        case 'c': {
          // vic: select frames in the same column (X-aligned)
          const frames = collectTopFrames(doc.children);
          const current = frames.find((f) => f.id === currentId);
          if (!current) return;
          const col = frames.filter((f) => Math.abs(f.x - current.x) <= COL_THRESHOLD);
          selectMultiple(col.map((f) => f.id));
          break;
        }
        case 'w': {
          // viw: select current node only (like word)
          selectMultiple([currentId]);
          break;
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer.current);
    };
  }, [vimMode, state.selectedNodeId, state.doc, selectMultiple]);

  return null; // render nothing
}
