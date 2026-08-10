/**
 * Claim lifecycle value schemas.
 *
 * The claim admission lifecycle vocabulary is shared-kernel product language
 * owned by `@beep/shared-domain` (promoted 2026-06-18). The epistemic slice owns
 * the *mechanism* — the SHACL claim gate, the transition service, and the
 * projection — while the *vocabulary* (`ClaimLifecycle`, `ClaimLifecycleTransition`)
 * lives in shared so other verticals can type against it without importing the
 * epistemic slice's domain. This module re-exports the shared vocabulary to
 * preserve the `@beep/epistemic-domain` public surface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Shared claim lifecycle vocabulary and transition value object.
 *
 * **Example** (Import and log lifecycle values)
 *
 * ```ts
 * import { ClaimLifecycle, ClaimLifecycleTransition } from "@beep/epistemic-domain"
 *
 * console.log(ClaimLifecycle.Enum.admitted)
 * console.log(ClaimLifecycleTransition)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "@beep/shared-domain/values/ClaimLifecycle";
