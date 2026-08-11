/**
 * CLI: Fetch and Link Ingestion Commands
 *
 * Commands for fetching web content via Jina Reader API,
 * ingesting URLs to storage, and managing ingested documents.
 *
 * @since 2.0.0
 * @module Cli/Commands/Fetch
 */

import { Console, Effect, FileSystem } from "effect";
import { getSomesStruct } from "@beep/utils/Option";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Argument as Args, Command, Flag as Options } from "effect/unstable/cli";
import { ContentEnrichmentAgent } from "../../Service/ContentEnrichmentAgent.ts";
import { JinaReaderClient } from "../../Service/JinaReaderClient.ts";
import type { IngestResult } from "../../Service/LinkIngestionService.ts";
import { LinkIngestionError, LinkIngestionService } from "../../Service/LinkIngestionService.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Fetch Command - Preview URL content without storage
// =============================================================================

const fetchUrl = Args.string("url").pipe(Args.withDescription("URL to fetch content from"));

const showMetadataOption = Options.boolean("metadata").pipe(
  Options.withAlias("m"),
  Options.withDefault(false),
  Options.withDescription("Show Jina metadata (title, siteName, etc.)")
);

const enrichOption = Options.boolean("enrich").pipe(
  Options.withAlias("e"),
  Options.withDefault(false),
  Options.withDescription("Run AI enrichment to extract structured metadata")
);

const truncateOption = Options.integer("truncate").pipe(
  Options.withAlias("t"),
  Options.optional,
  Options.withDescription("Truncate content to N characters (default: show all)")
);

const fetchHandler = Effect.fn("fetchHandler")(function* (
  url: string,
  showMetadata: boolean,
  enrich: boolean,
  truncate: O.Option<number>
) {
  const jina = yield* JinaReaderClient;
  yield* Console.log(`Fetching: ${url}\n---`);
  const response = yield* jina.fetchUrl(url);
  const { content } = response;
  if (showMetadata) {
    const metadataLines = [
      "Metadata:",
      `  Title: ${content.title}`,
      ...(O.isSome(content.siteName) ? [`  Site: ${content.siteName.value}`] : []),
      ...(O.isSome(content.publishedDate) ? [`  Published: ${content.publishedDate.value}`] : []),
      ...(O.isSome(content.description) ? [`  Description: ${content.description.value.slice(0, 100)}...`] : []),
      `  Word count: ${content.wordCount}`,
      "---",
    ];
    yield* Console.log(metadataLines.join("\n"));
  }
  if (enrich) {
    yield* Console.log("Running AI enrichment...\n(Note: Enrichment requires LLM service to be configured)");
    const enrichResult = yield* Effect.serviceOption(ContentEnrichmentAgent).pipe(
      Effect.flatMap((opt) =>
        O.match(opt, {
          onNone: () => Effect.succeed(O.none()),
          onSome: (enricher) => enricher.enrichFromJina(content).pipe(Effect.map(O.some)),
        })
      ),
      Effect.catch((error) =>
        Effect.gen(function* () {
          yield* Effect.log(`Enrichment failed: ${error}`);
          return O.none();
        })
      )
    );
    if (O.isSome(enrichResult)) {
      const enriched = enrichResult.value;
      const enrichedLines = [
        "Enriched metadata:",
        `  Headline: ${enriched.headline}`,
        `  Description: ${enriched.description}`,
        `  Source type: ${enriched.sourceType}`,
        ...(O.isSome(enriched.author) ? [`  Author: ${enriched.author.value}`] : []),
        ...(O.isSome(enriched.organization) ? [`  Organization: ${enriched.organization.value}`] : []),
        ...(O.isSome(enriched.publishedAt) ? [`  Published: ${DateTime.formatIso(enriched.publishedAt.value)}`] : []),
        `  Key entities: ${enriched.keyEntities.join(", ")}`,
        `  Topics: ${enriched.topics.join(", ")}`,
        `  Language: ${enriched.language}`,
        `  Word count: ${enriched.wordCount}`,
        "---",
      ];
      yield* Console.log(enrichedLines.join("\n"));
    } else {
      yield* Console.log("  Enrichment service not available. Configure LLM to enable.\n---");
    }
  }
  const maxLength = O.getOrElse(truncate, () => content.content.length);
  const displayContent = content.content.slice(0, maxLength);
  const truncated = content.content.length > maxLength;
  const contentOutput = truncated
    ? `Content:\n${displayContent}\n\n... [truncated, ${content.content.length - maxLength} more chars]`
    : `Content:\n${displayContent}`;
  yield* Console.log(contentOutput);
});

