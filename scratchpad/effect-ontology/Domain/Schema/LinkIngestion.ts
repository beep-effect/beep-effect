/**
 * Link-ingestion request, result, listing, and detail contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { HttpUrl } from "@beep/ontology/Ontology.models";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { Match } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { ContentHash, GcsUri, OntologyName } from "../Identity.ts";
import { SourceType } from "../Model/EnrichedContent.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/LinkIngestion");

export { HttpUrl };

/**
 * Canonical lifecycle status shared by link contracts and persistence.
 *
 * **Example** (Validate a processing status)
 *
 * ```ts
 * import { LinkStatus } from "@effect-ontology/Domain/Schema/LinkIngestion"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LinkStatus)("processing"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LinkStatus = LiteralKit(["pending", "enriched", "processing", "processed", "failed", "skipped"]).pipe(
  $I.annoteSchema("LinkStatus", {
    toArbitrary: () => (fc) => fc.constantFrom("pending", "enriched", "processing", "processed", "failed", "skipped"),
    description: "Lifecycle statuses used when listing ingested links.",
  })
);

/**
 * Decoded link lifecycle status.
 *
 * **Example** (Use a link lifecycle status)
 *
 * ```ts
 * import type { LinkStatus } from "@effect-ontology/Domain/Schema/LinkIngestion"
 *
 * const status: LinkStatus = "processing"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LinkStatus = typeof LinkStatus.Type;

/**
 * Request to ingest and optionally enrich one HTTP(S) resource.
 *
 * **Details**
 *
 * * Boolean controls have schema-owned defaults. Source classification is an
 * `Option`, eliminating undefined checks from ingestion behavior.
 *
 * **Example** (Use IngestLinkRequest)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { IngestLinkRequest } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const request = S.decodeUnknownOption(IngestLinkRequest)({
 *   url: "https://example.com/article",
 *   ontologyId: "claims"
 * })
 * console.log(O.map(request, (value) => value.skipEnrich))
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class IngestLinkRequest extends S.Class<IngestLinkRequest>($I`IngestLinkRequest`)(
  {
    url: HttpUrl.annotateKey({
      description: "Absolute HTTP(S) resource URL to ingest.",
    }),
    ontologyId: OntologyName.annotateKey({
      description: "Ontology registry identifier that scopes extraction.",
    }),
    skipEnrich: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({
        description: "Whether AI enrichment is skipped; defaults to false.",
      })
    ),
    sourceType: S.OptionFromOptionalKey(SourceType).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional caller-provided source classification override.",
      })
    ),
    allowDuplicates: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({
        description: "Whether already-known content may create another record; defaults to false.",
      })
    ),
  },
  $I.annote("IngestLinkRequest", {
    description: "Single-link ingestion request with validated URL, ontology scope, and explicit defaults.",
  })
) {
  static readonly is = S.is(IngestLinkRequest);
}

/**
 * Successful result of ingesting one link.
 *
 * **Example** (Use IngestLinkResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { IngestLinkResponse } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const response = S.decodeUnknownOption(IngestLinkResponse)({
 *   id: "link-42",
 *   contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   storageUri: "gs://beep-ontology-state/links/link-42.json",
 *   duplicate: false
 * })
 * console.log(O.map(response, (value) => value.duplicate))
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class IngestLinkResponse extends S.Class<IngestLinkResponse>($I`IngestLinkResponse`)(
  {
    id: S.NonEmptyString.annotateKey({
      description: "Persistent identifier assigned to the ingested link.",
    }),
    contentHash: ContentHash.annotateKey({
      description: "Canonical full SHA-256 identity of the fetched content.",
    }),
    storageUri: GcsUri.annotateKey({
      description: "Validated GCS URI of the stored content artifact.",
    }),
    headline: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional extracted headline.",
      })
    ),
    wordCount: S.OptionFromNullishOr(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-negative extracted word count.",
      })
    ),
    duplicate: S.Boolean.annotateKey({
      description: "Whether ingestion resolved to content already known by the system.",
    }),
  },
  $I.annote("IngestLinkResponse", {
    description: "Successful link-ingestion response with canonical content and storage identities.",
  })
) {
  static readonly is = S.is(IngestLinkResponse);
}

/**
 * Request to ingest a non-empty batch of HTTP(S) resources.
 *
 * **Example** (Use BatchIngestRequest)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BatchIngestRequest } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const request = S.decodeUnknownOption(BatchIngestRequest)({
 *   urls: ["https://example.com/a"],
 *   ontologyId: "claims"
 * })
 * console.log(O.map(request, (value) => value.concurrency))
 * ```
 *
 * @invariant At least one valid HTTP(S) URL is present and concurrency is a
 * positive integer.
 * @category dtos
 * @since 0.0.0
 */
