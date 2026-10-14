/**
 * Outlined sheet labels: the glyph-data shape, the outline extraction shared
 * by the vendored-subset generator and the operator `fontFile` route, and the
 * label-alphabet metrics layout needs.
 *
 * **Details**
 *
 * Coordinates of a {@link LabelFace} are font units with y up and the
 * baseline at 0. Only the label alphabet is ever outlined: the digits, `F`,
 * `I`, `G`, `.`, `/`, and the space. The opentype.js parser is loaded with a
 * dynamic import and read through the local {@link OpenTypeFontLike} shim,
 * so the package program never loads `@types/opentype.js`, which references
 * the DOM library.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, O, P, R, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { DrawingError } from "../TechnicalDrawing.errors.ts";

const $I = $TechnicalDrawingId.create("internal/LabelOutline");

/**
 * One outline command in font units: move, line, quadratic, or close.
 *
 * @internal
 * @since 0.0.0
 */
const GlyphCommand = S.Union([
  S.Tuple([S.Literal("M"), S.Finite, S.Finite]),
  S.Tuple([S.Literal("L"), S.Finite, S.Finite]),
  S.Tuple([S.Literal("Q"), S.Finite, S.Finite, S.Finite, S.Finite]),
  S.Tuple([S.Literal("Z")]),
]).pipe(
  $I.annoteSchema("GlyphCommand", {
    description: "One TrueType outline command in font units: move, line, quadratic Bézier, or close.",
  })
);

/**
 * Type for {@link GlyphCommand}.
 *
 * @internal
 * @since 0.0.0
 */
type GlyphCommand = typeof GlyphCommand.Type;

/**
 * Ink box `[xMin, yMin, xMax, yMax]` in font units, y up.
 *
 * @internal
 * @since 0.0.0
 */
export const InkBox = S.Tuple([S.Finite, S.Finite, S.Finite, S.Finite]).pipe(
  $I.annoteSchema("InkBox", {
    description: "Ink box [xMin, yMin, xMax, yMax] of a glyph or glyph run in font units, y up.",
  })
);

/**
 * Type for {@link InkBox}.
 *
 * @internal
 * @since 0.0.0
 */
export type InkBox = typeof InkBox.Type;

/**
 * One glyph: advance width, ink box (all zero for a blank glyph), and outline.
 *
 * @internal
 * @since 0.0.0
 */
const LabelGlyph = S.Struct({
  advance: S.Finite.annotateKey({ description: "Advance width in font units." }),
  commands: S.Array(GlyphCommand).annotateKey({ description: "Outline commands; empty for a blank glyph." }),
  ink: InkBox.annotateKey({ description: "Exact ink box of the outline; all zero for a blank glyph." }),
}).pipe(
  $I.annoteSchema("LabelGlyph", {
    description: "One label glyph: advance width, ink box, and outline in font units.",
  })
);

/**
 * Type for {@link LabelGlyph}.
 *
 * @internal
 * @since 0.0.0
 */
type LabelGlyph = typeof LabelGlyph.Type;

/**
 * A label face: em size, cap height, and the label alphabet's glyphs.
 *
 * @internal
 * @since 0.0.0
 */
export class LabelFace extends S.Class<LabelFace>($I`LabelFace`)(
  {
    capHeight: S.Finite.annotateKey({ description: "Cap height in font units." }),
    glyphs: S.Record(S.String, LabelGlyph).annotateKey({ description: "Glyphs of the label alphabet by character." }),
    unitsPerEm: S.Finite.annotateKey({ description: "Font units per em." }),
  },
  $I.annote("LabelFace", {
    description: "Outlines and metrics of the sheet-label alphabet of one face, in font units, y up.",
  })
) {}

/**
 * Characters a sheet label can contain.
 *
 * @internal
 * @since 0.0.0
 */
const LABEL_ALPHABET = "0123456789FIG./ ";

/**
 * The slice of an opentype.js font this module reads.
 *
 * @internal
 * @since 0.0.0
 */
