/**
 * OfficeActionId schema and runtime type.
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
 * Office action entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.OfficeActionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const OfficeActionId = make("office_action", {
  description: "Identifier for a law-practice office action entity.",
});

/**
 * Runtime type for {@link OfficeActionId}.
 *
 * @see {@link OfficeActionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type OfficeActionId = typeof OfficeActionId.Type;
