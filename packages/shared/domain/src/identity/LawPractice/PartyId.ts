/**
 * PartyId schema and runtime type.
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
 * Party entity identifier.
 *
 * **Details**
 *
 * A party is generic legal identity that references an existing party-like
 * record by opaque text reference rather than by a foreign-key edge. The id
 * therefore names the party itself, never the record it points at.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PartyId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PartyId = make("party", {
  description: "Identifier for a law-practice party entity.",
});

/**
 * Runtime type for {@link PartyId}.
 *
 * @see {@link PartyId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PartyId = typeof PartyId.Type;
