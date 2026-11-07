/** Verified raw extraction and registered default resolution in one operation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationDocument, CitationDocumentReceipt, FullCitation } from "@beep/law-practice-domain/values";
import { CitationEngineReport } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationAuthorityEdition } from "./AuthorityIdentity.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import { makeCitationMetadataStage } from "./MetadataComposition.ts";
import { makeCitationRegisteredResolver } from "./RegisteredResolver.ts";
import { CitationResourceBinding } from "./ResourceIdentity.ts";
import {
  ownCitationSourceExtraction,
  prepareCitationSourceExtraction,
  prepareCitationSourcePairExtraction,
} from "./SourceExtraction.ts";
import {
  CitationVerifiedExtractionConfiguration,
  CitationVerifiedExtractionFailure,
  CitationVerifiedExtractionResult,
} from "./VerifiedExtraction.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

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
  }).pipe(
    $I.annoteSchema("CitationExtractedDocumentResult", {
      description: "One complete source extraction/resolution with measured work and cumulative parent reservations.",
    })
  )
) {}
const own = Effect.fn("Citation.ownSourceDocument")(function* (
  limits: CitationEngineLimits,
  configuration: CitationVerifiedExtractionConfiguration
) {
  const extraction = yield* ownCitationSourceExtraction(limits, configuration);
  const resolver = yield* makeCitationRegisteredResolver();
  const editions = yield* CitationFrozenEditions;
  return { extraction, resolver, editions };
});
const editionNames = Effect.fn("Citation.sourceDocumentEditionNames")(function* (
  owned: Effect.Success<ReturnType<typeof own>>,
  result: CitationVerifiedExtractionResult
) {
  let seen = HashSet.empty<string>();
  const output = A.empty<CitationAuthorityEdition>();
  for (const mention of result.occurrences.mentions) {
    const citation = mention.citation;
    if (!S.is(FullCitation)(citation) || O.isNone(citation.publication.selectedEdition)) continue;
    const reference = citation.publication.selectedEdition.value;
    if (HashSet.has(seen, reference)) continue;
    const edition = yield* owned.editions.lookup(reference, citation.type);
    output.push(CitationAuthorityEdition.make({ edition: reference, shortName: edition.value.short_name }));
    seen = HashSet.add(seen, reference);
  }
  return output;
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
        const editions = yield* editionNames(owned, result);
        const resolved = yield* owned.resolver.resolve({
          verifiedSource: result.source.source,
          engineArtifact: owned.extraction.config.engineArtifact,
          mentions: result.occurrences.mentions,
          editions,
          limits,
        });
        return { result, resolved, editions };
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
  });
const definition = {
  schema: S.toType(CitationVerifiedExtractionConfiguration),
  invalid: () => CitationVerifiedExtractionFailure.make({ reason: "invalid-configuration" }),
  own,
  project,
};
/** Resolve genuine single-source input, extract verified occurrences, then run
 * registered default resolution without another outer permit or Scope.
 * Installation captures frozen editions, resolver ports and secure randomness.
 * Returned extract requires no services; full host protocols remain required.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourceDocument = makeCitationMetadataStage({
  ...definition,
  method: "extract",
  prepare: prepareSource(prepareCitationSourceExtraction),
});
/** Same connected operation for independently verified plain/markup inputs.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSourcePairDocument = makeCitationMetadataStage({
  ...definition,
  method: "extract",
  prepare: prepareSource(prepareCitationSourcePairExtraction),
});
