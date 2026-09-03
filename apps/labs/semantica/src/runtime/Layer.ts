import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { makeOpenAiEmbeddingModelLive } from "@beep/openai";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer, Logger } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { CorpusManifestBuilderLive } from "@/corpus/ManifestBuilder";
import { F1CatalogLive } from "@/fixtures/F1";
import { CanaryC0Live } from "@/layers/CanaryC0Live";
import { CanaryC1Live } from "@/layers/CanaryC1Live";
import { CanaryC2Live } from "@/layers/CanaryC2Live";
import { CanonicalizerLive } from "@/layers/CanonicalizerLive";
import { ChunkerLive } from "@/layers/ChunkerLive";
import { DocumentSourceLive } from "@/layers/DocumentSourceLive";
import { ActiveEmbeddingIdentityLive, OpenAiEmbeddingIdentity } from "@/layers/EmbedderLive";
import { AnthropicExtractionProviderLive } from "@/layers/LanguageModelLive";
import { ParserLive } from "@/layers/ParserLive";
import { ProviderCacheLive } from "@/layers/ProviderCacheLive";
import { RdfProjectionLive } from "@/layers/RdfProjectionLive";
import { ReasonerLive } from "@/layers/ReasonerLive";
import { VectorProjectionLive } from "@/layers/VectorProjectionLive";
import { LabConfig, LabConfigLive } from "@/runtime/Config";

export { LabConfig } from "@/runtime/Config";

const LoggingLive = Logger.layer([Logger.withConsoleError(Logger.formatLogFmt)], {
  mergeWithExisting: false,
});

// Bun's fetch aborts at ~300s by default even when the request carries a longer
// AbortSignal; hosted-model generations over full papers routinely need more.
// Bun honors this non-standard RequestInit extension to lift that ceiling.
const FetchTimeoutDisabledLive = Layer.succeed(FetchHttpClient.RequestInit, { timeout: false } as RequestInit);

const InfrastructureLive = Layer.mergeAll(BunServices.layer, FetchTimeoutDisabledLive, LabConfigLive, LoggingLive);

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

const EmbeddingIdentityLive = Layer.unwrap(
  LabConfig.pipe(
    Effect.map((config) =>
      ActiveEmbeddingIdentityLive(
        OpenAiEmbeddingIdentity({
          dimension: config.embeddingDimension,
          model: config.embeddingModel,
          revision: config.embeddingRevision,
        })
      )
    )
  )
).pipe(Layer.provide(InfrastructureLive));

const OpenAiEmbeddingProviderLive = Layer.unwrap(
  LabConfig.pipe(Effect.map((config) => makeOpenAiEmbeddingModelLive(config.embeddingDimension)))
).pipe(Layer.provide(InfrastructureLive));

const VectorServiceLive = VectorProjectionLive.pipe(
  Layer.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))),
  Layer.provide(InfrastructureLive)
);

const RdfServiceLive = RdfProjectionLive.pipe(
  Layer.provide(OxigraphSparqlQueryServiceLive),
  Layer.provide(InfrastructureLive)
);

const C1CanaryLive = CanaryC1Live(OpenAiEmbeddingProviderLive).pipe(
  Layer.provide(
    Layer.mergeAll(
      InfrastructureLive,
      C0CanaryLive,
      C0InputServicesLive,
      EmbeddingIdentityLive,
      RdfServiceLive,
      VectorServiceLive
    )
  )
);

const C2CanaryLive = CanaryC2Live.pipe(
  Layer.provide(Layer.mergeAll(InfrastructureLive, C1CanaryLive, RdfServiceLive, ReasonerLive))
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
export const RuntimeLayer = Layer.mergeAll(
  InfrastructureLive,
  P1ServicesLive,
  C0InputServicesLive,
  C0CanaryLive,
  C1CanaryLive,
  C2CanaryLive
);
