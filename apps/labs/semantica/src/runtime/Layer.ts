import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Logger } from "effect";
import { CorpusManifestBuilderLive } from "@/corpus/ManifestBuilder";
import { F1CatalogLive } from "@/fixtures/F1";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { DocumentSourceLive } from "@/layers/DocumentSourceLive";
import { CachingLanguageModelLive, ReplayLanguageModelLive } from "@/layers/LanguageModelLive";
import { ParserLive } from "@/layers/ParserLive";
import { ProviderCacheLive } from "@/layers/ProviderCacheLive";
import { LabConfig, LabConfigLive, RuntimeMode } from "@/runtime/Config";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";

export { LabConfig } from "@/runtime/Config";

const LoggingLive = Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)], {
  mergeWithExisting: false,
});

/**
 * Selects the live caching adapter or cache-only replay adapter from
 * {@link LabConfig.mode}.
 *
 * **Gotchas**
 *
 * The result is intentionally not acquired by {@link RuntimeLayer}; provider
 * acquisition remains lazy so manifest-only commands never require API keys.
 *
 * @category layers
 * @since 0.0.0
 */
export const LanguageModelRuntimeLive = <E, R>(live: Layer.Layer<LanguageModel.LanguageModel, E, R>) =>
  Layer.unwrap(
    LabConfig.pipe(
      Effect.map((config) =>
        RuntimeMode.$match(config.mode, {
          live: () => CachingLanguageModelLive(live),
          replay: () => ReplayLanguageModelLive,
        })
      )
    )
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
const InfrastructureLive = Layer.mergeAll(BunServices.layer, LabConfigLive, LoggingLive);

const P1ServicesLive = Layer.merge(CorpusManifestBuilderLive, F1CatalogLive).pipe(Layer.provide(InfrastructureLive));

const C0InputServicesLive = Layer.mergeAll(CanonicalizerLive, DocumentSourceLive, ParserLive, ProviderCacheLive).pipe(
  Layer.provide(InfrastructureLive)
);

export const RuntimeLayer = Layer.mergeAll(InfrastructureLive, P1ServicesLive, C0InputServicesLive);
