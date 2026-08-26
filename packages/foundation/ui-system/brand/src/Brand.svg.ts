/**
 * Encodes the brand mark as SVG documents and React-ready transform strings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import * as O from "effect/Option";
import type {
  BrandMark,
  MarkGround,
  MarkPaint,
  MarkSvgRequest,
  PixelGlasses,
  WordmarkSvgRequest,
} from "./Brand.schema.ts";

const WORDMARK_HEIGHT = 24;
const WORDMARK_TEXT_X = 30;
const WORDMARK_GLYPH_WIDTH = 11;

const round = (value: number): number => Number(value.toFixed(4));

/**
 * SVG transform placing the pixel glasses on the mark grid.
 *
 * **Example** (Read the glasses transform)
 *
 * ```ts
 * import { beep, glassesTransform } from "@beep/brand"
 *
 * console.log(glassesTransform(beep.mark.glasses))
 * ```
 *
 * @param glasses - Glasses placement and geometry.
 * @returns A `translate(...) scale(...) rotate(...)` transform list.
 * @category rendering
 * @since 0.0.0
 */
export const glassesTransform = (glasses: PixelGlasses): string =>
  `translate(${glasses.translate.x}, ${glasses.translate.y}) scale(${glasses.scale}) rotate(${glasses.rotation.degrees} ${glasses.rotation.origin.x} ${glasses.rotation.origin.y})`;

const strokePath =
  (mark: BrandMark, paint: MarkPaint) =>
  (d: string): string =>
    `<path d="${d}" stroke="${paint.stroke}" stroke-width="${mark.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;

const fillPath =
  (fill: string) =>
  (d: string): string =>
    `<path fill="${fill}" d="${d}"/>`;

const glassesGroup = (mark: BrandMark, paint: MarkPaint): string =>
  pipe(
    [
      `<g transform="${glassesTransform(mark.glasses)}">`,
      fillPath(paint.frame)(mark.glasses.frame),
      ...A.map(mark.glasses.lenses, fillPath(paint.lens)),
      "</g>",
    ],
    A.join("")
  );

const markBody = (mark: BrandMark, paint: MarkPaint): string =>
  pipe([...A.map(mark.strokes, strokePath(mark, paint)), glassesGroup(mark, paint)], A.join(""));

const scaledMark = (mark: BrandMark, paint: MarkPaint, size: number): string =>
  `<g transform="scale(${round(size / mark.viewBox)})">${markBody(mark, paint)}</g>`;

const groundRect =
  (size: number) =>
  (ground: MarkGround): string =>
    `<rect width="${size}" height="${size}" rx="${ground.radius}" fill="${ground.fill}"/>`;

const svgOpen = (width: number, height: number, label: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none" role="img" aria-label="${label}">`;

/**
 * Render the mark as a standalone SVG document.
 *
 * **Details**
 *
 * The mark is scaled from its own view box to `request.size`, so the same geometry
 * produces the 24-unit inline mark and the 32-unit favicon. When `ground` is present
 * a rounded rectangle is drawn first.
 *
 * **Example** (Render the favicon)
 *
 * ```ts
 * import { beep, MarkGround, MarkPaint, MarkSvgRequest, renderMarkSvg } from "@beep/brand"
 * import * as O from "effect/Option"
 *
 * const svg = renderMarkSvg(
 *   MarkSvgRequest.make({
 *     mark: beep.mark,
 *     size: 32,
 *     paint: MarkPaint.make({ stroke: beep.dark.brand["400"], frame: beep.dark.foreground.base, lens: beep.dark.brand["900"] }),
 *     ground: O.some(MarkGround.make({ fill: beep.dark.brand["900"], radius: 6 })),
 *   })
 * )
 * console.log(svg.startsWith("<svg"))
 * ```
 *
 * @param request - Mark, output size, paint, and optional ground.
 * @returns The SVG document text, ending with a newline.
 * @category rendering
 * @since 0.0.0
 */
export const renderMarkSvg = (request: MarkSvgRequest): string =>
  pipe(
    [
      svgOpen(request.size, request.size, request.mark.name),
      O.getOrElse(O.map(request.ground, groundRect(request.size)), () => ""),
      scaledMark(request.mark, request.paint, request.size),
      "</svg>",
    ],
    A.join(""),
    Str.concat("\n")
  );

const wordmarkText = (request: WordmarkSvgRequest): string =>
  `<text x="${WORDMARK_TEXT_X}" y="17.5" font-family="${Str.replaceAll('"', "'")(`${request.identity.typography.sans.family}, ${A.join(", ")(request.identity.typography.sans.fallbacks)}`)}" font-size="18" font-weight="700" letter-spacing="-0.02em" fill="${request.textFill}">${request.identity.name}</text>`;

/**
 * Render the mark beside the brand name as a horizontal wordmark SVG.
 *
 * **Example** (Render the wordmark for dark surfaces)
 *
 * ```ts
 * import { beep, MarkPaint, renderWordmarkSvg, WordmarkSvgRequest } from "@beep/brand"
 *
 * const svg = renderWordmarkSvg(
 *   WordmarkSvgRequest.make({
 *     identity: beep,
 *     paint: MarkPaint.make({ stroke: beep.dark.brand["400"], frame: beep.dark.foreground.base, lens: beep.dark.surface["0"] }),
 *     textFill: beep.dark.foreground.base,
 *   })
 * )
 * console.log(svg.includes(">beep<"))
 * ```
 *
 * @param request - Identity, mark paint, and text fill.
 * @returns The SVG document text, ending with a newline.
 * @category rendering
 * @since 0.0.0
 */
export const renderWordmarkSvg = (request: WordmarkSvgRequest): string =>
  pipe(
    [
      svgOpen(
        WORDMARK_TEXT_X + WORDMARK_GLYPH_WIDTH * Str.length(request.identity.name),
        WORDMARK_HEIGHT,
        request.identity.name
      ),
      scaledMark(request.identity.mark, request.paint, WORDMARK_HEIGHT),
      wordmarkText(request),
      "</svg>",
    ],
    A.join(""),
    Str.concat("\n")
  );
