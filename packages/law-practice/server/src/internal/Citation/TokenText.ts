/** Literal-space text-token boundaries from eyecite 2.7.6 tokenizers.py.
 * BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as S from "effect/Schema";
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
const invalid = () => CitationPythonUnicodeFailure.make({ reason: "invalid-input" });
const exhausted = (limit: "sourceUtf16" | "tokens") =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });

const preflightTokens = Effect.fn("Citation.preflightTextTokens")(function* (
  pointAt: (index: number) => number,
  length: number,
  maximum: number
) {
  let count = 0;
  let inWord = false;
  for (let offset = 0; offset < length; offset++) {
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
});
const collectSpans = Effect.fn("Citation.collectTextTokenSpans")(function* (
  pointAt: (index: number) => number,
  length: number
) {
  const spans = MutableList.make<typeof Span.Type>();
  let start = 0;
  for (let index = 0; index < length; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    if (pointAt(index) !== 32) continue;
    if (start < index) MutableList.append(spans, [start, index]);
    MutableList.append(spans, [index, index + 1]);
    start = index + 1;
  }
  if (start < length) MutableList.append(spans, [start, length]);
  return MutableList.takeAll(spans);
});

/** Plan append_text without projecting native surrogate words into token strings.
 * The preflight counts every output slot before allocating the result list.
 * The caller owns aggregate operation token/text reservations across gaps.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTokenText = Effect.fn("Citation.makeTokenText")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalid);
  const unicode = yield* makeCitationPythonUnicode(limits);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const plan = Effect.fn("Citation.planTokenText")(function* (input: unknown) {
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
    yield* preflightTokens(pointAt, value.pythonLength, limits.tokens);
    const spans = yield* collectSpans(pointAt, value.pythonLength);
    return CitationTokenTextPlan.make({ source: value.storage, spans });
  }, timing.timed);
  return { plan };
});
