/**
 * EasyMotion / Hop 風のヒントラベル。
 * vim mode で選択フレーム上で f キーを押すと、子コンポーネントに
 * ジャンプキーラベルが表示される。対応キーを押すとそのノードを選択。
 *
 * SVG 内にレンダリングするため、CanvasContent の後に配置する。
 */

import { useCallback, useEffect, useState } from 'react';
import { useEditor } from '../../pen/state/EditorContext';
import type { PenNode } from '../../pen/types';

const HINT_KEYS = 'asdghklqwertyuiopzxcvbnmj';

interface HintTarget {
  key: string;
  nodeId: string;
  name: string;
  cx: number; // center x in SVG coords
  cy: number; // center y in SVG coords
}

function getChildTargets(node: PenNode): HintTarget[] {
  if (!('children' in node)) return [];
  const children = (node as { children?: PenNode[] }).children ?? [];
  const targets: HintTarget[] = [];
  // parent offset
  const px = node.x ?? 0;
  const py = node.y ?? 0;
  for (let i = 0; i < children.length && i < HINT_KEYS.length; i++) {
    const child = children[i];
    const x = (child.x ?? 0);
    const y = (child.y ?? 0);
    const w = typeof (child as { width?: unknown }).width === 'number'
      ? (child as { width: number }).width : 40;
    const h = typeof (child as { height?: unknown }).height === 'number'
      ? (child as { height: number }).height : 20;
    targets.push({
      key: HINT_KEYS[i],
      nodeId: child.id,
      name: (child as { name?: string }).name ?? child.type,
      cx: px + x + w / 2,
      cy: py + y + h / 2,
    });
  }
  return targets;
}

interface Props {
  vimMode: boolean;
  /** SVG viewBox scale を渡してラベルサイズを調整 */
  svgScale: number;
}

export function HintLabels({ vimMode, svgScale }: Props) {
  const { selectedNode, selectNode } = useEditor();
  const [active, setActive] = useState(false);
  const [targets, setTargets] = useState<HintTarget[]>([]);

  const activate = useCallback(() => {
    if (!selectedNode) return;
    const t = getChildTargets(selectedNode);
    if (t.length > 0) {
      setTargets(t);
      setActive(true);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (!vimMode) {
      setActive(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey) return;

      if (!active && e.key === 'f' && selectedNode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        activate();
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
  }, [vimMode, active, targets, selectedNode, selectNode, activate]);

  if (!active || targets.length === 0) return null;

  // Label size scales inversely with zoom so it stays readable
  const labelSize = Math.max(10, 14 / svgScale);
  const padX = labelSize * 0.6;
  const padY = labelSize * 0.3;
  const bgH = labelSize + padY * 2;
  const bgW = labelSize * 1.2 + padX * 2;

  return (
    <g pointerEvents="none">
      {targets.map((t) => (
        <g key={t.nodeId}>
          {/* Background pill */}
          <rect
            x={t.cx - bgW / 2}
            y={t.cy - bgH / 2}
            width={bgW}
            height={bgH}
            rx={bgH / 2}
            fill="#1e1b4b"
            opacity={0.95}
          />
          {/* Key label */}
          <text
            x={t.cx}
            y={t.cy}
            fill="#fbbf24"
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
    </g>
  );
}
