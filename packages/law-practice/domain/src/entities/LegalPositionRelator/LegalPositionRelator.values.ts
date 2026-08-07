/**
 * Concept-local value objects for legal position relators.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/LegalPositionRelator/LegalPositionRelator.values");

/**
 * The exercise lineage a stored legal position rests on.
 *
 * **When to use**
 *
 * Use as a relator's grounding. Every stored relation carries one, and it is a
 * reference to a lineage rather than a single event.
 *
 * **Details**
 *
 * Two links, because a derived position has two answers to "where did this come
 * from". `producingExercise` names the act that brought this position into
 * being. `foundingExercise` names the founding act of the relation whose power
 * that act exercised — the position that made the producing act possible at
 * all.
 *
 * A relation founded directly by a norm has no earlier relation behind it, so
 * its `foundingExercise` is absent rather than pointed at itself. Absence is an
 * `Option`, following the lineage posture the bitemporal edge substrate already
 * uses for the first version in a chain.
 *
 * Collapsing the two into one scalar loses the chain: with only the producing
 * act recorded, a reader can see that a position was created but not by what
 * authority, which is the authority-laundering failure this shape exists to
 * prevent.
 *
 * **Gotchas**
 *
 * A recorded lineage is not a finding of authority. That an exercise is named
 * says nothing about whether the actor had the power exercised, whether the
 * exercise constituted its effect, or whether it was permitted — those are
 * separately recorded determinations on the exercise itself.
 *
 * **Example** (Record a derived position's lineage)
 *
 * ```ts
 * import { LegalPositionGrounding } from "@beep/law-practice-domain"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as O from "effect/Option"
 *
 * const grounding = LegalPositionGrounding.make({
 *   foundingExercise: O.some(LawPractice.PowerExerciseId.make(7)),
 *   producingExercise: LawPractice.PowerExerciseId.make(12),
 * })
 * console.log(O.isSome(grounding.foundingExercise)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalPositionGrounding extends S.Class<LegalPositionGrounding>($I`LegalPositionGrounding`)(
  {
    foundingExercise: S.OptionFromNullOr(LawPractice.PowerExerciseId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description:
        "Founding exercise of the relation whose power the producing exercise used; absent for a norm-founded relation.",
    }),
    producingExercise: LawPractice.PowerExerciseId.annotateKey({
      description: "Exercise that brought this position into being.",
    }),
  },
  $I.annote("LegalPositionGrounding", {
    description: "Exercise lineage a stored legal position rests on: what produced it and what founded that power.",
  })
) {}
