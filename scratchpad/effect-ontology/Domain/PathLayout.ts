/**
 * Exact storage-path schemas and constructors for effect-ontology artifacts.
 *
 * **Details**
 *
 * * Every dynamic segment is validated by its owning schema, every persisted
 * filename is finite, and all paths use stable POSIX separators. Parsing is
 * total and returns `Result`; trusted construction is colocated on each path
 * schema and cannot emit a path outside that schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import type { FastCheck } from "effect/testing";
import { BatchId, ContentHash, DocumentId, Namespace, OntologyName } from "./Identity.ts";
import { OutputFilename, OutputType } from "./Model/OutputType.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/PathLayout");

const annotateStoragePath =
  (name: string, description: string) =>
  <Schema extends S.Schema<string>>(schema: Schema) =>
    schema
      .annotate({
        toArbitrary: () => S.toArbitrary(schema),
      })
      .pipe(
        $I.annoteSchema(name, {
          description,
        })
      );

const annotateParser =
  (name: string, description: string) =>
  <Schema extends S.Top & S.ConstraintDecoder<unknown>>(schema: Schema) => {
    const decodeResult = S.decodeUnknownResult(schema);

    return schema
      .annotate({
        toArbitrary: () => S.toArbitrary(schema),
      })
      .pipe(
        $I.annoteSchema(name, {
          description,
        }),
        SchemaUtils.withStatics(() => ({
          decodeResult,
        }))
      );
  };

const makeBatchPathSchema = <const Name extends string, const Suffix extends string>(
  name: Name,
  suffix: Suffix,
  description: string
) =>
  S.TemplateLiteral(["batches/", BatchId, `/${suffix}`]).pipe(
    annotateStoragePath(name, description),
    S.brand(name),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromBatch: (batchId: BatchId): typeof schema.Type => schema.fromUnknown(`batches/${batchId}/${suffix}`),
    }))
  );

const makeDocumentPathSchema = <const Name extends string, const Suffix extends string>(
  name: Name,
  suffix: Suffix,
  description: string
) =>
  S.TemplateLiteral(["documents/", DocumentId, `/${suffix}`]).pipe(
    annotateStoragePath(name, description),
    S.brand(name),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromDocument: (documentId: DocumentId): typeof schema.Type =>
        schema.fromUnknown(`documents/${documentId}/${suffix}`),
    }))
  );

const makeImageHashPathSchema = <const Name extends string, const Suffix extends string>(
  name: Name,
  suffix: Suffix,
  description: string
) =>
  S.TemplateLiteral(["assets/images/", ContentHash, `/${suffix}`]).pipe(
    annotateStoragePath(name, description),
    S.brand(name),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromHash: (hash: ContentHash): typeof schema.Type => schema.fromUnknown(`assets/images/${hash}/${suffix}`),
    }))
  );

/**
 * Safe, single storage-key segment for owner identifiers.
 *
 * **Details**
 *
 * * The constrained alphabet rules out separators, dot traversal, control
 * characters, and ambiguous empty segments at the ingress boundary.
 *
 * **Example** (Use StoragePathSegment)
 * ```ts
 * import { StoragePathSegment } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(StoragePathSegment.is("link-2026_07")) // true
 * console.log(StoragePathSegment.is("../escape")) // false
 * ```
 *
 * @invariant One to 128 ASCII letters, digits, dots, underscores, colons,
 * at-signs, or dashes, beginning with an alphanumeric character.
 * @category validation
 * @since 0.0.0
 */
export const StoragePathSegment = S.String.check(
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/, {
    identifier: $I`StoragePathSegmentPatternCheck`,
    title: "Storage Path Segment",
    description: "A non-empty storage-key segment without path separators, traversal syntax, or control characters.",
    message:
      "Storage path segment must begin with a letter or digit and contain at most 128 letters, digits, dots, underscores, colons, at-signs, or dashes.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,63}$/),
  })
  .pipe(
    S.brand("StoragePathSegment"),
    $I.annoteSchema("StoragePathSegment", {
      description: "Traversal-safe single segment for a storage object key.",
    }),
    SchemaUtils.withCodecStatics
  );

