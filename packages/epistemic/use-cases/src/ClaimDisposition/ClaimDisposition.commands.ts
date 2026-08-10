/**
 * Claim disposition boundary command.
 *
 * The disposition repository port takes a fully built {@link ClaimDisposition}
 * entity rather than a partial insert payload, so the boundary a caller crosses
 * is a decode: untrusted input becomes an entity here, once, and everything
 * downstream works with the entity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import * as BaseEntitySchema from "@beep/shared-domain/entity/BaseEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ClaimDisposition/ClaimDisposition.commands");

/**
 * Decoded append payload for one durable claim disposition.
 *
 * **Details**
 *
 * The `id` and `publicId` a caller supplies are the identity it reserves for the
 * row; the SERIAL primary key is assigned by the database on insert and the
 * persistence converter drops the supplied value, so `id` matters only to
 * in-memory implementations that have no database to assign one.
 *
 * **Example** (Decode append payload)
 *
 * ```ts
 * import { ClaimDispositionAppend } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const append = S.decodeUnknownSync(ClaimDispositionAppend)({
 *   claimId: 3,
 *   createdAt: 1_000,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.ClaimDispositionId.entityType,
 *   id: 1,
 *   orgId: 1,
 *   publicId: "epistemic_claim_disposition_a1",
 *   reason: "Expected at least 1 value(s) for evidence.",
 *   resolvedAt: 1_000,
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   status: "rejected",
 *   updatedAt: 1_000,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   violations: []
 * })
 *
 * console.log(append.status)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ClaimDispositionAppend extends S.Class<ClaimDispositionAppend>($I`ClaimDispositionAppend`)(
  {
    ...BaseEntitySchema.fields,
    ...ClaimDisposition.fields,
    entityType: S.tag(Epistemic.ClaimDispositionId.entityType),
    id: Epistemic.ClaimDispositionId,
  },
  $I.annote("ClaimDispositionAppend", {
    description: "Decoded append payload for one durable claim disposition.",
  })
) {}

/**
 * Build the {@link ClaimDisposition} entity a decoded append payload denotes.
 *
 * **Example** (Build entity from append)
 *
 * ```ts
 * import { ClaimDispositionAppend, appendClaimDisposition } from "@beep/epistemic-use-cases/ClaimDisposition"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const append = S.decodeUnknownSync(ClaimDispositionAppend)({
 *   claimId: 3,
 *   createdAt: 1_000,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.ClaimDispositionId.entityType,
 *   id: 1,
 *   orgId: 1,
 *   publicId: "epistemic_claim_disposition_a1",
 *   reason: "Expected at least 1 value(s) for evidence.",
 *   resolvedAt: 1_000,
 *   resolvedBy: { kind: "System", component: "Runtime" },
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   status: "rejected",
 *   updatedAt: 1_000,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   violations: []
 * })
 *
 * console.log(appendClaimDisposition(append).status)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const appendClaimDisposition = (input: ClaimDispositionAppend): ClaimDisposition => ClaimDisposition.make(input);
