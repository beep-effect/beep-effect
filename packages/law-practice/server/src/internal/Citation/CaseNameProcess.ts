/** _process_case_name from eyecite 2.7.6 helpers.py, BSD-2-Clause.
 * Free Law Project; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  copyCitationMetadataPatternConfiguration,
  makeCitationMetadataStage,
  substituteCitationMetadataMatches,
} from "./MetadataComposition.ts";
import { trimCitationMetadataBoundary } from "./MetadataStrings.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { parseCitationPythonInteger } from "./PythonInteger.ts";
import { CitationRegexPatternDescriptor } from "./RegexDescriptors.ts";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import {
  CitationStopWordsConfiguration,
  cleanCitationStopWords,
  copyCitationStopWordsConfiguration,
} from "./StopWords.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CaseNameProcess");
const max = CitationEngineAbsoluteMaxima;
const Patterns = S.Struct({ splitV: CitationPythonUnicodeStorage, lowercase: CitationPythonUnicodeStorage });
const fingerprints = {
  splitV: "b3e9b4fe24c0b1212186b1af46a315278b78badd3800824bb31623aa20ab6efa",
  lowercase: "90d8fc0fea71fed1e3111af543dc65ae5106463a284883b3c09291aab338d8dd",
};
const Reason = LiteralKit([
  "invalid-configuration",
  "invalid-input",
  "missing-candidate",
  "invalid-match",
  "invalid-year",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed processing failures without candidate names, years or partial patches.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationCaseNameProcessFailure extends S.TaggedError<
  CitationCaseNameProcessFailure,
  { readonly brand: unique symbol }
>($I`CitationCaseNameProcessFailure`)(
  "CitationCaseNameProcessFailure",
  { reason: Reason },
  $I.annoteError<CitationCaseNameProcessFailure>("CitationCaseNameProcessFailure", {
    description: "Candidate processing failed without retained source text or partial metadata.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationCaseNameProcessFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameProcessConfiguration extends S.Opaque<
  CitationCaseNameProcessConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patterns: Patterns,
    bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
    cleaner: CitationStopWordsConfiguration,
  }).pipe(
    $I.annoteSchema("CitationCaseNameProcessConfiguration", {
      description: "Fixed source split/removal profiles and captured native cleanup configuration.",
    })
  )
) {}
/** Built-in source string words and initialized/supplied search-state fields.
 * @internal @category models @since 0.0.0
 */
export class CitationCaseNameProcessInput extends S.Opaque<
  CitationCaseNameProcessInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    words: S.Array(CitationPythonUnicodeStorage).check(S.isMaxLength(max.tokens)),
    index: S.Int,
    spanStart: S.Natural.check(S.isLessThanOrEqualTo(max.sourceUtf16)),
    candidateCaseName: S.NullOr(CitationPythonUnicodeStorage),
    hasV: S.Boolean,
    startIndex: S.NullOr(S.Int),
    preCiteYear: S.NullOr(CitationPythonUnicodeStorage),
    short: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationCaseNameProcessInput", {
      description: "Owned built-in word values, native candidate, selected token truth and unverified source start.",
    })
  )
) {}
const Value = S.Option(CitationPythonUnicodeStorage);
/** None means leave the attribute untouched; Some(empty) is a real assignment.
 * @internal @category models @since 0.0.0
 */
export class CitationCaseNameProcessPatch extends S.Opaque<
  CitationCaseNameProcessPatch,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plaintiff: Value,
    defendant: Value,
    antecedentGuess: Value,
    year: Value,
    numericYear: S.Option(S.BigInt),
    fullSpanStart: S.Option(
      S.Int.check(S.isBetween({ minimum: -max.producedTextUtf16 - 1, maximum: max.sourceUtf16 }))
    ),
  }).pipe(
    $I.annoteSchema("CitationCaseNameProcessPatch", {
      description: "Only source-assigned metadata, exact arbitrary-size integer year and unverified source start.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameProcessResult extends S.Opaque<
  CitationCaseNameProcessResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patch: CitationCaseNameProcessPatch,
    reservedUnits: S.Natural.check(S.isLessThanOrEqualTo(max.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationCaseNameProcessResult", {
      description: "Atomic complete candidate-processing patch and cumulative invocation reservations.",
    })
  )
) {}
const Input = S.toType(CitationCaseNameProcessInput);
const Config = S.toType(CitationCaseNameProcessConfiguration);
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array(0) });
const bound = (index: number, length: number) => Num.max(0, Num.min(length, index < 0 ? length + index : index));
const plaintiffBoundary = (point: number) =>
  point === 32 || (point >= 9 && point <= 13) || point === 44 || point === 40;
/** Shared no-assignment patch for built-in name composition.
 * @internal @category models @since 0.0.0
 */
export const citationUnchangedCaseNamePatch = CitationCaseNameProcessPatch.make({
  plaintiff: O.none(),
  defendant: O.none(),
  antecedentGuess: O.none(),
  year: O.none(),
  numericYear: O.none(),
  fullSpanStart: O.none(),
});
/** Process a source candidate inside an existing operation, Scope and text authority.
 * @internal @category operations @since 0.0.0
 */
