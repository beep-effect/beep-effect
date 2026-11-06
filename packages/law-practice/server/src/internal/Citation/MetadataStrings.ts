/** Native clean_pin_cite and process_parenthetical from eyecite helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeCitationContextMatcher } from "./ContextMatcher.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/MetadataStrings");
const Reason = LiteralKit(["invalid-policy"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed metadata helper installation failure." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationMetadataStringsFailure extends S.TaggedError<
  CitationMetadataStringsFailure,
  { readonly brand: unique symbol }
>($I`CitationMetadataStringsFailure`)(
  "CitationMetadataStringsFailure",
  { reason: Reason },
  $I.annoteError<CitationMetadataStringsFailure>("CitationMetadataStringsFailure", {
    description: "Invalid metadata string policy without source payload.",
  })
) {}
const exhausted = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" });
const parenDelta = (point: number) =>
  Match.value(point).pipe(
    Match.when(40, () => 1),
    Match.when(41, () => -1),
    Match.orElse(() => 0)
  );
const closingParen = Effect.fn("Citation.findUnbalancedParentheticalEnd")(function* (
  source: CitationPythonUnicodeValue
) {
  let balance = 0;
  for (let index = 0; index < source.pythonLength; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    balance += parenDelta(citationPythonPointAt(source.storage, index));
    if (balance < 0) return O.some(index);
  }
  return O.none<number>();
});
const spaces = HashSet.fromIterable(citationPythonTextData.whitespace);
const pinBoundary = (point: number) => point === 44 || point === 32;
/** Frozen Python whitespace membership for native source points.
 * @internal @category predicates @since 0.0.0
 */
export const citationMetadataWhitespaceBoundary = (point: number) => HashSet.has(spaces, String.fromCodePoint(point));
/** Visit a native boundary without projecting surrogate words or allocating text.
 * @internal @category operations @since 0.0.0
 */
export const trimCitationMetadataBoundary = Effect.fn("Citation.trimMetadataBoundary")(function* (
  source: CitationPythonUnicodeValue,
  start: number,
  stop: number,
  direction: number,
  strip: (point: number) => boolean
) {
  let index = start;
  while (index !== stop) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    const point = citationPythonPointAt(source.storage, index);
    if (!strip(point)) break;
    index += direction;
  }
  return index;
});
const installStrings = Effect.fn("Citation.installMetadataStrings")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, () =>
    CitationMetadataStringsFailure.make({ reason: "invalid-policy" })
  );
  const timing = yield* makeCitationRegexTiming(limits, true);
  const input = yield* makeCitationRegexInput(limits, "source");
  return { limits, timing, input };
});
/** Cleaned pin and the original source length after right-only comma/space trim.
 * @internal @category models @since 0.0.0
 */
export class CitationPinCiteDetails extends S.Opaque<CitationPinCiteDetails, { readonly brand: unique symbol }>()(
  S.Struct({ pinCite: S.NullOr(CitationPythonUnicodeStorage), trailingEnd: S.Natural }).pipe(
    $I.annoteSchema("CitationPinCiteDetails", {
      description: "Shared native pin cleanup and source rstrip length without a second receiving copy.",
    })
  )
) {}
/** Capture the shared native pincite boundary cleaner without a year matcher.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPinCiteCleaner = Effect.fn("Citation.makePinCiteCleaner")(function* (policy: unknown) {
  const { limits, timing, input } = yield* installStrings(policy);
  const inspectPinCite = Effect.fn("Citation.inspectPinCite")(function* (raw: unknown) {
    if (raw === null) return CitationPinCiteDetails.make({ pinCite: null, trailingEnd: 0 });
    const source = yield* input.prepareUnicode(raw, () => Effect.void);
    const start = yield* trimCitationMetadataBoundary(source.value, 0, source.value.pythonLength, 1, pinBoundary);
    const last = yield* trimCitationMetadataBoundary(
      source.value,
      source.value.pythonLength - 1,
      start - 1,
      -1,
      pinBoundary
    );
    const pinCite = yield* source.slice({ start, end: last + 1 }, (layout) =>
      source.value.utf16Units + layout.utf16Units > limits.producedTextUtf16 ? Effect.fail(exhausted()) : Effect.void
    );
    return CitationPinCiteDetails.make({ pinCite, trailingEnd: start === source.value.pythonLength ? 0 : last + 1 });
  }, timing.timed);
  const cleanPinCite = Effect.fn("Citation.cleanPinCite")((raw: unknown) =>
    inspectPinCite(raw).pipe(Effect.map((value) => value.pinCite))
  );
  const stripWhitespace = Effect.fn("Citation.stripMetadataWhitespace")(function* (raw: unknown) {
    if (raw === null) return null;
    const source = yield* input.prepareUnicode(raw, () => Effect.void);
    const start = yield* trimCitationMetadataBoundary(
      source.value,
      0,
      source.value.pythonLength,
      1,
      citationMetadataWhitespaceBoundary
    );
    const last = yield* trimCitationMetadataBoundary(
      source.value,
      source.value.pythonLength - 1,
      start - 1,
      -1,
      citationMetadataWhitespaceBoundary
    );
    if (start === source.value.pythonLength) return null;
    return yield* source.slice({ start, end: last + 1 }, (layout) =>
      source.value.utf16Units + layout.utf16Units > limits.producedTextUtf16 ? Effect.fail(exhausted()) : Effect.void
    );
  }, timing.timed);
  return { cleanPinCite, inspectPinCite, stripWhitespace };
});
/** Capture the independently source-bound YEAR_REGEX and existing worker.
 * Raw requests contain only native text/null. Calls have R = never and preserve
 * the source's early closing-parenthesis return before year-prefix filtering.
 * Trusted pattern installation still belongs to the final engine Layer.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationMetadataStrings = Effect.fn("Citation.makeMetadataStrings")(function* (
  policy: unknown,
  runtime: unknown,
  yearPattern: unknown,
  bindings: unknown
) {
  const { limits, timing, input } = yield* installStrings(policy);
  const year = yield* makeCitationContextMatcher(limits, runtime, yearPattern, 64, bindings);
  const { cleanPinCite, inspectPinCite, stripWhitespace } = yield* makeCitationPinCiteCleaner(limits);
  const parenthetical = Effect.fn("Citation.processParenthetical")(function* (raw: unknown) {
    if (raw === null) return null;
    const source = yield* input.prepareUnicode(raw, () => Effect.void);
    const end = yield* closingParen(source.value);
    if (O.isSome(end)) {
      if (end.value === 0) return null;
      return yield* source.slice({ start: 0, end: end.value }, (layout) =>
        source.value.utf16Units + layout.utf16Units > limits.producedTextUtf16 ? Effect.fail(exhausted()) : Effect.void
      );
    }
    // Existing owned input plus matcher's prefix/context/worker copies.
    if (4 * source.value.utf16Units > limits.producedTextUtf16) return yield* exhausted();
    const matched = yield* year.search({
      words: [],
      prefix: source.value.storage,
      startIndex: 0,
      forward: true,
      stringsOnly: true,
    });
    return matched.match !== null || source.value.pythonLength === 0 ? null : source.value.storage;
  }, timing.timed);
  return { cleanPinCite, inspectPinCite, stripWhitespace, parenthetical, snapshot: year.snapshot };
});
