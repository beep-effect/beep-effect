/**
 * Correction delta entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import {
  CandidateRouting,
  CorrectedElement,
  CorrectionStage,
  ReviewerAction,
  ValidatorReport,
} from "./CorrectionDelta.values.ts";

const $I = $LawPracticeDomainId.create("entities/CorrectionDelta/CorrectionDelta.model");

/**
 * One appended record of a correction to a recorded interpretation.
 *
 * **When to use**
 *
 * Use to record that somebody proposed changing part of a recorded frame, what
 * a validator said about it, and what a reviewer then did. Revisions append a
 * further delta naming this one rather than editing it.
 *
 * **Details**
 *
 * Corrections are per element. `correctedElements` is non-empty and each entry
 * names one frame element together with the norm text the change rests on, so a
 * later reader re-reads one clause rather than a whole interpretation. A single
 * document pointer per record would say only that something changed.
 *
 * `stage` says which kind of reading is being corrected — a source read as a
 * frame, a fact treated as counting institutionally, or what follows from
 * either. `validatorReport` transcribes what some validator reported, at two
 * severities. `reviewerAction` records what a person then did, which includes
 * doing nothing yet.
 *
 * `candidateRouting` defaults to `contradiction-candidate-input`. A difference
 * nobody has resolved therefore stays visible as an input by omission, which is
 * the safe direction: a dropped disagreement is invisible, while a surplus
 * candidate input is merely one more thing to look at.
 *
 * **Gotchas**
 *
 * Nothing is emitted from here. This is the record of a correction, and
 * whatever consumes candidate inputs is a caller's concern — no submission, no
 * dispatch, and no reach into candidate ownership happens because a delta was
 * appended.
 *
 * Nothing is executed either. The validator report is a transcript, the
 * severities are recorded fields, and no shape or constraint ships with them.
 *
 * **Example** (Inspect the appended correction surface)
 *
 * ```ts
 * import { CorrectionDelta } from "@beep/law-practice-domain"
 *
 * console.log(CorrectionDelta.fields.correctedElements !== undefined) // true
 * console.log(CorrectionDelta.fields.candidateRouting !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class CorrectionDelta extends BaseEntity.Class<CorrectionDelta>($I`CorrectionDelta`)(
  LawPractice.CorrectionDeltaId,
  {
    fields: {
      candidateRouting: CandidateRouting.pipe(
        SchemaUtils.withConstantDefault<CandidateRouting>("contradiction-candidate-input")
      ).annotateKey({
        description: "Whether the difference stays an unresolved candidate input; unresolved is the default.",
      }),
      correctedElements: S.NonEmptyArray(CorrectedElement).annotateKey({
        description: "Elements this correction touched, one pointer each, never one document pointer per record.",
      }),
      frame: LawPractice.ActFrameId.annotateKey({
        description: "Recorded act frame whose elements this correction addresses.",
      }),
      reviewer: Principal.annotateKey({
        description: "Principal whose review this record attributes, including when no action was taken.",
      }),
      reviewerAction: ReviewerAction.annotateKey({
        description: "What the reviewer did about the correction, recorded and never derived from the findings.",
      }),
      stage: CorrectionStage.annotateKey({
        description: "Which of interpretation, qualification, or assessment is being corrected.",
      }),
      supersedes: S.OptionFromNullOr(LawPractice.CorrectionDeltaId).pipe(SchemaUtils.withNoneDefault).annotateKey({
        description: "Earlier correction this one replaces; absent for the first correction in a chain.",
      }),
      validatorReport: ValidatorReport.annotateKey({
        description: "Transcribed validator report at two severities, recorded and never re-executed.",
      }),
    },
    persisted: {
      candidateRouting: EntitySchema.persist.literal({
        columnName: "candidate_routing",
      }),
      correctedElements: EntitySchema.persist.jsonb({
        columnName: "corrected_elements",
      }),
      frame: EntitySchema.persist.entityId({
        columnName: "frame",
      }),
      reviewer: EntitySchema.persist.jsonb({
        columnName: "reviewer",
      }),
      reviewerAction: EntitySchema.persist.literal({
        columnName: "reviewer_action",
      }),
      stage: EntitySchema.persist.literal({
        columnName: "stage",
      }),
      supersedes: EntitySchema.persist.entityId({
        columnName: "supersedes",
      }),
      validatorReport: EntitySchema.persist.jsonb({
        columnName: "validator_report",
      }),
    },
  },
  $I.annote("CorrectionDelta", {
    description: "One appended correction to a recorded interpretation, per element, with its review on the record.",
  })
) {}