export class BatchIngestRequest extends S.Class<BatchIngestRequest>($I`BatchIngestRequest`)(
  {
    urls: HttpUrl.pipe(S.NonEmptyArray).annotateKey({
      description: "Non-empty collection of absolute HTTP(S) URLs to ingest.",
    }),
    ontologyId: OntologyName.annotateKey({
      description: "Ontology registry identifier that scopes extraction.",
    }),
    concurrency: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(5)),
      S.annotateKey({
        description: "Maximum number of concurrent link ingestions; defaults to five.",
      })
    ),
    skipEnrich: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({
        description: "Whether AI enrichment is skipped for every link; defaults to false.",
      })
    ),
    continueOnError: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({
        description: "Whether remaining links continue after one failure; defaults to true.",
      })
    ),
  },
  $I.annote("BatchIngestRequest", {
    description: "Non-empty batch-ingestion request with bounded concurrency and explicit behavior defaults.",
  })
) {
  static readonly is = S.is(BatchIngestRequest);
}

const BatchIngestResultDefinition = S.TaggedUnion({
  success: {
    url: HttpUrl.annotateKey({
      description: "Original URL represented by this result.",
    }),
    value: S.Struct({
      id: S.NonEmptyString.annotateKey({
        description: "Persistent link identifier.",
      }),
      contentHash: ContentHash.annotateKey({
        description: "Canonical full content digest.",
      }),
    }).annotateKey({
      description: "Identifiers created by successful ingestion.",
    }),
  },
  duplicate: {
    url: HttpUrl.annotateKey({
      description: "Original URL represented by this result.",
    }),
    value: S.Struct({
      id: S.NonEmptyString.annotateKey({
        description: "Identifier of the existing link record.",
      }),
      contentHash: ContentHash.annotateKey({
        description: "Canonical digest of the already-known content.",
      }),
    }).annotateKey({
      description: "Existing identifiers resolved for duplicate content.",
    }),
  },
  error: {
    url: HttpUrl.annotateKey({
      description: "Original URL represented by this result.",
    }),
    error: S.NonEmptyString.annotateKey({
      description: "Non-empty diagnostic explaining ingestion failure.",
    }),
  },
});

/**
 * Per-link batch outcome discriminated by status.
 *
 * **Details**
 *
 * * Success and duplicate outcomes nest their identifiers under `value`; error
 * outcomes carry a mandatory diagnostic. Impossible combinations of nullable
 * identifiers and errors are therefore unrepresentable.
 *
 * **Example** (Use BatchIngestResult)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BatchIngestResult } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const result = S.decodeUnknownOption(BatchIngestResult)({
 *   _tag: "error",
 *   url: "https://example.com/missing",
 *   error: "Resource was not found."
 * })
 * console.log(O.map(result, (value) => value._tag)) // "error"
 * ```
 *
 * @invariant The `_tag` discriminator determines the complete payload shape.
 * @category schemas
 * @since 0.0.0
 */
export const BatchIngestResult = BatchIngestResultDefinition.pipe(
  $I.annoteSchema("BatchIngestResult", {
    description: "Tagged per-link ingestion result with status-specific nested success data or a required error.",
    toArbitrary: () => S.toArbitrary(BatchIngestResultDefinition),
  })
);

