/**
 * LegalPositionRelatorId schema and runtime type.
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
 * Legal position relator entity identifier.
 *
 * **Details**
 *
 * A relator stores exactly one advantage-side directed legal position and
 * derives every other view of it. Because the correlative end is never
 * persisted, one id names one whole correlative pair rather than one half of
 * it, and a second id for the burden side would itself be the drift the
 * one-stored-relation rule exists to prevent.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.LegalPositionRelatorId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LegalPositionRelatorId = make("legal_position_relator", {
  description: "Identifier for a law-practice legal position relator entity.",
});

/**
 * Runtime type for {@link LegalPositionRelatorId}.
 *
 * @see {@link LegalPositionRelatorId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalPositionRelatorId = typeof LegalPositionRelatorId.Type;
