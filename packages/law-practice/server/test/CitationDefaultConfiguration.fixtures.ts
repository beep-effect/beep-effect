/** Connected replay uses the same production default assembly as server wiring.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationDefaultConfigurationInput } from "@beep/law-practice-server/internal/Citation/DefaultConfiguration";
import { makeCitationDefaultEngineConfiguration } from "@beep/law-practice-server/internal/Citation/EngineArtifact";
import { CitationFrozenEditions } from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import {
  installCitationDocumentExtractionFixture,
  installCitationDocumentRuntimeFixture,
} from "./CitationDocumentExtraction.fixtures.ts";
import { citationFixtureEngineBuild } from "./CitationEngineArtifact.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import type {
  CitationNativeProcessRuntime,
  CitationNativeRuntimeKind,
} from "@beep/law-practice-server/internal/Citation/NativeProcess";

/** Canonical committed asset locations, shared by both installation paths.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const citationDefaultFixtureAssetInput = (diffRuntime: CitationNativeProcessRuntime) =>
  CitationDefaultConfigurationInput.make({
    parserCatalog: NodeURL.fileURLToPath(new URL("../assets/citation/parser-catalog.data", import.meta.url)),
    helpers: NodeURL.fileURLToPath(new URL("../assets/citation/helper-configurations.data", import.meta.url)),
    vocabulary: NodeURL.fileURLToPath(new URL("../assets/citation/semantic-editions.json", import.meta.url)),
    diffRuntime,
  });

const installDefaults = Effect.fn("DefaultConfigurationTest.defaults")(function* <Services>(
  kind: CitationNativeRuntimeKind,
  setup: Effect.Success<ReturnType<typeof setupCitationMetadataRuntime>>,
  prepared: Pick<Effect.Success<ReturnType<typeof installCitationDocumentRuntimeFixture>>, "diffRuntime"> & {
    readonly provided: Context.Context<Services>;
  }
) {
  const { diffRuntime, provided } = prepared;
  const installed = yield* makeCitationDefaultEngineConfiguration(
    setup.limits,
    citationDefaultFixtureAssetInput(diffRuntime),
    citationFixtureEngineBuild(kind)
  ).pipe(Effect.provideContext(provided), DateTime.withCurrentZoneOffset(0));
  return {
    defaultConfiguration: installed.configuration,
    assets: installed.assets,
    engineArtifact: installed.engineArtifact,
    artifactDescriptor: installed.descriptor,
    provided: Context.add(provided, CitationFrozenEditions, installed.editions),
  };
});

/** Install authenticated production defaults while preserving the complete replay fixture.
 *
 * **Example** (Preparing a complete replay)
 * ```ts
 * import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
 * const installation = installCitationDefaultConfigurationFixture("bun");
 * ```
 * @internal @category testing @since 0.0.0
 */
export const installCitationDefaultConfigurationFixture = Effect.fn("DefaultConfigurationTest.install")(function* (
  kind: CitationNativeRuntimeKind
) {
  const original = yield* installCitationDocumentExtractionFixture(kind);
  const installed = yield* installDefaults(kind, original.setup, {
    diffRuntime: original.configuration.document.diffRuntime,
    provided: original.provided,
  });
  return { ...original, ...installed };
});

/** Install production defaults for source-document tests without unused replay evidence or stages.
 *
 * **Example** (Preparing a fresh source-document installation)
 * ```ts
 * import { installCitationSourceDocumentConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
 * const installation = installCitationSourceDocumentConfigurationFixture("bun");
 * ```
 * @internal @category testing @since 0.0.0
 */
export const installCitationSourceDocumentConfigurationFixture = Effect.fn("DefaultConfigurationTest.sourceDocument")(
  function* (kind: CitationNativeRuntimeKind) {
    const base = yield* setupCitationMetadataRuntime(kind, undefined, false, true, 8192);
    const limits = { ...base.limits, concurrentOperations: 1 };
    const operation = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideContext(base.provided));
    const setup = {
      ...base,
      limits,
      operation,
      provided: Context.add(base.provided, CitationOperationAdmission, operation),
    };
    const prepared = yield* installCitationDocumentRuntimeFixture(kind, setup);
    const installed = yield* installDefaults(kind, setup, prepared);
    return { setup, ...installed };
  }
);