/**
 * Runtime value decoded by {@link StoragePathSegment}.
 *
 * **Example** (Use StoragePathSegment)
 * ```ts
 * import { StoragePathSegment, type StoragePathSegment as Segment } from "@effect-ontology/PathLayout.ts"
 *
 * const segment: Segment = StoragePathSegment.make("document-42")
 * console.log(segment)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type StoragePathSegment = typeof StoragePathSegment.Type;

const OntologyFilePathParts = S.TemplateLiteralParser([
  "ontologies/",
  Namespace,
  "/",
  OntologyName,
  "/",
  ContentHash,
  "/ontology.ttl",
]).pipe(
  annotateParser(
    "OntologyFilePathParts",
    "Parsed ontology file path including validated namespace, name, and content hash."
  )
);

/**
 * Versioned Turtle ontology object path.
 *
 * **Example** (Use OntologyFilePath)
 * ```ts
 * import { ContentHash, Namespace, OntologyName } from "@effect-ontology/Identity.ts"
 * import { OntologyFilePath } from "@effect-ontology/PathLayout.ts"
 *
 * const path = OntologyFilePath.fromParts(
 *   Namespace.make("legal"),
 *   OntologyName.make("patents"),
 *   ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * )
 * console.log(path.startsWith("ontologies/legal/patents/")) // true
 * ```
 *
 * @invariant `ontologies/{namespace}/{name}/{sha256}/ontology.ttl`.
 * @category value-objects
 * @since 0.0.0
 */
export const OntologyFilePath = S.TemplateLiteral([
  "ontologies/",
  Namespace,
  "/",
  OntologyName,
  "/",
  ContentHash,
  "/ontology.ttl",
]).pipe(
  annotateStoragePath(
    "OntologyFilePath",
    "Versioned Turtle ontology path keyed by namespace, ontology name, and complete content hash."
  ),
  S.brand("OntologyFilePath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromParts: (namespace: Namespace, name: OntologyName, hash: ContentHash): typeof schema.Type =>
      schema.make(`ontologies/${namespace}/${name}/${hash}/ontology.ttl`),
    parts: (path: unknown) =>
      pipe(
        S.decodeUnknownResult(schema)(path),
        Result.flatMap(OntologyFilePathParts.decodeResult),
        Result.map(([, namespace, , name, , hash]) => Tuple.make(namespace, name, hash))
      ),
  }))
);

/**
 * Runtime value decoded by {@link OntologyFilePath}.
 *
 * **Example** (Use OntologyFilePath)
 * ```ts
 * import { type OntologyFilePath } from "@effect-ontology/PathLayout.ts"
 *
 * const accept = (path: OntologyFilePath) => path
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyFilePath = typeof OntologyFilePath.Type;

/**
 * Tuple decoded from the ontology-file path parser.
 *
 * **Example** (Use OntologyFilePathTuple)
 * ```ts
 * import { type OntologyFilePathTuple } from "@effect-ontology/PathLayout.ts"
 *
 * const accept = (parts: OntologyFilePathTuple) => parts
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyFilePathTuple = typeof OntologyFilePathParts.Type;

/**
 * Encoded representation accepted by {@link OntologyFilePath}.
 *
 * **Example** (Use OntologyFilePathEncoded)
 * ```ts
 * import { type OntologyFilePathEncoded } from "@effect-ontology/PathLayout.ts"
 *
 * const accept = (path: OntologyFilePathEncoded) => path
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyFilePathEncoded = typeof OntologyFilePath.Encoded;

/**
 * Mutable ontology manifest path used to resolve the latest version.
 *
 * **Example** (Use OntologyManifestPath)
 * ```ts
 * import { Namespace, OntologyName } from "@effect-ontology/Identity.ts"
 * import { OntologyManifestPath } from "@effect-ontology/PathLayout.ts"
 *
 * const path = OntologyManifestPath.fromParts(
 *   Namespace.make("legal"),
 *   OntologyName.make("patents")
 * )
 * console.log(path) // "ontologies/legal/patents/manifest.json"
 * ```
 *
 * @invariant `ontologies/{namespace}/{name}/manifest.json`.
 * @category value-objects
 * @since 0.0.0
 */
export const OntologyManifestPath = S.TemplateLiteral([
  "ontologies/",
  Namespace,
  "/",
  OntologyName,
  "/manifest.json",
]).pipe(
  annotateStoragePath("OntologyManifestPath", "Ontology manifest path used for latest-version resolution."),
  S.brand("OntologyManifestPath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromParts: (namespace: Namespace, name: OntologyName): typeof schema.Type =>
      schema.make(`ontologies/${namespace}/${name}/manifest.json`),
  }))
);

