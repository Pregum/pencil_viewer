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

/**
 * Pencil 仕様の blend mode 名。docs.pencil.dev 準拠の CamelCase。
 * CSS mix-blend-mode へのマップは blendModeToCss で行う。
 * LinearBurn / LinearDodge / Light は CSS に直接対応が無く近似値にマップ。
 *
 * 互換のため snake_case / lower の旧値も型で許容する（コードは全変種を扱う）。
 */
export type BlendMode =
  | 'Normal'
  | 'Darken' | 'Multiply' | 'LinearBurn' | 'ColorBurn'
  | 'Light' | 'Screen' | 'LinearDodge' | 'ColorDodge'
  | 'Overlay' | 'SoftLight' | 'HardLight'
  | 'Difference' | 'Exclusion'
  | 'Hue' | 'Saturation' | 'Color' | 'Luminosity'
  // 互換（旧形式）
  | 'normal' | 'darken' | 'multiply' | 'linear_burn' | 'color_burn'
  | 'light' | 'screen' | 'linear_dodge' | 'color_dodge'
  | 'overlay' | 'soft_light' | 'hard_light'
  | 'difference' | 'exclusion'
  | 'hue' | 'saturation' | 'color' | 'luminosity';

export interface SolidFill {
  type: 'color';
  color: Color;
  enabled?: boolean;
  opacity?: number;
  blendMode?: BlendMode;
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
  blendMode?: BlendMode;
}

export interface ImageFill {
  type: 'image';
  url: string;
  mode?: 'stretch' | 'fill' | 'fit';
  opacity?: number;
  enabled?: boolean;
  blendMode?: BlendMode;
}

/**
 * Mesh gradient: Pencil 仕様の bezier 補間メッシュ。
 * SVG には直接対応が無いため、viewer では縦横 2 本の linear gradient の
 * オーバーレイで「何となく似ている」近似を描く。
 */
export interface MeshGradientFill {
  type: 'mesh_gradient';
  columns?: number;
  rows?: number;
  /** 行メジャー順 (row-major) の頂点カラー。columns * rows 個を想定。*/
  colors?: Color[];
  opacity?: number;
  enabled?: boolean;
  blendMode?: BlendMode;
}

/** Fill は単一色 (string) / 構造体 / 配列いずれも取り得る */
export type Fill = Color | SolidFill | GradientFill | ImageFill | MeshGradientFill;
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
  blendMode?: BlendMode;
}

export type Effect = BlurEffect | ShadowEffect;
export type Effects = Effect | Effect[];

/**
 * Frame リサイズ時の子ノード挙動（Figma の Constraints 相当）。
 * 親が layout='none' のときのみ有効。
 * - 'left' / 'top': 親の左上に固定（デフォルト）
 * - 'right' / 'bottom': 親の右下に固定（幅/高さは保持、位置を追従）
 * - 'center': 親の中心に固定
 * - 'stretch': 親の両端に相対距離を保って伸縮
 * - 'scale': 親に対する比率を保ってスケール
 */
export type HorizontalConstraint = 'left' | 'right' | 'center' | 'stretch' | 'scale';
export type VerticalConstraint = 'top' | 'bottom' | 'center' | 'stretch' | 'scale';

export interface NodeConstraints {
  horizontal?: HorizontalConstraint;
  vertical?: VerticalConstraint;
}

