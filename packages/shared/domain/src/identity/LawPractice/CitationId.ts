/**
 * CitationId schema and runtime type.
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
 * Citation entity identifier.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.CitationId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CitationId = make("citation", {
  description: "Identifier for a law-practice citation entity.",
});

/**
 * Runtime type for {@link CitationId}.
 *
 * @see {@link CitationId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type CitationId = typeof CitationId.Type;
