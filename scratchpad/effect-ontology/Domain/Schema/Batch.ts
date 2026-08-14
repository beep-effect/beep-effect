/**
 * Batch-workflow manifests and activity boundary schemas.
 *
 * @remarks
 * All optional inputs are normalized to `Option`, collections use meaningful
 * empty or non-empty constraints, and workflow policies/configuration receive
 * schema-owned defaults.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { MimeType, NonNegativeInt, NonNegNum, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { BatchId, DocumentId, GcsUri, Namespace, OntologyName, OntologyVersion } from "../Identity.ts";
import { defaultPreprocessingOptions, LanguageCode, PreprocessingOptions } from "./DocumentMetadata.ts";
import { ShaclViolationSeverity, ValidationPolicy } from "./Shacl.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Batch");
const defaultValidationPolicy = ValidationPolicy.fromUnknown({});

/**
 * One immutable source entry in a stored batch manifest.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ManifestDocument } from "@effect-ontology/Schema/Batch.ts"
 *
 * const document = S.decodeUnknownSync(ManifestDocument)({
 *   documentId: "doc-abc123def456",
 *   sourceUri: "gs://beep-input/documents/report.pdf",
 *   contentType: "application/pdf",
 *   sizeBytes: 128
 * })
 * console.log(document.sizeBytes) // 128
 * ```
 *
 * @invariant Size is a non-negative integer and content type is a recognized
 * MIME type.
 * @category manifests
 * @since 0.0.0
 */
export class ManifestDocument extends S.Class<ManifestDocument>($I`ManifestDocument`)(
  {
    documentId: DocumentId.annotateKey({
      description: "Stable content-derived document identifier.",
    }),
    sourceUri: GcsUri.annotateKey({
      description: "Canonical storage URI of the source document.",
    }),
    contentType: MimeType.annotateKey({
      description: "Recognized MIME type of the source document.",
    }),
    sizeBytes: NonNegativeInt.annotateKey({
      description: "Non-negative source size measured in bytes.",
    }),
  },
  $I.annote("ManifestDocument", {
    description: "Validated identity, storage location, MIME type, and byte size for one manifest document.",
  })
) {}

/**
 * Immutable manifest that defines one batch workflow.
 *
 * @remarks
 * A manifest must contain at least one document. Omitted SHACL shapes decode
 * to `Option.none`, while omitted validation policy decodes to the canonical
 * policy that fails on violations only.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BatchManifest, ManifestDocument } from "@effect-ontology/Schema/Batch.ts"
 *
 * const documents = [S.decodeUnknownSync(ManifestDocument)({
 *   documentId: "doc-abc123def456",
 *   sourceUri: "gs://beep-input/documents/report.pdf",
 *   contentType: "application/pdf",
 *   sizeBytes: 128
 * })]
 * console.log(documents.length)
 * ```
 *
 * @invariant Contains at least one document and a complete validation policy.
 * @category manifests
 * @since 0.0.0
 */
export class BatchManifest extends S.Class<BatchManifest>($I`BatchManifest`)(
  {
    batchId: BatchId.annotateKey({
      description: "Stable identifier shared by every stage of the batch.",
    }),
    ontologyId: OntologyName.annotateKey({
      description: "Canonical ontology registry name used for routing and scoping.",
    }),
    ontologyUri: GcsUri.annotateKey({
      description: "Canonical storage URI of the ontology document.",
    }),
    ontologyVersion: OntologyVersion.annotateKey({
      description: "Content-addressed ontology version used by the batch.",
    }),
    shaclUri: S.OptionFromOptionalKey(GcsUri).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional storage URI of caller-supplied SHACL shapes.",
      })
    ),
    targetNamespace: Namespace.annotateKey({
      description: "Validated namespace used when minting entity IRIs.",
    }),
    documents: S.NonEmptyArray(ManifestDocument).annotateKey({
      description: "Non-empty ordered collection of documents in the batch.",
    }),
    createdAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which the immutable manifest was created.",
    }),
    validationPolicy: ValidationPolicy.pipe(
      SchemaUtils.withKeyDefaults(defaultValidationPolicy),
      S.annotateKey({
        description: "Complete policy controlling workflow failure for SHACL results.",
      })
    ),
  },
  $I.annote("BatchManifest", {
    description: "Versioned ontology-scoped batch manifest with non-empty documents and a complete validation policy.",
  })
) {
  static readonly decodeOptionString = S.decodeOption(S.fromJsonString(BatchManifest));
}

