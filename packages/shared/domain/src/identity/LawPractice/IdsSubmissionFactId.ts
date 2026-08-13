/**
 * IdsSubmissionFactId schema and runtime type.
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
 * Information-disclosure submission fact entity identifier.
 *
 * **Details**
 *
 * Each submission act is its own append-only record with its own operative
 * date, so an id names one act rather than a running state of "the IDS".
 * Supplemental and correcting submissions take fresh ids.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.IdsSubmissionFactId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const IdsSubmissionFactId = make("ids_submission_fact", {
  description: "Identifier for a law-practice information-disclosure submission fact entity.",
});

/**
 * Runtime type for {@link IdsSubmissionFactId}.
 *
 * @see {@link IdsSubmissionFactId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type IdsSubmissionFactId = typeof IdsSubmissionFactId.Type;
