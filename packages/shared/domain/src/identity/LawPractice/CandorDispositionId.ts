/**
 * CandorDispositionId schema and runtime type.
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
 * Candor disposition entity identifier.
 *
 * **Details**
 *
 * A candor disposition records one dated attorney judgment about one exact
 * patent citation event. Dispositions are append-only, so revision and
 * withdrawal append a new record that names the prior id rather than editing
 * what was decided at filing time.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.CandorDispositionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandorDispositionId = make("candor_disposition", {
  description: "Identifier for a law-practice candor disposition entity.",
});

/**
 * Runtime type for {@link CandorDispositionId}.
 *
 * @see {@link CandorDispositionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type CandorDispositionId = typeof CandorDispositionId.Type;
