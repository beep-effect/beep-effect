/**
 * CLI: Effect Ontology
 *
 * **Details**
 *
 * Command-line interface for knowledge extraction and reasoning tools.
 * Built with @effect/cli for type-safe command parsing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Config, Effect, Layer } from "effect";
import * as O from "effect/Option";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import { DatabaseReadyLive } from "../Runtime/Persistence/PostgresLayer.ts";
import { makeLanguageModelLayer } from "../Runtime/ProductionRuntime.ts";
import { ConfigServiceDefault } from "../Service/Config.ts";
import { ContentEnrichmentAgent } from "../Service/ContentEnrichmentAgent.ts";
import { ImageExtractor } from "../Service/ImageExtractor.ts";
import { ImageFetcher } from "../Service/ImageFetcher.ts";
import { ImageStore } from "../Service/ImageStore.ts";
import { JinaReaderClient } from "../Service/JinaReaderClient.ts";
import { LinkIngestionService } from "../Service/LinkIngestionService.ts";
import { RdfBuilder } from "../Service/Rdf.ts";
import { Reasoner } from "../Service/Reasoner.ts";
import { StorageServiceLive } from "../Service/Storage.ts";
import { WikidataClient } from "../Service/WikidataClient.ts";
import { extractCommand } from "./Commands/Extract.ts";
import { documentsCommand, fetchCommand, ingestBatchCommand, ingestLinkCommand } from "./Commands/Fetch.ts";
import { inferenceCommand } from "./Commands/Inference.ts";
import { ingestCommand } from "./Commands/Ingest.ts";
import { linkCommand } from "./Commands/Link.ts";
import { reconcileCommand } from "./Commands/Reconcile.ts";
import { storageCommand } from "./Commands/Storage.ts";
import { workflowCommand } from "./Commands/Workflow.ts";

// =============================================================================
// Root Command
// =============================================================================

const rootCommand = Command.make("effect-onto").pipe(
  Command.withSubcommands([
    extractCommand,
    inferenceCommand,
    ingestCommand,
    reconcileCommand,
    linkCommand,
    storageCommand,
    fetchCommand,
    ingestLinkCommand,
    ingestBatchCommand,
    documentsCommand,
    workflowCommand,
  ]),
  Command.withDescription("Effect Ontology CLI - Knowledge extraction and reasoning tools")
);

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Full LinkIngestion stack when PostgreSQL is configured
 */
const LinkIngestionLive = LinkIngestionService.Default.pipe(
  Layer.provideMerge(ContentEnrichmentAgent.Default),
  Layer.provideMerge(JinaReaderClient.Default),
  Layer.provideMerge(DatabaseReadyLive),
  Layer.provideMerge(ImageExtractor.Default),
  Layer.provideMerge(ImageFetcher.Default),
  Layer.provideMerge(ImageStore.Default),
  Layer.provideMerge(makeLanguageModelLayer),
  Layer.provideMerge(FetchHttpClient.layer),
  Layer.provideMerge(StorageServiceLive),
  Layer.provideMerge(ConfigServiceDefault)
);

/**
 * Dynamic LinkIngestion layer selection based on POSTGRES_HOST config.
 * Uses Layer.unwrap for config-driven layer selection.
 */
const LinkIngestionLayer = Layer.unwrap(
  Effect.gen(function* () {
    const postgresHost = yield* Config.string("POSTGRES_HOST").pipe(Config.option);

    if (O.isSome(postgresHost)) {
      return LinkIngestionLive;
    } else {
      // Use the service's built-in Disabled layer
      return LinkIngestionService.Disabled;
    }
  })
);

/**
 * CLI runtime layer with all required services
 *
 * Provides:
 * - ConfigService (via ConfigServiceDefault with env loading)
 * - RdfBuilder (Turtle parsing/serialization)
 * - Reasoner (RDFS reasoning)
 * - StorageService (file/GCS storage)
 * - WikidataClient (Wikidata API integration)
 * - JinaReaderClient (Jina Reader API for URL fetching)
 * - LinkIngestionService (mocked if Postgres not configured)
 * - BunServices (FileSystem, Path, etc.)
 */
const CliLive = Layer.mergeAll(
  Reasoner.Default,
  RdfBuilder.Default,
  StorageServiceLive,
  WikidataClient.Default,
  JinaReaderClient.Default,
  LinkIngestionLayer
).pipe(Layer.provideMerge(ConfigServiceDefault), Layer.provideMerge(BunServices.layer));

// =============================================================================
// Entry Point
// =============================================================================

/**
 * Runs the `effect-onto` root command against an argv vector using `CliLive`.
 *
 * **Gotchas**
 *
 * Link ingestion is swapped to {@link LinkIngestionService.Disabled} when
 * `POSTGRES_HOST` is unset. Commands that persist URLs then no-op at the
 * database boundary.
 *
 * **Example** (Name extract argv for the root runner)
 *
 * ```ts
 * import { runCli } from "@effect-ontology/Cli/index"
 *
 * const argv = [
 *   "effect-onto",
 *   "extract",
 *   "ontologies/people.ttl",
 *   "--text",
 *   "Ada Lovelace was a mathematician"
 * ] as const
 * console.log(runCli.length) // 1
 * console.log(argv[1]) // "extract"
 * console.log(argv.includes("--text")) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const runCli = (args: ReadonlyArray<string>) => {
  const effect = Command.runWith(rootCommand, {
    version: "0.1.0",
  })(args);

  const main = Effect.scoped(
    Effect.gen(function* () {
      const context = yield* Layer.build(CliLive);
      return yield* effect.pipe(Effect.provide(context));
    })
  );

  return BunRuntime.runMain(main);
};
