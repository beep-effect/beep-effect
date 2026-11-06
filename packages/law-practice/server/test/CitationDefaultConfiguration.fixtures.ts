/** Connected replay uses the same production default assembly as server wiring.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { makeCitationDefaultEngineConfiguration } from "@beep/law-practice-server/internal/Citation/EngineArtifact";
import { CitationFrozenEditions } from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";
import { citationFixtureEngineBuild } from "./CitationEngineArtifact.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

/** Install authenticated production data and retain original observations/runtime.
 * @internal @category testing @since 0.0.0
 */
export const installCitationDefaultConfigurationFixture = Effect.fn("DefaultConfigurationTest.install")(function* (
  kind: CitationNativeRuntimeKind
) {
  const original = yield* installCitationDocumentExtractionFixture(kind);
  const { setup, configuration, provided } = original;
  const installed = yield* makeCitationDefaultEngineConfiguration(
    setup.limits,
    {
      parserCatalog: NodeURL.fileURLToPath(new URL("../assets/citation/parser-catalog.data", import.meta.url)),
      helpers: NodeURL.fileURLToPath(new URL("../assets/citation/helper-configurations.data", import.meta.url)),
      vocabulary: NodeURL.fileURLToPath(new URL("../assets/citation/semantic-editions.json", import.meta.url)),
      diffRuntime: configuration.document.diffRuntime,
    },
    citationFixtureEngineBuild(kind)
  ).pipe(Effect.provideContext(provided), DateTime.withCurrentZoneOffset(0));
  return {
    ...original,
    defaultConfiguration: installed.configuration,
    assets: installed.assets,
    engineArtifact: installed.engineArtifact,
    artifactDescriptor: installed.descriptor,
    provided: Context.add(provided, CitationFrozenEditions, installed.editions),
  };
});
