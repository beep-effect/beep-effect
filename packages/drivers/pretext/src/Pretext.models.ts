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
import { A, O, pipe, R, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PretextSnapshotCodecError } from "./Pretext.errors.js";

const $I = $PretextId.create("Pretext.models");

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
export const EngineProfile = S.Struct({
  lineFitEpsilon: S.Finite,
  carryCJKAfterClosingQuote: S.Boolean,
  breakKeepAllAfterPunctuation: S.Boolean,
  preferPrefixWidthsForBreakableRuns: S.Boolean,
  preferEarlySoftHyphenBreak: S.Boolean,
}).pipe(
  $I.annoteSchema("EngineProfile", {
    description: "Per-engine layout quirk fences mirroring upstream pretext's EngineProfile.",
  })
);

/**
 * Type for {@link EngineProfile}.
 *
 * @example
 * ```ts
 * import { EngineProfile } from "@beep/pretext"
 *
 * const profile: EngineProfile = {
 *   lineFitEpsilon: 0.005,
 *   carryCJKAfterClosingQuote: true,
 *   breakKeepAllAfterPunctuation: true,
 *   preferPrefixWidthsForBreakableRuns: false,
 *   preferEarlySoftHyphenBreak: false
 * }
 *
 * console.log(profile.carryCJKAfterClosingQuote)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EngineProfile = typeof EngineProfile.Type;

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
export const FontMetrics = S.Struct({
  capturedAt: S.String,
  engine: S.String,
  platform: S.String,
  font: S.String,
  lineHeight: S.Finite,
  spaceWidth: S.Finite,
  words: S.Record(S.String, S.Finite),
  engineProfile: EngineProfile,
  sentence: S.OptionFromOptionalKey(S.String),
  oracle: S.OptionFromOptionalKey(S.String),
  domLineCounts: S.OptionFromOptionalKey(S.Record(S.String, S.Finite)),
}).pipe(
  $I.annoteSchema("FontMetrics", {
    description: "A single engine's font measurement capture: word widths, space advance, line height, engine profile.",
  })
);

/**
 * Type for {@link FontMetrics}.
 *
 * @example
 * ```ts
 * import type { FontMetrics } from "@beep/pretext"
 *
 * const lineHeightOf = (metrics: FontMetrics): number => metrics.lineHeight
 *
 * console.log(lineHeightOf.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type FontMetrics = typeof FontMetrics.Type;

/**
 * The versioned font-metrics snapshot envelope. The explicit version tag
 * means every future migration starts from a known format; unversioned input
 * fails decode with a typed error.
 *
 * @example
 * ```ts
 * import { FontMetricsSnapshotV1 } from "@beep/pretext"
 * import * as S from "effect/Schema"
 *
 * const guard = S.is(FontMetricsSnapshotV1)
 *
 * console.log(guard({ version: 2 }))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const FontMetricsSnapshotV1 = S.Struct({
  version: S.tag(1),
  metrics: FontMetrics,
}).pipe(
  $I.annoteSchema("FontMetricsSnapshotV1", {
    description: "Versioned font-metrics snapshot envelope: version tag plus a single engine's capture.",
  })
);

/**
 * Type for {@link FontMetricsSnapshotV1}.
 *
 * @example
 * ```ts
 * import type { FontMetricsSnapshotV1 } from "@beep/pretext"
 *
 * const versionOf = (snapshot: FontMetricsSnapshotV1): number => snapshot.version
 *
 * console.log(versionOf.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type FontMetricsSnapshotV1 = typeof FontMetricsSnapshotV1.Type;

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
 * Decode an unknown value into a {@link FontMetricsSnapshotV1}, failing with
 * a typed {@link PretextSnapshotCodecError} on contract mismatch.
 *
 * @example
 * ```ts
 * import { decodeFontMetricsSnapshot } from "@beep/pretext"
 * import * as Effect from "effect/Effect"
 *
 * const program = decodeFontMetricsSnapshot({ version: 1 }).pipe(
 *   Effect.catch((error) => Effect.succeed(error.operation))
 * )
 *
 * console.log(Effect.runSync(program))
 * ```
 *
 * @since 0.0.0
 * @category codecs
 */
