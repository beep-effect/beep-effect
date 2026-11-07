/** Shared real public-engine installation for runtime and corpus qualification.
 * @internal @packageDocumentation @since 0.0.0
 */

import { SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationEngineConfiguration, CitationEngineLive } from "@beep/law-practice-server/layer";
import { CitationEngine } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { makeCitationXmlTestRuntime } from "./CitationXmlWorker.fixtures.ts";
import type { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";

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
    DateTime.withCurrentZoneOffset(0)
  );
  return { engine: Context.get(built, CitationEngine), configuration };
});