export const fetchCommand = Command.make(
  "fetch",
  {
    url: fetchUrl,
    metadata: showMetadataOption,
    enrich: enrichOption,
    truncate: truncateOption,
  },
  ({ enrich, metadata, truncate, url }) => withErrorHandler(fetchHandler(url, metadata, enrich, truncate))
).pipe(Command.withDescription("Fetch URL content via Jina Reader (preview, no storage)"));

// =============================================================================
// Ingest Link Command - Fetch and store URL content
// =============================================================================

const ingestUrlArg = Args.string("url").pipe(Args.withDescription("URL to ingest"));

const skipEnrichOption = Options.boolean("skip-enrich").pipe(
  Options.withDefault(false),
  Options.withDescription("Skip AI enrichment (just fetch and store)")
);

const sourceTypeOption = Options.choice("source-type", [
  "news",
  "blog",
  "press_release",
  "official",
  "academic",
  "unknown",
]).pipe(Options.optional, Options.withDescription("Override source type classification"));

const noDuplicateOption = Options.boolean("allow-duplicates").pipe(
  Options.withDefault(false),
  Options.withDescription("Allow re-ingesting duplicate content")
);

const ontologyIdOption = Options.string("ontology").pipe(
  Options.withAlias("o"),
  Options.withDescription("Ontology ID for scoping (e.g., 'seattle')")
);

const ingestLinkHandler = Effect.fn(function* (
  url: string,
  ontologyId: string,
  skipEnrich: boolean,
  sourceType: O.Option<string>,
  allowDuplicates: boolean
) {
  const ingestion = yield* LinkIngestionService;

  yield* Console.log(`Ingesting: ${url} (ontology: ${ontologyId})`);

  const result = yield* ingestion.ingestUrl(url, {
    ontologyId,
    enrich: !skipEnrich,
    ...getSomesStruct({ sourceType }),
    skipDuplicates: !allowDuplicates,
  });

  const outputLines = result.duplicate
    ? ["Content already exists (duplicate)", `  ID: ${result.id}`, `  Hash: ${result.contentHash}`]
    : [
        "Ingestion complete:",
        `  ID: ${result.id}`,
        `  Hash: ${result.contentHash}`,
        `  Storage: ${result.storageUri}`,
        ...(P.isNotUndefined(result.headline) ? [`  Headline: ${result.headline}`] : []),
        ...(P.isNotUndefined(result.wordCount) ? [`  Word count: ${result.wordCount}`] : []),
      ];

  yield* Console.log(outputLines.join("\n"));
});

export const ingestLinkCommand = Command.make(
  "ingest-link",
  {
    url: ingestUrlArg,
    ontologyId: ontologyIdOption,
    skipEnrich: skipEnrichOption,
    sourceType: sourceTypeOption,
    allowDuplicates: noDuplicateOption,
  },
  ({ allowDuplicates, ontologyId, skipEnrich, sourceType, url }) =>
    withErrorHandler(ingestLinkHandler(url, ontologyId, skipEnrich, sourceType, allowDuplicates))
).pipe(Command.withDescription("Fetch URL via Jina Reader and ingest to storage"));

// =============================================================================
// Documents Command - List ingested documents
// =============================================================================

const statusFilterOption = Options.choice("status", ["pending", "enriched", "processed", "failed"]).pipe(
  Options.optional,
  Options.withDescription("Filter by status")
);

const sourceTypeFilterOption = Options.choice("type", [
  "news",
  "blog",
  "press_release",
  "official",
  "academic",
  "unknown",
]).pipe(Options.optional, Options.withDescription("Filter by source type"));

const limitOption = Options.integer("limit").pipe(
  Options.withAlias("l"),
  Options.withDefault(20),
  Options.withDescription("Maximum results to show")
);

const offsetOption = Options.integer("offset").pipe(Options.withDefault(0), Options.withDescription("Skip N results"));

const jsonOutputOption = Options.boolean("json").pipe(
  Options.withDefault(false),
  Options.withDescription("Output as JSON")
);