interface OpenTypeFontLike {
  readonly charToGlyph: (char: string) => {
    readonly index: number;
    readonly advanceWidth?: number | undefined;
    readonly path: { readonly commands: ReadonlyArray<Readonly<Record<string, unknown>>> };
  };
  readonly tables: { readonly os2?: { readonly sCapHeight?: number | undefined } | undefined };
  readonly unitsPerEm: number;
}

/**
 * Whether a parsed value has the {@link OpenTypeFontLike} surface.
 *
 * @internal
 * @since 0.0.0
 */
const isOpenTypeFontLike = (value: unknown): value is OpenTypeFontLike =>
  P.hasProperty(value, "unitsPerEm") &&
  P.isNumber(value.unitsPerEm) &&
  P.hasProperty(value, "charToGlyph") &&
  P.isFunction(value.charToGlyph) &&
  P.hasProperty(value, "tables") &&
  P.isObject(value.tables);

const OutlineKind = LiteralKit(["M", "L", "Q", "Z"]);

const coordinate = (command: Readonly<Record<string, unknown>>, key: string): number => {
  const value = command[key];
  return P.isNumber(value) ? value : Number.NaN;
};

const commandOf = (command: Readonly<Record<string, unknown>>): O.Option<GlyphCommand> =>
  pipe(
    O.liftPredicate(command.type, OutlineKind.is.M),
    O.orElse(() => O.liftPredicate(command.type, OutlineKind.is.L)),
    O.orElse(() => O.liftPredicate(command.type, OutlineKind.is.Q)),
    O.orElse(() => O.liftPredicate(command.type, OutlineKind.is.Z)),
    O.map(
      (kind): GlyphCommand =>
        OutlineKind.$match(kind, {
          M: () => ["M", coordinate(command, "x"), coordinate(command, "y")] as const,
          L: () => ["L", coordinate(command, "x"), coordinate(command, "y")] as const,
          Q: () =>
            [
              "Q",
              coordinate(command, "x1"),
              coordinate(command, "y1"),
              coordinate(command, "x"),
              coordinate(command, "y"),
            ] as const,
          Z: () => ["Z"] as const,
        })
    )
  );

