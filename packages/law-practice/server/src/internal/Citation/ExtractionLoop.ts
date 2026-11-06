/** Original get_citations token loop from eyecite 2.7.6 find.py, BSD-2-Clause.
 * Consumes actual prepared Document/token state; raw-input preparation and the
 * import-time joke shortcut are separate entry-point duties.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationOperationAdmission } from "./Admission.ts";
import { CitationTokenExtractionInput } from "./ExtractionContext.ts";
import {
  CitationExtractionSelectionResult,
  makeCitationExtractionSelection,
  projectCitationExtractionSelection,
} from "./ExtractionSelection.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import {
  CitationFullExtractionConfiguration,
  CitationFullExtractionResult,
  inheritCitationParallelCase,
  makeCitationFullExtraction,
} from "./FullExtraction.ts";
import { CitationGeneratedReference, makeCitationGeneratedCombinedReferences } from "./GeneratedReferences.ts";
import { decodeCitationMetadataRuntimeConfiguration, makeCitationMetadataOperation } from "./MetadataComposition.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { CitationReferencePatternConfiguration } from "./ReferencePatterns.ts";
import {
  CitationReferenceTokenConfiguration,
  CitationReferenceTokenResult,
  makeCitationReferenceTokenExtraction,
} from "./ReferenceTokenExtraction.ts";
import { CitationTokenSeed } from "./TokenObjects.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ExtractionLoop");
const max = CitationEngineAbsoluteMaxima;
const Reason = LiteralKit(["invalid-input", "invalid-configuration"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed prepared extraction-loop failures without Document text or partial models.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationExtractionLoopFailure extends S.TaggedError<
  CitationExtractionLoopFailure,
  { readonly brand: unique symbol }
>($I`CitationExtractionLoopFailure`)(
  "CitationExtractionLoopFailure",
  { reason: Reason },
  $I.annoteError<CitationExtractionLoopFailure>("CitationExtractionLoopFailure", {
    description: "Prepared extraction failed without raw input, nested causes or partial results.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationExtractionLoopFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export class CitationExtractionLoopConfiguration extends S.Opaque<
  CitationExtractionLoopConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    full: CitationFullExtractionConfiguration,
    reference: CitationReferenceTokenConfiguration,
    generated: CitationReferencePatternConfiguration,
  }).pipe(
    $I.annoteSchema("CitationExtractionLoopConfiguration", {
      description:
        "Existing source-bound constructor and generated-reference configurations, detached at installation.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationExtractionLoopInput extends S.Opaque<
  CitationExtractionLoopInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    plain: CitationPythonUnicodeStorage,
    markup: CitationPythonUnicodeStorage,
    words: CitationTokenExtractionInput.fields.words,
    geometry: CitationTokenExtractionInput.fields.geometry,
    tokens: S.Array(S.Struct({ index: CitationTokenExtractionInput.fields.index, token: CitationTokenSeed })).check(
      S.isMaxLength(max.tokens)
    ),
    removeAmbiguous: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationExtractionLoopInput", {
      description:
        "Prepared original Document text, words and ordered citation tokens; no caller-supplied citation models.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationExtractionLoopModel = S.Union([
  CitationFullExtractionResult,
  CitationReferenceTokenResult,
  CitationGeneratedReference,
]).pipe(
  $I.annoteSchema("CitationExtractionLoopModel", {
    description: "Existing private source-native constructor results; no redundant public wire citation.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationExtractionLoopModel = typeof CitationExtractionLoopModel.Type;
/** @internal @category models @since 0.0.0 */
export class CitationExtractionLoopEntry extends S.Opaque<
  CitationExtractionLoopEntry,
  { readonly brand: unique symbol }
>()(
  S.Struct({ model: CitationExtractionLoopModel, documentAttached: S.Boolean }).pipe(
    $I.annoteSchema("CitationExtractionLoopEntry", {
      description:
        "Original model with builtin Document attachment observation; generated references remain unattached.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationExtractionLoopResult extends S.Opaque<
  CitationExtractionLoopResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    models: S.Array(CitationExtractionLoopEntry).check(S.isMaxLength(max.candidates)),
    citations: S.Array(CitationExtractionLoopEntry).check(S.isMaxLength(max.candidates)),
    selection: CitationExtractionSelectionResult,
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationExtractionLoopResult", {
      description:
        "Complete pre-filter models and retained original entries, with source-free diagnostics and cumulative text usage.",
    })
  )
) {}
const Input = S.toType(CitationExtractionLoopInput);
const Configuration = S.toType(CitationExtractionLoopConfiguration);
// Upstream Schema owns native byte representation and fresh decoding; no custom
// recursive configuration clone or JSON string parser is introduced.
const ConfigurationJson = Configuration.pipe(S.toCodecJson);
const isFull = S.is(CitationFullExtractionResult);
const referenceToken = (token: CitationTokenSeed) =>
  token.kind === "IdToken" ||
  token.kind === "SupraToken" ||
  token.kind === "SectionToken" ||
  (token.kind === "CitationToken" && token.short);