/**
 * Runtime value decoded by {@link BatchIngestResult}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchIngestResult = typeof BatchIngestResult.Type;

class BatchIngestSummary extends S.Class<BatchIngestSummary>($I`BatchIngestSummary`)(
  {
    total: NonNegativeInt.annotateKey({
      description: "Total number of processed URLs.",
    }),
    success: NonNegativeInt.annotateKey({
      description: "Number of newly ingested URLs.",
    }),
    duplicate: NonNegativeInt.annotateKey({
      description: "Number of URLs resolved as duplicate content.",
    }),
    error: NonNegativeInt.annotateKey({
      description: "Number of URLs that failed ingestion.",
    }),
  },
  $I.annote("BatchIngestSummary", {
    description: "Non-negative counts summarizing a batch-ingestion result collection.",
  })
) {}

const summarizeBatchResults = (results: ReadonlyArray<BatchIngestResult>): BatchIngestSummary => {
  const success = A.length(A.filter(results, BatchIngestResult.guards.success));
  const duplicate = A.length(A.filter(results, BatchIngestResult.guards.duplicate));
  const error = A.length(A.filter(results, BatchIngestResult.guards.error));

  return BatchIngestSummary.make({
    total: NonNegativeInt.make(A.length(results)),
    success: NonNegativeInt.make(success),
    duplicate: NonNegativeInt.make(duplicate),
    error: NonNegativeInt.make(error),
  });
};

const BatchIngestResponseDefinition = S.Struct({
  results: S.Array(BatchIngestResult).pipe(
    SchemaUtils.withEmptyArrayDefaults<BatchIngestResult>(),
    S.annotateKey({
      description: "Per-link tagged outcomes; defaults to an empty collection.",
    })
  ),
  summary: BatchIngestSummary.annotateKey({
    description: "Counts that must exactly summarize the result collection.",
  }),
}).check(
  S.makeFilter(
    ({ results, summary }) =>
      matchBatchSummaryConsistency({
        actual: summary,
        expected: summarizeBatchResults(results),
      }),
    {
      identifier: $I`BatchIngestSummaryConsistencyCheck`,
      title: "Batch Ingest Summary Consistency",
      description: "A response whose total and per-status counts exactly summarize its results.",
      message: "Batch ingest summary must exactly match the result collection.",
      arbitrary: {
        candidate: {
          make: (fc) =>
            fc.array(S.toArbitrary(BatchIngestResult)(fc), { maxLength: 32 }).map((results) => ({
              results,
              summary: summarizeBatchResults(results),
            })),
        },
      },
    }
  )
);

const BatchSummaryComparison = S.Struct({
  actual: BatchIngestSummary,
  expected: BatchIngestSummary,
});

const matchBatchSummaryConsistency = Match.type<typeof BatchSummaryComparison.Type>().pipe(
  Match.when(
    ({ actual, expected }) =>
      expected.total === actual.total &&
      expected.success === actual.success &&
      expected.duplicate === actual.duplicate &&
      expected.error === actual.error,
    () => undefined
  ),
  Match.orElse(() => ({
    path: ["summary"],
    issue: "Batch summary counts must exactly match the tagged result collection.",
  }))
);

/**
 * Batch-ingestion response with a summary proven from tagged results.
 *
 * **Example** (Use BatchIngestResponse)
 * ```ts
 * import { BatchIngestResponse } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const response = BatchIngestResponse.fromResults([])
 * console.log(response.summary.total) // 0
 * ```
 *
 * @invariant Summary counts exactly equal the result count grouped by `_tag`.
 * @category dtos
 * @since 0.0.0
 */
export const BatchIngestResponse = BatchIngestResponseDefinition.annotate({
  toArbitrary: () => (fc) =>
    fc.array(S.toArbitrary(BatchIngestResult)(fc), { maxLength: 32 }).map((results) => ({
      results,
      summary: summarizeBatchResults(results),
    })),
}).pipe(
  $I.annoteSchema("BatchIngestResponse", {
    description: "Batch-ingestion response whose non-negative summary is consistent with its tagged results.",
  }),
  SchemaUtils.withStatics((schema) => ({
    fromResults: (results: ReadonlyArray<BatchIngestResult>): typeof schema.Type =>
      schema.make({
        results,
        summary: summarizeBatchResults(results),
      }),
  }))
);

