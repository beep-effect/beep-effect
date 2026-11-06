/** Original plain/markup generated-reference helpers from eyecite 2.7.6 find.py.
 * Free Law Project, BSD-2-Clause; source-native private models only.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationCaseMetadataFields } from "./CaseMetadata.ts";
import { CitationHtmlTagGeometryInput } from "./HtmlTagGeometry.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import {
  CitationReferencePatternConfiguration,
  copyCitationReferencePatternConfiguration,
  makeCitationReferencePatterns,
} from "./ReferencePatterns.ts";
import { CitationRegexInputLayout, makeCitationRegexInput } from "./RegexInput.ts";
import { makeCitationRegexWorker } from "./RegexWorker.ts";
import { makeCitationSpanOffsets } from "./SpanOffsets.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/GeneratedReferences");
const Value = S.NullOr(CitationPythonUnicodeStorage);
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "invalid-match"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed generated-reference failures without source text or partial matches.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationGeneratedReferenceFailure extends S.TaggedError<
  CitationGeneratedReferenceFailure,
  { readonly brand: unique symbol }
>($I`CitationGeneratedReferenceFailure`)(
  "CitationGeneratedReferenceFailure",
  { reason: Reason },
  $I.annoteError<CitationGeneratedReferenceFailure>("CitationGeneratedReferenceFailure", {
    description: "Reference construction failed without source, names, captures or nested causes.",
  })
) {}
/** Complete fresh original ReferenceCitation state before any Document attachment.
 * @internal @category models @since 0.0.0
 */
export class CitationGeneratedReference extends S.Opaque<
  CitationGeneratedReference,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("ReferenceCitation", {
    index: S.tag(0),
    documentAttached: S.tag(false),
    token: CitationTokenSeed,
    spanStart: S.Int,
    spanEnd: S.Int,
    fullSpanStart: S.Int,
    fullSpanEnd: S.Int,
    metadata: S.Struct({
      pinCite: Value,
      parenthetical: Value,
      pinCiteSpanStart: S.NullOr(S.Int),
      pinCiteSpanEnd: S.NullOr(S.Int),
      plaintiff: Value,
      defendant: Value,
      resolvedCaseNameShort: Value,
      resolvedCaseName: Value,
    }),
  }).pipe(
    $I.annoteSchema("CitationGeneratedReference", {
      description:
        "Original generated name/pincite reference with native token, all metadata slots and unverified Python spans.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationGeneratedReferenceInput extends S.Opaque<
  CitationGeneratedReferenceInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: CitationPythonUnicodeStorage,
    offset: CitationTokenSeed.fields.end,
    metadata: CitationCaseMetadataFields,
  }).pipe(
    $I.annoteSchema("CitationGeneratedReferenceInput", {
      description: "Original plain Document text, citation.span end and native full-case name metadata.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationGeneratedReferencesResult extends S.Opaque<
  CitationGeneratedReferencesResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    references: S.Array(CitationGeneratedReference).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationGeneratedReferencesResult", {
      description: "Atomically completed generated references and enclosing operation text usage.",
    })
  )
) {}
const Input = S.toType(CitationGeneratedReferenceInput);
const Configuration = S.toType(CitationReferencePatternConfiguration);
const fail = (reason: typeof Reason.Type) => CitationGeneratedReferenceFailure.make({ reason });
type Evaluation = Effect.Success<ReturnType<Effect.Success<ReturnType<typeof makeCitationRegexWorker>>["evaluate"]>>;
const readNamedCaptures = Effect.fn("Citation.readReferenceCaptures")(function* (evaluated: Evaluation, index: number) {
  const named = yield* Effect.forEach(
    R.toEntries(evaluated.descriptor.profile.names),
    Effect.fnUntraced(function* ([name, group]) {
      const capture = yield* evaluated.result.capture(index, group);
      const value = capture._tag === "Unmatched" ? null : yield* evaluated.source.slice(capture, () => Effect.void);
      return Tuple.make(name, value);
    }),
    { concurrency: 1 }
  );
  return R.fromEntries(named);
});
const referenceFromCaptures = (
  data: CitationPythonUnicodeStorage,
  first: number,
  last: number,
  fullFirst: number,
  fullLast: number,
  values: Readonly<Record<string, CitationPythonUnicodeStorage | null>>
) =>
  CitationGeneratedReference.make({
    token: CitationTokenSeed.make({
      kind: "CaseReferenceToken",
      data,
      start: first,
      end: last,
      groups: {},
      exact: [],
      variation: [],
      short: false,
    }),
    spanStart: first,
    spanEnd: last,
    fullSpanStart: fullFirst,
    fullSpanEnd: fullLast,
    metadata: {
      pinCite: O.getOrNull(R.get(values, "pin_cite")),
      parenthetical: null,
      pinCiteSpanStart: null,
      pinCiteSpanEnd: null,
      plaintiff: O.getOrNull(R.get(values, "plaintiff")),
      defendant: O.getOrNull(R.get(values, "defendant")),
      resolvedCaseNameShort: O.getOrNull(R.get(values, "resolved_case_name_short")),
      resolvedCaseName: O.getOrNull(R.get(values, "resolved_case_name")),
    },
  });
