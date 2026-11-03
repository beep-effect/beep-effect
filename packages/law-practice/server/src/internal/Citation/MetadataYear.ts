/** Source get_year behavior from eyecite 2.7.6 helpers.py (BSD-2-Clause).
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { citationPythonDecimalValues } from "./PythonDecimal.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
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
// CPython integer conversion recognizes ASCII's six parser spaces, plus
// non-ASCII Unicode whitespace. ASCII separators U+001C..001F are rejected.
const spaces = HashSet.fromIterable(
  A.filter(A.fromIterable(citationPythonTextData.whitespace), (char) => {
    const point = O.getOrElse(Str.codePointAt(char, 0), () => 0);
    return point > 127 || point === 32 || (point >= 9 && point <= 13);
  })
);
const isSpace = (point: number) => HashSet.has(spaces, String.fromCodePoint(point));
const digit = (point: number) => HashMap.get(citationPythonDecimalValues, String.fromCodePoint(point));
class DecimalState extends S.Opaque<DecimalState, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.Natural.check(S.isLessThanOrEqualTo(10001)),
    count: S.Natural.check(S.isLessThanOrEqualTo(4300)),
    previousDigit: S.Boolean,
  }).pipe(
    $I.annoteSchema("DecimalState", {
      description: "Bounded source integer scan state; saturation occurs only above every valid Python date year.",
    })
  )
) {}
const nextDigit = (state: DecimalState, point: number) => {
  const decimal = digit(point);
  if (O.isSome(decimal)) {
    return state.count === 4300
      ? O.none<DecimalState>()
      : O.some(
          DecimalState.make({
            value: Num.min(10001, state.value * 10 + decimal.value),
            count: state.count + 1,
            previousDigit: true,
          })
        );
  }
  return point === 95 && state.previousDigit
    ? O.some(DecimalState.make({ ...state, previousDigit: false }))
    : O.none<DecimalState>();
};
const trim = Effect.fn("Citation.trimIntegerSpaces")(function* (
  source: CitationPythonUnicodeValue,
  start: number,
  stop: number,
  direction: number
) {
  let index = start;
  while (index !== stop && isSpace(citationPythonPointAt(source.storage, index))) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    index += direction;
  }
  return index;
});
const scan = Effect.fn("Citation.scanYearDigits")(function* (
  source: CitationPythonUnicodeValue,
  start: number,
  end: number
) {
  let state = DecimalState.make({ value: 0, count: 0, previousDigit: false });
  for (let index = start; index < end; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const next = nextDigit(state, citationPythonPointAt(source.storage, index));
    if (O.isNone(next)) return O.none<number>();
    state = next.value;
  }
  return state.previousDigit ? O.some(state.value) : O.none<number>();
});
const parse = Effect.fn("Citation.parseMetadataYear")(function* (source: CitationPythonUnicodeValue, highest: number) {
  let start = yield* trim(source, 0, source.pythonLength, 1);
  const last = yield* trim(source, source.pythonLength - 1, start - 1, -1);
  const end = last + 1;
  if (start === end) return O.none<number>();
  const first = citationPythonPointAt(source.storage, start);
  const negative = first === 45;
  if (negative || first === 43) start++;
  const value = yield* scan(source, start, end);
  return O.filter(value, (year) => !negative && year >= 1600 && year <= highest);
});
const CapturedYearBound = S.Int.check(S.isBetween({ minimum: 2, maximum: 10000 })).pipe(
  $I.annoteSchema("CapturedYearBound", {
    description: "One more than a supported Python date year, captured by the installing engine.",
  })
);
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
  const highest = yield* S.decodeUnknownEffect(CapturedYearBound)(bound).pipe(
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
