/**
 * .pen ファイルのランタイム検証スキーマ(zod)。
 *
 * 方針:
 * - `passthrough()` で未知プロパティを握りつぶし、仕様の揺れに耐える
 * - 型は `types.ts` 側で厳格に定義し、zod は最小限のチェックに徹する
 * - 判別子 `type` ベースのノード union
 * - 未知の `type` は parser 側で UnsupportedNode に変換するため、ここでは
 *   既知 type のみを厳密に検証する
 */

import { z } from 'zod';

const zSize = z.union([z.number(), z.string()]).optional();

/** CSS color のみ許可。url() / javascript: 等の注入を防止 */
const zColor = z.string().refine(
  (s) => !/^\s*url\s*\(/i.test(s) && !/^\s*javascript:/i.test(s),
  { message: 'Invalid color value' },
);

const zSolidFill = z
  .object({
    type: z.literal('color'),
    color: zColor,
    enabled: z.boolean().optional(),
    opacity: z.number().optional(),
  })
  .passthrough();

const zGradientStop = z
  .object({
    color: zColor,
    position: z.number(),
  })
  .passthrough();

const zGradientFill = z
  .object({
    type: z.literal('gradient'),
    gradientType: z.enum(['linear', 'radial', 'angular']).optional(),
    colors: z.array(zGradientStop).optional(),
    rotation: z.number().optional(),
    center: z.object({ x: z.number().optional(), y: z.number().optional() }).optional(),
    size: z.object({ width: z.number().optional(), height: z.number().optional() }).optional(),
    opacity: z.number().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

const zImageFill = z
  .object({
    type: z.literal('image'),
    url: z.string(),
    mode: z.enum(['stretch', 'fill', 'fit']).optional(),
    opacity: z.number().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

/** ショートハンド(単一色文字列)または構造化 fill */
const zSingleFill = z.union([zColor, zSolidFill, zGradientFill, zImageFill]);
const zFills = z.union([zSingleFill, z.array(zSingleFill)]);

const zStroke = z
  .object({
    thickness: z
      .union([
        z.number(),
        z
          .object({
            top: z.number().optional(),
            right: z.number().optional(),
            bottom: z.number().optional(),
            left: z.number().optional(),
          })
          .passthrough(),
      ])
      .optional(),
    fill: zFills.optional(),
    align: z.enum(['inside', 'center', 'outside']).optional(),
    dashPattern: z.array(z.number()).optional(),
    cap: z.enum(['none', 'round', 'square']).optional(),
    join: z.enum(['miter', 'bevel', 'round']).optional(),
  })
  .passthrough();

const zBlurEffect = z
  .object({
    type: z.literal('blur'),
    radius: z.number().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

const zShadowEffect = z
  .object({
    type: z.literal('shadow'),
    shadowType: z.enum(['inner', 'outer']).optional(),
    offset: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .optional(),
    blur: z.number().optional(),
    spread: z.number().optional(),
    color: zColor.optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

const zEffect = z.discriminatedUnion('type', [zBlurEffect, zShadowEffect]);
const zEffects = z.union([zEffect, z.array(zEffect)]);

const nodeBase = {
  id: z.string(),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.number().optional(),
  opacity: z.number().optional(),
  enabled: z.boolean().optional(),
  flipX: z.boolean().optional(),
  flipY: z.boolean().optional(),
};

const graphicsBase = {
  ...nodeBase,
  width: zSize,
  height: zSize,
  fill: zFills.optional(),
  stroke: zStroke.optional(),
  effect: zEffects.optional(),
};

const zRectangle = z
  .object({
    type: z.literal('rectangle'),
    ...graphicsBase,
    cornerRadius: z
      .union([z.number(), z.tuple([z.number(), z.number(), z.number(), z.number()])])
      .optional(),
  })
  .passthrough();

const zEllipse = z
  .object({
    type: z.literal('ellipse'),
    ...graphicsBase,
    innerRadius: z.number().optional(),
    startAngle: z.number().optional(),
    sweepAngle: z.number().optional(),
  })
  .passthrough();

const zLine = z.object({ type: z.literal('line'), ...graphicsBase }).passthrough();

const zPolygon = z
  .object({
    type: z.literal('polygon'),
    ...graphicsBase,
    polygonCount: z.number().optional(),
    cornerRadius: z.number().optional(),
  })
  .passthrough();

const zPath = z
  .object({
    type: z.literal('path'),
    ...graphicsBase,
    geometry: z.string().optional(),
    fillRule: z.enum(['nonzero', 'evenodd']).optional(),
  })
  .passthrough();

const zText = z
  .object({
    type: z.literal('text'),
    ...graphicsBase,
    content: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.string().optional(),
    letterSpacing: z.number().optional(),
    lineHeight: z.number().optional(),
    textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
    textAlignVertical: z.enum(['top', 'middle', 'bottom']).optional(),
    textGrowth: z.enum(['auto', 'fixed-width', 'fixed-width-height']).optional(),
    underline: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
    fontStyle: z.string().optional(),
  })
  .passthrough();

const zIconFont = z
  .object({
    type: z.literal('icon_font'),
    ...nodeBase,
    width: zSize,
    height: zSize,
    iconFontName: z.string().optional(),
    iconFontFamily: z.string().optional(),
    weight: z.number().optional(),
    fill: zFills.optional(),
    effect: zEffects.optional(),
  })
  .passthrough();

// Frame と Group は自己参照するので lazy
export const zPenNode: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    zRectangle,
    zEllipse,
    zLine,
    zPolygon,
    zPath,
    zText,
    zIconFont,
    zFrame,
    zGroup,
    // 未知ノードはここで落とさず、parser 側で UnsupportedNode に変換する
    z
      .object({ type: z.string(), id: z.string() })
      .passthrough(),
  ]),
);

const zFrame: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      type: z.literal('frame'),
      ...graphicsBase,
      children: z.array(zPenNode).optional(),
      cornerRadius: z
        .union([z.number(), z.tuple([z.number(), z.number(), z.number(), z.number()])])
        .optional(),
      clip: z.boolean().optional(),
      layout: z.enum(['none', 'vertical', 'horizontal']).optional(),
      gap: z.number().optional(),
      padding: z
        .union([
          z.number(),
          z.tuple([z.number(), z.number()]),
          z.tuple([z.number(), z.number(), z.number(), z.number()]),
        ])
        .optional(),
      justifyContent: z
        .enum(['start', 'center', 'end', 'space_between', 'space_around'])
        .optional(),
      alignItems: z.enum(['start', 'center', 'end']).optional(),
    })
    .passthrough(),
);

const zGroup: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      type: z.literal('group'),
      ...nodeBase,
      width: zSize,
      height: zSize,
      children: z.array(zPenNode).optional(),
      effect: zEffects.optional(),
    })
    .passthrough(),
);

export const zPenDocument = z
  .object({
    version: z.string(),
    children: z.array(zPenNode),
    themes: z.unknown().optional(),
    variables: z.unknown().optional(),
    imports: z.unknown().optional(),
    fonts: z.unknown().optional(),
  })
  .passthrough();
