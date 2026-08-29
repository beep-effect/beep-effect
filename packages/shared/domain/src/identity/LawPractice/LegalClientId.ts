/**
 * LegalClientId schema and runtime type.
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
 * Legal client entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.LegalClientId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LegalClientId = make("legal_client", {
  description: "Identifier for a law-practice legal client entity.",
});

/**
 * Runtime type for {@link LegalClientId}.
 *
 * @see {@link LegalClientId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalClientId = typeof LegalClientId.Type;