/**
 * Runtime value decoded by {@link OntologyManifestPath}.
 *
 * **Example** (Use OntologyManifestPath)
 * ```ts
 * import { type OntologyManifestPath } from "@effect-ontology/PathLayout.ts"
 *
 * const accept = (path: OntologyManifestPath) => path
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OntologyManifestPath = typeof OntologyManifestPath.Type;

/**
 * Batch workflow status path.
 *
 * **Example** (Use BatchStatusPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchStatusPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchStatusPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/status.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchStatusPath = makeBatchPathSchema(
  "BatchStatusPath",
  "status.json",
  "Batch workflow status document path."
);

/** Runtime value decoded by {@link BatchStatusPath}.
 *
 * **Example** (Use BatchStatusPath)
 * ```ts
 * import { type BatchStatusPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchStatusPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchStatusPath = typeof BatchStatusPath.Type;

/**
 * Batch input manifest path.
 *
 * **Example** (Use BatchManifestPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchManifestPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchManifestPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/manifest.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchManifestPath = makeBatchPathSchema(
  "BatchManifestPath",
  "manifest.json",
  "Batch input manifest path."
);

/** Runtime value decoded by {@link BatchManifestPath}.
 *
 * **Example** (Use BatchManifestPath)
 * ```ts
 * import { type BatchManifestPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchManifestPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchManifestPath = typeof BatchManifestPath.Type;

/**
 * Batch entity-resolution graph path.
 *
 * **Example** (Use BatchResolutionPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchResolutionPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchResolutionPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/resolution/merged.ttl"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchResolutionPath = makeBatchPathSchema(
  "BatchResolutionPath",
  "resolution/merged.ttl",
  "Merged batch entity-resolution graph path."
);

/** Runtime value decoded by {@link BatchResolutionPath}.
 *
 * **Example** (Use BatchResolutionPath)
 * ```ts
 * import { type BatchResolutionPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchResolutionPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchResolutionPath = typeof BatchResolutionPath.Type;

/**
 * Batch SHACL-validated graph path.
 *
 * **Example** (Use BatchValidationGraphPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchValidationGraphPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchValidationGraphPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/validation/validated.ttl"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchValidationGraphPath = makeBatchPathSchema(
  "BatchValidationGraphPath",
  "validation/validated.ttl",
  "Batch SHACL-validated graph path."
);

/** Runtime value decoded by {@link BatchValidationGraphPath}.
 *
 * **Example** (Use BatchValidationGraphPath)
 * ```ts
 * import { type BatchValidationGraphPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchValidationGraphPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchValidationGraphPath = typeof BatchValidationGraphPath.Type;

/**
 * Batch SHACL validation report path.
 *
 * **Example** (Use BatchValidationReportPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchValidationReportPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchValidationReportPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/validation/report.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchValidationReportPath = makeBatchPathSchema(
  "BatchValidationReportPath",
  "validation/report.json",
  "Batch SHACL validation report path."
);

/** Runtime value decoded by {@link BatchValidationReportPath}.
 *
 * **Example** (Use BatchValidationReportPath)
 * ```ts
 * import { type BatchValidationReportPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchValidationReportPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchValidationReportPath = typeof BatchValidationReportPath.Type;

/**
 * Batch canonical graph path.
 *
 * **Example** (Use BatchCanonicalPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchCanonicalPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchCanonicalPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/canonical/final.ttl"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchCanonicalPath = makeBatchPathSchema(
  "BatchCanonicalPath",
  "canonical/final.ttl",
  "Batch canonical graph path."
);

/** Runtime value decoded by {@link BatchCanonicalPath}.
 *
 * **Example** (Use BatchCanonicalPath)
 * ```ts
 * import { type BatchCanonicalPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchCanonicalPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchCanonicalPath = typeof BatchCanonicalPath.Type;

/**
 * Batch preprocessing enriched-manifest path.
 *
 * **Example** (Use BatchEnrichedManifestPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchEnrichedManifestPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchEnrichedManifestPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/preprocessing/enriched-manifest.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchEnrichedManifestPath = makeBatchPathSchema(
  "BatchEnrichedManifestPath",
  "preprocessing/enriched-manifest.json",
  "Batch preprocessing enriched-manifest path."
);

/** Runtime value decoded by {@link BatchEnrichedManifestPath}.
 *
 * **Example** (Use BatchEnrichedManifestPath)
 * ```ts
 * import { type BatchEnrichedManifestPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchEnrichedManifestPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchEnrichedManifestPath = typeof BatchEnrichedManifestPath.Type;

/**
 * Batch ingest manifest path.
 *
 * **Example** (Use BatchIngestManifestPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchIngestManifestPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchIngestManifestPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/ingest/manifest.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchIngestManifestPath = makeBatchPathSchema(
  "BatchIngestManifestPath",
  "ingest/manifest.json",
  "Batch ingest manifest path."
);

/** Runtime value decoded by {@link BatchIngestManifestPath}.
 *
 * **Example** (Use BatchIngestManifestPath)
 * ```ts
 * import { type BatchIngestManifestPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchIngestManifestPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchIngestManifestPath = typeof BatchIngestManifestPath.Type;

/**
 * Batch final ingest output path.
 *
 * **Example** (Use BatchFinalOutputPath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchFinalOutputPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchFinalOutputPath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/ingest/output.ttl"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchFinalOutputPath = makeBatchPathSchema(
  "BatchFinalOutputPath",
  "ingest/output.ttl",
  "Batch final ingest output path."
);

/** Runtime value decoded by {@link BatchFinalOutputPath}.
 *
 * **Example** (Use BatchFinalOutputPath)
 * ```ts
 * import { type BatchFinalOutputPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchFinalOutputPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchFinalOutputPath = typeof BatchFinalOutputPath.Type;

/**
 * Batch inference-enriched graph path.
 *
 * **Example** (Use BatchInferencePath)
 * ```ts
 * import { BatchId } from "@effect-ontology/Identity.ts"
 * import { BatchInferencePath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(BatchInferencePath.fromBatch(BatchId.make("batch-deadbeefcafe")))
 * // "batches/batch-deadbeefcafe/inference/enriched.ttl"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const BatchInferencePath = makeBatchPathSchema(
  "BatchInferencePath",
  "inference/enriched.ttl",
  "Batch inference-enriched graph path."
);

/** Runtime value decoded by {@link BatchInferencePath}.
 *
 * **Example** (Use BatchInferencePath)
 * ```ts
 * import { type BatchInferencePath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: BatchInferencePath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type BatchInferencePath = typeof BatchInferencePath.Type;

/**
 * Document metadata path.
 *
 * **Example** (Use DocumentMetadataPath)
 * ```ts
 * import { DocumentId } from "@effect-ontology/Identity.ts"
 * import { DocumentMetadataPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(DocumentMetadataPath.fromDocument(DocumentId.make("doc-deadbeefcafe")))
 * // "documents/doc-deadbeefcafe/metadata.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DocumentMetadataPath = makeDocumentPathSchema(
  "DocumentMetadataPath",
  "metadata.json",
  "Document metadata path."
);

/** Runtime value decoded by {@link DocumentMetadataPath}.
 *
 * **Example** (Use DocumentMetadataPath)
 * ```ts
 * import { type DocumentMetadataPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: DocumentMetadataPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocumentMetadataPath = typeof DocumentMetadataPath.Type;

/**
 * Normalized document input path.
 *
 * **Example** (Use DocumentInputPath)
 * ```ts
 * import { DocumentId } from "@effect-ontology/Identity.ts"
 * import { DocumentInputPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(DocumentInputPath.fromDocument(DocumentId.make("doc-deadbeefcafe")))
 * // "documents/doc-deadbeefcafe/input/content.txt"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DocumentInputPath = makeDocumentPathSchema(
  "DocumentInputPath",
  "input/content.txt",
  "Normalized document input path."
);

/** Runtime value decoded by {@link DocumentInputPath}.
 *
 * **Example** (Use DocumentInputPath)
 * ```ts
 * import { type DocumentInputPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: DocumentInputPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocumentInputPath = typeof DocumentInputPath.Type;

/**
 * Extracted document RDF graph path.
 *
 * **Example** (Use DocumentGraphPath)
 * ```ts
 * import { DocumentId } from "@effect-ontology/Identity.ts"
 * import { DocumentGraphPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(DocumentGraphPath.fromDocument(DocumentId.make("doc-deadbeefcafe")))
 * // "documents/doc-deadbeefcafe/extraction/graph.ttl"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DocumentGraphPath = makeDocumentPathSchema(
  "DocumentGraphPath",
  "extraction/graph.ttl",
  "Extracted document RDF graph path."
);

/** Runtime value decoded by {@link DocumentGraphPath}.
 *
 * **Example** (Use DocumentGraphPath)
 * ```ts
 * import { type DocumentGraphPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: DocumentGraphPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type DocumentGraphPath = typeof DocumentGraphPath.Type;

const RunMetadataPathParts = S.TemplateLiteralParser(["runs/", DocumentId, "/metadata.json"]).pipe(
  annotateParser("RunMetadataPathParts", "Parsed extraction-run metadata path and document identifier.")
);

/**
 * Extraction-run metadata path.
 *
 * **Example** (Use RunMetadataPath)
 * ```ts
 * import { DocumentId } from "@effect-ontology/Identity.ts"
 * import { RunMetadataPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(RunMetadataPath.fromDocument(DocumentId.make("doc-deadbeefcafe")))
 * // "runs/doc-deadbeefcafe/metadata.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RunMetadataPath = S.TemplateLiteral(["runs/", DocumentId, "/metadata.json"]).pipe(
  annotateStoragePath("RunMetadataPath", "Extraction-run metadata path."),
  S.brand("RunMetadataPath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromDocument: (documentId: DocumentId): typeof schema.Type => schema.make(`runs/${documentId}/metadata.json`),
    parts: (path: unknown) =>
      pipe(
        S.decodeUnknownResult(schema)(path),
        Result.flatMap(RunMetadataPathParts.decodeResult),
        Result.map(([, documentId]) => documentId)
      ),
  }))
);

/** Runtime value decoded by {@link RunMetadataPath}.
 *
 * **Example** (Use RunMetadataPath)
 * ```ts
 * import { type RunMetadataPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: RunMetadataPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type RunMetadataPath = typeof RunMetadataPath.Type;

/**
 * Extraction-run normalized input path.
 *
 * **Example** (Use RunInputPath)
 * ```ts
 * import { DocumentId } from "@effect-ontology/Identity.ts"
 * import { RunInputPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(RunInputPath.fromDocument(DocumentId.make("doc-deadbeefcafe")))
 * // "runs/doc-deadbeefcafe/input/document.txt"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const RunInputPath = S.TemplateLiteral(["runs/", DocumentId, "/input/document.txt"]).pipe(
  annotateStoragePath("RunInputPath", "Extraction-run normalized input path."),
  S.brand("RunInputPath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromDocument: (documentId: DocumentId): typeof schema.Type => schema.make(`runs/${documentId}/input/document.txt`),
  }))
);

/** Runtime value decoded by {@link RunInputPath}.
 *
 * **Example** (Use RunInputPath)
 * ```ts
 * import { type RunInputPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: RunInputPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type RunInputPath = typeof RunInputPath.Type;

const runChunkPathPattern = /^runs\/doc-[0-9a-f]{12}\/input\/chunks\/chunk-(?:0|[1-9][0-9]*)\.txt$/;

const RunChunkCanonicalIndexCheck = S.isPattern(runChunkPathPattern, {
  identifier: $I`RunChunkCanonicalIndexCheck`,
  title: "Canonical Run Chunk Index",
  description:
    "A run chunk path whose non-negative decimal index has no sign, fraction, exponent, or redundant leading zero.",
  message: "Run chunk path must end with a canonical non-negative decimal index such as chunk-0.txt or chunk-12.txt.",
});

const RunChunkPathParts = S.TemplateLiteralParser([
  "runs/",
  DocumentId,
  "/input/chunks/chunk-",
  NonNegativeInt,
  ".txt",
]).pipe(
  annotateParser(
    "RunChunkPathParts",
    "Parsed extraction-run chunk path with document identifier and non-negative index."
  )
);

/**
 * Extraction-run input chunk path.
 *
 * **Details**
 *
 * * The whole-path check rejects alternate numeric spellings such as `01`,
 * `+1`, fractions, and exponents even when JavaScript could parse them.
 *
 * **Example** (Use RunChunkPath)
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { DocumentId } from "@effect-ontology/Identity.ts"
 * import { RunChunkPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(RunChunkPath.fromParts(
 *   DocumentId.make("doc-deadbeefcafe"),
 *   NonNegativeInt.make(2)
 * ))
 * // "runs/doc-deadbeefcafe/input/chunks/chunk-2.txt"
 * ```
 *
 * @invariant Uses a canonical non-negative decimal index.
 * @category value-objects
 * @since 0.0.0
 */
