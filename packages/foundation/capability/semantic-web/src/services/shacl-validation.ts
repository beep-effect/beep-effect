/**
 * SHACL validation service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import { Dataset, NamedNode } from "../rdf.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";
import type { Effect } from "effect";

const $I = $SemanticWebId.create("services/shacl-validation");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "SHACL Core", disposition: "informative" }],
    equivalenceBasis: "Shape and result equality by exact field comparison.",
    representations: [{ kind: "RDF/JS" }],
    implementationNotes: [
      "The v1 package surface validates a bounded SHACL-inspired subset covering targetClass, minCount, maxCount, and datatype.",
      "A full external SHACL engine can later back this contract without changing the public request and result wrappers.",
    ],
  });

/**
 * SHACL report severity.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclSeverity } from "@beep/semantic-web/services/shacl-validation"
 *
 * const severity = S.decodeUnknownSync(ShaclSeverity)("violation")
 * strictEqual(severity, "violation")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ShaclSeverity = LiteralKit(["info", "warning", "violation"]).pipe(
  $I.annoteSchema("ShaclSeverity", {
    description: "SHACL report severity.",
  })
);

/**
 * SHACL property shape used by the bounded service contract.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclPropertyShape } from "@beep/semantic-web/services/shacl-validation"
 *
 * const shape = S.decodeUnknownSync(ShaclPropertyShape)({
 *   path: { termType: "NamedNode", value: "https://example.com/name" },
 *   minCount: 1
 * })
 * strictEqual(shape.path.value, "https://example.com/name")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShaclPropertyShape extends S.Class<ShaclPropertyShape>($I`ShaclPropertyShape`)(
  {
    path: NamedNode,
    minCount: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
    maxCount: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
    datatype: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ShaclPropertyShape", {
    description: "SHACL property shape used by the bounded service contract.",
    semanticSchemaMetadata: serviceContractMetadata(
      "ShaclPropertyShape",
      "SHACL property shape used by the bounded service contract."
    ),
  })
) {}

/**
 * SHACL node shape used by the bounded service contract.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclNodeShape } from "@beep/semantic-web/services/shacl-validation"
 *
 * const shape = S.decodeUnknownSync(ShaclNodeShape)({
 *   targetClass: { termType: "NamedNode", value: "https://example.com/Person" },
 *   properties: [
 *     {
 *       path: { termType: "NamedNode", value: "https://example.com/name" },
 *       minCount: 1
 *     }
 *   ]
 * })
 * strictEqual(shape.properties.length, 1)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShaclNodeShape extends S.Class<ShaclNodeShape>($I`ShaclNodeShape`)(
  {
    id: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
    targetClass: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
    properties: S.Array(ShaclPropertyShape),
  },
  $I.annote("ShaclNodeShape", {
    description: "SHACL node shape used by the bounded service contract.",
    semanticSchemaMetadata: serviceContractMetadata(
      "ShaclNodeShape",
      "SHACL node shape used by the bounded service contract."
    ),
  })
) {}

/**
 * SHACL validation violation.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation"
 *
 * const violation = S.decodeUnknownSync(ShaclValidationViolation)({
 *   focusNode: "https://example.com/alice",
 *   path: { termType: "NamedNode", value: "https://example.com/name" },
 *   message: "Expected at least one value.",
 *   severity: "violation"
 * })
 * strictEqual(violation.severity, "violation")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShaclValidationViolation extends S.Class<ShaclValidationViolation>($I`ShaclValidationViolation`)(
  {
    focusNode: S.String,
    path: NamedNode,
    message: S.String,
    severity: ShaclSeverity,
  },
  $I.annote("ShaclValidationViolation", {
    description: "SHACL validation violation.",
    semanticSchemaMetadata: serviceContractMetadata("ShaclValidationViolation", "SHACL validation violation."),
  })
) {}

/**
 * SHACL validation request.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclValidationRequest } from "@beep/semantic-web/services/shacl-validation"
 *
 * const request = S.decodeUnknownSync(ShaclValidationRequest)({
 *   dataset: { quads: [] },
 *   shapes: [],
 *   maxResults: 10
 * })
 * strictEqual(request.shapes.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShaclValidationRequest extends S.Class<ShaclValidationRequest>($I`ShaclValidationRequest`)(
  {
    dataset: Dataset,
    shapes: S.Array(ShaclNodeShape),
    maxResults: S.OptionFromOptionalKey(NonNegativeInt).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ShaclValidationRequest", {
    description: "SHACL validation request.",
    semanticSchemaMetadata: serviceContractMetadata(
      "ShaclValidationRequest",
      "Request to validate RDF data against bounded SHACL-inspired shapes."
    ),
  })
) {}

/**
 * SHACL validation result.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ShaclValidationResult } from "@beep/semantic-web/services/shacl-validation"
 *
 * const result = ShaclValidationResult.make({
 *   conforms: true,
 *   violations: [],
 *   truncated: false
 * })
 * strictEqual(result.conforms, true)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShaclValidationResult extends S.Class<ShaclValidationResult>($I`ShaclValidationResult`)(
  {
    conforms: S.Boolean,
    violations: S.Array(ShaclValidationViolation),
    truncated: S.Boolean,
  },
  $I.annote("ShaclValidationResult", {
    description: "SHACL validation result.",
    semanticSchemaMetadata: serviceContractMetadata("ShaclValidationResult", "SHACL validation result."),
  })
) {}

/**
 * SHACL validation error reason.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclValidationErrorReason } from "@beep/semantic-web/services/shacl-validation"
 *
 * const reason = S.decodeUnknownSync(ShaclValidationErrorReason)("invalidShape")
 * strictEqual(reason, "invalidShape")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ShaclValidationErrorReason = LiteralKit(["invalidShape", "engineFailure"]).pipe(
  $I.annoteSchema("ShaclValidationErrorReason", {
    description: "SHACL validation error reason.",
    semanticSchemaMetadata: serviceContractMetadata("ShaclValidationErrorReason", "SHACL validation error reason."),
  })
);

/**
 * Typed SHACL validation error.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ShaclValidationError } from "@beep/semantic-web/services/shacl-validation"
 *
 * const error = ShaclValidationError.make({
 *   reason: "invalidShape",
 *   message: "maxCount must be greater than or equal to minCount."
 * })
 * strictEqual(error.reason, "invalidShape")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ShaclValidationError extends TaggedErrorClass<ShaclValidationError>($I`ShaclValidationError`)(
  "ShaclValidationError",
  {
    reason: ShaclValidationErrorReason,
    message: S.String,
  },
  $I.annote("ShaclValidationError", {
    description: "Typed SHACL validation error.",
    semanticSchemaMetadata: serviceContractMetadata("ShaclValidationError", "Typed SHACL validation error."),
  })
) {}

/**
 * SHACL validation service contract shape.
 *
 * @example
 * ```ts
 * import type { ShaclValidationServiceShape } from "@beep/semantic-web/services/shacl-validation"
 *
 * const acceptShaclValidationServiceShape = (value: ShaclValidationServiceShape) => value
 * console.log(acceptShaclValidationServiceShape)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface ShaclValidationServiceShape {
  readonly validate: (request: ShaclValidationRequest) => Effect.Effect<ShaclValidationResult, ShaclValidationError>;
}

/**
 * SHACL validation service tag.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   ShaclValidationRequest,
 *   ShaclValidationResult,
 *   ShaclValidationService
 * } from "@beep/semantic-web/services/shacl-validation"
 *
 * const request = S.decodeUnknownSync(ShaclValidationRequest)({
 *   dataset: { quads: [] },
 *   shapes: []
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* ShaclValidationService
 *   return yield* service.validate(request)
 * })
 *
 * const result = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     ShaclValidationService,
 *     ShaclValidationService.of({
 *       validate: () => Effect.succeed(ShaclValidationResult.make({ conforms: true, violations: [], truncated: false }))
 *     })
 *   )
 * )
 * strictEqual(result.conforms, true)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ShaclValidationService extends Context.Service<ShaclValidationService, ShaclValidationServiceShape>()(
  $I`ShaclValidationService`
) {}