/**
 * Runtime value decoded by {@link BatchIngestResponse}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchIngestResponse = typeof BatchIngestResponse.Type;

/**
 * Normalized query for listing ingested links.
 *
 * **Example** (Use ListLinksQuery)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ListLinksQuery } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const query = S.decodeUnknownOption(ListLinksQuery)({})
 * console.log(O.map(query, (value) => value.limit))
 * console.log(O.map(query, (value) => value.offset))
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class ListLinksQuery extends S.Class<ListLinksQuery>($I`ListLinksQuery`)(
  {
    status: S.OptionFromOptionalKey(LinkStatus).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional lifecycle-status filter.",
      })
    ),
    sourceType: S.OptionFromOptionalKey(SourceType).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional source-classification filter.",
      })
    ),
    organization: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-empty organization filter.",
      })
    ),
    limit: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(20)),
      S.annotateKey({
        description: "Positive page size; defaults to twenty.",
      })
    ),
    offset: NonNegativeInt.pipe(
      SchemaUtils.withKeyDefaults(NonNegativeInt.make(0)),
      S.annotateKey({
        description: "Non-negative pagination offset; defaults to zero.",
      })
    ),
  },
  $I.annote("ListLinksQuery", {
    description: "Link-list query with Option-normalized filters and schema-owned pagination defaults.",
  })
) {}

/**
 * Compact projection of one ingested link.
 *
 * **Example** (Use LinkSummary)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LinkSummary } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const summary = S.decodeUnknownOption(LinkSummary)({
 *   id: "link-42",
 *   contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   status: "pending"
 * })
 * console.log(O.map(summary, (value) => value.status))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinkSummary extends S.Class<LinkSummary>($I`LinkSummary`)(
  {
    id: S.NonEmptyString.annotateKey({
      description: "Persistent link identifier.",
    }),
    contentHash: ContentHash.annotateKey({
      description: "Canonical full SHA-256 content identity.",
    }),
    sourceUri: S.OptionFromNullishOr(HttpUrl).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional original HTTP(S) source URL." })
    ),
    sourceType: S.OptionFromNullishOr(SourceType).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional source classification." })
    ),
    headline: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional extracted headline." })
    ),
    organization: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional attributed organization." })
    ),
    status: LinkStatus.annotateKey({
      description: "Current ingestion lifecycle status.",
    }),
    wordCount: S.OptionFromNullishOr(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional non-negative extracted word count." })
    ),
    fetchedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional UTC fetch instant." })
    ),
    enrichedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional UTC enrichment instant." })
    ),
  },
  $I.annote("LinkSummary", {
    description: "Compact ingested-link projection with canonical content identity and normalized optional metadata.",
  })
) {}

/**
 * Paginated response listing ingested links.
 *
 * **Example** (Use ListLinksResponse)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ListLinksResponse } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const response = S.decodeUnknownOption(ListLinksResponse)({
 *   total: 0,
 *   limit: 20,
 *   offset: 0,
 *   hasMore: false
 * })
 * console.log(O.map(response, (value) => value.links.length)) // 0
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class ListLinksResponse extends S.Class<ListLinksResponse>($I`ListLinksResponse`)(
  {
    links: S.Array(LinkSummary).pipe(
      SchemaUtils.withEmptyArrayDefaults<LinkSummary>(),
      S.annotateKey({ description: "Current page of link summaries." })
    ),
    total: NonNegativeInt.annotateKey({ description: "Total matching link count." }),
    limit: PosInt.annotateKey({ description: "Positive requested page size." }),
    offset: NonNegativeInt.annotateKey({ description: "Non-negative page offset." }),
    hasMore: S.Boolean.annotateKey({ description: "Whether another result page follows." }),
  },
  $I.annote("ListLinksResponse", {
    description: "Paginated link-list response with constrained counts and an always-present result collection.",
  })
) {}

/**
 * Detailed projection of one ingested link and its processing metadata.
 *
 * **Details**
 *
 * * All nullable source metadata decodes to `Option`; topics and entity keys
 * always decode to readonly arrays.
 *
 * **Example** (Use LinkDetail)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { LinkDetail } from "@effect-ontology/Schema/LinkIngestion"
 *
 * const detail = S.decodeUnknownOption(LinkDetail)({
 *   id: "link-42",
 *   contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   storageUri: "gs://beep-ontology-state/links/link-42.json",
 *   status: "pending"
 * })
 * console.log(O.map(detail, (value) => value.topics.length))
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class LinkDetail extends S.Class<LinkDetail>($I`LinkDetail`)(
  {
    id: S.NonEmptyString,
    contentHash: ContentHash,
    sourceUri: S.OptionFromNullishOr(HttpUrl).pipe(SchemaUtils.withNoneDefault),
    sourceType: S.OptionFromNullishOr(SourceType).pipe(SchemaUtils.withNoneDefault),
    headline: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    author: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    organization: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    language: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    topics: S.Array(S.NonEmptyString).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
    keyEntities: S.Array(S.NonEmptyString).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
    storageUri: GcsUri,
    status: LinkStatus,
    wordCount: S.OptionFromNullishOr(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
    publishedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    fetchedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    enrichedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    processedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    errorMessage: S.OptionFromNullishOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("LinkDetail", {
    description: "Detailed ingested-link projection with validated identities and fully normalized optional metadata.",
  })
) {
  static readonly is = S.is(LinkDetail);
}