export const RunChunkPath = S.TemplateLiteral(["runs/", DocumentId, "/input/chunks/chunk-", NonNegativeInt, ".txt"])
  .check(RunChunkCanonicalIndexCheck)
  .pipe(
    annotateStoragePath("RunChunkPath", "Extraction-run chunk path with a canonical non-negative decimal index."),
    S.brand("RunChunkPath"),
    SchemaUtils.withCodecStatics,
    SchemaUtils.withStatics((schema) => ({
      fromParts: (documentId: DocumentId, index: NonNegativeInt): typeof schema.Type =>
        schema.make(`runs/${documentId}/input/chunks/chunk-${index}.txt`),
      parts: (path: unknown) =>
        pipe(
          S.decodeUnknownResult(schema)(path),
          Result.flatMap(RunChunkPathParts.decodeResult),
          Result.map(([, documentId, , index]) => Tuple.make(documentId, index))
        ),
    }))
  );

/** Runtime value decoded by {@link RunChunkPath}.
 *
 * **Example** (Use RunChunkPath)
 * ```ts
 * import { type RunChunkPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: RunChunkPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type RunChunkPath = typeof RunChunkPath.Type;

const RunOutputPathParts = S.TemplateLiteralParser(["runs/", DocumentId, "/outputs/", OutputFilename]).pipe(
  annotateParser(
    "RunOutputPathParts",
    "Parsed extraction-run output path with document identifier and exact artifact filename."
  )
);

/**
 * Exact extraction-run artifact path.
 *
 * **Details**
 *
 * * Unlike the upstream free-form filename slot, this schema accepts only
 * filenames owned by {@link OutputType}.
 *
 * **Example** (Use RunOutputPath)
 * ```ts
 * import { DocumentId } from "@effect-ontology/Identity.ts"
 * import { RunOutputPath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(RunOutputPath.fromParts(
 *   DocumentId.make("doc-deadbeefcafe"),
 *   "rdf-jsonld"
 * ))
 * // "runs/doc-deadbeefcafe/outputs/graph.jsonld"
 * ```
 *
 * @invariant `runs/{documentId}/outputs/{registeredFilename}`.
 * @category value-objects
 * @since 0.0.0
 */
