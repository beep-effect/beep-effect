/**
 * EvidenceVerificationId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $EpistemicDomainId.create("identity/Epistemic");
const make = EntityId.factory("epistemic", $I);

/**
 * Identifier for one immutable evidence-verification sidecar row.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { EvidenceVerificationId } from "@beep/shared-domain/identity/Epistemic"
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
 * import type { EvidenceVerificationId } from "@beep/shared-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<EvidenceVerificationId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EvidenceVerificationId = typeof EvidenceVerificationId.Type;
