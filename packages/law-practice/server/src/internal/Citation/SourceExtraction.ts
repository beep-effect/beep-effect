/** Raw source resolution and verified extraction in one admitted operation.
 * Reuses the existing resolver, verifier, extraction stages and Effect ownership.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineReport, CitationExtractionMeasurements } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { ownCitationSemanticExtraction } from "./SemanticExtraction.ts";
import { makeCitationSourceRequestAdapter } from "./SourceRequest.ts";
import {
  CitationVerifiedExtractionConfiguration,
  CitationVerifiedExtractionFailure,
  CitationVerifiedExtractionResult,
  makeCitationVerifiedExtraction,
} from "./VerifiedExtraction.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SourceExtraction");
/** Completed verified source extraction and separate source-free diagnostics.
 * @internal @category models @since 0.0.0
 */
export class CitationSourceExtractionResult extends S.Opaque<
  CitationSourceExtractionResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({ ...CitationVerifiedExtractionResult.fields, report: CitationEngineReport }).pipe(
    $I.annoteSchema("CitationSourceExtractionResult", {
      description: "Verified extraction with a completed-operation report; timing is separate from semantic values.",
    })
  )
) {}
/** Capture source/semantic dependencies for one admitted parent operation.
 * @internal @category operations @since 0.0.0
 */
export const ownCitationSourceExtraction = Effect.fn("Citation.ownSourceExtraction")(function* (
  limits: CitationEngineLimits,
  configuration: CitationVerifiedExtractionConfiguration
) {
  const source = yield* makeCitationSourceRequestAdapter(limits);
  const semantic = yield* ownCitationSemanticExtraction(limits, configuration.extraction);
  const config = CitationVerifiedExtractionConfiguration.make({
    extraction: semantic.config,
    engineArtifact: configuration.engineArtifact,
  });
  return { source, config, children: semantic.children };
});
const own = ownCitationSourceExtraction;
const extractPrepared = Effect.fn("Citation.extractPreparedSource")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  request: Effect.Success<ReturnType<Effect.Success<ReturnType<typeof makeCitationSourceRequestAdapter>>["prepare"]>>
) {
  return yield* Effect.gen(function* () {
    const extraction = yield* makeCitationVerifiedExtraction(limits, runtime, owned.config);
    return yield* extraction.extract(request);
  }).pipe(Effect.provideContext(owned.children));
});
const prepareSource = (method: keyof Effect.Success<ReturnType<typeof makeCitationSourceRequestAdapter>>) =>
  Effect.fn("Citation.extractResolvedSource")(function* (
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    owned: Effect.Success<ReturnType<typeof own>>,
    raw: unknown
  ) {
    const [workDuration, result] = yield* Effect.timed(
      Effect.gen(function* () {
        const request = yield* owned.source[method](raw);
        return yield* extractPrepared(limits, runtime, owned, request);
      })
    );
    return { result, workDuration, limits, engineArtifact: owned.config.engineArtifact };
  });
/** Resolve and extract within the existing admitted parent's Scope and budget.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationSourceExtraction = prepareSource("prepare");
/** Prepare independently verified plain/markup slots under the same parent.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationSourcePairExtraction = prepareSource("preparePair");
const prepare = prepareCitationSourceExtraction;
const preparePair = prepareCitationSourcePairExtraction;
/** Admit before resolver work and retain one enclosing deadline and cumulative
 * text budget through verified occurrence production. Child extraction reuses
 * the existing parent admission Context rather than acquiring another permit.
 * Captured SourceTextResolver is installation-only; extract has R=never.
 * Single and paired primitive profiles share this owner. Retained model
 * mutation and custom-tokenizer behavior remain separate compatibility duties.
 * @internal @category constructors @since 0.0.0
 */
const definition = {
  schema: S.toType(CitationVerifiedExtractionConfiguration),
  invalid: () => CitationVerifiedExtractionFailure.make({ reason: "invalid-configuration" }),
  own,
  project: (
    patch: Effect.Success<ReturnType<typeof prepare>>,
    reservedUnits: number
  ): CitationSourceExtractionResult => {
    const result = patch.result;
    const raw = result.semantic.raw.outcome;
    const tokenizer = raw._tag === "Shortcut" ? null : raw.result.extraction.tokenizer;
    const extraction = CitationExtractionMeasurements.make({
      tokenizer:
        tokenizer === null ? null : { patternsChecked: tokenizer.patternsChecked, tokens: tokenizer.tokens.length },
      semanticCitations: result.semantic.citations.length,
      verifiedMentions: result.occurrences.mentions.length,
      unverifiedCitations: result.occurrences.unverified.length,
      unverifiedComponents: result.occurrences.unverifiedComponents.length,
      unboundWarnings: result.occurrences.unboundWarnings.length,
    });
    const report = CitationEngineReport.make({
      operation: "extract",
      engineArtifact: patch.engineArtifact,
      limits: patch.limits,
      workDuration: patch.workDuration,
      producedTextUtf16: reservedUnits,
      extraction,
    });
    const completed = CitationSourceExtractionResult.make({ ...result, report, reservedUnits });
    return { ...completed, source: result.source, semantic: result.semantic, occurrences: result.occurrences };
  },
};
/** Single raw component under one admitted verified extraction.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourceExtraction = makeCitationMetadataStage({ ...definition, method: "extract", prepare });
/** Independent plain/markup sources under the same admission and budget.
 * Captured Clock measures work separately from semantic citation data.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourcePairExtraction = makeCitationMetadataStage({
  ...definition,
  method: "extract",
  prepare: preparePair,
});
