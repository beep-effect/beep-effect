/** Literal-space text-token boundaries from eyecite 2.7.6 tokenizers.py.
 * BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationPythonUnicodeFailure, makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";

const $I = $LawPracticeServerId.create("internal/Citation/TokenText");
const Span = S.Tuple([S.Natural, S.Natural]).pipe(
  $I.annoteSchema("Span", { description: "Half-open plain-text token boundary in native Python source points." })
);
/** @internal @category models @since 0.0.0 */
export class CitationTokenTextPlan extends S.Opaque<CitationTokenTextPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    source: CitationPythonUnicodeStorage,
    spans: S.Array(Span).check(S.isMaxLength(CitationEngineAbsoluteMaxima.tokens)),
  }).pipe(
    $I.annoteSchema("CitationTokenTextPlan", {
      description: "Owned native source snapshot and literal-space token spans; no verified citation evidence.",
    })
  )
) {}
const Range = S.Struct({ start: S.Natural, end: S.Natural }).pipe(
  $I.annoteSchema("Range", { description: "Forward gap bounds in the prepared native source." })
);
const invalid = () => CitationPythonUnicodeFailure.make({ reason: "invalid-input" });
const exhausted = (limit: "sourceUtf16" | "tokens") =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });

const preflightTokens = Effect.fn("Citation.preflightTextTokens")(function* (
  pointAt: (index: number) => number,
  start: number,
  end: number,
  maximum: number
) {
  let count = 0;
  let inWord = false;
  for (let offset = start; offset < end; offset++) {
    if (offset % 4096 === 0) yield* Effect.yieldNow;
    if (pointAt(offset) === 32) {
      count++;
      inWord = false;
    } else if (!inWord) {
      count++;
      inWord = true;
    }
    if (count > maximum) return yield* exhausted("tokens");
  }
  return count;
});
const collectSpans = Effect.fn("Citation.collectTextTokenSpans")(function* (
  pointAt: (index: number) => number,
  from: number,
  end: number
) {
  const spans = MutableList.make<typeof Span.Type>();
  let start = from;
  for (let index = from; index < end; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    if (pointAt(index) !== 32) continue;
    if (start < index) MutableList.append(spans, [start, index]);
    MutableList.append(spans, [index, index + 1]);
    start = index + 1;
  }
  if (start < end) MutableList.append(spans, [start, end]);
  return MutableList.takeAll(spans);
});

/** Plan append_text without projecting native surrogate words into token strings.
 * The preflight counts every output slot before allocating the result list.
 * Each prepared source owns a cumulative text-token budget across its gaps.
 * The caller retains whole-operation produced-text and mixed-output ownership.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenText = Effect.fn("Citation.makeTokenText")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalid);
  const unicode = yield* makeCitationPythonUnicode(limits);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const prepare = Effect.fn("Citation.prepareTokenTextSource")(function* (input: unknown) {
    const value = yield* unicode.fromStorage(input);
    if (value.utf16Units > limits.sourceUtf16) return yield* exhausted("sourceUtf16");
    const { bytes, width } = value.storage;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pointAt = (index: number) =>
      width === 1
        ? view.getUint8(index)
        : width === 2
          ? view.getUint16(index * width, true)
          : view.getUint32(index * width, true);
    const mutex = yield* Semaphore.make(1);
    let remaining = limits.tokens;
    const range = Effect.fn("Citation.planNativeTextGap")(function* (input: unknown) {
      const { start, end } = yield* S.decodeUnknownEffect(Range)(input).pipe(Effect.mapError(invalid));
      if (start > end || end > value.pythonLength) return yield* invalid();
      const count = yield* preflightTokens(pointAt, start, end, remaining);
      const spans = yield* collectSpans(pointAt, start, end);
      remaining -= count;
      return spans;
    });
    return {
      length: value.pythonLength,
      range: Effect.fn("Citation.serialNativeTextGap")((input: unknown) =>
        timing.timed(mutex.withPermit(range(input)))
      ),
      snapshot: Effect.sync(() => CitationPythonUnicodeStorage.make({ width, bytes: Bytes.concat([bytes]) })),
    };
  }, timing.timed);
  const plan = Effect.fn("Citation.planTokenText")(function* (input: unknown) {
    const prepared = yield* prepare(input);
    const spans = yield* prepared.range({ start: 0, end: prepared.length });
    return CitationTokenTextPlan.make({ source: yield* prepared.snapshot, spans });
  }, timing.timed);
  return { plan, prepare };
});
