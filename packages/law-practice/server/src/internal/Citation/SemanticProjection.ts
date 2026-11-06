/** Builtin original models to the existing semantic Citation structured codec.
 * eyecite 2.7.6, Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation } from "@beep/law-practice-domain/values";
import { CourtId, findCourtById } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationExtractionLoopModel } from "./ExtractionLoop.ts";
import { CitationGeneratedReference } from "./GeneratedReferences.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { makeCitationSemanticVocabulary } from "./SemanticVocabulary.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import { CitationTokenDispatchBindings } from "./TokenDispatch.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SemanticProjection");
const Reason = LiteralKit(["invalid-input", "invalid-configuration", "missing-edition", "invalid-meaning"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed semantic projection failures without native metadata, groups or source text.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationSemanticProjectionFailure extends S.TaggedError<
  CitationSemanticProjectionFailure,
  { readonly brand: unique symbol }
>($I`CitationSemanticProjectionFailure`)(
  "CitationSemanticProjectionFailure",
  { reason: Reason },
  $I.annoteError<CitationSemanticProjectionFailure>("CitationSemanticProjectionFailure", {
    description: "Meaning projection failed without source or partial citation data.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationSemanticProjectionFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationSemanticProjectionConfiguration extends S.Opaque<
  CitationSemanticProjectionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ editions: CitationTokenDispatchBindings, vocabulary: S.String.check(S.isMaxLength(1024 * 1024)) }).pipe(
    $I.annoteSchema("CitationSemanticProjectionConfiguration", {
      description: "Original local edition ids and authenticated derived identity artifact; no publication guessing.",
    })
  )
) {}
const Configuration = S.toType(CitationSemanticProjectionConfiguration);
const Input = S.toType(CitationExtractionLoopModel);
const NativeFields = S.Record(S.String, S.NullOr(CitationPythonUnicodeStorage)).pipe(S.toType);
const isGenerated = S.is(CitationGeneratedReference);
const isCourtId = S.is(CourtId);
const own = Effect.fn("Citation.ownSemanticProjection")(function* (
  _limits: CitationEngineLimits,
  config: CitationSemanticProjectionConfiguration
) {
  const vocabulary = yield* makeCitationSemanticVocabulary(config.vocabulary);
  const editions = HashMap.fromIterable(A.map(config.editions, (row) => Tuple.make(row.id, row.ref)));
  if (HashMap.size(editions) !== config.editions.length) return yield* fail("invalid-configuration");
  return { vocabulary, editions };
});
const projectFields = Effect.fn("Citation.projectSemanticTextFields")(function* (
  limits: CitationEngineLimits,
  raw: unknown
) {
  const fields = yield* S.decodeUnknownEffect(NativeFields)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const unicode = yield* makeCitationPythonUnicode(limits);
  const budget = yield* CitationTextBudget;
  const entries = yield* Effect.forEach(
    R.toEntries(fields),
    Effect.fnUntraced(function* ([key, value]) {
      const text = value === null ? null : (yield* unicode.fromStorageReserved(value, budget.reserve)).text;
      return Tuple.make(key, text);
    }),
    { concurrency: 1 }
  );
  return R.fromEntries(entries);
});
const courtMeaning = (
  value: string | null,
  vocabulary: Effect.Success<ReturnType<typeof makeCitationSemanticVocabulary>>
) => {
  if (value === null) return null;
  if (isCourtId(value) && O.isSome(findCourtById(value)))
    return { status: "known", id: value, vocabularyVersion: vocabulary.vocabularyVersion };
  return { status: "unmapped", value };
};
const prepare = Effect.fn("Citation.projectBuiltinMeaning")(function* (
  limits: CitationEngineLimits,
  _runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  const model = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  const state = isGenerated(model) ? model : model.outcome;
  const components = yield* projectFields(limits, model.token.groups);
  const { pinCiteSpanStart: _pinStart, pinCiteSpanEnd: _pinEnd, ...metadata } = state.metadata;
  const fields = yield* projectFields(limits, metadata);
  const get = (name: string) => O.getOrNull(R.get(fields, name));
  const locator = { pinCite: get("pinCite"), parenthetical: get("parenthetical") };
  const dated = { ...locator, year: get("year"), month: get("month"), day: get("day") };
  const cases = { ...dated, court: courtMeaning(get("court"), owned.vocabulary) };
  const publication = Effect.fnUntraced(function* (family: "case" | "law" | "journal") {
    const refs = yield* Effect.forEach(
      A.appendAll(model.token.exact, model.token.variation),
      (id) => Effect.fromOption(HashMap.get(owned.editions, id), () => fail("missing-edition")),
      { concurrency: 1 }
    );
    const bindings = yield* Effect.forEach(refs, (ref) => owned.vocabulary.lookup(ref, family), { concurrency: 1 });
    const selected = "editionGuess" in state ? state.editionGuess : null;
    if (selected !== null) yield* owned.vocabulary.lookup(selected, family);
    if (family !== "case") return { editions: refs, selectedEdition: selected };
    const editions = yield* Effect.forEach(
      bindings,
      (row) =>
        row.family === "case"
          ? Effect.succeed({ edition: row.edition, reporterId: row.reporterId })
          : Effect.fail(fail("invalid-meaning")),
      { concurrency: 1 }
    );
    return { editions, selectedEdition: selected, vocabularyVersion: owned.vocabulary.vocabularyVersion };
  });
  const meaning = yield* Match.value(state._tag).pipe(
    Match.when("FullCaseCitation", () =>
      publication("case").pipe(
        Effect.map((publication) => ({
          type: "case",
          components,
          publication,
          metadata: {
            ...cases,
            plaintiff: get("plaintiff"),
            defendant: get("defendant"),
            additionalText: get("extra"),
            antecedentGuess: get("antecedentGuess"),
            shortCaseName: get("resolvedCaseNameShort"),
            caseName: get("resolvedCaseName"),
          },
        }))
      )
    ),
    Match.when("ShortCaseCitation", () =>
      publication("case").pipe(
        Effect.map((publication) => ({
          type: "shortFormCase",
          components,
          publication,
          metadata: {
            ...cases,
            antecedentGuess: get("antecedentGuess"),
            ...(R.has(fields, "plaintiff") ? { plaintiff: get("plaintiff") } : {}),
          },
        }))
      )
    ),
    Match.when("FullLawCitation", () =>
      publication("law").pipe(
        Effect.map((publication) => ({
          type: "law",
          components,
          publication,
          metadata: { ...dated, publisher: get("publisher") },
        }))
      )
    ),
    Match.when("FullJournalCitation", () =>
      publication("journal").pipe(
        Effect.map((publication) => ({ type: "journal", components, publication, metadata: dated }))
      )
    ),
    Match.when("IdCitation", () => Effect.succeed({ type: "id", components, metadata: locator })),
    Match.when("SupraCitation", () =>
      Effect.succeed({
        type: "supra",
        components,
        metadata: { ...locator, antecedentGuess: get("antecedentGuess"), volume: get("volume") },
      })
    ),
    Match.when("ReferenceCitation", () =>
      Effect.succeed({
        type: "reference",
        components,
        metadata: {
          ...locator,
          plaintiff: get("plaintiff"),
          defendant: get("defendant"),
          shortCaseName: get("resolvedCaseNameShort"),
          caseName: get("resolvedCaseName"),
        },
      })
    ),
    Match.when("UnknownCitation", () => Effect.succeed({ type: "unknown", components, metadata: locator })),
    Match.exhaustive
  );
  return yield* S.decodeUnknownEffect(Citation)(meaning).pipe(Effect.mapError(() => fail("invalid-meaning")));
});
/** Project legal meaning through Citation's own structured codec. Occurrence
 * coordinates, attachment, inferred numeric year and telemetry remain outside
 * the semantic value. This is not a codec for reconstructing Python objects.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSemanticProjection = makeCitationMetadataStage({
  method: "project",
  schema: Configuration,
  invalid: () => fail("invalid-configuration"),
  own,
  prepare,
  project: (citation) => citation,
});