const documentsHandler = Effect.fn("documentsHandler")(function* (
  status: O.Option<string>,
  sourceType: O.Option<string>,
  limit: number,
  offset: number,
  jsonOutput: boolean
) {
  const ingestion = yield* LinkIngestionService;
  const documents = yield* ingestion.list({
    ...getSomesStruct({ status, sourceType }),
    limit,
    offset,
  });
  if (jsonOutput) {
    const output = documents.map((doc: any) => ({
      id: doc.id,
      contentHash: doc.contentHash,
      sourceUri: doc.sourceUri,
      status: doc.status,
      headline: doc.headline,
      sourceType: doc.sourceType,
      organization: doc.organization,
      fetchedAt: doc.fetchedAt?.toISOString(),
      wordCount: doc.wordCount,
    }));
    const outputJson = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown, { space: 2 }))(output);
    yield* Console.log(outputJson);
  } else {
    const formatDocument = (doc: (typeof documents)[number]): string => {
      const lines = [
        `[${doc.status}] ${doc.id}`,
        `  Hash: ${doc.contentHash.slice(0, 12)}...`,
        ...(P.isNotNull(doc.sourceUri) ? [`  URL: ${doc.sourceUri}`] : []),
        ...(P.isNotNull(doc.headline)
          ? [`  Title: ${doc.headline.slice(0, 60)}${doc.headline.length > 60 ? "..." : ""}`]
          : []),
        ...(P.isNotNull(doc.sourceType) ? [`  Type: ${doc.sourceType}`] : []),
        ...(P.isNotNull(doc.organization) ? [`  Org: ${doc.organization}`] : []),
        ...(P.isNotNull(doc.wordCount) ? [`  Words: ${doc.wordCount}`] : []),
        "",
      ];
      return lines.join("\n");
    };
    const formattedDocs = documents.map(formatDocument);
    const output = [`Ingested documents (${documents.length}):`, "", ...formattedDocs].join("\n");
    yield* Console.log(output);
  }
});

export const documentsCommand = Command.make(
  "documents",
  {
    status: statusFilterOption,
    sourceType: sourceTypeFilterOption,
    limit: limitOption,
    offset: offsetOption,
    json: jsonOutputOption,
  },
  ({ json, limit, offset, sourceType, status }) =>
    withErrorHandler(documentsHandler(status, sourceType, limit, offset, json))
).pipe(Command.withDescription("List ingested documents"));

// =============================================================================
// Ingest Batch Command - Bulk ingest from file
// =============================================================================

const urlsFileArg = Args.file("file").pipe(Args.withDescription("File containing URLs (one per line)"));

const concurrencyOption = Options.integer("concurrency").pipe(
  Options.withAlias("c"),
  Options.withDefault(5),
  Options.withDescription("Number of concurrent fetches")
);

const ingestBatchHandler = Effect.fn("ingestBatchHandler")(function* (
  file: string,
  ontologyId: string,
  concurrency: number,
  skipEnrich: boolean
) {
  const ingestion = yield* LinkIngestionService;
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(file);
  const urls = content
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0 && !line.startsWith("#"));
  yield* Console.log(`Ingesting ${urls.length} URLs with concurrency ${concurrency} (ontology: ${ontologyId})\n`);
  const results = yield* ingestion.ingestUrls(urls, {
    ontologyId,
    concurrency,
    enrich: !skipEnrich,
    continueOnError: true,
  });
  const resultLines = yield* Effect.forEach(results, (result) => {
    if (result instanceof LinkIngestionError) {
      return Effect.succeed(`[ERROR] ${result.url ?? "unknown"}: ${result.message}`);
    } else {
      const ingestResult = result as IngestResult;
      if (ingestResult.duplicate) {
        return Effect.succeed(`[SKIP] ${ingestResult.contentHash.slice(0, 12)}... (duplicate)`);
      } else {
        return Effect.succeed(
          `[OK] ${ingestResult.contentHash.slice(0, 12)}... ${ingestResult.headline?.slice(0, 40) ?? ""}`
        );
      }
    }
  });
  const counts = results.reduce(
    (acc, result: IngestResult | LinkIngestionError) => {
      if (result instanceof LinkIngestionError) {
        return { ...acc, errorCount: acc.errorCount + 1 };
      } else {
        const ingestResult = result;
        if (ingestResult.duplicate) {
          return { ...acc, duplicateCount: acc.duplicateCount + 1 };
        } else {
          return { ...acc, successCount: acc.successCount + 1 };
        }
      }
    },
    { successCount: 0, duplicateCount: 0, errorCount: 0 }
  );
  const output = [
    ...resultLines,
    "",
    `Summary: ${counts.successCount} ingested, ${counts.duplicateCount} duplicates, ${counts.errorCount} errors`,
  ].join("\n");
  yield* Console.log(output);
});

export const ingestBatchCommand = Command.make(
  "ingest-batch",
  {
    file: urlsFileArg,
    ontologyId: ontologyIdOption,
    concurrency: concurrencyOption,
    skipEnrich: skipEnrichOption,
  },
  ({ concurrency, file, ontologyId, skipEnrich }) =>
    withErrorHandler(ingestBatchHandler(file, ontologyId, concurrency, skipEnrich))
).pipe(Command.withDescription("Bulk ingest URLs from a file"));
