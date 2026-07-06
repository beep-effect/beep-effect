/**
 * Dataset canonicalization service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { Dataset } from "../rdf.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";
import type { Effect } from "effect";

const $I = $SemanticWebId.create("services/canonicalization");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "RDF Dataset Canonicalization 1.0", disposition: "normative" }],
    equivalenceBasis: "Canonical text and fingerprint equality.",
    representations: [{ kind: "RDF/JS" }, { kind: "TriG" }],
    canonicalizationRequired: true,
    implementationNotes: [
      "rdfc-1.0 is the graph-safe canonicalization algorithm for semantic identity and fingerprinting.",
      "lexical-sort-v1 remains a deterministic fallback for non-semantic ordering workflows only.",
    ],
  });

/**
 * Canonicalization algorithm name.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { CanonicalizationAlgorithm } from "@beep/semantic-web/services/canonicalization"
 *
 * const algorithm = S.decodeUnknownSync(CanonicalizationAlgorithm)("rdfc-1.0")
 * strictEqual(algorithm, "rdfc-1.0")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CanonicalizationAlgorithm = LiteralKit(["rdfc-1.0", "lexical-sort-v1"]).pipe(
  $I.annoteSchema("CanonicalizationAlgorithm", {
    description: "Canonicalization algorithm name with an explicit graph-safe default and lexical fallback.",
  })
);

/**
 * Canonicalization error reason.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { CanonicalizationErrorReason } from "@beep/semantic-web/services/canonicalization"
 *
 * const reason = S.decodeUnknownSync(CanonicalizationErrorReason)("unsupportedAlgorithm")
 * strictEqual(reason, "unsupportedAlgorithm")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CanonicalizationErrorReason = LiteralKit([
  "workLimitExceeded",
  "unsupportedAlgorithm",
  "canonicalizationFailure",
  "fingerprintFailure",
]).pipe(
  $I.annoteSchema("CanonicalizationErrorReason", {
    description: "Canonicalization error reason.",
    semanticSchemaMetadata: serviceContractMetadata("CanonicalizationErrorReason", "Canonicalization error reason."),
  })
);

/**
 * Typed canonicalization error.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { CanonicalizationError } from "@beep/semantic-web/services/canonicalization"
 *
 * const error = CanonicalizationError.make({
 *   reason: "unsupportedAlgorithm",
 *   message: "Only rdfc-1.0 is accepted for graph-safe fingerprints."
 * })
 * strictEqual(error.reason, "unsupportedAlgorithm")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CanonicalizationError extends TaggedErrorClass<CanonicalizationError>($I`CanonicalizationError`)(
  "CanonicalizationError",
  {
    reason: CanonicalizationErrorReason,
    message: S.String,
  },
  $I.annote("CanonicalizationError", {
    description: "Typed canonicalization error.",
    semanticSchemaMetadata: serviceContractMetadata("CanonicalizationError", "Typed canonicalization error."),
  })
) {}

/**
 * Dataset canonicalization request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { CanonicalizeDatasetRequest } from "@beep/semantic-web/services/canonicalization"
 *
 * const request = S.decodeUnknownSync(CanonicalizeDatasetRequest)({
 *   dataset: { quads: [] },
 *   algorithm: "rdfc-1.0"
 * })
 * strictEqual(request.algorithm, "rdfc-1.0")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalizeDatasetRequest extends S.Class<CanonicalizeDatasetRequest>($I`CanonicalizeDatasetRequest`)(
  {
    dataset: Dataset,
    algorithm: CanonicalizationAlgorithm,
    workLimit: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CanonicalizeDatasetRequest", {
    description: "Dataset canonicalization request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "CanonicalizeDatasetRequest",
      "Request to canonicalize an RDF dataset."
    ),
  })
) {}

/**
 * Dataset fingerprint request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { FingerprintDatasetRequest } from "@beep/semantic-web/services/canonicalization"
 *
 * const request = S.decodeUnknownSync(FingerprintDatasetRequest)({
 *   dataset: { quads: [] },
 *   algorithm: "lexical-sort-v1"
 * })
 * strictEqual(request.dataset.quads.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FingerprintDatasetRequest extends S.Class<FingerprintDatasetRequest>($I`FingerprintDatasetRequest`)(
  {
    dataset: Dataset,
    algorithm: CanonicalizationAlgorithm,
    workLimit: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FingerprintDatasetRequest", {
    description: "Dataset fingerprint request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "FingerprintDatasetRequest",
      "Request to fingerprint an RDF dataset."
    ),
  })
) {}

/**
 * Canonical dataset output.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { CanonicalDatasetResult } from "@beep/semantic-web/services/canonicalization"
 *
 * const result = S.decodeUnknownSync(CanonicalDatasetResult)({
 *   canonicalText: "",
 *   dataset: { quads: [] }
 * })
 * strictEqual(result.canonicalText, "")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalDatasetResult extends S.Class<CanonicalDatasetResult>($I`CanonicalDatasetResult`)(
  {
    canonicalText: S.String,
    dataset: Dataset,
  },
  $I.annote("CanonicalDatasetResult", {
    description: "Canonical dataset output.",
    semanticSchemaMetadata: serviceContractMetadata("CanonicalDatasetResult", "Canonical dataset output."),
  })
) {}

/**
 * Dataset fingerprint output.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { DatasetFingerprint } from "@beep/semantic-web/services/canonicalization"
 *
 * const fingerprint = "0".repeat(64)
 * const result = S.decodeUnknownSync(DatasetFingerprint)({
 *   canonicalText: "<s> <p> <o> .",
 *   fingerprint
 * })
 * strictEqual(result.fingerprint, fingerprint)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DatasetFingerprint extends S.Class<DatasetFingerprint>($I`DatasetFingerprint`)(
  {
    canonicalText: S.String,
    fingerprint: Sha256Hex,
  },
  $I.annote("DatasetFingerprint", {
    description: "Dataset fingerprint output.",
    semanticSchemaMetadata: serviceContractMetadata("DatasetFingerprint", "Dataset fingerprint output."),
  })
) {}

/**
 * Canonicalization service contract shape.
 *
 * @example
 * ```ts
 * import type { CanonicalizationServiceShape } from "@beep/semantic-web/services/canonicalization"
 *
 * const acceptCanonicalizationServiceShape = (value: CanonicalizationServiceShape) => value
 * console.log(acceptCanonicalizationServiceShape)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface CanonicalizationServiceShape {
  readonly canonicalize: (
    request: CanonicalizeDatasetRequest
  ) => Effect.Effect<CanonicalDatasetResult, CanonicalizationError>;
  readonly fingerprint: (
    request: FingerprintDatasetRequest
  ) => Effect.Effect<DatasetFingerprint, CanonicalizationError>;
}

/**
 * Canonicalization service tag.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   CanonicalDatasetResult,
 *   CanonicalizationError,
 *   CanonicalizationService,
 *   CanonicalizeDatasetRequest
 * } from "@beep/semantic-web/services/canonicalization"
 *
 * const request = S.decodeUnknownSync(CanonicalizeDatasetRequest)({
 *   dataset: { quads: [] },
 *   algorithm: "rdfc-1.0"
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* CanonicalizationService
 *   const result = yield* service.canonicalize(request)
 *   return result.canonicalText
 * })
 *
 * const canonicalText = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     CanonicalizationService,
 *     CanonicalizationService.of({
 *       canonicalize: () =>
 *         Effect.succeed(S.decodeUnknownSync(CanonicalDatasetResult)({ canonicalText: "", dataset: { quads: [] } })),
 *       fingerprint: () =>
 *         Effect.fail(CanonicalizationError.make({ reason: "fingerprintFailure", message: "not used" }))
 *     })
 *   )
 * )
 * strictEqual(canonicalText, "")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CanonicalizationService extends Context.Service<CanonicalizationService, CanonicalizationServiceShape>()(
  $I`CanonicalizationService`
) {}
