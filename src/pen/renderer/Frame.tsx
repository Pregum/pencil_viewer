/**
 * Frame レンダラ。layout 計算は layout/flex.ts 側で済んでいる前提。
 * ここでは: 背景 fill の描画、clipPath、子の再帰描画を担う。
 */

import type { CSSProperties } from 'react';
import type { FrameNode } from '../types';
import { usePaintRegistry } from '../paint/PaintContext';
import {
  resolveFillLayers,
  resolveStroke,
  resolveStrokeWidth,
  resolveFilter,
  hasPartialStroke,
  resolvePartialStroke,
} from './paint';
import { LayoutGridOverlay } from '../../components/Viewer/LayoutGridOverlay';
import { isCornerRadiusArray, roundedRectPath } from './roundedRectPath';
import { renderMaskedChildren } from './MaskedChildren';

export function Frame({ node }: { node: FrameNode }) {
  const registry = usePaintRegistry() ?? undefined;
  const ctx = { nodeId: node.id, registry };
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const width = typeof node.width === 'number' ? node.width : undefined;
  const height = typeof node.height === 'number' ? node.height : undefined;
  const opacity = node.opacity ?? 1;
  const clipId = node.clip ? `clip-${node.id}` : undefined;
  const transform = x === 0 && y === 0 ? undefined : `translate(${x} ${y})`;

  const fillLayers = resolveFillLayers(node.fill, ctx);
  const filter = resolveFilter(ctx);
  // cornerRadius: number (従来, 全 4 角共通) or [nw, ne, se, sw]
  const rawCr = node.cornerRadius;
  const crArr = isCornerRadiusArray(rawCr) ? rawCr : null;
  const rawRx = typeof rawCr === 'number' ? rawCr : undefined;
  const rx = rawRx != null && width != null && height != null
    ? Math.min(rawRx, (width) / 2, (height) / 2)
    : rawRx;

  // 部分ボーダー判定
  const partial = resolvePartialStroke(node.stroke);
  const isPartial = hasPartialStroke(node.stroke);
  const strokeColor = resolveStroke(node.stroke, ctx);
  const strokeWidth = isPartial ? 0 : resolveStrokeWidth(node.stroke);

  return (
    <g
      transform={transform}
      opacity={opacity}
      clipPath={clipId ? `url(#${clipId})` : undefined}
      filter={filter}
    >
      {clipId && width != null && height != null && (
        <defs>
          <clipPath id={clipId}>
            {crArr ? (
              <path d={roundedRectPath(0, 0, width, height, crArr)} />
            ) : (
              <rect x={0} y={0} width={width} height={height} rx={rx} ry={rx} />
            )}
          </clipPath>
        </defs>
      )}
      {/* 背景 fill レイヤー群（配列順に composite） — cornerRadius 配列なら <path>、通常は <rect> */}
      {width != null && height != null && crArr && fillLayers.map((l, i) => (
        <path
          key={`bg-${i}`}
          d={roundedRectPath(0, 0, width, height, crArr)}
          fill={l.paint}
          fillOpacity={l.opacity !== 1 ? l.opacity : undefined}
          stroke={i === fillLayers.length - 1 && !isPartial ? strokeColor : 'none'}
          strokeWidth={i === fillLayers.length - 1 && !isPartial ? strokeWidth : 0}
          style={l.blendMode ? ({ mixBlendMode: l.blendMode } as CSSProperties) : undefined}
        />
      ))}
      {width != null && height != null && !crArr && fillLayers.map((l, i) => (
        <rect
          key={`bg-${i}`}
          x={0}
          y={0}
          width={width}
          height={height}
          rx={rx}
          ry={rx}
          fill={l.paint}
          fillOpacity={l.opacity !== 1 ? l.opacity : undefined}
          stroke={i === fillLayers.length - 1 && !isPartial ? strokeColor : 'none'}
          strokeWidth={i === fillLayers.length - 1 && !isPartial ? strokeWidth : 0}
          style={l.blendMode ? ({ mixBlendMode: l.blendMode } as CSSProperties) : undefined}
        />
      ))}
      {/* fill が全く無いが stroke だけある場合 */}
      {width != null && height != null && fillLayers.length === 0 && strokeWidth > 0 && !isPartial && strokeColor !== 'none' && (
        crArr ? (
          <path
            d={roundedRectPath(0, 0, width, height, crArr)}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        ) : (
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={rx}
            ry={rx}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        )
      )}
      {/* 部分ボーダー: 各辺を個別の line で描画 */}
      {isPartial && partial && width != null && height != null && strokeColor !== 'none' && (
        <>
          {partial.top > 0 && (
            <line x1={0} y1={0} x2={width} y2={0}
              stroke={strokeColor} strokeWidth={partial.top} />
          )}
          {partial.bottom > 0 && (
            <line x1={0} y1={height} x2={width} y2={height}
              stroke={strokeColor} strokeWidth={partial.bottom} />
          )}
          {partial.left > 0 && (
            <line x1={0} y1={0} x2={0} y2={height}
              stroke={strokeColor} strokeWidth={partial.left} />
          )}
          {partial.right > 0 && (
            <line x1={width} y1={0} x2={width} y2={height}
              stroke={strokeColor} strokeWidth={partial.right} />
          )}
        </>
      )}
      {/* Layout grids は背景 fill の直後、children の前に配置 */}
      <LayoutGridOverlay frame={node} />
      {node.children && renderMaskedChildren(node.children)}
    </g>
  );
}
