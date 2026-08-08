/**
 * Epistemic slice-local entity identifiers.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntityId from "@beep/shared-domain/entity/EntityId";

const $I = $EpistemicDomainId.create("identity/Epistemic");
const make = EntityId.factory("epistemic", $I);

/**
 * Identifier for one immutable contradiction candidate.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContradictionCandidateId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * console.log(ContradictionCandidateId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ContradictionCandidateId = make("contradiction_candidate", {
  description: "Identifier for an immutable epistemic contradiction candidate.",
});

/**
 * Runtime type for {@link ContradictionCandidateId}.
 *
 * **Example** (Type empty id array)
 *
 * ```ts
 * import type { ContradictionCandidateId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<ContradictionCandidateId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContradictionCandidateId = typeof ContradictionCandidateId.Type;

/**
 * Identifier for one contradiction-submission receipt.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContradictionReceiptId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * console.log(ContradictionReceiptId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ContradictionReceiptId = make("contradiction_receipt", {
  description: "Identifier for a durable contradiction-submission receipt.",
});

/**
 * Runtime type for {@link ContradictionReceiptId}.
 *
 * **Example** (Type empty id array)
 *
 * ```ts
 * import type { ContradictionReceiptId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<ContradictionReceiptId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContradictionReceiptId = typeof ContradictionReceiptId.Type;

/**
 * Identifier for one recorded contradiction disposition.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContradictionDispositionId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * console.log(ContradictionDispositionId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ContradictionDispositionId = make("contradiction_disposition", {
  description: "Identifier for a durable human contradiction disposition.",
});

/**
 * Runtime type for {@link ContradictionDispositionId}.
 *
 * **Example** (Type empty id array)
 *
 * ```ts
 * import type { ContradictionDispositionId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<ContradictionDispositionId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContradictionDispositionId = typeof ContradictionDispositionId.Type;

/**
 * Identifier for one immutable evidence-verification sidecar row.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { EvidenceVerificationId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * console.log(EvidenceVerificationId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const EvidenceVerificationId = make("evidence_verification", {
  description: "Identifier for an immutable evidence-to-source verification manifestation.",
});

/**
 * Runtime type for {@link EvidenceVerificationId}.
 *
 * **Example** (Type empty id array)
 *
 * ```ts
 * import type { EvidenceVerificationId } from "@beep/epistemic-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<EvidenceVerificationId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EvidenceVerificationId = typeof EvidenceVerificationId.Type;
