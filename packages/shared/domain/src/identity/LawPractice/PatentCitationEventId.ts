/**
 * PatentCitationEventId schema and runtime type.
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
 * Patent citation event entity identifier.
 *
 * **Details**
 *
 * A patent citation event records one observed occurrence of a patent
 * reference against a filing. Events are append-only, so an id always names
 * one exact observation rather than a mutable current state.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PatentCitationEventId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PatentCitationEventId = make("patent_citation_event", {
  description: "Identifier for a law-practice patent citation event entity.",
});

/**
 * Runtime type for {@link PatentCitationEventId}.
 *
 * @see {@link PatentCitationEventId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PatentCitationEventId = typeof PatentCitationEventId.Type;
