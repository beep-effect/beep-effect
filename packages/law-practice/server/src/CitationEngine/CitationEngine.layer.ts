/** Live four-operation composition over captured server citation adapters.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngine, CitationEngineLimits, CitationInputError } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { CitationAnnotationEntryConfiguration } from "../internal/Citation/AnnotationEntry.ts";
import { failCitationAnnotationBoundary } from "../internal/Citation/AnnotationFailure.ts";
import { makeCitationAnnotationOperation } from "../internal/Citation/AnnotationOperation.ts";
import { CitationMissingPageIdentityFactory } from "../internal/Citation/CallbackRuntimeIndex.ts";
import { failCitationExtractionBoundary } from "../internal/Citation/EngineFailure.ts";
import { CitationNativeProcessAdmission } from "../internal/Citation/NativeAdmission.ts";
import { CitationNativeProcessRuntime } from "../internal/Citation/NativeProcess.ts";
import { captureCitationOperationPolicy } from "../internal/Citation/Snapshot.ts";
import { makeCitationSourceCleaning } from "../internal/Citation/SourceCleaning.ts";
import { makeCitationSourcePairDocument } from "../internal/Citation/SourceDocument.ts";
import { makeCitationSourceResolution } from "../internal/Citation/SourceResolution.ts";
import { CitationVerifiedExtractionConfiguration } from "../internal/Citation/VerifiedExtraction.ts";

const $I = $LawPracticeServerId.create("CitationEngine/CitationEngine.layer");
/** Trusted server configuration assembled from authenticated parser/helper/
 * vocabulary assets and an implementation artifact producer. Host layers supply
 * coherent shared admission, native transport, cleaner/value, source and
 * missing-page semantic-object identity services.
 * These are installation inputs; runtime requests cannot replace them.
 * **Example** (Inspect explicit configuration ownership)
 * ```ts
 * import { CitationEngineConfiguration } from "@beep/law-practice-server/layer"
 * console.log(CitationEngineConfiguration.fields.limits !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineConfiguration extends S.Opaque<
  CitationEngineConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    limits: CitationEngineLimits,
    runtime: CitationNativeProcessRuntime,
    extraction: CitationVerifiedExtractionConfiguration,
    annotation: CitationAnnotationEntryConfiguration,
  }).pipe(
    $I.annoteSchema("CitationEngineConfiguration", {
      description:
        "Explicit trusted policy, regex backend, authenticated extraction/artifact and annotation backend configuration.",
    })
  )
) {}
const Configuration = S.toType(CitationEngineConfiguration);
const make = Effect.fn("Citation.makeEngine")(function* (raw: unknown) {
  const invalid = () => CitationInputError.make({ operation: "extract" });
  const configuration = yield* S.decodeUnknownEffect(Configuration)(raw).pipe(Effect.mapError(invalid));
  const { limits, engineArtifact } = yield* captureCitationOperationPolicy(
    configuration.limits,
    configuration.extraction.engineArtifact,
    invalid
  );
  // A host-provided shared owner is required, so private stage fallbacks cannot
  // silently create a second total native capacity in this composition.
  yield* CitationNativeProcessAdmission;
  // Null-page case hashing uses semantic-object identity. Require the trusted
  // owner at installation instead of refusing a valid citation on first use.
  yield* CitationMissingPageIdentityFactory;
  const cleaner = yield* makeCitationSourceCleaning(limits, engineArtifact);
  const extraction = yield* makeCitationSourcePairDocument(
    limits,
    configuration.runtime,
    configuration.extraction
  ).pipe(Effect.catch(failCitationExtractionBoundary));
  const resolution = yield* makeCitationSourceResolution(limits, engineArtifact);
  const annotation = yield* makeCitationAnnotationOperation(
    limits,
    configuration.runtime,
    configuration.annotation,
    engineArtifact
  ).pipe(Effect.catch((error) => failCitationAnnotationBoundary(limits, error)));
  return CitationEngine.of({
    clean: cleaner.clean,
    extract: Effect.fn("Citation.Engine.extract")((input) =>
      extraction.extract(input).pipe(Effect.map((result) => result.output))
    ),
    resolve: Effect.fn("Citation.Engine.resolve")((input) =>
      resolution.resolve(input).pipe(Effect.map((result) => result.output))
    ),
    annotate: annotation.annotate,
  });
});
/** Build the four real admitted operations with captured dependencies. The host
 * supplies source/vocabulary, missing-page object identity and coherent runtime
 * services through Effect Layer
 * composition; returned methods require no later caller Context. Configuration
 * is acquired when the Layer builds. Canonical retained-document/general-host
 * qualification, complete deployment attestation and final parity remain open.
 * **Example** (Inspect the live Layer constructor)
 * ```ts
 * import { CitationEngineLive } from "@beep/law-practice-server/layer"
 * console.log(typeof CitationEngineLive) // "function"
 * ```
 * @category layers
 * @since 0.0.0
 */
export const CitationEngineLive = (configuration: CitationEngineConfiguration) =>
  Layer.effect(CitationEngine, make(configuration));
