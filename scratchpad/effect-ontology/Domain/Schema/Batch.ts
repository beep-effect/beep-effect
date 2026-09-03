/**
 * Batch-workflow manifests and activity boundary schemas.
 *
 * **Details**
 *
 * * All optional inputs are normalized to `Option`, collections use meaningful
 * empty or non-empty constraints, and workflow policies/configuration receive
 * schema-owned defaults.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { MimeType, NonNegativeInt, NonNegNum, SchemaUtils } from "@beep/schema";
import { ShaclSeverity } from "@beep/semantic-web/services/shacl-validation";
import * as S from "effect/Schema";
import { BatchId, DocumentId, GcsUri, Namespace, OntologyName, OntologyVersion } from "../Identity.ts";
import {
  ChunkingParams,
  defaultChunkingParams,
  defaultPreprocessingOptions,
  LanguageCode,
  PreprocessingOptions,
} from "./DocumentMetadata.ts";
import { ValidationPolicy } from "./Shacl.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Batch");
const defaultValidationPolicy = ValidationPolicy.decodeUnknownSync({});

/**
 * One immutable source entry in a stored batch manifest.
 *
 * **Example** (Use ManifestDocument)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ManifestDocument } from "@effect-ontology/Schema/Batch"
 *
 * const document = S.decodeUnknownOption(ManifestDocument)({
 *   documentId: "doc-abc123def456",
 *   sourceUri: "gs://beep-input/documents/report.pdf",
 *   contentType: "application/pdf",
 *   sizeBytes: 128
 * })
 * console.log(O.map(document, (value) => value.sizeBytes)) // 128
 * ```
 *
 * @invariant Size is a non-negative integer and content type is a recognized
 * MIME type.
 * @category models
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
 * **Details**
 *
 * * A manifest must contain at least one document. Omitted SHACL shapes decode
 * to `Option.none`, while omitted validation policy decodes to the canonical
 * policy that fails on violations only.
 *
 * **Example** (Use BatchManifest)
 * ```ts
 * import * as S from "effect/Schema"
 * import { BatchManifest, ManifestDocument } from "@effect-ontology/Schema/Batch"
 *
 * const documents = [S.decodeUnknownOption(ManifestDocument)({
 *   documentId: "doc-abc123def456",
 *   sourceUri: "gs://beep-input/documents/report.pdf",
 *   contentType: "application/pdf",
 *   sizeBytes: 128
 * })]
 * console.log(documents.length)
 * ```
 *
 * @invariant Contains at least one document and a complete validation policy.
 * @category models
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

  static readonly decodeEffectFromJsonString = S.decodeEffect(S.fromJsonString(BatchManifest));
  static readonly encodeEffectFromJsonStringFormatted = S.encodeEffect(S.fromJsonString(BatchManifest, { space: 2 }));
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(BatchManifest);
  static readonly encodeEffectFromJsonString = S.encodeEffect(S.fromJsonString(BatchManifest));
}

/**
 * Input to extraction of one document.
 *
 * **Details**
 *
 * * Optional provenance and acceleration metadata are `Option` values. Extraction
 * logic therefore matches on semantic absence instead of checking nullish
 * boundary values.
 *
 * **Example** (Use ExtractionActivityInput)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ExtractionActivityInput } from "@effect-ontology/Schema/Batch"
 *
 * const input = S.decodeUnknownOption(ExtractionActivityInput)({
 *   batchId: "batch-abc123def456",
 *   documentId: "doc-abc123def456",
 *   sourceUri: "gs://beep-input/documents/report.pdf",
 *   ontologyUri: "gs://beep-ontology/football/premier-league.ttl",
 *   ontologyId: "premier-league",
 *   targetNamespace: "football"
 * })
 * console.log(O.map(input, (value) => value.ontologyId)) // Some("premier-league")
 * ```
 *
 * @category dtos
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
    chunking: ChunkingParams.pipe(
      SchemaUtils.withKeyDefaults(defaultChunkingParams.standard),
      S.annotateKey({ description: "Schema-defaulted preprocessing chunking hints for extraction." })
    ),
    eventTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    publishedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    title: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    language: S.OptionFromOptionalKey(LanguageCode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExtractionActivityInput", {
    description: "Document, ontology, namespace, acceleration, and provenance inputs for extraction.",
  })
) {
  static readonly decodeEffectFromJsonString = S.decodeEffect(S.fromJsonString(ExtractionActivityInput));
}

/**
 * Input to entity resolution after per-document extraction.
 *
 * **Example** (Use ResolutionActivityInput)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ResolutionActivityInput } from "@effect-ontology/Schema/Batch"
 *
 * const input = S.decodeUnknownOption(ResolutionActivityInput)({
 *   batchId: "batch-abc123def456",
 *   documentGraphUris: ["gs://beep-ontology-state/documents/doc-abc123def456/graph.jsonld"]
 * })
 * console.log(O.map(input, (value) => value.documentGraphUris.length)) // Some(1)
 * ```
 *
 * @invariant At least one document graph is supplied for resolution.
 * @category dtos
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
) {
  static readonly decodeEffectFromJsonString = S.decodeEffect(S.fromJsonString(ResolutionActivityInput));
}

/**
 * Input to SHACL validation of a resolved graph.
 *
 * **Details**
 *
 * * Omitted shapes request generation from the ontology; omitted policy uses the
 * canonical violation-failing default.
 *
 * **Example** (Use ValidationActivityInput)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ValidationActivityInput } from "@effect-ontology/Schema/Batch"
 *
 * const input = S.decodeUnknownOption(ValidationActivityInput)({
 *   batchId: "batch-abc123def456",
 *   resolvedGraphUri: "gs://beep-ontology-state/batches/batch-abc123def456/resolved.jsonld",
 *   ontologyUri: "gs://beep-ontology/football/premier-league.ttl"
 * })
 * console.log(O.map(input, (value) => value.validationPolicy.logOnly)) // Some(false)
 * console.log(O.map(input, (value) => value.validationPolicy.failOnViolation)) // Some(true)
 * ```
 *
 * @category dtos
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
) {
  static readonly decodeEffectFromJsonString = S.decodeEffect(S.fromJsonString(ValidationActivityInput));
}

/**
 * Aggregated SHACL results for one severity.
 *
 * **Example** (Use ValidationActivityViolationSummary)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ValidationActivityViolationSummary } from "@effect-ontology/Schema/Batch"
 *
 * const summary = S.decodeUnknownOption(ValidationActivityViolationSummary)({
 *   severity: "warning",
 *   count: 0
 * })
 * console.log(O.map(summary, (value) => value.sampleMessages)) // []
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
    severity: ShaclSeverity.annotateKey({
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
 * **Details**
 *
 * * This transport summary complements the experiment execution
 * `ShaclValidationReport`, whose nested validation result owns standards-level
 * conformance; this value records artifact locations and workflow timing.
 *
 * **Example** (Use ValidationActivityOutput)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ValidationActivityOutput } from "@effect-ontology/Schema/Batch"
 *
 * const output = S.decodeUnknownOption(ValidationActivityOutput)({
 *   validatedUri: "gs://beep-ontology-state/batches/batch-abc123def456/validated.jsonld",
 *   conforms: true,
 *   violations: 0,
 *   reportUri: "gs://beep-ontology-state/batches/batch-abc123def456/shacl.json",
 *   durationMs: 12
 * })
 * console.log(O.map(output, (value) => value.conforms)) // Some(true)
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
 * **Example** (Use IngestionActivityInput)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { IngestionActivityInput } from "@effect-ontology/Schema/Batch"
 *
 * const input = S.decodeUnknownOption(IngestionActivityInput)({
 *   batchId: "batch-abc123def456",
 *   validatedGraphUri: "gs://beep-ontology-state/batches/batch-abc123def456/validated.jsonld",
 *   targetNamespace: "football"
 * })
 * console.log(O.map(input, (value) => value.targetNamespace)) // Some("football")
 * ```
 *
 * @category dtos
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
) {
  static readonly decodeEffectFromJsonString = S.decodeEffect(S.fromJsonString(IngestionActivityInput));
}

/**
 * Complete payload used to start or resume a batch workflow.
 *
 * **Details**
 *
 * * Document identifiers are non-empty, optional artifact locations decode to
 * `Option`, and preprocessing always has a complete schema-owned value.
 *
 * **Example** (Use BatchWorkflowPayload)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BatchWorkflowPayload } from "@effect-ontology/Schema/Batch"
 *
 * const payload = S.decodeUnknownOption(BatchWorkflowPayload)({
 *   batchId: "batch-abc123def456",
 *   ontologyId: "premier-league",
 *   manifestUri: "gs://beep-ontology-state/batches/batch-abc123def456/manifest.json",
 *   ontologyVersion: `football/premier-league@${"a".repeat(64)}`,
 *   ontologyUri: "gs://beep-ontology/football/premier-league.ttl",
 *   targetNamespace: "football",
 *   documentIds: ["doc-abc123def456"]
 * })
 * console.log(O.map(payload, (value) => value.documentIds.length)) // Some(1)
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
    shaclUri: GcsUri.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    documentIds: S.NonEmptyArray(DocumentId),
    ontologyEmbeddingsUri: GcsUri.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    preprocessing: PreprocessingOptions.pipe(SchemaUtils.withKeyDefaults(defaultPreprocessingOptions)),
  },
  $I.annote("BatchWorkflowPayload", {
    description:
      "Complete ontology-scoped batch workflow payload with non-empty documents and normalized optional artifacts.",
  })
) {
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(BatchWorkflowPayload);
}

/**
 * SHACL workflow policy re-export retained for source-path parity.
 *
 * **Example** (Use Batch)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ValidationPolicy } from "@effect-ontology/Schema/Batch"
 *
 * const policy = S.decodeUnknownOption(ValidationPolicy)({})
 * console.log(O.map(policy, (value) => value.failOnViolation)) // Some(true)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export { ValidationPolicy };
