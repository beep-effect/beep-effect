/**
 * Font-metrics snapshot contracts and pure layout helpers.
 *
 * The browser-safe pure surface of the driver: a `FontMetricsSnapshotV1` is
 * captured once in an actual engine (impure, `@beep/pretext/browser`) and
 * decoded anywhere; everything downstream of decode is pure arithmetic. The
 * snapshot is a per-engine value by design — never a cross-machine
 * determinism claim.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PretextId } from "@beep/identity/packages";
import { isNonNegative } from "@beep/schema/Number";
import { A, O, pipe, R, Str } from "@beep/utils";
import { Effect, Result } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { PretextSnapshotCodecError } from "./Pretext.errors.ts";

const $I = $PretextId.create("Pretext.models");

const NonNegativeAdvance = S.Finite.check(isNonNegative);
const NonNegativeLineCount = S.Int.check(isNonNegative);

/**
 * Per-engine layout quirk fences, mirroring upstream pretext's
 * `EngineProfile` (v0.0.8, `src/measurement.ts`). Captured with the metrics
 * so pure replays of engine behavior stay honest about which engine they
 * reproduce.
 *
 * @example
 * ```ts
 * import { EngineProfile } from "@beep/pretext"
 * import * as S from "effect/Schema"
 *
 * const profile = S.decodeUnknownSync(EngineProfile)({
 *   lineFitEpsilon: 0.005,
 *   carryCJKAfterClosingQuote: true,
 *   breakKeepAllAfterPunctuation: true,
 *   preferPrefixWidthsForBreakableRuns: false,
 *   preferEarlySoftHyphenBreak: false
 * })
 *
 * console.log(profile.lineFitEpsilon)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class EngineProfile extends S.Class<EngineProfile>($I`EngineProfile`)(
  {
    lineFitEpsilon: NonNegativeAdvance,
    carryCJKAfterClosingQuote: S.Boolean,
    breakKeepAllAfterPunctuation: S.Boolean,
    preferPrefixWidthsForBreakableRuns: S.Boolean,
    preferEarlySoftHyphenBreak: S.Boolean,
  },
  $I.annote("EngineProfile", {
    description: "Per-engine layout quirk fences mirroring upstream pretext's EngineProfile.",
  })
) {}

/**
 * A single engine's font measurement capture: word advance widths, the space
 * advance, the line height, and the engine profile the values were captured
 * under. `sentence`, `oracle`, and `domLineCounts` are capture provenance —
 * present on oracle-validated fixtures, absent on live captures.
 *
 * @example
 * ```ts
 * import { FontMetrics } from "@beep/pretext"
 * import * as S from "effect/Schema"
 *
 * const metrics = S.decodeUnknownSync(FontMetrics)({
 *   capturedAt: "2026-07-12",
 *   engine: "Chrome/150.0.0.0",
 *   platform: "Linux x86_64",
 *   font: "16px Arial",
 *   lineHeight: 20,
 *   spaceWidth: 4.4453125,
 *   words: { the: 22.2421875 },
 *   engineProfile: {
 *     lineFitEpsilon: 0.005,
 *     carryCJKAfterClosingQuote: true,
 *     breakKeepAllAfterPunctuation: true,
 *     preferPrefixWidthsForBreakableRuns: false,
 *     preferEarlySoftHyphenBreak: false
 *   }
 * })
 *
 * console.log(metrics.font)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class FontMetrics extends S.Class<FontMetrics>($I`FontMetrics`)(
  {
    // capturedAt is opaque provenance, not a datetime contract: live captures
    // write full ISO, curated fixtures may carry date-only stamps.
    capturedAt: S.String,
    engine: S.String,
    platform: S.String,
    font: S.String,
    lineHeight: NonNegativeAdvance,
    // spaceWidth is a kerning-derived delta (pair minus markers) and may
    // legitimately sit at or fractionally below zero; keep it unrefined.
    spaceWidth: S.Finite,
    words: S.Record(S.String, NonNegativeAdvance),
    engineProfile: EngineProfile,
    sentence: S.OptionFromOptionalKey(S.String),
    oracle: S.OptionFromOptionalKey(S.String),
    domLineCounts: S.OptionFromOptionalKey(S.Record(S.String, NonNegativeLineCount)),
  },
  $I.annote("FontMetrics", {
    description: "A single engine's font measurement capture: word widths, space advance, line height, engine profile.",
  })
) {}

/**
 * The versioned font-metrics snapshot envelope. The explicit version tag
 * means every future migration starts from a known format; unversioned input
 * fails decode with a typed error.
 *
 * Codec statics are colocated on the schema: `is`, `decodeOption`,
 * `fromUnknown` (trusted-boundary sync decode), plus the driver's typed
 * `decode`/`encode` Effects failing with {@link PretextSnapshotCodecError}.
 *
 * @example
 * ```ts
 * import { FontMetricsSnapshotV1 } from "@beep/pretext"
 *
 * console.log(FontMetricsSnapshotV1.is({ version: 2 }))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class FontMetricsSnapshotV1 extends S.Class<FontMetricsSnapshotV1>($I`FontMetricsSnapshotV1`)(
  {
    version: S.tag(1),
    metrics: FontMetrics,
  },
  $I.annote("FontMetricsSnapshotV1", {
    description: "Versioned font-metrics snapshot envelope: version tag plus a single engine's capture.",
  })
) {
  static readonly is = S.is(FontMetricsSnapshotV1);
  static readonly fromUnknown = (input: unknown): FontMetricsSnapshotV1 =>
    S.decodeUnknownResult(FontMetricsSnapshotV1)(input).pipe(
      Result.getOrThrowWith((error) => PretextSnapshotCodecError.make({ operation: "decode", message: error.message }))
    );
  static readonly decodeOption: (input: unknown) => O.Option<FontMetricsSnapshotV1> =
    S.decodeUnknownOption(FontMetricsSnapshotV1);
  static readonly decode = (input: unknown): Effect.Effect<FontMetricsSnapshotV1, PretextSnapshotCodecError> =>
    S.decodeUnknownEffect(FontMetricsSnapshotV1)(input).pipe(
      Effect.mapError((error) => PretextSnapshotCodecError.make({ operation: "decode", message: error.message }))
    );
  static readonly encode = (
    value: FontMetricsSnapshotV1
  ): Effect.Effect<typeof FontMetricsSnapshotV1.Encoded, PretextSnapshotCodecError> =>
    S.encodeEffect(FontMetricsSnapshotV1)(value).pipe(
      Effect.mapError((error) => PretextSnapshotCodecError.make({ operation: "encode", message: error.message }))
    );
}

/**
 * Encoded (wire) type for {@link FontMetricsSnapshotV1}.
 *
 * @example
 * ```ts
 * import type { FontMetricsSnapshotV1Encoded } from "@beep/pretext"
 *
 * const versionOf = (snapshot: FontMetricsSnapshotV1Encoded): number => snapshot.version
 *
 * console.log(versionOf.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type FontMetricsSnapshotV1Encoded = typeof FontMetricsSnapshotV1.Encoded;

/**
 * Text and width inputs for pure line-count and height calculations.
 *
 * @example
 * ```ts
 * import { TextLayoutInput } from "@beep/pretext"
 *
 * const input = TextLayoutInput.make({ maxWidth: 320, text: "the dragon" })
 *
 * console.log(input.maxWidth)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class TextLayoutInput extends S.Class<TextLayoutInput>($I`TextLayoutInput`)(
  {
    maxWidth: NonNegativeAdvance,
    text: S.String,
  },
  $I.annote("TextLayoutInput", {
    description: "Text and maximum width used by pure font-metrics layout calculations.",
  })
) {}

/**
 * A word-indexed line range from a greedy text layout. `startWord` is
 * inclusive, `endWord` is exclusive, and `width` is the line advance.
 *
 * @example
 * ```ts
 * import { LineRange } from "@beep/pretext"
 *
 * const range = LineRange.make({ startWord: 0, endWord: 2, width: 80 })
 *
 * console.log(range.endWord)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineRange extends S.Class<LineRange>($I`LineRange`)(
  {
    startWord: NonNegativeLineCount,
    endWord: NonNegativeLineCount,
    width: NonNegativeAdvance,
  },
  $I.annote("LineRange", {
    description: "A word-indexed half-open line range and its measured advance width.",
  })
) {}

/**
 * Aggregate geometry for a greedy text layout: total line count and widest
 * line advance.
 *
 * @example
 * ```ts
 * import { LineStats } from "@beep/pretext"
 *
 * const stats = LineStats.make({ lineCount: 2, maxLineWidth: 180 })
 *
 * console.log(stats.maxLineWidth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineStats extends S.Class<LineStats>($I`LineStats`)(
  {
    lineCount: NonNegativeLineCount,
    maxLineWidth: NonNegativeAdvance,
  },
  $I.annote("LineStats", {
    description: "Aggregate line count and maximum line width from a greedy text layout.",
  })
) {}

const wordWidths = (metrics: FontMetrics, text: string): O.Option<ReadonlyArray<number>> =>
  O.all(A.map(Str.split(text, " "), (word) => R.get(metrics.words, word)));

/**
 * The tightest width at which `text` stays on one line — the sum of its word
 * advances plus inter-word spaces. This is pretext's "shrinkwrap" width and
 * exactly the pure input a layout constraint solver needs, without asking
 * the DOM. Returns `None` when any word is missing from the snapshot.
 *
 * Word-granularity greedy semantics: trailing collapsible spaces hang at
 * line end, so a break is charged `space + word`, never a dangling space.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16, naturalWidth } from "@beep/pretext"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const metrics = Effect.runSync(chromeLinuxArial16).metrics
 *
 * const width = naturalWidth(metrics, "the the")
 *
 * console.log(O.isOption(width))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const naturalWidth: {
  (metrics: FontMetrics, text: string): O.Option<number>;
  (text: string): (metrics: FontMetrics) => O.Option<number>;
} = dual(
  2,
  (metrics: FontMetrics, text: string): O.Option<number> =>
    O.map(wordWidths(metrics, text), (widths) =>
      A.reduce(widths, 0, (total, width, index) => (index === 0 ? width : total + metrics.spaceWidth + width))
    )
);

/**
 * Greedy first-fit word ranges for `text` at `maxWidth`, computed purely from
 * snapshot word widths. Returns `None` when any word is missing from the
 * snapshot. Ranges use half-open word indices and omit trailing spaces from
 * each line width.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16, lineRanges } from "@beep/pretext"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const metrics = Effect.runSync(chromeLinuxArial16).metrics
 *
 * const ranges = lineRanges(metrics, { text: "the the", maxWidth: 40 })
 *
 * console.log(O.isOption(ranges))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lineRanges: {
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<ReadonlyArray<LineRange>>;
  (input: TextLayoutInput): (metrics: FontMetrics) => O.Option<ReadonlyArray<LineRange>>;
} = dual(
  2,
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<ReadonlyArray<LineRange>> =>
    O.map(wordWidths(metrics, input.text), (widths) => {
      const state = A.reduce(
        widths,
        { lines: 0, ranges: A.empty<LineRange>(), startWord: 0, width: 0 },
        (state, wordWidth, index) => {
          if (state.lines === 0) {
            return { ...state, lines: 1, width: wordWidth };
          }
          const needed = state.width + metrics.spaceWidth + wordWidth;
          return needed > input.maxWidth
            ? {
                lines: state.lines + 1,
                ranges: A.append(
                  state.ranges,
                  LineRange.make({ startWord: state.startWord, endWord: index, width: state.width })
                ),
                startWord: index,
                width: wordWidth,
              }
            : { ...state, width: needed };
        }
      );
      return A.append(
        state.ranges,
        LineRange.make({ startWord: state.startWord, endWord: A.length(widths), width: state.width })
      );
    })
);

/**
 * Aggregate greedy line geometry for `text` at `maxWidth`, derived from
 * {@link lineRanges}. Returns `None` when any word is missing from the
 * snapshot.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16, lineStats } from "@beep/pretext"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const metrics = Effect.runSync(chromeLinuxArial16).metrics
 *
 * const stats = lineStats(metrics, { text: "the the", maxWidth: 40 })
 *
 * console.log(O.isOption(stats))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lineStats: {
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<LineStats>;
  (input: TextLayoutInput): (metrics: FontMetrics) => O.Option<LineStats>;
} = dual(
  2,
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<LineStats> =>
    O.map(lineRanges(metrics, input), (ranges) =>
      LineStats.make({
        lineCount: A.length(ranges),
        maxLineWidth: A.reduce(ranges, 0, (maximum, range) => (range.width > maximum ? range.width : maximum)),
      })
    )
);

/**
 * Greedy first-fit line count for `text` at `maxWidth`, computed purely from
 * snapshot word widths. Returns `None` when any word is missing from the
 * snapshot. Greedy semantics only — no justification claims.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16, lineCount } from "@beep/pretext"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const metrics = Effect.runSync(chromeLinuxArial16).metrics
 *
 * const lines = lineCount(metrics, { text: "the the", maxWidth: 320 })
 *
 * console.log(O.isOption(lines))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lineCount: {
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<number>;
  (input: TextLayoutInput): (metrics: FontMetrics) => O.Option<number>;
} = dual(
  2,
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<number> =>
    O.map(
      wordWidths(metrics, input.text),
      (widths) =>
        A.reduce(widths, { lines: 0, width: 0 }, (state, wordWidth) => {
          if (state.lines === 0) {
            return { lines: 1, width: wordWidth };
          }
          const needed = state.width + metrics.spaceWidth + wordWidth;
          return needed > input.maxWidth
            ? { lines: state.lines + 1, width: wordWidth }
            : { lines: state.lines, width: needed };
        }).lines
    )
);

/**
 * Greedy first-fit text height for `text` at `maxWidth`: line count times
 * the snapshot's line height. Returns `None` when any word is missing from
 * the snapshot.
 *
 * @example
 * ```ts
 * import { chromeLinuxArial16, textHeight } from "@beep/pretext"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const metrics = Effect.runSync(chromeLinuxArial16).metrics
 *
 * const height = textHeight(metrics, { text: "the the", maxWidth: 320 })
 *
 * console.log(O.isOption(height))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const textHeight: {
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<number>;
  (input: TextLayoutInput): (metrics: FontMetrics) => O.Option<number>;
} = dual(
  2,
  (metrics: FontMetrics, input: TextLayoutInput): O.Option<number> =>
    pipe(
      lineCount(metrics, input),
      O.map((lines) => lines * metrics.lineHeight)
    )
);
