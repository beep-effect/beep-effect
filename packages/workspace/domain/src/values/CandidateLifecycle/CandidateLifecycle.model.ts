/**
 * Workspace candidate lifecycle value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $WorkspaceDomainId.create("values/CandidateLifecycle/CandidateLifecycle.model");

/**
 * Candidate lifecycle vocabulary for proof outputs.
 *
 * **Example** (Check candidate lifecycle)
 *
 * ```ts
 * import { CandidateLifecycle } from "@beep/workspace-domain"
 *
 * console.log(CandidateLifecycle.is.candidate("candidate"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandidateLifecycle = LiteralKit(["candidate"]).pipe(
  $I.annoteSchema("CandidateLifecycle", {
    description: "Lifecycle state for candidate work produced by the runtime proof.",
  })
);

/**
 * Runtime type for {@link CandidateLifecycle}.
 *
 * **Example** (Type candidate lifecycle value)
 *
 * ```ts
 * import type { CandidateLifecycle } from "@beep/workspace-domain"
 *
 * const value: CandidateLifecycle = "candidate"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CandidateLifecycle = typeof CandidateLifecycle.Type;