const prepare = Effect.fn("Citation.extractPreparedDocument")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationExtractionLoopConfiguration,
  raw: unknown
) {
  const request = yield* S.decodeUnknownEffect(Input)(raw).pipe(Effect.mapError(() => fail("invalid-input")));
  if (request.words.length > limits.tokens || request.tokens.length > limits.tokens)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "tokens" });
  const full = yield* makeCitationFullExtraction(limits, runtime, config.full);
  const reference = yield* makeCitationReferenceTokenExtraction(limits, runtime, config.reference);
  const generated = yield* makeCitationGeneratedCombinedReferences(limits, runtime, config.generated);
  const selection = yield* makeCitationExtractionSelection(limits);
  const models = MutableList.make<CitationExtractionLoopEntry>();
  let prior = O.none<CitationExtractionLoopEntry>();
  const append = Effect.fn("Citation.appendExtractedModel")(function* (
    model: CitationExtractionLoopModel,
    documentAttached: boolean
  ) {
    if (models.length >= limits.candidates)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
    const entry = CitationExtractionLoopEntry.make({ model, documentAttached });
    MutableList.append(models, entry);
    prior = O.some(entry);
  });
  yield* Effect.forEach(
    request.tokens,
    Effect.fnUntraced(function* ({ index, token }) {
      const context = { words: request.words, index, token, geometry: request.geometry };
      if (referenceToken(token)) {
        const model = yield* reference.extract(context);
        return yield* append(model, true);
      }
      if (token.kind !== "CitationToken") return;
      let model = yield* full.extract(context);
      if (O.isSome(prior) && isFull(prior.value.model))
        model = yield* inheritCitationParallelCase(model, prior.value.model);
      if (model.outcome._tag === "FullCaseCitation") {
        const projected = yield* projectCitationExtractionSelection(models.length, model);
        const references = yield* generated.combined({
          plain: request.plain,
          markup: request.markup,
          start: projected.span[0],
          offset: projected.span[1],
          kind: model.outcome._tag,
          metadata: model.outcome.metadata,
          geometry: request.geometry,
        });
        yield* Effect.forEach(references.references, (item) => append(item, false), { concurrency: 1, discard: true });
      }
      yield* append(model, true);
    }),
    { concurrency: 1, discard: true }
  );
  const all = MutableList.takeAll(models);
  const facts = yield* Effect.forEach(all, (entry, id) => projectCitationExtractionSelection(id, entry.model), {
    concurrency: 1,
  });
  const filtered = yield* selection.select(facts);
  const retained = request.removeAmbiguous ? filtered.disambiguated : filtered.selected;
  return { models: all, citations: A.map(retained, (id) => A.getUnsafe(all, id)), selection: filtered, retained };
});
/** Install one admitted extraction operation. Child stages are installed inside
 * its Scope and receive the existing budget plus an admission view that reuses
 * the already-held parent permit. Native process admission is never replaced.
 * No child stage escapes this private invocation; returned extract has R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationExtractionLoop = Effect.fn("Citation.makeExtractionLoop")(function* (
  policy: unknown,
  runtimeInput: unknown,
  configurationInput: unknown
) {
  const { limits, runtime, configuration } = yield* decodeCitationMetadataRuntimeConfiguration(
    policy,
    runtimeInput,
    configurationInput,
    Configuration,
    () => fail("invalid-configuration")
  );
  const encoded = yield* S.encodeEffect(ConfigurationJson)(configuration).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const config = yield* S.decodeEffect(ConfigurationJson)(encoded).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const admission = yield* CitationOperationAdmission;
  const editions = yield* CitationFrozenEditions;
  const zone = yield* DateTime.CurrentTimeZone;
  const nested = CitationOperationAdmission.of({
    run: Effect.fn("Citation.reuseExtractionPermit")(
      <A, E>(_: CitationSafetyLimitExceeded["operation"], body: Effect.Effect<A, E>) => body
    ),
    snapshot: admission.snapshot,
  });
  const installed = yield* makeCitationMetadataOperation(
    limits,
    (raw: unknown) =>
      prepare(limits, runtime, config, raw).pipe(
        Effect.provideService(CitationOperationAdmission, nested),
        Effect.provideService(CitationFrozenEditions, editions),
        Effect.provideService(DateTime.CurrentTimeZone, zone)
      ),
    () => fail("invalid-configuration")
  );
  const extract = Effect.fn("Citation.extractDocumentLoop")(
    (raw: unknown) =>
      admission.run(
        "extract",
        Effect.gen(function* () {
          const [result, reservedUnits] = yield* installed.run(raw);
          const completed = CitationExtractionLoopResult.make({ ...result, reservedUnits });
          // Struct construction validates each occurrence independently. Reconnect
          // returned entries to that one validated model list by original ids.
          return { ...completed, citations: A.map(result.retained, (id) => A.getUnsafe(completed.models, id)) };
        })
      ),
    installed.timing.timed
  );
  return { extract };
});
