/**
 * LegalOppositionCandidateId schema and runtime type.
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
 * Legal opposition candidate entity identifier.
 *
 * **Details**
 *
 * A legal opposition candidate records that two stored relations were screened
 * as prima facie opposed. Candidates are append-only, so the id names one
 * screening; a later attorney assignment about the same pair is recorded on
 * that screening rather than replacing it, and a second party's priority basis
 * takes a fresh id.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.LegalOppositionCandidateId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LegalOppositionCandidateId = make("legal_opposition_candidate", {
  description: "Identifier for a law-practice legal opposition candidate entity.",
});

/**
 * Runtime type for {@link LegalOppositionCandidateId}.
 *
 * @see {@link LegalOppositionCandidateId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type LegalOppositionCandidateId = typeof LegalOppositionCandidateId.Type;
