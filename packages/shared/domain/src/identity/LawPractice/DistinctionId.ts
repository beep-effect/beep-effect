/**
 * DistinctionId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $LawPracticeDomainId.create("identity/LawPractice");
const make = EntityId.factory("law_practice", $I);

/**
 * Distinction entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.DistinctionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const DistinctionId = make("distinction", {
  description: "Identifier for a law-practice distinction entity.",
});

/**
 * Runtime type for {@link DistinctionId}.
 *
 * @see {@link DistinctionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type DistinctionId = typeof DistinctionId.Type;
