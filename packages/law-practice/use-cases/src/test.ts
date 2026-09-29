/**
 * Test-only law-practice use-case fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Port-output schema for the `Effect` a law-practice port method returns,
 * exported for package-local guard and codec tests.
 *
 * **Example** (Guard a port output)
 *
 * ```ts
 * import { EffectOutput } from "@beep/law-practice-use-cases/test"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EffectOutput<number>())(Effect.succeed(1))) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export { EffectOutput } from "./internal/effectOutput.ts";
/**
 * Spike entity input schema exported for package-local schema parity tests.
 *
 * **Example** (Decode entity input schema)
 *
 * ```ts
 * import { EntityInput } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(EntityInput)({
 *   createdAt: 1,
 *   createdByPrincipal: { component: "Runtime", kind: "System" },
 *   entityType: "LawPracticeClaim",
 *   id: 2,
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 3,
 *   updatedByPrincipal: { component: "Runtime", kind: "System" }
 * })
 *
 * console.log(input.source) // "System"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export { EntityInput } from "./internal/spikeEntity.ts";
/**
 * Fixed office-action review spike candidates.
 *
 * **Example** (Log spike candidates length)
 *
 * ```ts
 * import { OfficeActionReviewSpikeCandidates } from "@beep/law-practice-use-cases/test"
 *
 * console.log(OfficeActionReviewSpikeCandidates.length)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export { OfficeActionReviewSpikeCandidates } from "./OfficeActionReview/OfficeActionReview.candidates.ts";
