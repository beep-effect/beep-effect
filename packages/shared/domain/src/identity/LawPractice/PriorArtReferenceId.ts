/**
 * PriorArtReferenceId schema and runtime type.
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
 * Prior art reference entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PriorArtReferenceId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PriorArtReferenceId = make("prior_art_reference", {
  description: "Identifier for a law-practice prior art reference entity.",
});

/**
 * Runtime type for {@link PriorArtReferenceId}.
 *
 * @see {@link PriorArtReferenceId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PriorArtReferenceId = typeof PriorArtReferenceId.Type;
