/**
 * CorrectionDeltaId schema and runtime type.
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
 * Correction delta entity identifier.
 *
 * **Details**
 *
 * A correction delta records one proposed change to a recorded interpretation
 * together with what a reviewer did about it. Deltas are append-only, so an id
 * names one correction as it was proposed and reviewed; revising it appends a
 * further delta naming the earlier id.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.CorrectionDeltaId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CorrectionDeltaId = make("correction_delta", {
  description: "Identifier for a law-practice correction delta entity.",
});

/**
 * Runtime type for {@link CorrectionDeltaId}.
 *
 * @see {@link CorrectionDeltaId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type CorrectionDeltaId = typeof CorrectionDeltaId.Type;