export const RunOutputPath = S.TemplateLiteral(["runs/", DocumentId, "/outputs/", OutputFilename]).pipe(
  annotateStoragePath("RunOutputPath", "Extraction-run output path constrained to the registered artifact filenames."),
  S.brand("RunOutputPath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromParts: (documentId: DocumentId, type: OutputType): typeof schema.Type =>
      schema.make(`runs/${documentId}/outputs/${OutputType.filename(type)}`),
    parts: (path: unknown) =>
      pipe(
        S.decodeUnknownResult(schema)(path),
        Result.flatMap(RunOutputPathParts.decodeResult),
        Result.map(([, documentId, , filename]) => Tuple.make(documentId, filename))
      ),
  }))
);

/** Runtime value decoded by {@link RunOutputPath}.
 *
 * **Example** (Use RunOutputPath)
 * ```ts
 * import { type RunOutputPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: RunOutputPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type RunOutputPath = typeof RunOutputPath.Type;

/**
 * Supported derived image size.
 *
 * **Example** (Use ImageVariantSize)
 * ```ts
 * import { ImageVariantSize } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(ImageVariantSize.is.thumb("thumb")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageVariantSize = LiteralKit(["thumb", "medium"])
  .annotate({
    toArbitrary: () => (fc: typeof FastCheck) => fc.constantFrom("thumb", "medium"),
  })
  .pipe(
    $I.annoteSchema("ImageVariantSize", {
      description: "Finite size label for a derived image variant.",
    })
  );

/**
 * Runtime value decoded by {@link ImageVariantSize}.
 *
 * **Example** (Use ImageVariantSize)
 * ```ts
 * import { ImageVariantSize, type ImageVariantSize as VariantSize } from "@effect-ontology/PathLayout.ts"
 *
 * const size: VariantSize = ImageVariantSize.Enum.thumb
 * console.log(size)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImageVariantSize = typeof ImageVariantSize.Type;

/**
 * Aggregate kind that owns an image manifest.
 *
 * **Example** (Use ImageOwnerType)
 * ```ts
 * import { ImageOwnerType } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(ImageOwnerType.is.document("document")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageOwnerType = LiteralKit(["link", "document"])
  .annotate({
    toArbitrary: () => (fc: typeof FastCheck) => fc.constantFrom("link", "document"),
  })
  .pipe(
    $I.annoteSchema("ImageOwnerType", {
      description: "Finite owner kind used to partition image manifests.",
    })
  );

/**
 * Runtime value decoded by {@link ImageOwnerType}.
 *
 * **Example** (Use ImageOwnerType)
 * ```ts
 * import { ImageOwnerType, type ImageOwnerType as OwnerType } from "@effect-ontology/PathLayout.ts"
 *
 * const ownerType: OwnerType = ImageOwnerType.Enum.document
 * console.log(ownerType)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImageOwnerType = typeof ImageOwnerType.Type;

/**
 * Original image bytes path.
 *
 * **Example** (Use ImageOriginalPath)
 * ```ts
 * import { ContentHash } from "@effect-ontology/Identity.ts"
 * import { ImageOriginalPath } from "@effect-ontology/PathLayout.ts"
 *
 * const hash = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(ImageOriginalPath.fromHash(hash).endsWith("/original")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageOriginalPath = makeImageHashPathSchema(
  "ImageOriginalPath",
  "original",
  "Content-addressed original image bytes path."
);

/** Runtime value decoded by {@link ImageOriginalPath}.
 *
 * **Example** (Use ImageOriginalPath)
 * ```ts
 * import { type ImageOriginalPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: ImageOriginalPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageOriginalPath = typeof ImageOriginalPath.Type;

/**
 * Image metadata document path.
 *
 * **Example** (Use ImageMetadataPath)
 * ```ts
 * import { ContentHash } from "@effect-ontology/Identity.ts"
 * import { ImageMetadataPath } from "@effect-ontology/PathLayout.ts"
 *
 * const hash = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(ImageMetadataPath.fromHash(hash).endsWith("/metadata.json")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageMetadataPath = makeImageHashPathSchema(
  "ImageMetadataPath",
  "metadata.json",
  "Content-addressed image metadata path."
);

/** Runtime value decoded by {@link ImageMetadataPath}.
 *
 * **Example** (Use ImageMetadataPath)
 * ```ts
 * import { type ImageMetadataPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: ImageMetadataPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageMetadataPath = typeof ImageMetadataPath.Type;

/**
 * Optional image-label document path.
 *
 * **Example** (Use ImageLabelsPath)
 * ```ts
 * import { ContentHash } from "@effect-ontology/Identity.ts"
 * import { ImageLabelsPath } from "@effect-ontology/PathLayout.ts"
 *
 * const hash = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(ImageLabelsPath.fromHash(hash).endsWith("/labels.json")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageLabelsPath = makeImageHashPathSchema(
  "ImageLabelsPath",
  "labels.json",
  "Content-addressed optional image-label document path."
);

/** Runtime value decoded by {@link ImageLabelsPath}.
 *
 * **Example** (Use ImageLabelsPath)
 * ```ts
 * import { type ImageLabelsPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: ImageLabelsPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageLabelsPath = typeof ImageLabelsPath.Type;

/**
 * Derived JPEG image variant path.
 *
 * **Example** (Use ImageVariantPath)
 * ```ts
 * import { ContentHash } from "@effect-ontology/Identity.ts"
 * import { ImageVariantPath } from "@effect-ontology/PathLayout.ts"
 *
 * const hash = ContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(ImageVariantPath.fromParts(hash, "thumb").endsWith("/thumb.jpg")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageVariantPath = S.TemplateLiteral([
  "assets/images/",
  ContentHash,
  "/variants/",
  ImageVariantSize,
  ".jpg",
]).pipe(
  annotateStoragePath("ImageVariantPath", "Content-addressed derived JPEG image variant path."),
  S.brand("ImageVariantPath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromParts: (hash: ContentHash, size: ImageVariantSize): typeof schema.Type =>
      schema.make(`assets/images/${hash}/variants/${size}.jpg`),
  }))
);

/** Runtime value decoded by {@link ImageVariantPath}.
 *
 * **Example** (Use ImageVariantPath)
 * ```ts
 * import { type ImageVariantPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: ImageVariantPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageVariantPath = typeof ImageVariantPath.Type;

/**
 * Base path containing all images associated with an owner.
 *
 * **Example** (Use ImageOwnerBasePath)
 * ```ts
 * import { ImageOwnerBasePath, StoragePathSegment } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(ImageOwnerBasePath.fromParts(
 *   "document",
 *   StoragePathSegment.make("doc-deadbeefcafe")
 * ))
 * // "assets/owners/document/doc-deadbeefcafe/images"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageOwnerBasePath = S.TemplateLiteral([
  "assets/owners/",
  ImageOwnerType,
  "/",
  StoragePathSegment,
  "/images",
]).pipe(
  annotateStoragePath("ImageOwnerBasePath", "Traversal-safe base path for all images associated with one owner."),
  S.brand("ImageOwnerBasePath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromParts: (ownerType: ImageOwnerType, ownerId: StoragePathSegment): typeof schema.Type =>
      schema.make(`assets/owners/${ownerType}/${ownerId}/images`),
  }))
);

/** Runtime value decoded by {@link ImageOwnerBasePath}.
 *
 * **Example** (Use ImageOwnerBasePath)
 * ```ts
 * import { type ImageOwnerBasePath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: ImageOwnerBasePath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageOwnerBasePath = typeof ImageOwnerBasePath.Type;

/**
 * Owner image-manifest path.
 *
 * **Example** (Use ImageManifestPath)
 * ```ts
 * import { ImageManifestPath, StoragePathSegment } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(ImageManifestPath.fromParts(
 *   "link",
 *   StoragePathSegment.make("article-42")
 * ))
 * // "assets/owners/link/article-42/images/manifest.json"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ImageManifestPath = S.TemplateLiteral([
  "assets/owners/",
  ImageOwnerType,
  "/",
  StoragePathSegment,
  "/images/manifest.json",
]).pipe(
  annotateStoragePath("ImageManifestPath", "Traversal-safe owner image-manifest path."),
  S.brand("ImageManifestPath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromParts: (ownerType: ImageOwnerType, ownerId: StoragePathSegment): typeof schema.Type =>
      schema.make(`assets/owners/${ownerType}/${ownerId}/images/manifest.json`),
  }))
);

/** Runtime value decoded by {@link ImageManifestPath}.
 *
 * **Example** (Use ImageManifestPath)
 * ```ts
 * import { type ImageManifestPath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: ImageManifestPath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ImageManifestPath = typeof ImageManifestPath.Type;

/**
 * Namespace-level canonical entities graph path.
 *
 * **Example** (Use CanonicalNamespacePath)
 * ```ts
 * import { Namespace } from "@effect-ontology/Identity.ts"
 * import { CanonicalNamespacePath } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(CanonicalNamespacePath.fromNamespace(Namespace.make("legal")))
 * // "canonical/legal/entities.ttl"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const CanonicalNamespacePath = S.TemplateLiteral(["canonical/", Namespace, "/entities.ttl"]).pipe(
  annotateStoragePath("CanonicalNamespacePath", "Namespace-level canonical entities graph path."),
  S.brand("CanonicalNamespacePath"),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    fromNamespace: (namespace: Namespace): typeof schema.Type => schema.make(`canonical/${namespace}/entities.ttl`),
  }))
);

/** Runtime value decoded by {@link CanonicalNamespacePath}.
 *
 * **Example** (Use CanonicalNamespacePath)
 * ```ts
 * import { type CanonicalNamespacePath } from "@effect-ontology/PathLayout.ts"
 * const accept = (path: CanonicalNamespacePath) => path
 * console.log(accept)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalNamespacePath = typeof CanonicalNamespacePath.Type;

/**
 * Unified constructors and total parsers for storage paths.
 *
 * **Details**
 *
 * * Builders delegate to the owning schema statics. Parser functions return
 * `Result` so untrusted object keys never throw synchronously. Image hashes
 * use complete content identity, and owner IDs must already be validated
 * {@link StoragePathSegment} values.
 *
 * **Example** (Use PathLayout)
 * ```ts
 * import { BatchId, DocumentId } from "@effect-ontology/Identity.ts"
 * import { PathLayout } from "@effect-ontology/PathLayout.ts"
 *
 * console.log(PathLayout.batch.status(BatchId.make("batch-deadbeefcafe")))
 * console.log(PathLayout.run.output(DocumentId.make("doc-deadbeefcafe"), "rdf-jsonld"))
 * ```
 *
 * @invariant Every produced value satisfies the corresponding exported path
 * schema.
 * @category utilities
 * @since 0.0.0
 */
