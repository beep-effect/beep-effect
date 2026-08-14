/**
 * SHACL validation service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { Dataset, NamedNode, ObjectTerm } from "@beep/rdf/Rdf";
import { makeSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
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
      "The v1 package surface validates a bounded SHACL-inspired subset covering targetClass, targetNode, minCount, maxCount, datatype, class, and hasValue.",
      "Full external SHACL engines can consume the optional shapesDataset while legacy callers keep using the typed bounded shapes array.",
    ],
  });

/**
 * SHACL report severity.
 *
 * **Example** (Decode violation severity)
 *
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
 * Type for {@link ShaclSeverity}.
 *
 * **Example** (Narrow violation severity type)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ShaclSeverity } from "@beep/semantic-web/services/shacl-validation"
 *
 * const severity: ShaclSeverity = "violation"
 * strictEqual(ShaclSeverity.is.violation(severity), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ShaclSeverity = typeof ShaclSeverity.Type;

/**
 * SHACL property shape used by the bounded service contract.
 *
 * **Example** (Decode property shape)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclPropertyShape } from "@beep/semantic-web/services/shacl-validation"
 *
 * const shape = S.decodeUnknownSync(ShaclPropertyShape)({
 *   path: { termType: "NamedNode", value: "https://example.com/name" },
 *   minCount: 1,
 *   class: { termType: "NamedNode", value: "https://schema.org/Person" }
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
    class: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
    hasValue: S.OptionFromOptionalKey(ObjectTerm).pipe(SchemaUtils.withNoneDefault),
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
 * **Example** (Decode node shape)
 *
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
    targetNode: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
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
 * **Example** (Decode validation violation)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation"
 *
 * const violation = S.decodeUnknownSync(ShaclValidationViolation)({
 *   focusNode: "https://example.com/alice",
 *   path: { termType: "NamedNode", value: "https://example.com/name" },
 *   message: "Expected at least one value.",
 *   severity: "violation",
 *   sourceConstraintComponent: {
 *     termType: "NamedNode",
 *     value: "http://www.w3.org/ns/shacl#MinCountConstraintComponent"
 *   }
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
    sourceShape: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
    sourceConstraintComponent: S.OptionFromOptionalKey(NamedNode).pipe(SchemaUtils.withNoneDefault),
    value: S.OptionFromOptionalKey(ObjectTerm).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ShaclValidationViolation", {
    description: "SHACL validation violation.",
    semanticSchemaMetadata: serviceContractMetadata("ShaclValidationViolation", "SHACL validation violation."),
  })
) {}

/**
 * SHACL validation request.
 *
 * **Example** (Decode validation request)
 *
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
    shapesDataset: S.OptionFromOptionalKey(Dataset).pipe(SchemaUtils.withNoneDefault),
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
 * **Example** (Make conforming result)
 *
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
 * **Example** (Decode invalidShape reason)
 *
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
 * Type for {@link ShaclValidationErrorReason}.
 *
 * **Example** (Narrow invalidShape reason type)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ShaclValidationErrorReason } from "@beep/semantic-web/services/shacl-validation"
 *
 * const reason: ShaclValidationErrorReason = "invalidShape"
 * strictEqual(ShaclValidationErrorReason.is.invalidShape(reason), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ShaclValidationErrorReason = typeof ShaclValidationErrorReason.Type;

/**
 * Typed SHACL validation error.
 *
 * **Example** (Make invalidShape error)
 *
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
 * **Example** (Accept service shape type)
 *
 * ```ts
 * import type { ShaclValidationServiceShape } from "@beep/semantic-web/services/shacl-validation"
 *
 * const acceptShaclValidationServiceShape = (value: ShaclValidationServiceShape) => value
 * console.log(acceptShaclValidationServiceShape)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ShaclValidationServiceShape {
  readonly validate: (request: ShaclValidationRequest) => Effect.Effect<ShaclValidationResult, ShaclValidationError>;
}

/**
 * SHACL validation service tag.
 *
 * **Example** (Validate with mock service)
 *
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