export const processCitationCaseName = Effect.fn("Citation.processNativeCaseName")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationCaseNameProcessConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  if (request.candidateCaseName === null) return yield* fail("missing-candidate");
  if (request.words.length > limits.tokens)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
  const input = yield* makeCitationRegexInput(limits);
  const words = yield* Effect.forEach(request.words, (word) => input.prepareUnicode(word, () => Effect.void));
  const candidate = (yield* input.prepareUnicode(request.candidateCaseName, () => Effect.void)).value.storage;
  const worker = yield* makeCitationRegexWorker(limits, runtime, config.bindings, "python-regex-v0");
  const clean = (source: CitationPythonUnicodeStorage) =>
    cleanCitationStopWords(limits, runtime, config.cleaner, source);
  const split = Effect.fn("Citation.splitCaseNameOnce")(function* () {
    const evaluated = yield* worker.evaluate(config.patterns.splitV, candidate, 0, 1, "search");
    if (evaluated.result.matches === 0) return { plaintiff: empty, defendant: evaluated.source.value.storage };
    const match = yield* evaluated.result.capture(0, 0);
    if (match._tag === "Unmatched") return yield* fail("invalid-match");
    const plaintiff = yield* evaluated.source.slice({ start: 0, end: match.start }, () => Effect.void);
    const defendant = yield* evaluated.source.slice(
      { start: match.end, end: evaluated.source.value.pythonLength },
      () => Effect.void
    );
    return { plaintiff, defendant };
  });
  const cleanPlaintiff = Effect.fn("Citation.processPlaintiffName")(function* (raw: CitationPythonUnicodeStorage) {
    const prepared = yield* input.prepareUnicode(raw, () => Effect.void);
    const start = yield* trimCitationMetadataBoundary(
      prepared.value,
      0,
      prepared.value.pythonLength,
      1,
      plaintiffBoundary
    );
    const end =
      1 +
      (yield* trimCitationMetadataBoundary(
        prepared.value,
        prepared.value.pythonLength - 1,
        start - 1,
        -1,
        plaintiffBoundary
      ));
    const trimmed = yield* prepared.slice({ start, end }, () => Effect.void);
    const evaluated = yield* worker.evaluate(config.patterns.lowercase, trimmed, 0);
    const removed = yield* substituteCitationMetadataMatches(evaluated, O.none(), () => fail("invalid-match"));
    return yield* clean(removed);
  });
  const finishName = Effect.fn("Citation.finishCaseNameAssignments")(function* (
    defendant: CitationPythonUnicodeStorage,
    cleaned: CitationPythonUnicodeStorage
  ) {
    if (cleaned.bytes.length === 0) return citationUnchangedCaseNamePatch;
    const name = request.short ? yield* clean(defendant) : cleaned;
    const first = bound(request.startIndex === null ? 0 : request.startIndex, words.length);
    const last = bound(request.index - 1, words.length);
    const length = A.reduce(
      A.take(A.drop(words, first), Num.max(0, last - first)),
      0,
      (sum, word) => sum + word.value.pythonLength
    );
    return CitationCaseNameProcessPatch.make({
      ...citationUnchangedCaseNamePatch,
      defendant: request.short ? O.none() : O.some(name),
      antecedentGuess: request.short ? O.some(name) : O.none(),
      fullSpanStart: O.some(request.spanStart - length - 1),
    });
  });
  const processYear = Effect.fn("Citation.processPreCitationYear")(function* () {
    if (request.preCiteYear === null || request.preCiteYear.bytes.length === 0) return citationUnchangedCaseNamePatch;
    const prepared = yield* input.prepareUnicode(request.preCiteYear, () => Effect.void);
    const numericYear = yield* parseCitationPythonInteger(prepared.value);
    if (O.isNone(numericYear)) return yield* fail("invalid-year");
    return CitationCaseNameProcessPatch.make({
      ...citationUnchangedCaseNamePatch,
      year: O.some(prepared.value.storage),
      numericYear,
    });
  });
  let plaintiff = O.none<CitationPythonUnicodeStorage>();
  let defendant = candidate;
  if (request.hasV) {
    const selected = yield* split();
    const name = yield* cleanPlaintiff(selected.plaintiff);
    plaintiff = O.some(name);
    defendant = selected.defendant;
  }
  const cleaned = yield* clean(defendant);
  const names = yield* finishName(defendant, cleaned);
  const year = yield* processYear();
  return CitationCaseNameProcessPatch.make({ ...names, plaintiff, year: year.year, numericYear: year.numericYear });
});
/** Copy the source-bound processing configuration for enclosing composition.
 * @internal @category operations @since 0.0.0
 */
export const copyCitationCaseNameProcessConfiguration = Effect.fn("Citation.copyCaseNameProcessConfiguration")(
  function* (limits: CitationEngineLimits, decoded: CitationCaseNameProcessConfiguration) {
    const owned = yield* copyCitationMetadataPatternConfiguration(
      limits,
      Patterns,
      decoded.patterns,
      decoded.bindings,
      fingerprints,
      () => fail("invalid-configuration")
    );
    const cleaner = yield* copyCitationStopWordsConfiguration(limits, decoded.cleaner);
    return CitationCaseNameProcessConfiguration.make({ ...owned, cleaner });
  }
);
/** Install one admitted composition; cleaner calls share its Scope and budget
 * without reacquiring the enclosing operation's permit. Methods have R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCaseNameProcess = makeCitationMetadataStage({
  method: "apply",
  schema: Config,
  invalid: () => fail("invalid-configuration"),
  own: copyCitationCaseNameProcessConfiguration,
  prepare: processCitationCaseName,
  project: (patch, reservedUnits) => CitationCaseNameProcessResult.make({ patch, reservedUnits }),
});
