/** Native match_on_tokens context assembly from eyecite 2.7.6 helpers.py.
 * BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constVoid } from "effect/Function";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { concatCitationPythonRanges, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenContext");
const Kind = LiteralKit(["Text", ...CitationTokenSeed.fields.kind.literals]);
const Word = S.Struct({ kind: Kind, data: S.NullOr(CitationPythonUnicodeStorage) }).check(
  S.makeFilter((word) => word.kind !== "Text" || word.data !== null)
);
/** Owned source words and explicit context scan mode; no executable request fields.
 * @internal @category models @since 0.0.0
 */
export class CitationTokenContextInput extends S.Opaque<CitationTokenContextInput, { readonly brand: unique symbol }>()(
  S.Struct({
    words: S.Array(Word).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
    prefix: CitationPythonUnicodeStorage,
    startIndex: S.Int,
    stringsOnly: S.Boolean,
    forward: S.Boolean,
  }).pipe($I.annoteSchema("CitationTokenContextInput", { description: "Built-in token context preparation profile." }))
) {}
const Anchor = LiteralKit(["start", "end"]).pipe(
  $I.annoteSchema("Anchor", { description: "Forward start or backward end anchoring for the subsequent regex call." })
);
/** @internal @category models @since 0.0.0 */
export class CitationTokenContextPlan extends S.Opaque<CitationTokenContextPlan, { readonly brand: unique symbol }>()(
  S.Struct({ source: CitationPythonUnicodeStorage, anchor: Anchor }).pipe(
    $I.annoteSchema("CitationTokenContextPlan", { description: "Owned canonical native context and source anchoring." })
  )
) {}
const Reason = LiteralKit(["invalid-input", "index-out-of-range"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed source context preparation failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationTokenContextFailure extends S.TaggedError<
  CitationTokenContextFailure,
  { readonly brand: unique symbol }
>($I`CitationTokenContextFailure`)(
  "CitationTokenContextFailure",
  { reason: Reason },
  $I.annoteError<CitationTokenContextFailure>("CitationTokenContextFailure", {
    description: "Context preparation failed without retaining input text or nested causes.",
  })
) {}
const invalid = () => CitationTokenContextFailure.make({ reason: "invalid-input" });
const indexError = () => CitationTokenContextFailure.make({ reason: "index-out-of-range" });
const exhausted = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" });
const maxChars = 300;
const Input = S.toType(CitationTokenContextInput);
type Range = { readonly source: CitationPythonUnicodeStorage; readonly start: number; readonly end: number };
const length = (range: Range) => range.end - range.start;
const trimRanges = (ranges: ReadonlyArray<Range>, forward: boolean): ReadonlyArray<Range> => {
  let remaining = maxChars;
  const ordered = forward ? ranges : A.reverse(ranges);
  const selected = A.map(ordered, (range) => {
    const count = Num.min(remaining, length(range));
    remaining -= count;
    return forward ? { ...range, end: range.start + count } : { ...range, start: range.end - count };
  });
  return forward ? selected : A.reverse(selected);
};

const isStop = (kind: typeof Kind.Type, stringsOnly: boolean) =>
  kind === "ParagraphToken" || (stringsOnly && kind !== "Text");
const selectContextRanges = Effect.fn("Citation.selectContextRanges")(function* (
  request: CitationTokenContextInput,
  words: ReadonlyArray<Range & { readonly kind: typeof Kind.Type }>,
  prefix: Range
) {
  let ranges: ReadonlyArray<Range> = [prefix];
  let count = length(prefix);
  let index = request.forward ? Num.min(request.startIndex, words.length) : Num.max(request.startIndex, -1);
  const step = request.forward ? 1 : -1;
  let finished = false;
  const advance = Effect.fn("Citation.advanceContextScan")(function* () {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const position = index < 0 ? words.length + index : index;
    const word = yield* Effect.fromOption(A.get(words, position), indexError);
    if (isStop(word.kind, request.stringsOnly)) {
      finished = true;
      return;
    }
    ranges = request.forward ? A.append(ranges, word) : A.prepend(ranges, word);
    count += length(word);
    if (count >= maxChars) {
      ranges = trimRanges(ranges, request.forward);
      finished = true;
    }
    index += step;
  });
  yield* Effect.whileLoop({
    while: () => !finished && (request.forward ? index < words.length : index >= 0),
    body: advance,
    step: constVoid,
  });
  return ranges;
});

/** Prepare source context text and anchoring before the third-party regex call.
 * Methods capture policy and Clock, have R = never, and return no partial text.
 * This built-in word profile does not implement regex matching or custom str protocols.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenContext = Effect.fn("Citation.makeTokenContext")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalid);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const unicode = yield* makeCitationPythonUnicode(limits);
  const plan = Effect.fn("Citation.planTokenContext")(function* (input: unknown) {
    const request = yield* S.decodeUnknownEffect(Input)(input).pipe(Effect.mapError(invalid));
    if (request.words.length > limits.tokens)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
    const prefix = yield* unicode.fromStorage(request.prefix);
    let retained = prefix.utf16Units;
    const words = yield* Effect.forEach(
      request.words,
      Effect.fn("Citation.ownContextWord")(function* (word) {
        const value = yield* word.data === null ? unicode.fromText("None") : unicode.fromStorage(word.data);
        retained += value.utf16Units;
        if (retained > limits.producedTextUtf16) return yield* exhausted();
        return { kind: word.kind, source: value.storage, start: 0, end: value.pythonLength };
      })
    );
    const ranges = yield* selectContextRanges(request, words, {
      source: prefix.storage,
      start: 0,
      end: prefix.pythonLength,
    });
    const source = yield* concatCitationPythonRanges(ranges, (layout) =>
      retained + layout.utf16Units > limits.producedTextUtf16 ? Effect.fail(exhausted()) : Effect.void
    );
    return CitationTokenContextPlan.make({ source, anchor: request.forward ? Anchor.Enum.start : Anchor.Enum.end });
  }, timing.timed);
  return { plan };
});
