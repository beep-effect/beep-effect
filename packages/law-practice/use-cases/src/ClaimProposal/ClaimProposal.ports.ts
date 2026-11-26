/**
 * Claim proposal port: the service every proposal path writes through.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { LawProposedClaimRecord } from "@beep/law-practice-domain/values/LawClaim";
import type * as Effect from "effect/Effect";
import type { ClaimProposalRefused } from "./ClaimProposal.errors.ts";
import type { ClaimProposalRequest } from "./ClaimProposal.values.ts";

const $I = $LawPracticeUseCasesId.create("ClaimProposal/ClaimProposal.ports");

/**
 * Service shape of claim proposal.
 *
 * **Details**
 *
 * `propose` returns a proposed record or a refusal value; it never admits. A
 * request whose proposal is already stored returns that record unchanged.
 *
 * **Example** (Name the proposal method)
 *
 * ```ts
 * import type { ClaimProposalShape } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * const method: keyof ClaimProposalShape = "propose"
 * console.log(method) // "propose"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ClaimProposalShape {
  /** Propose the distinction claim the request's candidates support. */
  readonly propose: (request: ClaimProposalRequest) => Effect.Effect<LawProposedClaimRecord, ClaimProposalRefused>;
}

/**
 * The service every proposal path writes a proposed claim through.
 *
 * **Example** (Reference the proposal service)
 *
 * ```ts
 * import { ClaimProposal } from "@beep/law-practice-use-cases/ClaimProposal"
 *
 * console.log(ClaimProposal.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ClaimProposal extends Context.Service<ClaimProposal, ClaimProposalShape>()($I`ClaimProposal`) {}