// Extremes of a quadratic Bézier on one axis: the end points plus the interior
// stationary point, when there is one.
const quadExtremes = (p0: number, p1: number, p2: number): ReadonlyArray<number> => {
  const denominator = p0 - 2 * p1 + p2;
  const t = denominator === 0 ? -1 : (p0 - p1) / denominator;
  return t > 0 && t < 1 ? [p0, p2, (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2] : [p0, p2];
};

type Extremes = {
  readonly xs: ReadonlyArray<number>;
  readonly ys: ReadonlyArray<number>;
  readonly at: readonly [number, number];
};

/**
 * Exact ink box of outline commands: curve extrema, never control points.
 *
 * @internal
 * @since 0.0.0
 */
const inkOf = (commands: ReadonlyArray<GlyphCommand>): InkBox => {
  const { xs, ys } = A.reduce(
    commands,
    { xs: [], ys: [], at: [0, 0] } as Extremes,
    (acc, command): Extremes =>
      command[0] === "Q"
        ? {
            xs: [...acc.xs, ...quadExtremes(acc.at[0], command[1], command[3])],
            ys: [...acc.ys, ...quadExtremes(acc.at[1], command[2], command[4])],
            at: [command[3], command[4]],
          }
        : command[0] === "Z"
          ? acc
          : { xs: [...acc.xs, command[1]], ys: [...acc.ys, command[2]], at: [command[1], command[2]] }
  );
  return A.isReadonlyArrayNonEmpty(xs) && A.isReadonlyArrayNonEmpty(ys)
    ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    : [0, 0, 0, 0];
};

const glyphOf = (font: OpenTypeFontLike, char: string): Result.Result<LabelGlyph, string> => {
  const glyph = font.charToGlyph(char);
  const commands = A.map(glyph.path.commands, commandOf);
  return glyph.index === 0 && char !== " "
    ? Result.fail(`the font has no glyph for "${char}"`)
    : A.every(commands, O.isSome)
      ? Result.succeed({
          advance: glyph.advanceWidth ?? 0,
          ink: inkOf(A.getSomes(commands)),
          commands: A.getSomes(commands),
        })
      : Result.fail(`the outline of "${char}" is not TrueType (only M, L, Q, Z commands are supported)`);
};

/**
 * Outline the label alphabet of a parsed font.
 *
 * **Details**
 *
 * The cap height is the font's OS/2 `sCapHeight`, or the ink top of `F` when
 * the table has none.
 *
 * @internal
 * @since 0.0.0
 */
const faceFromFont = (font: OpenTypeFontLike): Result.Result<typeof LabelFace.Encoded, string> =>
  pipe(
    Result.all(
      A.map(A.fromIterable(LABEL_ALPHABET), (char) => Result.map(glyphOf(font, char), (g) => [char, g] as const))
    ),
    Result.map((entries) => {
      const glyphs: Readonly<Record<string, LabelGlyph>> = R.fromEntries(entries);
      const declared = font.tables.os2?.sCapHeight ?? 0;
      return {
        unitsPerEm: font.unitsPerEm,
        capHeight: declared > 0 ? declared : (glyphs.F?.ink[3] ?? font.unitsPerEm),
        glyphs,
      };
    })
  );

/**
 * Vertical ink span `[yMin, yMax]` of the whole label alphabet in font units:
 * the height every label of the face fits in, whatever its digits.
 *
 * @internal
 * @since 0.0.0
 */
export const alphabetSpan = (face: LabelFace): readonly [number, number] => {
  const inked = A.filter(R.values(face.glyphs), (g) => A.isReadonlyArrayNonEmpty(g.commands));
  return [Math.min(...A.map(inked, (g) => g.ink[1])), Math.max(...A.map(inked, (g) => g.ink[3]))];
};

// A non-literal specifier keeps the import out of the type program (the
// published typings reference the DOM library) and out of bundler graphs.
const OPENTYPE_MODULE = Str.concat("opentype", ".js");

const parserOf = (module: unknown): O.Option<(buffer: ArrayBuffer) => unknown> =>
  pipe(
    O.some(module),
    O.filter((m) => P.hasProperty(m, "parse") && P.isFunction(m.parse)),
    O.orElse(() =>
      pipe(
        O.some(module),
        O.filter(P.hasProperty("default")),
        O.map((m) => m.default),
        O.filter((m) => P.hasProperty(m, "parse") && P.isFunction(m.parse))
      )
    ),
    O.map((m) => (buffer: ArrayBuffer) => (m as { readonly parse: (b: ArrayBuffer) => unknown }).parse(buffer))
  );

/**
 * Outline the label alphabet of an operator-supplied TrueType file.
 *
 * @internal
 * @since 0.0.0
 */
export const outlineFontFile = Effect.fnUntraced(function* (fontFile: string, bytes: Uint8Array) {
  const failed = (message: string) =>
    DrawingError.make({ reason: "font", message: `Label font "${fontFile}": ${message}` });
  const module = yield* Effect.tryPromise({
    try: () => import(OPENTYPE_MODULE),
    catch: (cause) => DrawingError.fromUnknown("font", "Could not load the opentype.js font parser.", cause),
  });
  const parse = yield* O.match(parserOf(module), {
    onNone: () => failed("the opentype.js module has no parse function."),
    onSome: Effect.succeed,
  });
  const font = yield* Effect.try({
    try: () => parse(bytes.slice().buffer),
    catch: (cause) => DrawingError.fromUnknown("font", `Label font "${fontFile}" could not be parsed.`, cause),
  });
  if (!isOpenTypeFontLike(font)) {
    return yield* failed("the parser returned no font.");
  }
  const outlined = yield* Result.match(faceFromFont(font), {
    onFailure: (message) => failed(`${message}.`),
    onSuccess: Effect.succeed,
  });
  return yield* S.decodeEffect(LabelFace)(outlined).pipe(
    Effect.mapError((cause) =>
      DrawingError.fromUnknown("font", `Label font "${fontFile}" has outlines that are not finite.`, cause)
    )
  );
});
