/** Shared real public-engine installation for runtime and corpus qualification.
 * @internal @packageDocumentation @since 0.0.0
 */

import { SourceTextResolver } from "@beep/file-processing/SourceText";
import {
  CitationMissingPageIdentities,
  CitationMissingPageIdentityFactory,
} from "@beep/law-practice-server/internal/Citation/CallbackRuntimeIndex";
import { CitationEngineConfiguration, CitationEngineLive } from "@beep/law-practice-server/layer";
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
    Effect.provideService(
      CitationMissingPageIdentityFactory,
      CitationMissingPageIdentityFactory.of({
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
      })
    ),
    DateTime.withCurrentZoneOffset(0)
  );
  return { engine: Context.get(built, CitationEngine), configuration };
});