const bound = (index: number, length: number) => Num.max(0, Num.min(length, index < 0 ? length + index : index));
const prepare = Effect.fn("Citation.extractPincitedReferences")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationReferencePatternConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const builder = yield* makeCitationReferencePatterns(limits, config);
  const pattern = yield* builder.build(request.metadata, "pin");
  if (O.isNone(pattern)) return A.empty<CitationGeneratedReference>();
  const input = yield* makeCitationRegexInput(limits, "source");
  const plain = yield* input.prepareUnicode(request.plain, () => Effect.void);
  const length = plain.value.pythonLength;
  const start = Num.max(0, Num.min(length, request.offset < 0 ? length + request.offset : request.offset));
  const remainder = yield* plain.slice({ start, end: length }, () => Effect.void);
  const worker = yield* makeCitationRegexWorker(limits, runtime, [pattern.value.descriptor]);
  const evaluated = yield* worker.evaluate(pattern.value.pattern, remainder, pattern.value.descriptor.flags);
  if (evaluated.result.matches === 0) return A.empty<CitationGeneratedReference>();
  if (evaluated.result.matches > limits.candidates)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
  return yield* Effect.forEach(
    A.makeBy(evaluated.result.matches, (index) => index),
    Effect.fnUntraced(function* (index) {
      const whole = yield* evaluated.result.capture(index, 0);
      if (whole._tag === "Unmatched") return yield* fail("invalid-match");
      const data = yield* evaluated.source.slice(whole, () => Effect.void);
      const values = yield* readNamedCaptures(evaluated, index);
      const first = whole.start + request.offset;
      const last = whole.end + request.offset;
      return referenceFromCaptures(data, first, last, first, last, values);
    }),
    { concurrency: 1 }
  );
});
/** Run original plain-name reference generation through shared admission, captured
 * Scope/deadline/text authority, existing typed regex RPC and retirement barrier.
 * No partial references publish; whole-loop assembly follows.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationGeneratedReferences = makeCitationMetadataStage({
  method: "pincited",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own: copyCitationReferencePatternConfiguration,
  prepare,
  project: (references, reservedUnits) => CitationGeneratedReferencesResult.make({ references, reservedUnits }),
});

/** @internal @category models @since 0.0.0 */
export class CitationGeneratedMarkupInput extends S.Opaque<
  CitationGeneratedMarkupInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: CitationPythonUnicodeStorage,
    markup: CitationPythonUnicodeStorage,
    start: CitationTokenSeed.fields.start,
    metadata: CitationCaseMetadataFields,
    geometry: CitationHtmlTagGeometryInput.pipe(S.toType, S.Option),
  }).pipe(
    $I.annoteSchema("CitationGeneratedMarkupInput", {
      description: "Original plain/markup document, citation span start and optional prepared bidirectional maps.",
    })
  )
) {}
const MarkupInput = S.toType(CitationGeneratedMarkupInput);
const sameLayout = CitationRegexInputLayout.pipe(S.toType, S.toEquivalence);
const sameNative = CitationPythonUnicodeStorage.pipe(S.toType, S.toEquivalence);
const prepareMarkupGeometry = Effect.fn("Citation.prepareReferenceMarkupGeometry")(function* (
  limits: CitationEngineLimits,
  request: CitationGeneratedMarkupInput,
  geometry: CitationHtmlTagGeometryInput
) {
  const input = yield* makeCitationRegexInput(limits, "source");
  const plain = yield* input.prepareUnicode(request.plain, () => Effect.void);
  const markup = yield* input.prepareUnicode(request.markup, () => Effect.void);
  if (
    !sameNative(geometry.plain, plain.value.storage) ||
    !sameLayout(geometry.forward.before, plain.layout) ||
    !sameLayout(geometry.backward.after, plain.layout) ||
    !sameLayout(geometry.backward.before, markup.layout) ||
    geometry.forward.after.pythonLength !== markup.layout.pythonLength
  )
    return yield* fail("invalid-input");
  const forward = yield* makeCitationSpanOffsets(limits, geometry.forward);
  const backward = yield* makeCitationSpanOffsets(limits, geometry.backward);
  return { plain, markup, forward, backward };
});
const prepareMarkup = Effect.fn("Citation.extractMarkupReferences")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationReferencePatternConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(MarkupInput)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const builder = yield* makeCitationReferencePatterns(limits, config);
  const pattern = yield* builder.build(request.metadata, "markup");
  if (O.isNone(pattern) || O.isNone(request.geometry) || request.markup.bytes.length === 0)
    return A.empty<CitationGeneratedReference>();
  const { plain, markup, forward, backward } = yield* prepareMarkupGeometry(limits, request, request.geometry.value);
  const offset = yield* forward.update(request.start, "right");
  const suffix = yield* markup.slice(
    { start: bound(offset, markup.value.pythonLength), end: markup.value.pythonLength },
    () => Effect.void
  );
  const worker = yield* makeCitationRegexWorker(limits, runtime, [
    pattern.value.descriptor,
    builder.rejection.descriptor,
  ]);
  const evaluated = yield* worker.evaluate(pattern.value.pattern, suffix, pattern.value.descriptor.flags);
  if (evaluated.result.matches === 0) return A.empty<CitationGeneratedReference>();
  const references = yield* Effect.forEach(
    A.makeBy(evaluated.result.matches, (index) => index),
    Effect.fnUntraced(function* (index) {
      const whole = yield* evaluated.result.capture(index, 0);
      const name = yield* evaluated.result.capture(index, 1);
      if (whole._tag === "Unmatched" || name._tag === "Unmatched") return yield* fail("invalid-match");
      const fullFirst = yield* backward.update(offset + whole.start, "left");
      const fullLast = yield* backward.update(offset + whole.end, "right");
      const first = yield* backward.update(offset + name.start, "left");
      const last = yield* backward.update(offset + name.end, "right");
      const after = yield* plain.slice(
        { start: bound(fullLast, plain.value.pythonLength), end: plain.value.pythonLength },
        () => Effect.void
      );
      const rejected = yield* worker.evaluate(
        builder.rejection.pattern,
        after,
        builder.rejection.descriptor.flags,
        1,
        "match"
      );
      if (rejected.result.matches !== 0) return O.none<CitationGeneratedReference>();
      const start = bound(first, plain.value.pythonLength);
      const end = Num.max(start, bound(last, plain.value.pythonLength));
      const data = yield* plain.slice({ start, end }, () => Effect.void);
      const values = yield* readNamedCaptures(evaluated, index);
      return O.some(referenceFromCaptures(data, first, last, fullFirst, fullLast, values));
    }),
    { concurrency: 1 }
  );
  const kept = A.getSomes(references);
  if (kept.length > limits.candidates)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
  return kept;
});
/** Original markup-name reference generation using existing offset plans and
 * typed regex RPC under one captured operation, deadline and text authority.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationGeneratedMarkupReferences = makeCitationMetadataStage({
  method: "markup",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own: copyCitationReferencePatternConfiguration,
  prepare: prepareMarkup,
  project: (references, reservedUnits) => CitationGeneratedReferencesResult.make({ references, reservedUnits }),
});

/** @internal @category models @since 0.0.0 */
export class CitationGeneratedCombinedInput extends S.Opaque<
  CitationGeneratedCombinedInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CitationGeneratedMarkupInput.fields,
    offset: CitationGeneratedReferenceInput.fields.offset,
    kind: S.Literals([
      "FullCaseCitation",
      "FullLawCitation",
      "FullJournalCitation",
      "ShortCaseCitation",
      "IdCitation",
      "SupraCitation",
      "UnknownCitation",
      "ReferenceCitation",
    ]),
  }).pipe(
    $I.annoteSchema("CitationGeneratedCombinedInput", {
      description:
        "Original reference caller with citation family and span endpoints before ordered plain/markup generation.",
    })
  )
) {}
const CombinedInput = S.toType(CitationGeneratedCombinedInput);
const prepareCombined = Effect.fn("Citation.extractGeneratedReferences")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationReferencePatternConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(CombinedInput)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const input = yield* makeCitationRegexInput(limits, "source");
  const plain = yield* input.prepareUnicode(request.plain, () => Effect.void);
  if (plain.value.pythonLength <= request.offset || request.kind !== "FullCaseCitation")
    return A.empty<CitationGeneratedReference>();
  const pin = yield* prepare(limits, runtime, config, request);
  if (request.markup.bytes.length === 0) return pin;
  const markup = yield* prepareMarkup(limits, runtime, config, request);
  if (pin.length + markup.length > limits.candidates)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
  return A.appendAll(pin, markup);
});
/** Original ordered plain/markup caller, sharing one Scope, deadline and
 * cumulative text budget across both generators; final filtering stays separate.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationGeneratedCombinedReferences = makeCitationMetadataStage({
  method: "combined",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own: copyCitationReferencePatternConfiguration,
  prepare: prepareCombined,
  project: (references, reservedUnits) => CitationGeneratedReferencesResult.make({ references, reservedUnits }),
});
