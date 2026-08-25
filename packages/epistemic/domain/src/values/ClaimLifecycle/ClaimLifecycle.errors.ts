/**
 * Claim lifecycle typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { ClaimLifecycle } from "./ClaimLifecycle.model.ts";

const $I = $EpistemicDomainId.create("values/ClaimLifecycle/ClaimLifecycle.errors");

/**
 * Raised when a requested lifecycle transition is not a legal forward step for
 * the claim's current state (e.g. skipping a state, moving backwards, or
 * advancing past `admitted`).
 *
 * **Example** (Make invalid transition error)
 *
 * ```ts
 * import { ClaimInvalidTransition } from "@beep/epistemic-domain"
 *
 * const error = ClaimInvalidTransition.make({ from: "candidate", to: "admitted" })
 * console.log(error.from)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClaimInvalidTransition extends S.TaggedError<ClaimInvalidTransition>($I`ClaimInvalidTransition`)(
  "ClaimInvalidTransition",
  {
    from: ClaimLifecycle,
    to: ClaimLifecycle,
  },
  $I.annoteError<ClaimInvalidTransition>("ClaimInvalidTransition", {
    title: "Claim invalid transition",
    description: "The requested lifecycle transition is not a legal forward step for the current claim state.",
  })
) {
  /**
   * Build a {@link ClaimInvalidTransition} from a from/to state pair.
   *
   * **Example** (Build error from states)
   *
   * ```ts
   * import { ClaimInvalidTransition } from "@beep/epistemic-domain"
   *
   * const error = ClaimInvalidTransition.between("shape_valid", "candidate")
   * console.log(error.to)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static between(from: ClaimLifecycle, to: ClaimLifecycle): ClaimInvalidTransition {
    return ClaimInvalidTransition.make({ from, to });
  }
}

/**
 * Union of every claim lifecycle error.
 *
 * **Example** (Decode lifecycle error union)
 *
 * ```ts
 * import { ClaimInvalidTransition, ClaimLifecycleError } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(ClaimLifecycleError)(
 *   ClaimInvalidTransition.between("candidate", "admitted")
 * )
 *
 * console.log(decoded._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClaimLifecycleError = S.Union([ClaimInvalidTransition]).pipe(
  $I.annoteSchema("ClaimLifecycleError", {
    description: "Union of every claim lifecycle error.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ClaimLifecycleError}.
 *
 * **Example** (Annotate with error type)
 *
 * ```ts
 * import { ClaimInvalidTransition } from "@beep/epistemic-domain"
 * import type { ClaimLifecycleError } from "@beep/epistemic-domain"
 *
 * const error: ClaimLifecycleError = ClaimInvalidTransition.between("candidate", "admitted")
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimLifecycleError = typeof ClaimLifecycleError.Type;
