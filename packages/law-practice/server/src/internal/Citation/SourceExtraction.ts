/** Raw source resolution and verified extraction in one admitted operation.
 * Reuses the existing resolver, verifier, extraction stages and Effect ownership.
 * @internal @packageDocumentation @since 0.0.0
 */
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

const own = Effect.fn("Citation.ownSourceExtraction")(function* (
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
const prepare = Effect.fn("Citation.extractResolvedSource")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  owned: Effect.Success<ReturnType<typeof own>>,
  raw: unknown
) {
  const request = yield* owned.source.prepare(raw);
  return yield* Effect.gen(function* () {
    const extraction = yield* makeCitationVerifiedExtraction(limits, runtime, owned.config);
    return yield* extraction.extract(request);
  }).pipe(Effect.provideContext(owned.children));
});
/** Admit before resolver work and retain one enclosing deadline and cumulative
 * text budget through verified occurrence production. Child extraction reuses
 * the existing parent admission Context rather than acquiring another permit.
 * Captured SourceTextResolver is installation-only; extract has R=never.
 * This composes the single-source profile; dual-source and retained Document
 * dispatch remain required and are not classified as unsupported operations.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourceExtraction = makeCitationMetadataStage({
  method: "extract",
  schema: S.toType(CitationVerifiedExtractionConfiguration),
  invalid: () => CitationVerifiedExtractionFailure.make({ reason: "invalid-configuration" }),
  own,
  prepare,
  project: (result, reservedUnits): CitationVerifiedExtractionResult => {
    const completed = CitationVerifiedExtractionResult.make({ ...result, reservedUnits });
    return { ...completed, source: result.source, semantic: result.semantic, occurrences: result.occurrences };
  },
});
