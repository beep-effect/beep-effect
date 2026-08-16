/**
 * PatentAssetId schema and runtime type.
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
 * Patent asset entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PatentAssetId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PatentAssetId = make("patent_asset", {
  description: "Identifier for a law-practice patent asset entity.",
});

/**
 * Runtime type for {@link PatentAssetId}.
 *
 * @see {@link PatentAssetId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PatentAssetId = typeof PatentAssetId.Type;
