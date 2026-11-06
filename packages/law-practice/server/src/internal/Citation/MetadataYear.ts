/** Source get_year behavior from eyecite 2.7.6 helpers.py (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as BI from "effect/BigInt";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { parseCitationPythonInteger } from "./PythonInteger.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/MetadataYear");
const Reason = LiteralKit(["invalid-policy", "invalid-clock", "invalid-bound"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed installation failure without source values." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationMetadataYearFailure extends S.TaggedError<
  CitationMetadataYearFailure,
  { readonly brand: unique symbol }
>($I`CitationMetadataYearFailure`)(
  "CitationMetadataYearFailure",
  { reason: Reason },
  $I.annoteError<CitationMetadataYearFailure>("CitationMetadataYearFailure", {
    description: "Invalid captured year policy without source text.",
  })
) {}
const SourceDateYear = S.Int.check(S.isBetween({ minimum: 1, maximum: 9999 })).pipe(
  $I.annoteSchema("SourceDateYear", { description: "Python date's supported installation-year domain." })
);
const parse = Effect.fn("Citation.parseMetadataYear")(function* (source: CitationPythonUnicodeValue, highest: number) {
  const value = yield* parseCitationPythonInteger(source);
  return O.flatMap(
    O.filter(value, (year) => year >= BigInt(1600) && year <= BigInt(highest)),
    BI.toNumber
  );
});
/** Captured source calendar ceiling, not an invocation mode.
 * @internal @category models @since 0.0.0
 */
export const CitationMetadataYearBound = S.Int.check(S.isBetween({ minimum: 2, maximum: 10000 })).pipe(
  $I.annoteSchema("CitationMetadataYearBound", {
    description: "One more than a supported Python date year, captured by the installing engine.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationMetadataYearBound = typeof CitationMetadataYearBound.Type;
/** Reinstall an already captured source year ceiling under a fresh invocation
 * budget. This private configuration is server data, never a raw request mode.
 * The normal constructor captures the calendar once and delegates here.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationMetadataYearFromBound = Effect.fn("Citation.makeMetadataYearFromBound")(function* (
  policy: unknown,
  bound: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () =>
    CitationMetadataYearFailure.make({ reason: "invalid-policy" })
  );
  const highest = yield* S.decodeUnknownEffect(CitationMetadataYearBound)(bound).pipe(
    Effect.mapError(() => CitationMetadataYearFailure.make({ reason: "invalid-bound" }))
  );
  const timing = yield* makeCitationRegexTiming(limits, true);
  const input = yield* makeCitationRegexInput(limits, "source");
  const getYear = Effect.fn("Citation.getMetadataYear")(function* (raw: unknown) {
    const source = yield* input.prepareUnicode(raw, () => Effect.void);
    return yield* parse(source.value, highest);
  }, timing.timed);
  return { highestValidYear: highest, getYear };
});
/** Capture the source import-time year ceiling using Effect Clock and the
 * supplied CurrentTimeZone. Each native-input method has R = never; it retains
 * Unicode 14 integer semantics and the frozen 4300-digit conversion ceiling.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationMetadataYear = Effect.fn("Citation.makeMetadataYear")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () =>
    CitationMetadataYearFailure.make({ reason: "invalid-policy" })
  );
  const now = yield* DateTime.nowInCurrentZone;
  const currentYear = yield* S.decodeEffect(SourceDateYear)(DateTime.getPart(now, "year")).pipe(
    Effect.mapError(() => CitationMetadataYearFailure.make({ reason: "invalid-clock" }))
  );
  return yield* makeCitationMetadataYearFromBound(limits, currentYear + 1);
});
