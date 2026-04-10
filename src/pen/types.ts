/**
 * .pen ファイルの TypeScript 型定義(discriminated union)。
 *
 * 仕様: https://docs.pencil.dev/for-developers/the-pen-format
 *
 * 戦略:
 * - `type` フィールドを判別子とする discriminated union
 * - MVP では主要ノード(rectangle / ellipse / line / polygon / path / text /
 *   frame / group / icon_font)を型付け
 * - 未知のフィールドは握りつぶしてランタイムで落とさない(parser 側で passthrough)
 * - themes / variables / ref は将来フェーズ用に unknown で通す
 */

export type Color = string;

export interface Position {
  x?: number;
  y?: number;
}

export type SizeValue = number | string; // "fill_container" / "fit_content" などの特殊値を許容

export interface Size {
  width?: SizeValue;
  height?: SizeValue;
}

export interface SolidFill {
  type: 'color';
  color: Color;
  enabled?: boolean;
  opacity?: number;
}

export interface GradientStop {
  color: Color;
  position: number;
}

export interface GradientFill {
  type: 'gradient';
  gradientType?: 'linear' | 'radial' | 'angular';
  colors?: GradientStop[];
  rotation?: number;
  center?: Position;
  size?: { width?: number; height?: number };
  opacity?: number;
  enabled?: boolean;
}

export interface ImageFill {
  type: 'image';
  url: string;
  mode?: 'stretch' | 'fill' | 'fit';
  opacity?: number;
  enabled?: boolean;
}

/** Fill は単一色 (string) / 構造体 / 配列いずれも取り得る */
export type Fill = Color | SolidFill | GradientFill | ImageFill;
export type Fills = Fill | Fill[];

export interface StrokeThickness {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface Stroke {
  thickness?: number | StrokeThickness;
  fill?: Fills;
  align?: 'inside' | 'center' | 'outside';
  dashPattern?: number[];
  cap?: 'none' | 'round' | 'square';
  join?: 'miter' | 'bevel' | 'round';
}

export interface BlurEffect {
  type: 'blur';
  radius?: number;
  enabled?: boolean;
}

export interface ShadowEffect {
  type: 'shadow';
  shadowType?: 'inner' | 'outer';
  offset?: { x: number; y: number };
  blur?: number;
  spread?: number;
  color?: Color;
  enabled?: boolean;
}

export type Effect = BlurEffect | ShadowEffect;
export type Effects = Effect | Effect[];

interface NodeBase extends Position {
  id: string;
  name?: string;
  rotation?: number;
  opacity?: number;
  enabled?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  /**
   * Pencil 拡張: `"absolute"` のとき、親が flex レイアウトでもこの子は
   * flex flow から外れ、自分の `x`/`y` がそのまま使われる。
   */
  layoutPosition?: 'absolute';
}

interface GraphicsBase extends NodeBase, Size {
  fill?: Fills;
  stroke?: Stroke;
  effect?: Effects;
}

export interface RectangleNode extends GraphicsBase {
  type: 'rectangle';
  cornerRadius?: number | [number, number, number, number];
}

export interface EllipseNode extends GraphicsBase {
  type: 'ellipse';
  innerRadius?: number;
  startAngle?: number;
  sweepAngle?: number;
}

export interface LineNode extends GraphicsBase {
  type: 'line';
}

export interface PolygonNode extends GraphicsBase {
  type: 'polygon';
  polygonCount?: number;
  cornerRadius?: number;
}

export interface PathNode extends GraphicsBase {
  type: 'path';
  geometry?: string;
  fillRule?: 'nonzero' | 'evenodd';
}

export interface TextNode extends GraphicsBase {
  type: 'text';
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textAlignVertical?: 'top' | 'middle' | 'bottom';
  textGrowth?: 'auto' | 'fixed-width' | 'fixed-width-height';
  underline?: boolean;
  strikethrough?: boolean;
  fontStyle?: string;
}

export interface FrameNode extends GraphicsBase {
  type: 'frame';
  children?: PenNode[];
  cornerRadius?: number | [number, number, number, number];
  clip?: boolean;
  layout?: 'none' | 'vertical' | 'horizontal';
  gap?: number;
  padding?: number | [number, number] | [number, number, number, number];
  justifyContent?: 'start' | 'center' | 'end' | 'space_between' | 'space_around';
  alignItems?: 'start' | 'center' | 'end';
}

export interface GroupNode extends NodeBase {
  type: 'group';
  children?: PenNode[];
  width?: SizeValue;
  height?: SizeValue;
  opacity?: number;
  effect?: Effects;
  /**
   * Pencil 仕様: groups default to `none` (未指定時は絶対配置)。
   * frame と同じ Layout プロパティを共有する。
   */
  layout?: 'none' | 'vertical' | 'horizontal';
  gap?: number;
  padding?: number | [number, number] | [number, number, number, number];
  justifyContent?: 'start' | 'center' | 'end' | 'space_between' | 'space_around';
  alignItems?: 'start' | 'center' | 'end';
}

export interface IconFontNode extends NodeBase, Size {
  type: 'icon_font';
  iconFontName?: string;
  iconFontFamily?: string;
  weight?: number;
  fill?: Fills;
  effect?: Effects;
}

export interface ImageNode extends GraphicsBase {
  type: 'image';
  url?: string;
  cornerRadius?: number | [number, number, number, number];
  clip?: boolean;
}

/**
 * 未対応ノード。parser は未知の `type` をこの型で通す(描画時はプレースホルダ)。
 */
export interface UnsupportedNode extends NodeBase {
  type: 'unsupported';
  originalType: string;
  width?: SizeValue;
  height?: SizeValue;
  raw: unknown;
}

export type PenNode =
  | RectangleNode
  | EllipseNode
  | LineNode
  | PolygonNode
  | PathNode
  | TextNode
  | FrameNode
  | GroupNode
  | IconFontNode
  | ImageNode
  | UnsupportedNode;

export interface PenDocument {
  version: string;
  children: PenNode[];
  /** 将来フェーズで詳細化。MVP では通すだけ。 */
  themes?: unknown;
  variables?: unknown;
  imports?: unknown;
  fonts?: unknown;
}
