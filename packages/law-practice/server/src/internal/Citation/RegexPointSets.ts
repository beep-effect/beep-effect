/** Bounded Python-point predicates for the reviewed regex compiler.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { citationPythonRegexData } from "./PythonRegexData.ts";
import { CitationRegexAtomInterval } from "./RegexAlphabet.ts";
import { CitationRegexEngine } from "./RegexEngine.ts";
import { CitationRegexTranslationFailure } from "./RegexTranslator.ts";
import { citationRegexV0Data } from "./RegexV0Data.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexPointSets");
const AsciiFolds = S.Natural.check(S.isLessThanOrEqualTo(0x10ffff))
  .pipe(S.Array)
  .check(S.isBetweenLength(1, 3))
  .pipe(S.Array)
  .check(S.isBetweenLength(128, 128));
const AsciiFoldsJson = S.fromJsonString(AsciiFolds).pipe(
  $I.annoteSchema("AsciiFoldsJson", {
    description: "Lossless encoded source observation rows, not inferred case-fold equivalence.",
  })
);

/** @internal @category models @since 0.0.0 */
export class CitationRegexPointRange extends S.Opaque<CitationRegexPointRange, { readonly brand: unique symbol }>()(
  S.Struct({ start: CitationRegexAtomInterval.fields.start, end: CitationRegexAtomInterval.fields.end })
    .check(
      S.makeFilter(
        (value) => value.start <= value.end,
        $I.annote("RangeOrder", { description: "Inclusive nonempty Python point interval." })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexPointRange", {
        description: "A source character predicate interval, including surrogate points.",
      })
    )
) {}
const range = (start: number, end = start) => CitationRegexPointRange.make({ start, end });
const unsupported = () => CitationRegexTranslationFailure.make({ reason: "unsupported-syntax" });
const byStart = Order.mapInput(Order.Number, (value: CitationRegexPointRange) => value.start);
/** @internal @category operations @since 0.0.0 */
export const normalizeCitationRegexRanges = (input: ReadonlyArray<CitationRegexPointRange>) => {
  const output = A.empty<CitationRegexPointRange>();
  for (const item of A.sort(input, byStart)) {
    const previous = A.last(output);
    if (O.isSome(previous) && item.start <= previous.value.end + 1)
      output[A.length(output) - 1] = range(previous.value.start, Num.max(previous.value.end, item.end));
    else output.push(item);
  }
  return output;
};
/** @internal @category operations @since 0.0.0 */
export const complementCitationRegexRanges = (input: ReadonlyArray<CitationRegexPointRange>) => {
  const output = A.empty<CitationRegexPointRange>();
  let start = 0;
  for (const item of normalizeCitationRegexRanges(input)) {
    if (start < item.start) output.push(range(start, item.start - 1));
    start = item.end + 1;
  }
  if (start <= 0x10ffff) output.push(range(start, 0x10ffff));
  return output;
};
/** @internal @category utilities @since 0.0.0 */
export const citationRegexHexDigit = (point: number): number =>
  point < 0 || point > 127
    ? -1
    : O.getOrElse(Str.indexOf(Str.toLowerCase(String.fromCharCode(point)))("0123456789abcdef"), () => -1);
const shiftedLetters = (start: number, end: number, first: number, last: number, shift: number) =>
  start > last || end < first ? [] : [range(Num.max(start, first) + shift, Num.min(end, last) + shift)];
const caseExtras = (start: number, end: number) => {
  const contains = (upper: number, lower: number) =>
    (start <= upper && end >= upper) || (start <= lower && end >= lower);
  const output = A.empty<CitationRegexPointRange>();
  if (contains(73, 105)) output.push(range(0x130, 0x131));
  if (contains(83, 115)) output.push(range(0x17f));
  if (contains(75, 107)) output.push(range(0x212a));
  return output;
};
const reviewedNonAscii = Effect.fnUntraced(function* (start: number, end: number) {
  if (start >= 0x2013 && end <= 0x2014) return [range(start, end)];
  return yield* unsupported();
});
const frozenRanges = Effect.fn("Citation.readFrozenRegexClass")(function* (text: string) {
  let index = 0;
  const point = () => O.getOrElse(Str.codePointAt(text, index), () => -1);
  const read = Effect.fnUntraced(function* () {
    let value = point();
    index += value > 0xffff ? 2 : 1;
    if (value === 92) {
      if (point() !== 120) return yield* unsupported();
      index++;
      const first = citationRegexHexDigit(point());
      index++;
      const second = citationRegexHexDigit(point());
      index++;
      if (first < 0 || second < 0) return yield* unsupported();
      value = first * 16 + second;
    }
    if (value < 0) return yield* unsupported();
    return value;
  });
  const output = A.empty<CitationRegexPointRange>();
  while (index < Str.length(text)) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const start = yield* read();
    let end = start;
    if (point() === 45) {
      index++;
      end = yield* read();
    }
    if (end < start) return yield* unsupported();
    output.push(range(start, end));
  }
  return normalizeCitationRegexRanges(output);
});
/** Freeze source-engine categories once. CPython retains its qualified ASCII
 * folding; regex V0 uses captured literal tables and all 8,256 range controls.
 * Other non-ASCII case-bearing literals remain unsupported, not folded using
 * the host's Unicode version.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexPointSets = Effect.fn("Citation.makeRegexPointSets")(function* (
  engineInput: unknown = "python-re"
) {
  const engine = yield* S.decodeUnknownEffect(CitationRegexEngine)(engineInput).pipe(Effect.mapError(unsupported));
  const data = CitationRegexEngine.match(engine, {
    "python-re": () => citationPythonRegexData,
    "python-regex-v0": () => citationRegexV0Data,
  });
  const folds =
    engine === "python-regex-v0"
      ? yield* S.decodeEffect(AsciiFoldsJson)(citationRegexV0Data.asciiIgnoreCaseJson).pipe(
          Effect.mapError(unsupported)
        )
      : [];
  const digit = yield* frozenRanges(data.digitClass);
  const space = yield* frozenRanges(data.spaceClass);
  const word = yield* frozenRanges(data.wordClass);
  const verboseSpace =
    engine === "python-re" ? [range(9, 13), range(32)] : yield* frozenRanges(citationRegexV0Data.verboseSpaceClass);
  const literal = Effect.fn("Citation.regexLiteralSet")(function* (start: number, end: number, insensitive: boolean) {
    if (start > end || start < 0 || end > 0x10ffff) return yield* unsupported();
    if (!insensitive) return [range(start, end)];
    if (end > 127) return yield* reviewedNonAscii(start, end);
    if (engine === "python-regex-v0")
      return normalizeCitationRegexRanges(
        A.flatMap(A.range(start, end), (point) => A.map(A.getUnsafe(folds, point), (value) => range(value)))
      );
    const output = [
      range(start, end),
      ...shiftedLetters(start, end, 65, 90, 32),
      ...shiftedLetters(start, end, 97, 122, -32),
      ...caseExtras(start, end),
    ];
    return normalizeCitationRegexRanges(output);
  });
  return { engine, digit, space, word, verboseSpace, literal };
});