/**
 * Input to extraction of one document.
 *
 * @remarks
 * Optional provenance and acceleration metadata are `Option` values. Extraction
 * logic therefore matches on semantic absence instead of checking nullish
 * boundary values.
 *
 * @example
 * ```ts
 * import type { ExtractionActivityInput } from "@effect-ontology/Schema/Batch.ts"
 *
 * const ontology = (input: ExtractionActivityInput) => input.ontologyId
 * console.log(typeof ontology) // "function"
 * ```
 *
 * @category activities
 * @since 0.0.0
 */
export class ExtractionActivityInput extends S.Class<ExtractionActivityInput>($I`ExtractionActivityInput`)(
  {
    batchId: BatchId,
    documentId: DocumentId,
    sourceUri: GcsUri,
    ontologyUri: GcsUri,
    ontologyId: OntologyName,
    targetNamespace: Namespace,
    ontologyEmbeddingsUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
    eventTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    publishedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    title: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    language: S.OptionFromOptionalKey(LanguageCode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExtractionActivityInput", {
    description: "Document, ontology, namespace, acceleration, and provenance inputs for extraction.",
  })
) {}

/**
 * Input to entity resolution after per-document extraction.
 *
 * @example
 * ```ts
 * import type { ResolutionActivityInput } from "@effect-ontology/Schema/Batch.ts"
 *
 * const count = (input: ResolutionActivityInput) => input.documentGraphUris.length
 * console.log(typeof count) // "function"
 * ```
 *
 * @invariant At least one document graph is supplied for resolution.
 * @category activities
 * @since 0.0.0
 */
export class ResolutionActivityInput extends S.Class<ResolutionActivityInput>($I`ResolutionActivityInput`)(
  {
    batchId: BatchId,
    documentGraphUris: S.NonEmptyArray(GcsUri).annotateKey({
      description: "Non-empty collection of extracted per-document graph URIs.",
    }),
  },
  $I.annote("ResolutionActivityInput", {
    description: "Batch identity and non-empty extracted graph locations for entity resolution.",
  })
) {}

/**
 * Input to SHACL validation of a resolved graph.
 *
 * @remarks
 * Omitted shapes request generation from the ontology; omitted policy uses the
 * canonical violation-failing default.
 *
 * @example
 * ```ts
 * import type { ValidationActivityInput } from "@effect-ontology/Schema/Batch.ts"
 *
 * const graph = (input: ValidationActivityInput) => input.resolvedGraphUri
 * console.log(typeof graph) // "function"
 * ```
 *
 * @category activities
 * @since 0.0.0
 */
export class ValidationActivityInput extends S.Class<ValidationActivityInput>($I`ValidationActivityInput`)(
  {
    batchId: BatchId,
    resolvedGraphUri: GcsUri,
    ontologyUri: GcsUri,
    shaclUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
    validationPolicy: ValidationPolicy.pipe(SchemaUtils.withKeyDefaults(defaultValidationPolicy)),
  },
  $I.annote("ValidationActivityInput", {
    description: "Resolved graph, ontology, optional shapes, and complete SHACL failure policy.",
  })
) {}

/**
 * Aggregated SHACL results for one severity.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ValidationActivityViolationSummary } from "@effect-ontology/Schema/Batch.ts"
 *
 * const summary = S.decodeUnknownSync(ValidationActivityViolationSummary)({
 *   severity: "warning",
 *   count: 0
 * })
 * console.log(summary.sampleMessages) // []
 * ```
 *
 * @invariant Count is non-negative and messages are always represented by an
 * array.
 * @category validation
 * @since 0.0.0
 */
