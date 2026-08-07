/**
 * Claim lifecycle transition service.
 *
 * Advances a candidate claim along the lifecycle in response to a gate verdict:
 * an admitted verdict drives `candidate -> shape_valid`; a rejected verdict
 * blocks the advance (the claim is returned unchanged); an illegal forward step
 * fails with {@link ClaimInvalidTransition}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as DomainCandidateClaim from "@beep/epistemic-domain/entities/CandidateClaim";
import { ClaimGateResult, ClaimInvalidTransition } from "@beep/epistemic-domain/values";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Context, Effect } from "effect";

const $I = $EpistemicUseCasesId.create("ClaimLifecycle/ClaimLifecycle.service");

/**
 * Service shape for the claim lifecycle transition.
 *
 * **Example** (Shape with advance function)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import type { ClaimTransitionShape } from "@beep/epistemic-use-cases/ClaimLifecycle"
 *
 * const shape: ClaimTransitionShape = {
 *   advance: (claim) => Effect.succeed(claim)
 * }
 *
 * strictEqual(typeof shape.advance, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ClaimTransitionShape {
  readonly advance: (
    claim: DomainCandidateClaim.CandidateClaim,
    gateResult: ClaimGateResult
  ) => Effect.Effect<DomainCandidateClaim.CandidateClaim, ClaimInvalidTransition>;
}

/**
 * Claim lifecycle transition service tag.
 *
 * **Example** (Provide ClaimTransition service)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import { ClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle"
 *
 * const hasAdvance = Effect.runSync(
 *   Effect.gen(function* () {
 *     const transition = yield* ClaimTransition
 *     return typeof transition.advance === "function"
 *   }).pipe(
 *     Effect.provideService(
 *       ClaimTransition,
 *       ClaimTransition.of({
 *         advance: (claim) => Effect.succeed(claim)
 *       })
 *     )
 *   )
 * )
 *
 * strictEqual(hasAdvance, true)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ClaimTransition extends Context.Service<ClaimTransition, ClaimTransitionShape>()($I`ClaimTransition`) {}

/**
 * Build the claim lifecycle transition shape. Pure: it has no dependencies and
 * derives the next claim deterministically from the current claim and a gate
 * verdict.
 *
 * **Example** (Advance admitted candidate claim)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { CandidateClaim, ClaimGateResult } from "@beep/epistemic-domain"
 * import { makeClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const claim = S.decodeUnknownSync(CandidateClaim)({
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "EpistemicCandidateClaim",
 *   fixtureKey: "claim.patentability",
 *   id: 1,
 *   lifecycle: "candidate",
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: {},
 *   source: "Agent",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 * const admitted = S.decodeUnknownSync(ClaimGateResult)({ verdict: "admitted" })
 *
 * const advanced = Effect.runSync(makeClaimTransition().advance(claim, admitted))
 * strictEqual(advanced.lifecycle, "shape_valid")
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeClaimTransition = (): ClaimTransitionShape => ({
  advance: (claim, gateResult) =>
    ClaimGateResult.match(gateResult, {
      rejected: () => Effect.succeed(claim),
      admitted: () =>
        claim.lifecycle === "candidate"
          ? Effect.succeed(DomainCandidateClaim.CandidateClaim.make({ ...claim, lifecycle: "shape_valid" }))
          : Effect.fail(ClaimInvalidTransition.between(claim.lifecycle, "shape_valid")),
    }),
});
