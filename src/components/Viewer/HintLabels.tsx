/**
 * EasyMotion / Hop 風のヒントラベル。
 *
 * vim mode 時:
 *   f = 画面内のフレーム（frame/group）のみ、カメラ中心からの距離昇順
 *   t = 全ノード（frame/group/text/rectangle 等すべて）、距離昇順
 *
 * ラベルは a-z の26キーを距離が近い順に割り当て。
 */

import { useEffect, useMemo, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

const HINT_KEYS = 'asdfghjklqwertyuiopzxcvbnm';

interface HintTarget {
  key: string;
  nodeId: string;
  name: string;
  cx: number;
  cy: number;
  dist: number;
}

interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function nodeCenter(node: PenNode): { cx: number; cy: number } | null {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const w = typeof (node as { width?: unknown }).width === 'number'
    ? (node as { width: number }).width : 0;
  const h = typeof (node as { height?: unknown }).height === 'number'
    ? (node as { height: number }).height : 0;
  if (w === 0 && h === 0) return null;
  return { cx: x + w / 2, cy: y + h / 2 };
}

function isInView(cx: number, cy: number, view: ViewRect): boolean {
  return cx >= view.x && cx <= view.x + view.width &&
         cy >= view.y && cy <= view.y + view.height;
}

/** 画面内のノードを再帰的に収集（絶対座標） */
function collectVisible(
  nodes: PenNode[],
  view: ViewRect,
  cameraCx: number,
  cameraCy: number,
  framesOnly: boolean,
  offsetX: number,
  offsetY: number,
): { nodeId: string; name: string; cx: number; cy: number; dist: number }[] {
  const result: { nodeId: string; name: string; cx: number; cy: number; dist: number }[] = [];
  for (const node of nodes) {
    const c = nodeCenter(node);
    if (!c) continue;
    const absCx = offsetX + c.cx;
    const absCy = offsetY + c.cy;

    if (!isInView(absCx, absCy, view)) continue;

    const isFrame = node.type === 'frame' || node.type === 'group';
    if (!framesOnly || isFrame) {
      const dist = Math.sqrt((absCx - cameraCx) ** 2 + (absCy - cameraCy) ** 2);
      result.push({
        nodeId: node.id,
        name: (node as { name?: string }).name ?? node.type,
        cx: absCx,
        cy: absCy,
        dist,
      });
    }

    // Recurse into children
    if ('children' in node && Array.isArray((node as { children?: PenNode[] }).children)) {
      const children = (node as { children: PenNode[] }).children;
      const px = node.x ?? 0;
      const py = node.y ?? 0;
      result.push(
        ...collectVisible(children, view, cameraCx, cameraCy, framesOnly, offsetX + px, offsetY + py),
      );
    }
  }
  return result;
}

interface Props {
  vimMode: boolean;
  svgScale: number;
  cameraCx: number;
  cameraCy: number;
  viewBox: ViewRect;
}

export function HintLabels({ vimMode, svgScale, cameraCx, cameraCy, viewBox }: Props) {
  const { state, selectNode } = useEditor();
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<'f' | 't'>('f');
  const [targets, setTargets] = useState<HintTarget[]>([]);

  // Collect targets when activated
  const allTargets = useMemo(() => {
    if (!active) return [];
    const framesOnly = mode === 'f';
    const raw = collectVisible(state.doc.children, viewBox, cameraCx, cameraCy, framesOnly, 0, 0);
    // Sort by distance, assign keys
    raw.sort((a, b) => a.dist - b.dist);
    // Deduplicate by nodeId
    const seen = new Set<string>();
    const unique = raw.filter((r) => {
      if (seen.has(r.nodeId)) return false;
      seen.add(r.nodeId);
      return true;
    });
    return unique.slice(0, HINT_KEYS.length).map((r, i) => ({
      ...r,
      key: HINT_KEYS[i],
    }));
  }, [active, mode, state.doc, viewBox, cameraCx, cameraCy]);

  useEffect(() => {
    if (active) setTargets(allTargets);
  }, [active, allTargets]);

  useEffect(() => {
    if (!vimMode) {
      setActive(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey) return;

      // Activate: f = frames only, t = all nodes
      if (!active && (e.key === 'f' || e.key === 't')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMode(e.key as 'f' | 't');
        setActive(true);
        return;
      }

      if (active) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === 'Escape') {
          setActive(false);
          setTargets([]);
          return;
        }
        const target = targets.find((t) => t.key === e.key);
        if (target) {
          selectNode(target.nodeId);
        }
        setActive(false);
        setTargets([]);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [vimMode, active, targets, selectNode]);

  if (!active || targets.length === 0) return null;

  const labelSize = Math.max(10, 14 / svgScale);
  const padX = labelSize * 0.6;
  const padY = labelSize * 0.3;
  const bgH = labelSize + padY * 2;
  const bgW = labelSize * 1.2 + padX * 2;

  return (
    <g pointerEvents="none">
      {/* Dim overlay */}
      <rect
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.width}
        height={viewBox.height}
        fill="black"
        opacity={0.15}
      />
      {targets.map((t) => (
        <g key={t.nodeId}>
          <rect
            x={t.cx - bgW / 2}
            y={t.cy - bgH / 2}
            width={bgW}
            height={bgH}
            rx={bgH / 2}
            fill={mode === 'f' ? '#1e1b4b' : '#451a03'}
            opacity={0.95}
          />
          <text
            x={t.cx}
            y={t.cy}
            fill={mode === 'f' ? '#fbbf24' : '#86efac'}
            fontSize={labelSize}
            fontWeight="800"
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {t.key}
          </text>
        </g>
      ))}
      {/* Mode indicator */}
      <text
        x={viewBox.x + 8 / svgScale}
        y={viewBox.y + 18 / svgScale}
        fill={mode === 'f' ? '#fbbf24' : '#86efac'}
        fontSize={12 / svgScale}
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        {mode === 'f' ? '-- FIND FRAME --' : '-- FIND ALL --'}
      </text>
    </g>
  );
}
