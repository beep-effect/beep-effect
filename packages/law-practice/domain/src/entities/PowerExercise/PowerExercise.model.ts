/**
 * Power exercise entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import {
  ActFrameSlotAssignment,
  AssertedAuthorityBasis,
  ExerciseResult,
  PreconditionAssertion,
} from "./PowerExercise.values.ts";

const $I = $LawPracticeDomainId.create("entities/PowerExercise/PowerExercise.model");
const PowerExerciseEntity = ProductEntity.make(LawPractice.PowerExerciseId);

/**
 * One attempt to exercise a power, recorded whether or not it worked.
 *
 * **When to use**
 *
 * Use to record that somebody did something under a claimed authority, on an
 * occasion, and what was determined about it afterwards. Stored positions point
 * back at exercises for their lineage, so this is where a position's "how did
 * it get here" is answered.
 *
 * **Details**
 *
 * The record is of an **attempt**. An act determined to have been beyond the
 * actor's power stays here with no effect on any position, because an attempt
 * that vanished would leave no trace that anybody tried — and who tried what,
 * and was told no, is frequently the fact a practice most needs later.
 *
 * `result` is required, and it is required here precisely because it is absent
 * from the standing position. An exercise always has an answer to "where does
 * this stand", even when the answer is that nobody has decided; a standing
 * position has no outcome at all, and giving it one would force a placeholder
 * into every stored relation.
 *
 * `authorityBasis` carries the claim to act: the role claimed, the norm claimed
 * under, and — where the power came from an earlier relation rather than
 * straight from a norm — the power cited and the exercise that conferred it.
 * That conferring exercise is the same link a produced position's grounding
 * names, so the lineage reads the same from either end.
 *
 * **Gotchas**
 *
 * Nothing here is verified. The authority is claimed, the preconditions are
 * asserted, the slot assignments are asserted, and every determination in the
 * result belongs to the person who made it. Whether the actor held the power,
 * whether the conditions obtained, and whether the act was legally valid are
 * not computed, and no combination of these fields may be read as computing
 * them.
 *
 * Recording an exercise writes no position. Positions are their own records,
 * created by their own callers, pointing back here.
 *
 * **Example** (Inspect the recorded exercise surface)
 *
 * ```ts
 * import { PowerExercise } from "@beep/law-practice-domain"
 *
 * console.log(PowerExercise.fields.result !== undefined) // true
 * console.log(PowerExercise.fields.authorityBasis !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class PowerExercise extends PowerExerciseEntity.Entity<PowerExercise>(PowerExerciseEntity.tableName)(
  {
    attemptedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Time the act was attempted, recorded for audit and never used to establish effect.",
    }).pipe(PowerExerciseEntity.pg.bigint("number"), PowerExerciseEntity.pg.columnName("attempted_at")),
    authorityBasis: AssertedAuthorityBasis.annotateKey({
      description: "Authority claimed for the act: role, norm, cited power, and conferring exercise.",
    }).pipe(PowerExerciseEntity.pg.jsonb(), PowerExerciseEntity.pg.columnName("authority_basis")),
    frame: LawPractice.ActFrameId.annotateKey({
      description: "Recorded act frame this attempt instantiates.",
    }).pipe(PowerExerciseEntity.pg.integer()),
    preconditionAssertions: S.Array(PreconditionAssertion)
      .annotateKey({
        description: "What was asserted about the frame's conditions on this occasion; unlisted ones are unaddressed.",
      })
      .pipe(PowerExerciseEntity.pg.jsonb(), PowerExerciseEntity.pg.columnName("precondition_assertions")),
    result: ExerciseResult.annotateKey({
      description: "Required record of what was determined about the attempt, on two axes plus a disposition.",
    }).pipe(PowerExerciseEntity.pg.jsonb()),
    slotAssignments: S.Array(ActFrameSlotAssignment)
      .annotateKey({ description: "Parties recorded as filling the frame's slots on this occasion." })
      .pipe(PowerExerciseEntity.pg.jsonb(), PowerExerciseEntity.pg.columnName("slot_assignments")),
    ...PowerExerciseEntity.identityFields,
  },
  $I.annote("PowerExercise", {
    description: "One recorded attempt to exercise a power, kept on the record whether or not it took effect.",
  }),
  PowerExerciseEntity.entityExtras
) {}
