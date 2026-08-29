/**
 * ContradictionDispositionId schema and runtime type.
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
 * Identifier for one recorded contradiction disposition.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContradictionDispositionId } from "@beep/shared-domain/identity/Epistemic"
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
 * import type { ContradictionDispositionId } from "@beep/shared-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<ContradictionDispositionId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContradictionDispositionId = typeof ContradictionDispositionId.Type;
