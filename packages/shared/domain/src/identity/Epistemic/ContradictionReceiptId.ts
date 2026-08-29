/**
 * ContradictionReceiptId schema and runtime type.
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
 * Identifier for one contradiction-submission receipt.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContradictionReceiptId } from "@beep/shared-domain/identity/Epistemic"
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
 * import type { ContradictionReceiptId } from "@beep/shared-domain/identity/Epistemic"
 *
 * const ids: ReadonlyArray<ContradictionReceiptId> = []
 * console.log(ids.length)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContradictionReceiptId = typeof ContradictionReceiptId.Type;
