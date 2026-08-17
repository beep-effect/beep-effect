/**
 * CLI: Fetch and Link Ingestion Commands
 *
 * **Details**
 *
 * Commands for fetching web content via Jina Reader API,
 * ingesting URLs to storage, and managing ingested documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import {Unknown} from "@beep/schema/Unknown";
import {getSomesStruct} from "@beep/utils/Option";
import {thunkEmptyStr} from "@beep/utils/thunk";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as A from "effect/Array";
import {pipe, flow} from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Argument from "effect/unstable/cli/Argument";
import * as Flag from "effect/unstable/cli/Flag";
import * as Command from "effect/unstable/cli/Command";
import {LinkStatus} from "../../Domain/Schema/LinkIngestion.ts";
import {ContentEnrichmentAgent} from "../../Service/ContentEnrichmentAgent.ts";
import {JinaReaderClient} from "../../Service/JinaReaderClient.ts";
import type {IngestResult} from "../../Service/LinkIngestionService.ts";
import {
  LinkIngestionError,
  LinkIngestionService
} from "../../Service/LinkIngestionService.ts";
import {withErrorHandler} from "../ErrorHandler.ts";

// =============================================================================
// Fetch Command - Preview URL content without storage
// =============================================================================

const fetchUrl = Argument.string("url").pipe(Argument.withDescription("URL to fetch content from"));

const showMetadataOption = Flag.boolean("metadata").pipe(
  Flag.withAlias("m"),
  Flag.withDefault(false),
  Flag.withDescription("Show Jina metadata (title, siteName, etc.)")
);

const enrichOption = Flag.boolean("enrich").pipe(
  Flag.withAlias("e"),
  Flag.withDefault(false),
  Flag.withDescription("Run AI enrichment to extract structured metadata")
);

const truncateOption = Flag.integer("truncate").pipe(
  Flag.withAlias("t"),
  Flag.optional,
  Flag.withDescription("Truncate content to N characters (default: show all)")
);

const OutputJSON = S.fromJsonString(Unknown, {space: 2}).pipe(
  SchemaUtils.withStatics((schema) => ({
    decodeUnknownEffect: S.decodeUnknownEffect(schema),
  }))
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
  const {content} = response;
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
      Effect.catch(
        Effect.fnUntraced(function* (error) {
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

/**
 * Retrieves fetch command data for downstream processing.
 *
 * **Example** (Inspect fetch command)
 *
 * ```ts
 * import { fetchCommand } from "@effect-ontology/Cli/Commands/Fetch"
 *
 * console.log(fetchCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const fetchCommand = Command.make(
  "fetch",
  {
    url: fetchUrl,
    metadata: showMetadataOption,
    enrich: enrichOption,
    truncate: truncateOption,
  },
  ({
     enrich,
     metadata,
     truncate,
     url
   }) => withErrorHandler(fetchHandler(url, metadata, enrich, truncate))
).pipe(Command.withDescription("Fetch URL content via Jina Reader (preview, no storage)"));

// =============================================================================
// Ingest Link Command - Fetch and store URL content
// =============================================================================

const ingestUrlArg = Argument.string("url").pipe(Argument.withDescription("URL to ingest"));

const skipEnrichOption = Flag.boolean("skip-enrich").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip AI enrichment (just fetch and store)")
);

const sourceTypeOption = Flag.choice("source-type", [
  "news",
  "blog",
  "press_release",
  "official",
  "academic",
  "unknown",
]).pipe(Flag.optional, Flag.withDescription("Override source type classification"));

const noDuplicateOption = Flag.boolean("allow-duplicates").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Allow re-ingesting duplicate content")
);

const ontologyIdOption = Flag.string("ontology").pipe(
  Flag.withAlias("o"),
  Flag.withDescription("Ontology ID for scoping (e.g., 'seattle')")
);

const ingestLinkHandler = Effect.fn("FetchCommand.ingestLink")(function* (
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
    ...getSomesStruct({sourceType}),
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

/**
 * Exposes ingest link command for composition by callers of this module.
 *
 * **Example** (Inspect ingest link command)
 *
 * ```ts
 * import { ingestLinkCommand } from "@effect-ontology/Cli/Commands/Fetch"
 *
 * console.log(ingestLinkCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ingestLinkCommand = Command.make(
  "ingest-link",
  {
    url: ingestUrlArg,
    ontologyId: ontologyIdOption,
    skipEnrich: skipEnrichOption,
    sourceType: sourceTypeOption,
    allowDuplicates: noDuplicateOption,
  },
  ({allowDuplicates, ontologyId, skipEnrich, sourceType, url}) =>
    withErrorHandler(ingestLinkHandler(url, ontologyId, skipEnrich, sourceType, allowDuplicates))
).pipe(Command.withDescription("Fetch URL via Jina Reader and ingest to storage"));

// =============================================================================
// Documents Command - List ingested documents
// =============================================================================

const statusFilterOption = Flag.choice("status", ["pending", "enriched", "processed", "failed"]).pipe(
  Flag.optional,
  Flag.withDescription("Filter by status")
);

const sourceTypeFilterOption = Flag.choice("type", [
  "news",
  "blog",
  "press_release",
  "official",
  "academic",
  "unknown",
]).pipe(Flag.optional, Flag.withDescription("Filter by source type"));

const limitOption = Flag.integer("limit").pipe(
  Flag.withAlias("l"),
  Flag.withDefault(20),
  Flag.withDescription("Maximum results to show")
);

const offsetOption = Flag.integer("offset").pipe(Flag.withDefault(0), Flag.withDescription("Skip N results"));

const jsonOutputOption = Flag.boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Output as JSON")
);

const documentsHandler = Effect.fn("documentsHandler")(function* (
  status: O.Option<string>,
  sourceType: O.Option<string>,
  limit: number,
  offset: number,
  jsonOutput: boolean
) {
  const ingestion = yield* LinkIngestionService;
  const canonicalStatus = yield* O.match(status, {
    onNone: () => Effect.succeed(O.none()),
    onSome: flow(LinkStatus.decodeUnknownEffect, Effect.map(O.some)),
  });
  const documents = yield* ingestion.list({
    ...getSomesStruct({status: canonicalStatus, sourceType}),
    limit,
    offset,
  });
  if (jsonOutput) {
    const output = A.map(documents, (doc) => ({
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
    const outputJson = yield* OutputJSON.decodeUnknownEffect(output);
    yield* Console.log(outputJson);
  } else {
    const formatDocument = (doc: (typeof documents)[number]): string => {
      const lines = [
        `[${doc.status}] ${doc.id}`,
        `  Hash: ${Str.slice(0, 12)(doc.contentHash)}...`,
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
    const formattedDocs = A.map(documents, formatDocument);
    const output = A.join([`Ingested documents (${documents.length}):`, "", ...formattedDocs], "\n");
    yield* Console.log(output);
  }
});

/**
 * Exposes documents command for composition by callers of this module.
 *
 * **Example** (Inspect documents command)
 *
 * ```ts
 * import { documentsCommand } from "@effect-ontology/Cli/Commands/Fetch"
 *
 * console.log(documentsCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const documentsCommand = Command.make(
  "documents",
  {
    status: statusFilterOption,
    sourceType: sourceTypeFilterOption,
    limit: limitOption,
    offset: offsetOption,
    json: jsonOutputOption,
  },
  ({json, limit, offset, sourceType, status}) =>
    withErrorHandler(documentsHandler(status, sourceType, limit, offset, json))
).pipe(Command.withDescription("List ingested documents"));

// =============================================================================
// Ingest Batch Command - Bulk ingest from file
// =============================================================================

const urlsFileArg = Argument.file("file").pipe(Argument.withDescription("File containing URLs (one per line)"));

const concurrencyOption = Flag.integer("concurrency").pipe(
  Flag.withAlias("c"),
  Flag.withDefault(5),
  Flag.withDescription("Number of concurrent fetches")
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
  const urls = pipe(
    content,
    Str.split("\n"),
    A.map(Str.trim),
    A.filter(P.and(Str.isNonEmpty, P.not(Str.startsWith("#"))))
  );
  yield* Console.log(`Ingesting ${urls.length} URLs with concurrency ${concurrency} (ontology: ${ontologyId})\n`);
  const results = yield* ingestion.ingestUrls(urls, {
    ontologyId,
    concurrency,
    enrich: !skipEnrich,
    continueOnError: true,
  });
  const resultLines = yield* Effect.forEach(results, (result) => {
    if (LinkIngestionError.is(result)) {
      return Effect.succeed(`[ERROR] ${result.url ?? "unknown"}: ${result.message}`);
    } else {
      const ingestResult = result;
      if (ingestResult.duplicate) {
        return Effect.succeed(`[SKIP] ${Str.slice(0, 12)(ingestResult.contentHash)}... (duplicate)`);
      } else {
        return Effect.succeed(
          `[OK] ${Str.slice(0, 12)(ingestResult.contentHash)}... ${O.fromNullishOr(ingestResult.headline).pipe(
            O.match({
              onNone: thunkEmptyStr,
              onSome: Str.slice(0, 40),
            })
          )}`
        );
      }
    }
  });
  const errors = A.filter(results, LinkIngestionError.is);
  const successes = A.filter(results, (result): result is IngestResult => !LinkIngestionError.is(result));
  const counts = {
    successCount: A.length(A.filter(successes, (result) => !result.duplicate)),
    duplicateCount: A.length(A.filter(successes, (result) => result.duplicate)),
    errorCount: A.length(errors),
  };
  const output = A.join(
    [
      ...resultLines,
      "",
      `Summary: ${counts.successCount} ingested, ${counts.duplicateCount} duplicates, ${counts.errorCount} errors`,
    ],
    "\n"
  );
  yield* Console.log(output);
});

/**
 * Exposes ingest batch command for composition by callers of this module.
 *
 * **Example** (Inspect ingest batch command)
 *
 * ```ts
 * import { ingestBatchCommand } from "@effect-ontology/Cli/Commands/Fetch"
 *
 * console.log(ingestBatchCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ingestBatchCommand = Command.make(
  "ingest-batch",
  {
    file: urlsFileArg,
    ontologyId: ontologyIdOption,
    concurrency: concurrencyOption,
    skipEnrich: skipEnrichOption,
  },
  ({concurrency, file, ontologyId, skipEnrich}) =>
    withErrorHandler(ingestBatchHandler(file, ontologyId, concurrency, skipEnrich))
).pipe(Command.withDescription("Bulk ingest URLs from a file"));