export class ValidationActivityViolationSummary extends S.Class<ValidationActivityViolationSummary>(
  $I`ValidationActivityViolationSummary`
)(
  {
    severity: ShaclViolationSeverity.annotateKey({
      description: "Standard SHACL severity summarized by this value.",
    }),
    count: NonNegativeInt.annotateKey({
      description: "Number of results having the summarized severity.",
    }),
    sampleMessages: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({
        description: "Bounded representative diagnostics selected by the validation adapter.",
      })
    ),
  },
  $I.annote("ValidationActivityViolationSummary", {
    description: "Non-negative SHACL result count and representative messages for one standard severity.",
  })
) {}

/**
 * Compact output of the SHACL validation activity.
 *
 * @remarks
 * This transport summary complements the standards-level
 * `ShaclValidationReport`: it records artifact locations and workflow timing.
 *
 * @example
 * ```ts
 * import type { ValidationActivityOutput } from "@effect-ontology/Schema/Batch.ts"
 *
 * const conforms = (output: ValidationActivityOutput) => output.conforms
 * console.log(typeof conforms) // "function"
 * ```
 *
 * @invariant Counts and duration are finite and non-negative; summary
 * collections are never nullish.
 * @category validation
 * @since 0.0.0
 */
export class ValidationActivityOutput extends S.Class<ValidationActivityOutput>($I`ValidationActivityOutput`)(
  {
    validatedUri: GcsUri,
    conforms: S.Boolean,
    violations: NonNegativeInt,
    violationSummary: S.Array(ValidationActivityViolationSummary).pipe(
      SchemaUtils.withEmptyArrayDefaults<ValidationActivityViolationSummary>()
    ),
    reportUri: GcsUri,
    durationMs: NonNegNum,
  },
  $I.annote("ValidationActivityOutput", {
    description:
      "Validated graph and report locations with conformance, result counts, summaries, and elapsed milliseconds.",
  })
) {}

/**
 * Input to ingestion of a graph that has completed validation.
 *
 * @example
 * ```ts
 * import type { IngestionActivityInput } from "@effect-ontology/Schema/Batch.ts"
 *
 * const namespace = (input: IngestionActivityInput) => input.targetNamespace
 * console.log(typeof namespace) // "function"
 * ```
 *
 * @category activities
 * @since 0.0.0
 */
export class IngestionActivityInput extends S.Class<IngestionActivityInput>($I`IngestionActivityInput`)(
  {
    batchId: BatchId,
    validatedGraphUri: GcsUri,
    targetNamespace: Namespace,
  },
  $I.annote("IngestionActivityInput", {
    description: "Batch identity, validated graph location, and target namespace for ingestion.",
  })
) {}

/**
 * Complete payload used to start or resume a batch workflow.
 *
 * @remarks
 * Document identifiers are non-empty, optional artifact locations decode to
 * `Option`, and preprocessing always has a complete schema-owned value.
 *
 * @example
 * ```ts
 * import type { BatchWorkflowPayload } from "@effect-ontology/Schema/Batch.ts"
 *
 * const documents = (payload: BatchWorkflowPayload) => payload.documentIds
 * console.log(typeof documents) // "function"
 * ```
 *
 * @invariant Contains at least one document identifier and complete
 * preprocessing configuration.
 * @category workflows
 * @since 0.0.0
 */
export class BatchWorkflowPayload extends S.Class<BatchWorkflowPayload>($I`BatchWorkflowPayload`)(
  {
    batchId: BatchId,
    ontologyId: OntologyName,
    manifestUri: GcsUri,
    ontologyVersion: OntologyVersion,
    ontologyUri: GcsUri,
    targetNamespace: Namespace,
    shaclUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
    documentIds: S.NonEmptyArray(DocumentId),
    ontologyEmbeddingsUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
    preprocessing: PreprocessingOptions.pipe(SchemaUtils.withKeyDefaults(defaultPreprocessingOptions)),
  },
  $I.annote("BatchWorkflowPayload", {
    description:
      "Complete ontology-scoped batch workflow payload with non-empty documents and normalized optional artifacts.",
  })
) {}

/**
 * SHACL workflow policy re-export retained for source-path parity.
 *
 * @example
 * ```ts
 * import { ValidationPolicy } from "@effect-ontology/Schema/Batch.ts"
 *
 * console.log(ValidationPolicy.fromUnknown({}).failOnViolation) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export { ValidationPolicy };
