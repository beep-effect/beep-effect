/** Raw primitive extraction and domain meaning under one operation authority.
 * eyecite 2.7.6, Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationDocumentStepContainers } from "./DocumentCleanerProtocols.ts";
import { CitationDocumentExtractionConfiguration, ownCitationDocumentExtraction } from "./DocumentExtraction.ts";
import { CitationExtractionEntryResult, makeCitationExtractionEntry } from "./ExtractionEntry.ts";
import { detachCitationMetadataConfiguration, makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationSemanticProjectionConfiguration, makeCitationSemanticProjection } from "./SemanticProjection.ts";
import { CitationTokenDispatchBindings } from "./TokenDispatch.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SemanticExtraction");
const Reason = LiteralKit(["invalid-configuration"]).pipe(
  $I.annoteSchema("Reason", { description: "Raw/semantic composition cannot install inconsistent edition authority." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationSemanticExtractionFailure extends S.TaggedError<
  CitationSemanticExtractionFailure,
  { readonly brand: unique symbol }
>($I`CitationSemanticExtractionFailure`)(
  "CitationSemanticExtractionFailure",
  { reason: Reason },
  $I.annoteError<CitationSemanticExtractionFailure>("CitationSemanticExtractionFailure", {
    description: "Composition failed without retaining source, configuration or partial citations.",
  })
) {}
const invalid = () => CitationSemanticExtractionFailure.make({ reason: "invalid-configuration" });
/** @internal @category models @since 0.0.0 */
export class CitationSemanticExtractionConfiguration extends S.Opaque<
  CitationSemanticExtractionConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    extraction: CitationDocumentExtractionConfiguration,
    semantic: CitationSemanticProjectionConfiguration,
  }).pipe(
    $I.annoteSchema("CitationSemanticExtractionConfiguration", {
      description: "Complete primitive extraction and semantic identity configuration captured by server composition.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationSemanticExtractionResult extends S.Opaque<
  CitationSemanticExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    raw: CitationExtractionEntryResult,
    citations: S.Array(Citation).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
    reservedUnits: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationSemanticExtractionResult", {
      description:
        "Atomically completed semantic values plus private raw state; neither raw coordinates nor this wrapper issue verified mentions.",
    })
  )
) {}
const Configuration = S.toType(CitationSemanticExtractionConfiguration);
const ConfigurationJson = Configuration.pipe(S.toCodecJson);
const sameBindings = S.toEquivalence(CitationTokenDispatchBindings);
/** Capture the complete semantic extraction configuration and its private child services.
 * @internal @category operations @since 0.0.0
 */
export const ownCitationSemanticExtraction = Effect.fn("Citation.ownSemanticExtraction")(function* (
  limits: CitationEngineLimits,
  configuration: CitationSemanticExtractionConfiguration
) {
  const config = yield* detachCitationMetadataConfiguration(ConfigurationJson, configuration, invalid);
  if (!sameBindings(config.semantic.editions, config.extraction.extraction.loop.full.editions)) return yield* invalid();
  const document = yield* ownCitationDocumentExtraction(limits, config.extraction);
  const containers = yield* CitationDocumentStepContainers;
  const children = document.children.pipe(Context.add(CitationDocumentStepContainers, containers));
  return { config, children };
});
const prepare = Effect.fn("Citation.extractSemanticCitations")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof ownCitationSemanticExtraction>>,
  request: unknown
) {
  return yield* Effect.gen(function* () {
    const entry = yield* makeCitationExtractionEntry(limits, runtime, owned.config.extraction);
    const semantic = yield* makeCitationSemanticProjection(limits, runtime, owned.config.semantic);
    const raw = yield* entry.extract(request);
    const models =
      raw.outcome._tag === "Shortcut"
        ? raw.outcome.citations
        : A.map(raw.outcome.result.extraction.extraction.citations, (entry) => entry.model);
    if (models.length > limits.candidates)
      return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "candidates" });
    const citations = yield* Effect.forEach(models, semantic.project, { concurrency: 1 });
    return { raw, citations };
  }).pipe(Effect.provideContext(owned.children));
});
/** One admitted raw request through original extraction and the domain Citation
 * codec. Native admission, one cumulative budget and the enclosing deadline are
 * retained. No partial citation list escapes on projection failure. All returned
 * methods require no caller services; verified mention adaptation remains separate.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationSemanticExtraction = makeCitationMetadataStage({
  method: "extract",
  schema: Configuration,
  invalid,
  own: ownCitationSemanticExtraction,
  prepare,
  project: (result, reservedUnits) => {
    const validated = CitationSemanticExtractionResult.make({ ...result, reservedUnits });
    const restored: CitationSemanticExtractionResult = { ...validated, raw: result.raw };
    return restored;
  },
});
