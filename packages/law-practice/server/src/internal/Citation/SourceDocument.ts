/** Verified raw extraction and registered default resolution in one operation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationDocument, CitationDocumentReceipt } from "@beep/law-practice-domain/values";
import {
  CitationEngineExtractionResult,
  CitationEngineReport,
  CitationExtractionDiagnostics,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationAuthorityEdition } from "./AuthorityIdentity.ts";
import { failCitationExtractionBoundary } from "./EngineFailure.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { CitationRegexOperation } from "./RegexPolicy.ts";
import { makeCitationRegisteredResolver } from "./RegisteredResolver.ts";
import { makeCitationResolutionEditions } from "./ResolutionEditions.ts";
import { CitationResourceBinding } from "./ResourceIdentity.ts";
import {
  ownCitationSourceExtraction,
  prepareCitationSourceExtraction,
  prepareCitationSourcePairExtraction,
  projectCitationSourceExtractionReport,
} from "./SourceExtraction.ts";
import { CitationVerifiedExtractionResult } from "./VerifiedExtraction.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationOwned } from "./ConfigurationOwnership.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import type { CitationVerifiedExtractionConfiguration } from "./VerifiedExtraction.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SourceDocument");
/** Complete connected extraction plus source-bound document and restoration
 * receipt. Original unresolved/ambiguous decisions remain document data.
 * @internal @category models @since 0.0.0
 */
export class CitationExtractedDocumentResult extends S.Opaque<
  CitationExtractedDocumentResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...CitationVerifiedExtractionResult.fields,
    document: CitationDocument,
    receipt: CitationDocumentReceipt,
    resourceBindings: S.Array(CitationResourceBinding),
    editions: S.Array(CitationAuthorityEdition),
    workDuration: CitationEngineReport.fields.workDuration,
    output: CitationEngineExtractionResult,
  }).pipe(
    $I.annoteSchema("CitationExtractedDocumentResult", {
      description: "One complete source extraction/resolution with measured work and cumulative parent reservations.",
    })
  )
) {}
const own = Effect.fn("Citation.ownSourceDocument")(function* (
  limits: CitationEngineLimits,
  configuration: CitationOwned<CitationVerifiedExtractionConfiguration>,
  runtime: CitationNativeProcessRuntime
) {
  const extraction = yield* ownCitationSourceExtraction(limits, configuration, runtime);
  const resolver = yield* makeCitationRegisteredResolver();
  const editions = yield* makeCitationResolutionEditions();
  return { extraction, resolver, editions };
});
const prepareSource = (extract: typeof prepareCitationSourceExtraction) =>
  Effect.fn("Citation.extractResolvedDocument")(function* (
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    owned: Effect.Success<ReturnType<typeof own>>,
    raw: unknown
  ) {
    const [workDuration, patch] = yield* Effect.timed(
      Effect.gen(function* () {
        const prepared = yield* extract(limits, runtime, owned.extraction, raw);
        const result = prepared.result;
        const editions = yield* owned.editions.forMentions(result.occurrences.mentions);
        const resolved = yield* owned.resolver.resolve({
          verifiedSource: result.source.source,
          engineArtifact: owned.extraction.config.engineArtifact,
          mentions: result.occurrences.mentions,
          editions,
          limits,
        });
        return { result, resolved, editions, limits: prepared.limits, engineArtifact: prepared.engineArtifact };
      })
    );
    return { ...patch, workDuration };
  });
const project = (patch: Effect.Success<ReturnType<ReturnType<typeof prepareSource>>>, reservedUnits: number) =>
  CitationExtractedDocumentResult.make({
    ...patch.result,
    ...patch.resolved,
    editions: patch.editions,
    workDuration: patch.workDuration,
    reservedUnits,
    output: CitationEngineExtractionResult.make({
      source: patch.result.source,
      inputs: patch.result.inputs,
      citations: patch.result.semantic.citations,
      document: patch.resolved.document,
      diagnostics: CitationExtractionDiagnostics.make({
        unverified: patch.result.occurrences.unverified,
        unverifiedComponents: patch.result.occurrences.unverifiedComponents,
        unboundWarnings: patch.result.occurrences.unboundWarnings,
      }),
      report: projectCitationSourceExtractionReport(patch, reservedUnits),
    }),
  });
const definition = {
  own,
  project,
};
/** Resolve genuine single-source input, extract verified occurrences, then run
 * registered default resolution without another outer permit or Scope.
 * Installation captures frozen editions, resolver ports and secure randomness.
 * Returned extract requires no services; full host protocols remain required.
 * @internal @category constructors @since 0.0.0
 */
const installSingle = makeCitationMetadataStage({
  ...definition,
  method: "extract",
  prepare: prepareSource(prepareCitationSourceExtraction),
});
/** Same connected operation for independently verified plain/markup inputs.
 * @internal @category constructors @since 0.0.0
 */
const installPair = makeCitationMetadataStage({
  ...definition,
  method: "extract",
  prepare: prepareSource(prepareCitationSourcePairExtraction),
});

const closeMethod = (install: typeof installSingle) =>
  Effect.fn("Citation.installSourceDocumentBoundary")(
    function* (
      limits: CitationEngineLimits,
      runtime: CitationNativeProcessRuntime,
      configuration: CitationOwned<CitationVerifiedExtractionConfiguration>
    ) {
      const stage = yield* install(limits, runtime, configuration);
      return {
        extract: Effect.fn("Citation.extractSourceDocumentBoundary")((raw: unknown) =>
          stage.extract(raw).pipe(Effect.catch(failCitationExtractionBoundary))
        ),
      };
    },
    Effect.provideService(CitationRegexOperation, "extract")
  );
/** Single source document with a closed engine method failure and captured
 * extraction operation. Installation errors remain trusted composition errors.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourceDocument = closeMethod(installSingle);
/** Paired sources share the same closed failure, admission and timing owner.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourcePairDocument = closeMethod(installPair);
