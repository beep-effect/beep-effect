/**
 * Public batch-submission request schemas.
 *
 * @remarks
 * Optional boundary fields decode to `Option`, and omitted preprocessing
 * configuration decodes to the complete canonical default.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { MimeType, NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { BatchId, DocumentId, GcsUri, Namespace, OntologyName, OntologyVersion } from "../Identity.ts";
import { defaultPreprocessingOptions, PreprocessingOptions } from "./DocumentMetadata.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/BatchRequest");

/**
 * One stored source document submitted for batch extraction.
 *
 * @remarks
 * Server-generated identifiers, size observations, and real-world timestamps
 * are represented as `Option`; downstream logic never inspects nullish values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BatchRequestDocument } from "@effect-ontology/Schema/BatchRequest.ts"
 *
 * const document = S.decodeUnknownSync(BatchRequestDocument)({
 *   sourceUri: "gs://beep-input/documents/report.pdf",
 *   contentType: "application/pdf"
 * })
 * console.log(document.sourceUri)
 * ```
 *
 * @invariant Size, when present, is a non-negative integer and content type is
 * a recognized MIME type.
 * @category requests
 * @since 0.0.0
 */
export class BatchRequestDocument extends S.Class<BatchRequestDocument>($I`BatchRequestDocument`)(
  {
    sourceUri: GcsUri.annotateKey({
      description: "Canonical Google Cloud Storage URI of the source document.",
    }),
    contentType: MimeType.annotateKey({
      description: "Recognized MIME type of the stored source document.",
    }),
    sizeBytes: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-negative source size in bytes.",
      })
    ),
    documentId: S.OptionFromOptionalKey(DocumentId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional caller-supplied document identifier; absence requests server derivation.",
      })
    ),
    eventTime: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional UTC instant of the real-world event described by the document.",
      })
    ),
    publishedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional UTC instant at which the original source was published.",
      })
    ),
  },
  $I.annote("BatchRequestDocument", {
    description: "Validated stored source document with Option-normalized identity, size, and provenance timestamps.",
  })
) {
  /** Derived runtime guard for validated request documents. */
  static readonly is = S.is(BatchRequestDocument);
}

/**
 * Request to launch one ontology-scoped extraction batch.
 *
 * @remarks
 * At least one document is required. Omitting `preprocessing` supplies
 * {@link defaultPreprocessingOptions}; optional generated or derived fields are
 * normalized to `Option`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BatchRequest } from "@effect-ontology/Schema/BatchRequest.ts"
 *
 * const request = S.decodeUnknownSync(BatchRequest)({
 *   ontologyId: "premier-league",
 *   ontologyUri: "gs://beep-ontology/football/premier-league.ttl",
 *   ontologyVersion:
 *     "football/premier-league@" + "a".repeat(64),
 *   targetNamespace: "football",
 *   documents: [
 *     {
 *       sourceUri: "gs://beep-input/documents/report.pdf",
 *       contentType: "application/pdf"
 *     }
 *   ]
 * })
 * console.log(request.preprocessing.enabled) // true
 * ```
 *
 * @invariant Contains at least one validated document and a complete
 * preprocessing policy.
 * @category requests
 * @since 0.0.0
 */
export class BatchRequest extends S.Class<BatchRequest>($I`BatchRequest`)(
  {
    batchId: S.OptionFromOptionalKey(BatchId).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional caller-supplied batch identifier; absence requests server derivation.",
      })
    ),
    ontologyId: OntologyName.annotateKey({
      description: "Canonical ontology registry name used for routing and scoping.",
    }),
    ontologyUri: GcsUri.annotateKey({
      description: "Canonical storage URI of the ontology document.",
    }),
    ontologyVersion: OntologyVersion.annotateKey({
      description: "Content-addressed ontology version used by the entire batch.",
    }),
    targetNamespace: Namespace.annotateKey({
      description: "Validated namespace used when minting entity IRIs.",
    }),
    shaclUri: S.OptionFromOptionalKey(GcsUri).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional storage URI of caller-supplied SHACL shapes.",
      })
    ),
    ontologyEmbeddingsUri: S.OptionFromOptionalKey(GcsUri).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional precomputed ontology-embedding artifact URI.",
      })
    ),
    documents: S.NonEmptyArray(BatchRequestDocument).annotateKey({
      description: "Non-empty ordered collection of source documents to process.",
    }),
    preprocessing: PreprocessingOptions.pipe(
      SchemaUtils.withKeyDefaults(defaultPreprocessingOptions),
      S.annotateKey({
        description: "Complete preprocessing policy; omission enables canonical defaults.",
      })
    ),
  },
  $I.annote("BatchRequest", {
    description: "Non-empty ontology-scoped batch submission with schema-defaulted preprocessing.",
  })
) {
  /**
   * Decodes an untrusted batch request.
   *
   * @param input - Unknown API-boundary value to validate and normalize.
   * @returns An Effect that succeeds with a complete request or fails with a
   * schema parse error.
   *
   * @example
   * ```ts
   * import { BatchRequest } from "@effect-ontology/Schema/BatchRequest.ts"
   *
   * const decode = BatchRequest.decode({
   *   ontologyId: "premier-league",
   *   ontologyUri: "gs://beep-ontology/football/premier-league.ttl",
   *   ontologyVersion: "football/premier-league@" + "a".repeat(64),
   *   targetNamespace: "football",
   *   documents: [{
   *     sourceUri: "gs://beep-input/documents/report.pdf",
   *     contentType: "application/pdf"
   *   }]
   * })
   * console.log(decode)
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = S.decodeUnknownEffect(BatchRequest);

  /** Derived runtime guard for validated batch requests. */
  static readonly is = S.is(BatchRequest);
}

export {
  /**
   * Canonical default preprocessing policy retained for source-path parity.
   *
   * @example
   * ```ts
   * import { defaultPreprocessingOptions } from "@effect-ontology/Schema/BatchRequest.ts"
   *
   * console.log(defaultPreprocessingOptions.enabled) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  defaultPreprocessingOptions,
  /**
   * Schema-backed preprocessing policy retained for source-path parity.
   *
   * @example
   * ```ts
   * import * as S from "effect/Schema"
   * import { PreprocessingOptions } from "@effect-ontology/Schema/BatchRequest.ts"
   *
   * console.log(S.decodeUnknownSync(PreprocessingOptions)({}).enabled) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  PreprocessingOptions,
};
