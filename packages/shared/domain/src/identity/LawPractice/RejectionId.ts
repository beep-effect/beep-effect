/**
 * RejectionId schema and runtime type.
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
 * Rejection entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.RejectionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const RejectionId = make("rejection", {
  description: "Identifier for a law-practice rejection entity.",
});

/**
 * Runtime type for {@link RejectionId}.
 *
 * @see {@link RejectionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type RejectionId = typeof RejectionId.Type;
