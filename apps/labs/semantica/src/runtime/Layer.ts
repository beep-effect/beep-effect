import * as BunServices from "@effect/platform-bun/BunServices";
import { Layer, Logger } from "effect";
import { CorpusManifestBuilderLive } from "@/corpus/ManifestBuilder";
import { F1CatalogLive } from "@/fixtures/F1";
import { CanaryC0Live } from "@/layers/CanaryC0Live";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { DocumentSourceLive } from "@/layers/DocumentSourceLive";
import { AnthropicExtractionProviderLive } from "@/layers/LanguageModelLive";
import { ParserLive } from "@/layers/ParserLive";
import { ProviderCacheLive } from "@/layers/ProviderCacheLive";
import { LabConfigLive } from "@/runtime/Config";

export { LabConfig } from "@/runtime/Config";

const LoggingLive = Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)], {
  mergeWithExisting: false,
});

const InfrastructureLive = Layer.mergeAll(BunServices.layer, LabConfigLive, LoggingLive);

const P1ServicesLive = Layer.merge(CorpusManifestBuilderLive, F1CatalogLive).pipe(Layer.provide(InfrastructureLive));

const CanonicalizerServiceLive = CanonicalizerLive.pipe(Layer.provide(InfrastructureLive));

const ChunkerServiceLive = ChunkerLive.pipe(Layer.provide(CanonicalizerServiceLive), Layer.provide(InfrastructureLive));

const C0InputServicesLive = Layer.mergeAll(
  CanonicalizerServiceLive,
  ChunkerServiceLive,
  DocumentSourceLive,
  ParserLive,
  ProviderCacheLive
).pipe(Layer.provide(InfrastructureLive));

const AnthropicProviderLive = AnthropicExtractionProviderLive.pipe(Layer.provide(InfrastructureLive));

const C0CanaryLive = CanaryC0Live(AnthropicProviderLive).pipe(
  Layer.provide(Layer.mergeAll(InfrastructureLive, P1ServicesLive, C0InputServicesLive))
);

/**
 * Bun runtime services, environment-decoded lab configuration, C0 input
 * services, and stderr logging.
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
export const RuntimeLayer = Layer.mergeAll(InfrastructureLive, P1ServicesLive, C0InputServicesLive, C0CanaryLive);
