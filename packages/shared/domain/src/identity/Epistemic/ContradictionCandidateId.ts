/**
 * ContradictionCandidateId schema and runtime type.
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
 * Identifier for one immutable contradiction candidate.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContradictionCandidateId } from "@beep/shared-domain/identity/Epistemic"
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
 * import type { ContradictionCandidateId } from "@beep/shared-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<ContradictionCandidateId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContradictionCandidateId = typeof ContradictionCandidateId.Type;
