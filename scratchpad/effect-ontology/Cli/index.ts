/**
 * CLI: Effect Ontology
 *
 * Command-line interface for knowledge extraction and reasoning tools.
 * Built with @effect/cli for type-safe command parsing.
 *
 * @since 2.0.0
 * @module Cli
 */

import { makeDrizzleLayer } from "@beep/postgres";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, Layer, Option } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
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
 * PostgreSQL client layer
 */
const PgClientLayer = PgClient.layerConfig({
  host: Config.string("POSTGRES_HOST"),
  port: Config.number("POSTGRES_PORT").pipe(Config.withDefault(5432)),
  database: Config.string("POSTGRES_DATABASE").pipe(Config.withDefault("workflow")),
  username: Config.string("POSTGRES_USER").pipe(Config.withDefault("workflow")),
  password: Config.redacted("POSTGRES_PASSWORD"),
});

/**
 * PgDrizzle layer with PgClient dependency
 */
const PgDrizzleLayer = makeDrizzleLayer().pipe(Layer.provideMerge(PgClientLayer));

/**
 * Full LinkIngestion stack when PostgreSQL is configured
 */
const LinkIngestionLive = LinkIngestionService.Default.pipe(
  Layer.provideMerge(ContentEnrichmentAgent.Default),
  Layer.provideMerge(JinaReaderClient.Default),
  Layer.provideMerge(PgDrizzleLayer),
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

    if (Option.isSome(postgresHost)) {
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
).pipe(Layer.provide(ConfigServiceDefault), Layer.provideMerge(BunServices.layer));

// =============================================================================
// Entry Point
// =============================================================================

/**
 * Run the CLI with provided arguments
 *
 * @param args - Command line arguments (typically Bun.argv)
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