export const decodeFontMetricsSnapshot = (
  input: unknown
): Effect.Effect<FontMetricsSnapshotV1, PretextSnapshotCodecError> =>
  S.decodeUnknownEffect(FontMetricsSnapshotV1)(input).pipe(
    Effect.mapError((error) =>
      PretextSnapshotCodecError.make({
        operation: "decode",
        message: error.message,
      })
    )
  );

/**
 * Encode a {@link FontMetricsSnapshotV1} to its wire form, failing with a
 * typed {@link PretextSnapshotCodecError} on contract mismatch.
 *
 * @example
 * ```ts
 * import { decodeFontMetricsSnapshot, encodeFontMetricsSnapshot } from "@beep/pretext"
 * import * as Effect from "effect/Effect"
 *
 * const roundTrip = decodeFontMetricsSnapshot({ version: 1 }).pipe(
 *   Effect.flatMap(encodeFontMetricsSnapshot),
 *   Effect.catch((error) => Effect.succeed(error.operation))
 * )
 *
 * console.log(Effect.runSync(roundTrip))
 * ```
 *
 * @since 0.0.0
 * @category codecs
 */
export const encodeFontMetricsSnapshot = (
  value: FontMetricsSnapshotV1
): Effect.Effect<FontMetricsSnapshotV1Encoded, PretextSnapshotCodecError> =>
  S.encodeEffect(FontMetricsSnapshotV1)(value).pipe(
    Effect.mapError((error) =>
      PretextSnapshotCodecError.make({
        operation: "encode",
        message: error.message,
      })
    )
  );

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
 * import { naturalWidth } from "@beep/pretext"
 * import type { FontMetrics } from "@beep/pretext"
 * import * as O from "effect/Option"
 *
 * declare const metrics: FontMetrics
 *
 * const width = naturalWidth(metrics, "the the")
 *
 * console.log(O.isOption(width))
 * ```
 *
 * @since 0.0.0
 * @category layout
 */
export const naturalWidth = (metrics: FontMetrics, text: string): O.Option<number> =>
  O.map(wordWidths(metrics, text), (widths) =>
    A.reduce(widths, 0, (total, width, index) => (index === 0 ? width : total + metrics.spaceWidth + width))
  );

/**
 * Greedy first-fit line count for `text` at `maxWidth`, computed purely from
 * snapshot word widths. Returns `None` when any word is missing from the
 * snapshot. Greedy semantics only — no justification claims.
 *
 * @example
 * ```ts
 * import { lineCount } from "@beep/pretext"
 * import type { FontMetrics } from "@beep/pretext"
 * import * as O from "effect/Option"
 *
 * declare const metrics: FontMetrics
 *
 * const lines = lineCount(metrics, "the the", 320)
 *
 * console.log(O.isOption(lines))
 * ```
 *
 * @since 0.0.0
 * @category layout
 */
export const lineCount = (metrics: FontMetrics, text: string, maxWidth: number): O.Option<number> =>
  O.map(
    wordWidths(metrics, text),
    (widths) =>
      A.reduce(widths, { lines: 0, width: 0 }, (state, wordWidth) => {
        if (state.lines === 0) {
          return { lines: 1, width: wordWidth };
        }
        const needed = state.width + metrics.spaceWidth + wordWidth;
        return needed > maxWidth ? { lines: state.lines + 1, width: wordWidth } : { lines: state.lines, width: needed };
      }).lines
  );

/**
 * Greedy first-fit text height for `text` at `maxWidth`: line count times
 * the snapshot's line height. Returns `None` when any word is missing from
 * the snapshot.
 *
 * @example
 * ```ts
 * import { textHeight } from "@beep/pretext"
 * import type { FontMetrics } from "@beep/pretext"
 * import * as O from "effect/Option"
 *
 * declare const metrics: FontMetrics
 *
 * const height = textHeight(metrics, "the the", 320)
 *
 * console.log(O.isOption(height))
 * ```
 *
 * @since 0.0.0
 * @category layout
 */
export const textHeight = (metrics: FontMetrics, text: string, maxWidth: number): O.Option<number> =>
  pipe(
    lineCount(metrics, text, maxWidth),
    O.map((lines) => lines * metrics.lineHeight)
  );
