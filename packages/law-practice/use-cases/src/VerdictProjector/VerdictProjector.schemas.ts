/**
 * Verdict projection values: what an attorney's final verdict on a
 * `claim-finding` review item says about the candidate claim's disposition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimDispositionStatus } from "@beep/epistemics/ClaimDispositionStatus";
import { ClaimGateViolation } from "@beep/epistemics/ClaimGate";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { CandidateClaimId } from "@beep/shared-domain/identity/Epistemic";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("VerdictProjector/VerdictProjector.schemas");

/**
 * Reason recorded when the attorney marks a claim finding `right`.
 *
 * **Example** (Read the confirm reason)
 *
 * ```ts
 * import { ATTORNEY_CONFIRMED_REASON } from "@beep/law-practice-use-cases/VerdictProjector"
 *
 * console.log(ATTORNEY_CONFIRMED_REASON) // "Attorney confirmed the finding"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ATTORNEY_CONFIRMED_REASON = "Attorney confirmed the finding";

/**
 * Reason recorded when the attorney marks a claim finding `wrong` without
 * typing a note.
 *
 * **Details**
 *
 * A `wrong` verdict with a note uses the note as the reason instead.
 *
 * **Example** (Read the fallback reject reason)
 *
 * ```ts
 * import { ATTORNEY_REJECTED_REASON } from "@beep/law-practice-use-cases/VerdictProjector"
 *
 * console.log(ATTORNEY_REJECTED_REASON) // "Attorney rejected the finding"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ATTORNEY_REJECTED_REASON = "Attorney rejected the finding";

/**
 * **Details**
 *
 * The subset of `ClaimDispositionStatus` without `superseded`. Superseding a
 * stored disposition is the epistemic owner's decision, never the
 * projector's.
 *
 * **Example** (Guard a projected status)
 *
 * ```ts
 * import { ClaimDispositionProjectionStatus } from "@beep/law-practice-use-cases/VerdictProjector"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimDispositionProjectionStatus)("rejected")) // true
 * console.log(S.is(ClaimDispositionProjectionStatus)("superseded")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimDispositionProjectionStatus = ClaimDispositionStatus.pick(["active", "rejected"]).pipe(
  $I.annoteSchema("ClaimDispositionProjectionStatus", {
    description: "Disposition statuses an attorney verdict projects to: active for right, rejected for wrong.",
  })
);

/**
 * @see {@link ClaimDispositionProjectionStatus} for the verdict mapping.
 * @category models
 * @since 0.0.0
 */
export type ClaimDispositionProjectionStatus = typeof ClaimDispositionProjectionStatus.Type;

/**
 * The disposition an attorney's final verdict implies for one candidate
 * claim, as a value the epistemic owner completes and persists.
 *
 * **Details**
 *
 * The field names and encodings match the matching fields of the persisted
 * `ClaimDisposition` entity, so the epistemic owner completes a projection
 * into a `ClaimDispositionAppend` by adding the entity id, organization and
 * audit fields. The projection carries none of those: it never invents ids.
 * `resolvedAt` is the `recordedAt` of the verdict row that decided it, never
 * a clock reading. `violations` is always empty, because an attorney verdict
 * is not a claim-gate result; the field exists so the value spreads into the
 * entity shape unchanged. It defaults to `[]` on construction.
 *
 * **Example** (Build a confirmed projection)
 *
 * ```ts
 * import { ATTORNEY_CONFIRMED_REASON, ClaimDispositionProjection } from "@beep/law-practice-use-cases/VerdictProjector"
 * import * as DateTime from "effect/DateTime"
 *
 * const projection = ClaimDispositionProjection.make({
 *   claimId: 3,
 *   status: "active",
 *   reason: ATTORNEY_CONFIRMED_REASON,
 *   resolvedAt: DateTime.makeUnsafe(1_760_400_000_000),
 *   resolvedBy: { kind: "System", component: "Runtime" },
 * })
 *
 * console.log(projection.status) // "active"
 * console.log(projection.violations.length) // 0
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ClaimDispositionProjection extends S.Opaque<
  ClaimDispositionProjection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    claimId: CandidateClaimId.annotateKey({
      description: "Candidate claim the verdict resolves.",
    }),
    status: ClaimDispositionProjectionStatus.annotateKey({
      description: "Disposition status the verdict implies: active for right, rejected for wrong.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Fixed confirm reason, the attorney's note, or the fixed reject reason.",
    }),
    resolvedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "The deciding verdict row's recordedAt, encoded as epoch milliseconds.",
    }),
    resolvedBy: Principal.annotateKey({
      description: "Principal the caller names as the decider; the projector copies it unchanged.",
    }),
    violations: S.Array(ClaimGateViolation).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({
        description: "Always empty: an attorney verdict is not a claim-gate result.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ClaimDispositionProjection", {
      description: "The disposition an attorney's final verdict implies for one candidate claim, before persistence.",
    })
  )
) {}

/**
 * **Example** (Type an encoded projection timestamp)
 *
 * ```ts
 * import type { ClaimDispositionProjection } from "@beep/law-practice-use-cases/VerdictProjector"
 *
 * const resolvedAt: ClaimDispositionProjection.Encoded["resolvedAt"] = 1_760_400_000_000
 * console.log(resolvedAt) // 1760400000000
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace ClaimDispositionProjection {
  /**
   * Wire-encoded representation of a decoded {@link ClaimDispositionProjection}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { ClaimDispositionProjection } from "@beep/law-practice-use-cases/VerdictProjector"
   *
   * type Wire = ClaimDispositionProjection.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof ClaimDispositionProjection.Encoded;
}
