/**
 * Claim lifecycle value schemas.
 *
 * Shared-kernel product language: the admission lifecycle of a claim, deliberately
 * shared across knowledge verticals (epistemic owns the gate/projection mechanism;
 * law-practice and future verticals type their work-product state from this same
 * vocabulary). Product-agnostic — it names the stages of a claim's journey, not any
 * one domain's claims.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SharedDomainId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("values/ClaimLifecycle/ClaimLifecycle.model");
const ClaimLifecycleBase = LiteralKit(["candidate", "shape_valid", "consistency_checked", "admitted"]);
const ClaimLifecycleTransitionReason = S.NonEmptyString.pipe(
  $I.annoteSchema("ClaimLifecycleTransitionReason", {
    description: "Non-empty reason text explaining a claim lifecycle transition.",
  })
);

/**
 * Lifecycle vocabulary for claims.
 *
 * The four states form a linear admission pipeline: a claim starts as a
 * `candidate`, becomes `shape_valid` once it passes structural validation,
 * `consistency_checked` after cross-checking, and `admitted` once accepted into
 * the authoritative store. `ClaimLifecycle.Options` is the canonical forward order.
 *
 * @example
 * ```ts
 * import { ClaimLifecycle } from "@beep/shared-domain/values/ClaimLifecycle"
 *
 * console.log(ClaimLifecycle.is.shape_valid("shape_valid"))
 * console.log(ClaimLifecycle.Enum.admitted)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimLifecycle = ClaimLifecycleBase.pipe(
  $I.annoteSchema("ClaimLifecycle", {
    description: "Admission lifecycle state for a claim: candidate -> shape_valid -> consistency_checked -> admitted.",
  }),
  SchemaUtils.withLiteralKitStatics(ClaimLifecycleBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Runtime type for {@link ClaimLifecycle}.
 *
 * @example
 * ```ts
 * import type { ClaimLifecycle } from "@beep/shared-domain/values/ClaimLifecycle"
 *
 * const value: ClaimLifecycle = "candidate"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClaimLifecycle = typeof ClaimLifecycle.Type;

/**
 * A single claim lifecycle transition: the state before, the state after, and a
 * reason describing why the move occurred (e.g. a gate verdict or a reasoner
 * result). Pure value object — it records a transition, it does not authorize
 * one. Legality of a transition is enforced by the owning slice's transition
 * service.
 *
 * @example
 * ```ts
 * import { ClaimLifecycleTransition } from "@beep/shared-domain/values/ClaimLifecycle"
 *
 * const transition = ClaimLifecycleTransition.make({
 *   from: "candidate",
 *   to: "shape_valid",
 *   reason: "claim gate admitted",
 * })
 * console.log(transition.to)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimLifecycleTransition extends S.Class<ClaimLifecycleTransition>($I`ClaimLifecycleTransition`)(
  {
    from: ClaimLifecycle.annotateKey({ description: "Lifecycle state before the transition." }),
    to: ClaimLifecycle.annotateKey({ description: "Lifecycle state after the transition." }),
    reason: ClaimLifecycleTransitionReason.annotateKey({ description: "Reason the transition occurred." }),
  },
  $I.annote("ClaimLifecycleTransition", {
    description: "A single claim lifecycle state change with from/to states and a reason.",
  })
) {}
