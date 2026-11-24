/**
 * Claim gate verdict value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicsId.create("ClaimGate/ClaimGateResult.model");
const ClaimGateSeverityBase = LiteralKit(["info", "warning", "violation"]);

/**
 * Severity of a claim gate violation. Mirrors the bounded SHACL severity
 * vocabulary as a product-agnostic domain literal so the verdict carries no
 * dependency on the semantic-web engine.
 *
 * **Details**
 *
 * `fromUnknown` returns an Effect with schema failures in its error channel;
 * `decodeOption` remains available for non-throwing synchronous checks.
 *
 * **Example** (Decode severity value)
 *
 * ```ts
 * import { ClaimGateSeverity } from "@beep/epistemics/ClaimGate"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const severity = yield* S.decodeUnknownEffect(ClaimGateSeverity)("violation")
 *   console.log(severity) // "violation"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimGateSeverity = ClaimGateSeverityBase.pipe(
  $I.annoteSchema("ClaimGateSeverity", {
    description: "Severity of a claim gate violation.",
  }),
  SchemaUtils.withLiteralKitStatics(ClaimGateSeverityBase)
);

/**
 * **Example** (Satisfy severity type)
 *
 * ```ts
 * import type { ClaimGateSeverity } from "@beep/epistemics/ClaimGate"
 *
 * const severity = "violation" satisfies ClaimGateSeverity
 * console.log(severity)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimGateSeverity = typeof ClaimGateSeverity.Type;

/**
 * A single claim gate violation, projected from a SHACL validation violation
 * into product-agnostic primitives (no RDF terms, no engine types).
 *
 * **Example** (Construct a violation)
 *
 * ```ts
 * import { ClaimGateViolation } from "@beep/epistemics/ClaimGate"
 * import { $EpistemicId } from "@beep/identity/packages"
 *
 * const violation = ClaimGateViolation.make({
 *   focusNode: "<urn:claim:1>",
 *   path: $EpistemicId.create("evidence").iri,
 *   message: "Expected at least 1 value(s) for evidence.",
 *   severity: "violation",
 * })
 * console.log(violation.severity)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimGateViolation extends S.Opaque<ClaimGateViolation, { readonly brand: unique symbol }>()(
  S.Struct({
    focusNode: S.String.annotateKey({ description: "SHACL focus node projected as a stable string token." }),
    path: S.String.annotateKey({ description: "SHACL result path projected as a stable string token." }),
    message: S.String.annotateKey({ description: "Human-readable validation message." }),
    severity: ClaimGateSeverity.annotateKey({ description: "Severity assigned by the claim gate." }),
  }).pipe(
    $I.annoteSchema("ClaimGateViolation", {
      description: "A single claim gate violation projected from a SHACL validation violation.",
    })
  )
) {}

const ClaimGateVerdict = LiteralKit(["admitted", "rejected"]).pipe(
  $I.annoteSchema("ClaimGateVerdict", {
    description: "Internal literal verdict vocabulary used to build ClaimGateResult.",
  })
);

/**
 * Typed verdict returned by the claim gate, discriminated on `verdict`: an
 * `admitted` claim carries no violations and drives a lifecycle advance, while a
 * `rejected` claim carries the violations that blocked it and does not advance.
 *
 * **Example** (Decode rejected result)
 *
 * ```ts
 * import { ClaimGateResult } from "@beep/epistemics/ClaimGate"
 * import { $EpistemicId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownSync(ClaimGateResult)({
 *   verdict: "rejected",
 *   violations: [
 *     {
 *       focusNode: $EpistemicId.create("claim/patentability").iri,
 *       message: "Expected at least 1 value(s) for evidence.",
 *       path: $EpistemicId.create("hasEvidenceQuote").iri,
 *       severity: "violation",
 *     },
 *   ],
 * })
 *
 * console.log(result.verdict)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimGateResult = ClaimGateVerdict.toTaggedUnion("verdict")({
  admitted: {},
  rejected: {
    violations: S.Array(ClaimGateViolation).annotateKey({
      description: "Claim gate violations that blocked admission.",
    }),
  },
}).pipe(
  $I.annoteSchema("ClaimGateResult", {
    description: "Typed admitted/rejected verdict returned by the claim gate.",
  })
);

/**
 * **Example** (Type admitted result)
 *
 * ```ts
 * import type { ClaimGateResult } from "@beep/epistemics/ClaimGate"
 *
 * const admitted: ClaimGateResult = { verdict: "admitted" }
 * console.log(admitted.verdict)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimGateResult = typeof ClaimGateResult.Type;
