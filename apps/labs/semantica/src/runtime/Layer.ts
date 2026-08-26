import * as BunServices from "@effect/platform-bun/BunServices";
import { Layer, Logger } from "effect";
import { CorpusManifestBuilderLive } from "@/corpus/ManifestBuilder";
import { F1CatalogLive } from "@/fixtures/F1";
import { LabConfigLive } from "@/runtime/Config";

export { LabConfig } from "@/runtime/Config";

const LoggingLive = Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)], {
  mergeWithExisting: false,
});

// C0 composition seam: DocumentSource, Parser, Canonicalizer, Chunker,
// Extractor, Ledger, ProviderCache, and Evaluator layers join the runtime here
// after their schemas and Context.Service contracts land in P2.

/**
 * Bun runtime services, environment-decoded lab configuration, and stderr logging.
 *
 * **Example** (Check the runtime layer)
 *
 * ```ts
 * import { RuntimeLayer } from "@/runtime/Layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(RuntimeLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
const InfrastructureLive = Layer.mergeAll(BunServices.layer, LabConfigLive, LoggingLive);

const P1ServicesLive = Layer.merge(CorpusManifestBuilderLive, F1CatalogLive).pipe(Layer.provide(InfrastructureLive));

export const RuntimeLayer = Layer.merge(InfrastructureLive, P1ServicesLive);
