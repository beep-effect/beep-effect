/**
 * PowerExerciseId schema and runtime type.
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
 * Power exercise entity identifier.
 *
 * **Details**
 *
 * A relator's grounding is a lineage reference to the exercise that produced
 * it and to the founding exercise of the relator whose power was exercised, so
 * the id is registered with the relator that requires it. The exercise entity
 * it names lands with the transition-event vocabulary; this registration
 * reserves its entity type and gives that lineage reference a type to point at.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.PowerExerciseId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const PowerExerciseId = make("power_exercise", {
  description: "Identifier for a law-practice power exercise entity.",
});

/**
 * Runtime type for {@link PowerExerciseId}.
 *
 * @see {@link PowerExerciseId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type PowerExerciseId = typeof PowerExerciseId.Type;
