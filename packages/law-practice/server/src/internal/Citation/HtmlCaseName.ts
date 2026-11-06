/** HTML case-name helpers adapted from eyecite 2.7.6 helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCaseNameProcessPatch } from "./CaseNameProcess.ts";
import { CitationHtmlTagGeometryInput, makeCitationHtmlTagGeometry } from "./HtmlTagGeometry.ts";
import { copyCitationMetadataPatternConfiguration, makeCitationMetadataStage } from "./MetadataComposition.ts";
import { citationMetadataWhitespaceBoundary, trimCitationMetadataBoundary } from "./MetadataStrings.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonPointAt } from "./PythonUnicode.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import {
  CitationStopWordsConfiguration,
  cleanCitationStopWords,
  copyCitationStopWordsConfiguration,
} from "./StopWords.ts";
import { CitationTokenContextInput } from "./TokenContext.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationHtmlEmphasis } from "./HtmlTagGeometry.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlCaseName");
const max = CitationEngineAbsoluteMaxima;
const Patterns = S.Struct({ splitV: CitationPythonUnicodeStorage });
const fingerprints = { splitV: "eb660449c0ac2be2a7f2979cc97ee6601af149ed21be2f69fcee0e4b1e2bae89" };
/** @internal @category models @since 0.0.0 */
export class CitationHtmlCaseNameConfiguration extends S.Opaque<
  CitationHtmlCaseNameConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patterns: Patterns,
    bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(1, 1)),
    cleaner: CitationStopWordsConfiguration,
  }).pipe(
    $I.annoteSchema("CitationHtmlCaseNameConfiguration", {
      description: "Fixed HTML versus split and existing native stop-word cleanup, captured at installation.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlCaseNameInput extends S.Opaque<CitationHtmlCaseNameInput, { readonly brand: unique symbol }>()(
  S.Struct({
    words: S.Array(
      S.Struct({
        kind: CitationTokenContextInput.fields.words.value.fields.kind,
        data: CitationPythonUnicodeStorage,
        start: S.NullOr(S.Int),
        stopWord: S.NullOr(CitationPythonUnicodeStorage),
      })
    ).check(S.isMaxLength(max.tokens)),
    index: S.Int,
    spanStart: S.Natural.check(S.isLessThanOrEqualTo(max.sourceUtf16)),
    short: S.Boolean,
    geometry: CitationHtmlTagGeometryInput,
  }).pipe(
    $I.annoteSchema("CitationHtmlCaseNameInput", {
      description: "Built-in native token text, original locations and prepared HTML geometry; no executable input.",
    })
  )
) {}
/** None preserves an existing field; Some(empty) is an actual assignment.
 * @internal @category models @since 0.0.0
 */
export class CitationHtmlCaseNamePatch extends S.Opaque<CitationHtmlCaseNamePatch, { readonly brand: unique symbol }>()(
  S.Struct({
    plaintiff: CitationCaseNameProcessPatch.fields.plaintiff,
    defendant: CitationCaseNameProcessPatch.fields.defendant,
    antecedentGuess: CitationCaseNameProcessPatch.fields.antecedentGuess,
    fullSpanStart: CitationCaseNameProcessPatch.fields.fullSpanStart,
  }).pipe(
    $I.annoteSchema("CitationHtmlCaseNamePatch", {
      description: "Only original HTML helper assignments, before verified mention projection.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationHtmlCaseNameResult extends S.Opaque<
  CitationHtmlCaseNameResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({ patch: CitationHtmlCaseNamePatch, reservedUnits: S.Natural }).pipe(
    $I.annoteSchema("CitationHtmlCaseNameResult", {
      description: "Atomic HTML name patch and cumulative invocation text reservations.",
    })
  )
) {}
/** @internal @category errors @since 0.0.0 */
export class CitationHtmlCaseNameFailure extends S.TaggedError<
  CitationHtmlCaseNameFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlCaseNameFailure`)(
  "CitationHtmlCaseNameFailure",
  {
    reason: S.Literals([
      "invalid-configuration",
      "invalid-input",
      "invalid-index",
      "missing-location",
      "invalid-match",
    ]),
  },
  $I.annoteError<CitationHtmlCaseNameFailure>("CitationHtmlCaseNameFailure", {
    description: "Closed HTML name failure without text, tags, partial metadata or nested causes.",
  })
) {}
const fail = (reason: CitationHtmlCaseNameFailure["reason"]) => CitationHtmlCaseNameFailure.make({ reason });
const unchanged = CitationHtmlCaseNamePatch.make({
  plaintiff: O.none(),
  defendant: O.none(),
  antecedentGuess: O.none(),
  fullSpanStart: O.none(),
});
const bound = (index: number, length: number) => Num.max(0, Num.min(length, index < 0 ? length + index : index));
const commaSpace = (point: number) => point === 44 || point === 32;
const versus = (source: CitationPythonUnicodeStorage) =>
  source.bytes.length === source.width && citationPythonPointAt(source, 0) === 118;
const run = Effect.fn("Citation.extractHtmlCaseName")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationHtmlCaseNameConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(S.toType(CitationHtmlCaseNameInput))(raw).pipe(
    Effect.mapError(() => fail("invalid-input"))
  );
  if (request.words.length > limits.tokens)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
  if (request.index < 0 || request.index >= request.words.length) return yield* fail("invalid-index");
  const input = yield* makeCitationRegexInput(limits);
  const words = yield* Effect.forEach(
    request.words,
    Effect.fnUntraced(function* (word) {
      const prepared = yield* input.prepareUnicode(word.data, () => Effect.void);
      const stopWord =
        word.stopWord === null ? null : (yield* input.prepareUnicode(word.stopWord, () => Effect.void)).value.storage;
      return { ...word, stopWord, prepared };
    })
  );
  const geometry = yield* makeCitationHtmlTagGeometry(limits, request.geometry);
  const clean = (text: CitationPythonUnicodeStorage) => cleanCitationStopWords(limits, runtime, config.cleaner, text);
  const length = (first: number, last: number) => {
    const start = bound(first, words.length);
    const end = bound(last, words.length);
    return A.reduce(
      A.take(A.drop(words, start), Num.max(0, end - start)),
      0,
      (sum, word) => sum + word.prepared.value.pythonLength
    );
  };
  const location = (index: number) =>
    Effect.fromOption(O.fromNullOr(A.getUnsafe(words, index).start), () => fail("missing-location"));
  const trim = Effect.fn("Citation.trimHtmlName")(function* (
    source: CitationPythonUnicodeStorage,
    predicate: (point: number) => boolean
  ) {
    const prepared = yield* input.prepareUnicode(source, () => Effect.void);
    const first = yield* trimCitationMetadataBoundary(prepared.value, 0, prepared.value.pythonLength, 1, predicate);
    const last =
      1 +
      (yield* trimCitationMetadataBoundary(prepared.value, prepared.value.pythonLength - 1, first - 1, -1, predicate));
    return yield* prepared.slice({ start: first, end: last }, () => Effect.void);
  });
  const overlap = Effect.fn("Citation.trimOverlappingHtmlName")(function* (
    source: CitationPythonUnicodeStorage,
    end: number
  ) {
    if (end <= request.spanStart) return source;
    const prepared = yield* input.prepareUnicode(source, () => Effect.void);
    return yield* prepared.slice(
      { start: 0, end: bound(request.spanStart - end, prepared.value.pythonLength) },
      () => Effect.void
    );
  });
  const skip = Effect.fn("Citation.skipHtmlNameWord")(function* (index: number) {
    const word = A.getUnsafe(words, index).prepared;
    const first = yield* trimCitationMetadataBoundary(word.value, 0, word.value.pythonLength, 1, commaSpace);
    return first === word.value.pythonLength;
  });
  const short = Effect.fn("Citation.extractShortHtmlName")(function* (index: number) {
    const start = yield* location(request.index);
    const tags = yield* geometry.find(start - length(index, request.index));
    if (tags.length === 0) return unchanged;
    const projected = yield* geometry.convert(tags);
    const text = yield* overlap(projected.text, projected.end);
    const cleaned = yield* clean(text);
    return CitationHtmlCaseNamePatch.make({
      ...unchanged,
      antecedentGuess: O.some(cleaned),
      fullSpanStart: O.some(projected.start),
    });
  });
  const parties = Effect.fn("Citation.assignHtmlParties")(function* (
    plaintiff: CitationPythonUnicodeStorage,
    defendant: CitationPythonUnicodeStorage,
    start: number
  ) {
    const cleanedPlaintiff = yield* clean(plaintiff);
    const plainLength = plaintiff.bytes.length / plaintiff.width;
    const cleanedLength = cleanedPlaintiff.bytes.length / cleanedPlaintiff.width;
    const stripped = yield* trim(cleanedPlaintiff, citationMetadataWhitespaceBoundary);
    const commas = yield* trim(stripped, (point) => point === 44);
    const finalPlaintiff = yield* trim(commas, (point) => point === 40);
    const cleanedDefendant = yield* clean(defendant);
    const defendantSpace = yield* trim(cleanedDefendant, citationMetadataWhitespaceBoundary);
    const finalDefendant = yield* trim(defendantSpace, (point) => point === 44);
    return CitationHtmlCaseNamePatch.make({
      ...unchanged,
      plaintiff: O.some(finalPlaintiff),
      defendant: O.some(finalDefendant),
      fullSpanStart: O.some(start + plainLength - cleanedLength),
    });
  });
  const single = Effect.fn("Citation.extractSingleElementHtmlName")(function* (
    tags: ReadonlyArray<CitationHtmlEmphasis>
  ) {
    const projected = yield* geometry.convert(tags);
    const worker = yield* makeCitationRegexWorker(limits, runtime, config.bindings, "python-regex-v0");
    const evaluated = yield* worker.evaluate(config.patterns.splitV, projected.text, 2, 1, "search");
    if (evaluated.result.matches === 0)
      return yield* parties(
        CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(0) }),
        projected.text,
        projected.start
      );
    const capture = yield* evaluated.result.capture(0, 0);
    if (capture._tag === "Unmatched") return yield* fail("invalid-match");
    const plaintiff = yield* evaluated.source.slice({ start: 0, end: capture.start }, () => Effect.void);
    const defendant = yield* evaluated.source.slice(
      { start: capture.end, end: evaluated.source.value.pythonLength },
      () => Effect.void
    );
    return yield* parties(plaintiff, defendant, projected.start);
  });
  const fromVersus = Effect.fn("Citation.extractHtmlVersusParties")(function* (index: number) {
    const start = yield* location(index);
    const left = yield* geometry.find(start - length(index - 2, index));
    const right = yield* geometry.find(start + length(index, index + 2));
    if (left.length !== 1 || right.length !== 1) return unchanged;
    // A unique lookup of the same original interval returns the same tuple.
    if (
      A.getUnsafe(left, 0).start === A.getUnsafe(right, 0).start &&
      A.getUnsafe(left, 0).end === A.getUnsafe(right, 0).end
    )
      return yield* single(left);
    const plaintiff = yield* geometry.convert(left);
    const defendant = yield* geometry.convert(right);
    return yield* parties(plaintiff.text, defendant.text, plaintiff.start);
  });
  const afterStop = Effect.fn("Citation.extractHtmlDefendantAfterStop")(function* (index: number) {
    let shift = 3;
    while (index + shift < words.length) {
      const word = A.getUnsafe(words, index + shift);
      if (word.kind !== "Text" || word.prepared.value.pythonLength !== 1 || citationPythonPointAt(word.data, 0) !== 32)
        break;
      shift++;
      yield* Effect.yieldNow;
    }
    const start = yield* location(index);
    const tags = yield* geometry.find(start + length(index, index + shift) - 1);
    if (tags.length !== 1) return unchanged;
    const projected = yield* geometry.convert(tags);
    const text = yield* overlap(projected.text, projected.end);
    const cleaned = yield* clean(text);
    const defendant = yield* trim(cleaned, commaSpace);
    return CitationHtmlCaseNamePatch.make({
      ...unchanged,
      defendant: O.some(defendant),
      fullSpanStart: O.some(projected.start),
    });
  });
  const visit = Effect.fn("Citation.visitHtmlCaseNameWord")(function* (index: number) {
    if (yield* skip(index)) return O.none<CitationHtmlCaseNamePatch>();
    if (request.short) return yield* short(index).pipe(Effect.asSome);
    const word = A.getUnsafe(words, index);
    if (word.kind !== "StopWordToken") return O.none<CitationHtmlCaseNamePatch>();
    const selected = word.stopWord !== null && versus(word.stopWord) ? fromVersus(index) : afterStop(index);
    return yield* selected.pipe(Effect.asSome);
  });
  for (let index = request.index - 1; index >= Num.max(request.index - 28, 0); index--) {
    yield* Effect.yieldNow;
    const selected = yield* visit(index);
    if (O.isSome(selected)) return selected.value;
  }
  return unchanged;
});
const own = Effect.fn("Citation.ownHtmlCaseNameConfiguration")(function* (
  limits: CitationEngineLimits,
  config: CitationHtmlCaseNameConfiguration
) {
  const patterns = yield* copyCitationMetadataPatternConfiguration(
    limits,
    Patterns,
    config.patterns,
    config.bindings,
    fingerprints,
    () => fail("invalid-configuration")
  );
  const cleaner = yield* copyCitationStopWordsConfiguration(limits, config.cleaner);
  return CitationHtmlCaseNameConfiguration.make({ ...patterns, cleaner });
});
/** Captured operation, Scope, text authority and workers; extract requires R=never.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationHtmlCaseName = makeCitationMetadataStage({
  method: "extract",
  schema: S.toType(CitationHtmlCaseNameConfiguration),
  invalid: () => fail("invalid-configuration"),
  own,
  prepare: run,
  project: (patch, reservedUnits) => CitationHtmlCaseNameResult.make({ patch, reservedUnits }),
});
