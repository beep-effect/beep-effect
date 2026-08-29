/**
 * ClaimId schema and runtime type.
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
 * Claim entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.ClaimId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ClaimId = make("claim", {
  description: "Identifier for a law-practice patent claim entity.",
});

/**
 * Runtime type for {@link ClaimId}.
 *
 * @see {@link ClaimId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;