export const PathLayout = {
  ontology: {
    encode: OntologyFilePath.fromParts,
    decode: OntologyFilePath.parts,
    manifest: OntologyManifestPath.fromParts,
  },
  batch: {
    status: BatchStatusPath.fromBatch,
    manifest: BatchManifestPath.fromBatch,
    resolution: BatchResolutionPath.fromBatch,
    validationGraph: BatchValidationGraphPath.fromBatch,
    validationReport: BatchValidationReportPath.fromBatch,
    canonical: BatchCanonicalPath.fromBatch,
    enrichedManifest: BatchEnrichedManifestPath.fromBatch,
    ingestManifest: BatchIngestManifestPath.fromBatch,
    finalOutput: BatchFinalOutputPath.fromBatch,
    inference: BatchInferencePath.fromBatch,
  },
  document: {
    metadata: DocumentMetadataPath.fromDocument,
    input: DocumentInputPath.fromDocument,
    graph: DocumentGraphPath.fromDocument,
  },
  run: {
    metadata: RunMetadataPath.fromDocument,
    input: RunInputPath.fromDocument,
    chunk: RunChunkPath.fromParts,
    output: RunOutputPath.fromParts,
    parseMetadata: RunMetadataPath.parts,
    parseChunk: RunChunkPath.parts,
    parseOutput: RunOutputPath.parts,
  },
  canonical: (namespace: Namespace) => ({
    entities: CanonicalNamespacePath.fromNamespace(namespace),
  }),
  image: {
    original: ImageOriginalPath.fromHash,
    metadata: ImageMetadataPath.fromHash,
    labels: ImageLabelsPath.fromHash,
    variant: ImageVariantPath.fromParts,
    manifest: ImageManifestPath.fromParts,
    ownerBase: ImageOwnerBasePath.fromParts,
  },
};

export {
  /**
   * Registered output artifact filenames colocated with path construction.
   *
   * **Example** (Use PathLayout)
   * ```ts
   * import { OutputFilename } from "@effect-ontology/PathLayout.ts"
   *
   * console.log(OutputFilename.Enum.graphJsonld) // "graph.jsonld"
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  OutputFilename,
  /**
   * Closed output artifact taxonomy used by run-path constructors.
   *
   * **Example** (Use PathLayout)
   * ```ts
   * import { OutputType } from "@effect-ontology/PathLayout.ts"
   *
   * console.log(OutputType.filename("rdf-jsonld")) // "graph.jsonld"
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  OutputType,
};