interface NodeBase extends Position {
  id: string;
  name?: string;
  rotation?: number;
  opacity?: number;
  enabled?: boolean;
  flipX?: boolean;
  flipY?: boolean;
  /**
   * エディタ拡張: true のとき、UI から選択・ドラッグ不可（表示はされる）。
   * Pencil format には無いが passthrough で保持される。
   */
  locked?: boolean;
  /** Frame Constraints（親リサイズ時の挙動）。editor 拡張、passthrough 保存 */
  constraints?: NodeConstraints;
  /**
   * Component Variants: reusable=true なノードが同じ `variantOf` 文字列を
   * 共有するとき、同じコンポーネントセットのバリアントとして扱う。
   * ref ノードは選択するバリアントを ref フィールドで指定し、UI から
   * 同じグループの他バリアントへ切替できる。
   */
  variantOf?: string;
  /** バリアント識別用の props (ex: { size: 'large', state: 'default' })。表示用 */
  variantProps?: Record<string, string>;
  /**
   * Masking: true のとき、このノードの shape で同階層の後続兄弟を alpha クリップする。
   * Figma の "Use as mask" と同等。
   */
  mask?: boolean;
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

/**
 * Figma の Layout Grid 相当。Frame 内に視覚ガイドとして半透明で描画される。
 * - columns: 縦のカラム群
 * - rows:    横のロー群
 * - grid:    同間隔の格子
 */
export interface LayoutGrid {
  pattern: 'columns' | 'rows' | 'grid';
  /** columns/rows: カラム/ロー数 */
  count?: number;
  /** grid: 1 セルのサイズ (px) */
  size?: number;
  /** カラム/ロー間のスペース */
  gutter?: number;
  /** 両端の余白 (alignment='min' のとき先頭, 'max' のとき末尾) */
  offset?: number;
  /** カラム/ロー幅 (alignment='min'/'max'/'center' で有効) */
  sectionSize?: number;
  alignment?: 'min' | 'max' | 'center' | 'stretch';
  color?: Color;
  opacity?: number;
  visible?: boolean;
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
  layoutGrids?: LayoutGrid[];
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
 * コンポーネント参照(インスタンス)。ref → 別ノード ID を参照し、
 * descendants でサブツリーのプロパティを上書きする。
 */
export interface RefNode extends NodeBase {
  type: 'ref';
  ref: string;
  width?: SizeValue;
  height?: SizeValue;
  descendants?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * ノード間を結ぶコネクション線。
 */
export interface ConnectionNode extends NodeBase {
  type: 'connection';
  width?: SizeValue;
  height?: SizeValue;
  source?: { path: string; anchor?: string };
  target?: { path: string; anchor?: string };
  stroke?: Stroke;
}

/**
 * 付箋メモ。開発者向けのアノテーション。
 */
export interface NoteNode extends NodeBase {
  type: 'note';
  content?: string;
  width?: SizeValue;
  height?: SizeValue;
  fontFamily?: string;
  fontSize?: number;
  fill?: Fills;
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
  | RefNode
  | ConnectionNode
  | NoteNode
  | UnsupportedNode;

/**
 * Figma の Styles 相当。Variables とは別の概念で、名前付きの
 * プロパティセット（Color / Text / Effect）を保存しノードから参照する。
 * editor 拡張 — .pen 仕様外だが passthrough で保存される。
 */
export interface ColorStyle {
  id: string;
  type: 'color';
  name: string;
  value: Color;
}
export interface TextStyle {
  id: string;
  type: 'text';
  name: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fill?: Color;
}
export interface EffectStyle {
  id: string;
  type: 'effect';
  name: string;
  effects: Effects;
}
export type NamedStyle = ColorStyle | TextStyle | EffectStyle;

export interface PenDocument {
  version: string;
  children: PenNode[];
  /** 将来フェーズで詳細化。MVP では通すだけ。 */
  themes?: unknown;
  variables?: unknown;
  imports?: unknown;
  fonts?: unknown;
  /** 名前付きスタイル (Figma Styles)。editor 拡張 */
  styles?: NamedStyle[];
  /** Comment mode で付けたピン + コメント。editor 拡張 */
  comments?: DocComment[];
}

export interface DocComment {
  id: string;
  /** SVG 座標系でのピン位置 */
  x: number;
  y: number;
  /** 本文（複数行可） */
  text: string;
  /** 作成時刻 ISO */
  createdAt: string;
  /** 解決済みマーク */
  resolved?: boolean;
}
