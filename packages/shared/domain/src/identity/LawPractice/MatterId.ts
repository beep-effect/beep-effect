/**
 * MatterId schema and runtime type.
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
 * Matter entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.MatterId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const MatterId = make("matter", {
  description: "Identifier for a law-practice matter entity.",
});

/**
 * Runtime type for {@link MatterId}.
 *
 * @see {@link MatterId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type MatterId = typeof MatterId.Type;
