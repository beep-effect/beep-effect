import { CitationOperationAdmission } from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationCleanerProtocols } from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import { CitationDocumentStepContainers } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import { CitationDocumentInputProtocols } from "@beep/law-practice-server/internal/Citation/InputDocument";
import { CitationNativeProcessAdmission } from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import * as FileSystem from "effect/FileSystem";
import { citationDefaultFixtureAssetInput } from "./CitationDefaultConfiguration.fixtures.ts";
import { citationPrimitiveCleanerProtocols } from "./CitationDocumentServices.fixtures.ts";
import { citationFixtureEngineBuild } from "./CitationEngineArtifact.fixtures.ts";
import { makeCitationHtmlTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
/** Shared real public-engine installation for runtime and corpus qualification.
 * @internal @packageDocumentation @since 0.0.0
 */

import { SourceTextResolver } from "@beep/file-processing/SourceText";
import {
  CitationMissingPageIdentities,
  CitationMissingPageIdentityFactory,
} from "@beep/law-practice-server/internal/Citation/CallbackRuntimeIndex";
import {
  CitationEngineConfiguration,
  CitationEngineDefaultConfiguration,
  CitationEngineDefaultLive,
  CitationEngineLive,
} from "@beep/law-practice-server/layer";
import { CitationEngine } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { makeCitationXmlTestRuntime } from "./CitationXmlWorker.fixtures.ts";
import type { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";

/** Controlled per-operation object identities for conditional grouping proof.
 * This is not a production allocator or a native-address/hash attestation.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const citationFixtureMissingPageIdentityFactory = CitationMissingPageIdentityFactory.of({
  build: Effect.sync(() => {
    let hashes = HashMap.empty<string, bigint>();
    return CitationMissingPageIdentities.of({
      read: Effect.fn("EngineLayerTest.identity")(function* (reference) {
        const key =
          reference._tag === "Mention" ? `Mention:${reference.mentionId}` : `Detached:${reference.detachedId}`;
        const existing = HashMap.get(hashes, key);
        if (O.isSome(existing)) return existing.value;
        const value = BigInt("4294967296") + BigInt(HashMap.size(hashes)) * BigInt("16");
        hashes = HashMap.set(hashes, key, value);
        return value;
      }),
    });
  }),
});

/** Build the same real Layer from authenticated production configuration and
 * coherent captured owners. The caller supplies the canonical fixture resolver.
 * @internal @category testing @since 0.0.0
 */
export const buildCitationEngineFixture = Effect.fn("EngineLayerTest.build")(function* (
  installed: Effect.Success<ReturnType<typeof installCitationDefaultConfigurationFixture>>,
  resolver: SourceTextResolver["Service"]
) {
  const { setup, provided, defaultConfiguration, engineArtifact } = installed;
  const xmlRuntime = yield* makeCitationXmlTestRuntime(setup.runtime.kind);
  const configuration = CitationEngineConfiguration.make({
    limits: { ...setup.limits, cleanDeadline: setup.limits.cleanDeadline.pipe(Duration.toMillis, Duration.millis) },
    runtime: setup.runtime,
    extraction: { extraction: defaultConfiguration, engineArtifact },
    annotation: { geometry: defaultConfiguration.extraction.document, xmlRuntime },
  });
  const built = yield* Layer.build(CitationEngineLive(configuration)).pipe(
    Effect.provideContext(provided),
    Effect.provideService(SourceTextResolver, resolver),
    // Controlled identity inputs qualify grouping conditionally. They do not
    // attest a production allocator or exact native source hash integers.
    Effect.provideService(CitationMissingPageIdentityFactory, citationFixtureMissingPageIdentityFactory),
    DateTime.withCurrentZoneOffset(0)
  );
  return { engine: Context.get(built, CitationEngine), configuration };
});

/** Build the production default Layer with explicit test-only host/deployment
 * dependencies; actual owners and asset assembly are created by the Layer.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const buildCitationDefaultEngineFixture = Effect.fn("EngineLayerTest.buildDefault")(function* (
  installed: Effect.Success<ReturnType<typeof installCitationDefaultConfigurationFixture>>,
  resolver: SourceTextResolver["Service"]
) {
  const { setup, defaultConfiguration } = installed;
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-default-html-" });
  const htmlRuntime = yield* makeCitationHtmlTestRuntime(setup.runtime.kind, directory);
  const xmlRuntime = yield* makeCitationXmlTestRuntime(setup.runtime.kind);
  const configuration = CitationEngineDefaultConfiguration.make({
    limits: { ...setup.limits, cleanDeadline: setup.limits.cleanDeadline.pipe(Duration.toMillis, Duration.millis) },
    build: citationFixtureEngineBuild(setup.runtime.kind),
    runtime: setup.runtime,
    htmlRuntime,
    xmlRuntime,
    assets: citationDefaultFixtureAssetInput(defaultConfiguration.extraction.document.diffRuntime),
  });
  const build = Effect.fn("EngineLayerTest.installDefault")((configuration: CitationEngineDefaultConfiguration) =>
    Layer.build(CitationEngineDefaultLive(configuration)).pipe(
      Effect.provideContext(setup.context),
      Effect.provideService(CitationCleanerProtocols, citationPrimitiveCleanerProtocols),
      Effect.provideService(CitationMissingPageIdentityFactory, citationFixtureMissingPageIdentityFactory),
      Effect.provideService(SourceTextResolver, resolver),
      DateTime.withCurrentZoneOffset(0)
    )
  );
  const built = yield* build(configuration);
  return {
    build,
    engine: Context.get(built, CitationEngine),
    configuration,
    operation: Context.get(built, CitationOperationAdmission),
    admission: Context.get(built, CitationNativeProcessAdmission),
    adapter: {
      create: Context.get(built, CitationDocumentStepContainers).create,
      document: Context.get(built, CitationDocumentInputProtocols),
    },
  };
});
