/** Live four-operation composition over captured server citation adapters.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngine,
  CitationEngineLimits,
  CitationInputError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { CitationAnnotationEntryConfiguration } from "../internal/Citation/AnnotationEntry.ts";
import { failCitationAnnotationBoundary } from "../internal/Citation/AnnotationFailure.ts";
import { makeCitationAnnotationOperation } from "../internal/Citation/AnnotationOperation.ts";
import { CitationMissingPageIdentityFactory } from "../internal/Citation/CallbackRuntimeIndex.ts";
import { CitationDefaultConfigurationInput } from "../internal/Citation/DefaultConfiguration.ts";
import { makeCitationDocumentServices } from "../internal/Citation/DocumentServices.ts";
import {
  CitationEngineBuildIdentity,
  makeCitationDefaultEngineConfiguration,
} from "../internal/Citation/EngineArtifact.ts";
import { failCitationExtractionBoundary } from "../internal/Citation/EngineFailure.ts";
import { CitationFrozenEditions } from "../internal/Citation/FrozenEditions.ts";
import { CitationNativeProcessAdmission, makeCitationAdmissionOwners } from "../internal/Citation/NativeAdmission.ts";
import { CitationNativeProcessRuntime } from "../internal/Citation/NativeProcess.ts";
import { captureCitationOperationPolicy, captureCitationSnapshot } from "../internal/Citation/Snapshot.ts";
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
const ConfigurationJson = CitationEngineConfiguration.pipe(S.toCodecJson, S.fromJsonString);
const make = Effect.fn("Citation.makeEngine")(function* (raw: unknown) {
  const invalid = () => CitationInputError.make({ operation: "extract" });
  const configuration = yield* captureCitationSnapshot(Configuration, ConfigurationJson, raw, invalid);
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

/** Complete installation data for the production default owner assembly.
 * Runtimes and paths are trusted deployment inputs; source requests cannot
 * select them. Build metadata must describe the actual implementation and ports.
 * Every backend must have the declared build runtime kind. This schema does not
 * attest executable contents or infer deployment identities from asset hashes.
 * **Example** (Inspect the explicit installation requirements)
 * ```ts
 * import { CitationEngineDefaultConfiguration } from "@beep/law-practice-server/layer"
 * console.log(CitationEngineDefaultConfiguration.fields.assets !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationEngineDefaultConfiguration extends S.Opaque<
  CitationEngineDefaultConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    limits: CitationEngineLimits,
    build: CitationEngineBuildIdentity,
    assets: CitationDefaultConfigurationInput,
    runtime: CitationNativeProcessRuntime,
    htmlRuntime: CitationNativeProcessRuntime,
    xmlRuntime: CitationNativeProcessRuntime,
  }).pipe(
    $I.annoteSchema("CitationEngineDefaultConfiguration", {
      description:
        "Explicit build, policy, authenticated asset locations and native backends for one scoped engine owner cohort.",
    })
  )
) {}
const DefaultConfiguration = S.toType(CitationEngineDefaultConfiguration);
const DefaultConfigurationJson = CitationEngineDefaultConfiguration.pipe(S.toCodecJson, S.fromJsonString);
const makeDefault = Effect.fn("Citation.makeDefaultEngine")(function* (raw: unknown) {
  const invalid = () => CitationInputError.make({ operation: "extract" });
  // Snapshot before asynchronous asset reads or host acquisition can mutate input.
  const configuration = yield* captureCitationSnapshot(DefaultConfiguration, DefaultConfigurationJson, raw, invalid);
  const { limits, build, runtime, htmlRuntime, xmlRuntime, assets } = configuration;
  if (
    !A.every([runtime, htmlRuntime, xmlRuntime, assets.diffRuntime], (backend) => backend.kind === build.runtime.kind)
  )
    return yield* invalid();
  const owners = yield* makeCitationAdmissionOwners(limits).pipe(Effect.mapError(invalid));
  const installed = yield* makeCitationDefaultEngineConfiguration(limits, assets, build).pipe(Effect.mapError(invalid));
  const services = yield* makeCitationDocumentServices(limits, htmlRuntime).pipe(
    Effect.provideContext(owners),
    Effect.mapError((error) =>
      S.is(CitationSafetyLimitExceeded)(error)
        ? CitationSafetyLimitExceeded.make({ operation: "extract", limit: error.limit })
        : invalid()
    )
  );
  const captured = Context.merge(owners, services.context).pipe(
    Context.add(CitationFrozenEditions, installed.editions)
  );
  const engine = yield* make(
    CitationEngineConfiguration.make({
      limits,
      runtime,
      extraction: { extraction: installed.configuration, engineArtifact: installed.engineArtifact },
      annotation: { geometry: installed.configuration.extraction.document, xmlRuntime },
    })
  ).pipe(Effect.provideContext(captured));
  return Context.add(captured, CitationEngine, engine);
});
/** Install authenticated default parsing, cleaner/value/container owners, one
 * shared operation admission and one shared native admission for all four
 * operations. The Layer scope owns cleanup, including failed acquisition.
 * Trusted source, host cleaner/object-identity and platform services remain
 * required and are captured at installation. The output Context also contains
 * the coherent owner services for trusted server plan/container setup. No test protocol or synthetic
 * missing-page hash is substituted. An existing caller owner is not reused by
 * this explicitly independent default assembly; use CitationEngineLive when
 * composing an already shared owner cohort.
 * **Example** (Inspect the default Layer constructor)
 * ```ts
 * import { CitationEngineDefaultLive } from "@beep/law-practice-server/layer"
 * console.log(typeof CitationEngineDefaultLive) // "function"
 * ```
 * @category layers
 * @since 0.0.0
 */
export const CitationEngineDefaultLive = (configuration: CitationEngineDefaultConfiguration) =>
  Layer.effectContext(makeDefault(configuration));
