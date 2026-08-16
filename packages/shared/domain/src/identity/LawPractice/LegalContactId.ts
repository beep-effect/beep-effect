/**
 * LegalContactId schema and runtime type.
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
 * Legal contact entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.LegalContactId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LegalContactId = make("legal_contact", {
  description: "Identifier for a law-practice legal contact entity.",
});

/**
 * Runtime type for {@link LegalContactId}.
 *
 * @see {@link LegalContactId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalContactId = typeof LegalContactId.Type;
