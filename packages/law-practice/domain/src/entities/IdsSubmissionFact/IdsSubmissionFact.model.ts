/**
 * Information-disclosure submission fact record.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import { CitingApplicationIdentity } from "../../values/CitingApplicationIdentity/index.ts";
import {
  IdsCandidateWindowFacts,
  IdsContentPresenceFacts,
  IdsFeeFacts,
  IdsOfficeTreatmentFacts,
  IdsStatementFacts,
  IdsSubmissionKind,
  LegalSourceVersion,
} from "./IdsSubmissionFact.values.ts";

const $I = $LawPracticeDomainId.create("entities/IdsSubmissionFact/IdsSubmissionFact.model");
const IdsSubmissionFactEntity = ProductEntity.make(LawPractice.IdsSubmissionFactId);

/**
 * One information-disclosure submission act, recorded as presence-only facts.
 *
 * **When to use**
 *
 * Use to record what a submission contained and how the Office treated it, so
 * an attorney's later candor judgment rests on observed facts rather than on
 * recollection. This entity is the mechanical half of the fact/judgment split;
 * the judgment half is `CandorDisposition`.
 *
 * **Details**
 *
 * Each submission is an independent append-only record carrying its own
 * `operativeDate`. Supplemental submissions are separate records rather than
 * revisions, and a `correction` records the later date that 37 CFR 1.97(i) and
 * MPEP 609.05(a) make operative for subsequent timing — a fact that would be
 * destroyed by editing the original record.
 *
 * `modeledFrom` cites which CFR capture and MPEP revision the fact vocabulary
 * was built against, because those move independently. It is a citation, not a
 * resolver; nothing reads it to select behaviour.
 *
 * **Gotchas**
 *
 * Nothing on this entity is a legal conclusion. `candidateWindow` is a
 * candidate reading of the controlling dates and never a timing-compliance
 * label; the content and fee fields record presence, not satisfaction of a
 * requirement; and office treatment is recorded exactly as marked, never as
 * evidence of reliance, approval, or materiality.
 *
 * **Example** (Inspect the recorded fact surface)
 *
 * ```ts
 * import { IdsSubmissionFact } from "@beep/law-practice-domain"
 *
 * console.log(IdsSubmissionFact.fields.candidateWindow !== undefined) // true
 * console.log(IdsSubmissionFact.fields.operativeDate !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class IdsSubmissionFact extends IdsSubmissionFactEntity.Entity<IdsSubmissionFact>(
  IdsSubmissionFactEntity.tableName
)(
  {
    candidateWindow: IdsCandidateWindowFacts.annotateKey({
      description: "Controlling prosecution dates and timing edge cases behind a candidate 37 CFR 1.97 window.",
    }).pipe(IdsSubmissionFactEntity.pg.jsonb(), IdsSubmissionFactEntity.pg.columnName("candidate_window")),
    citingApplication: CitingApplicationIdentity.annotateKey({
      description: "Filing this submission was made in.",
    }).pipe(IdsSubmissionFactEntity.pg.jsonb(), IdsSubmissionFactEntity.pg.columnName("citing_application")),
    content: IdsContentPresenceFacts.annotateKey({
      description: "Presence of 37 CFR 1.98 content items, as observed.",
    }).pipe(IdsSubmissionFactEntity.pg.jsonb()),
    fees: IdsFeeFacts.annotateKey({
      description: "Presence of the 37 CFR 1.17(p) timing fee and 1.17(v) size fee, as observed.",
    }).pipe(IdsSubmissionFactEntity.pg.jsonb()),
    modeledFrom: LegalSourceVersion.annotateKey({
      description: "CFR capture and MPEP revision this record's fact vocabulary was modeled from.",
    }).pipe(IdsSubmissionFactEntity.pg.jsonb(), IdsSubmissionFactEntity.pg.columnName("modeled_from")),
    officeTreatment: S.OptionFromNullOr(IdsOfficeTreatmentFacts)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Office treatment as observed, absent until the Office has acted." })
      .pipe(IdsSubmissionFactEntity.pg.jsonb(), IdsSubmissionFactEntity.pg.columnName("office_treatment")),
    operativeDate: S.DateTimeUtcFromMillis.annotateKey({
      description: "This submission act's own operative date; supplements and corrections each carry their own.",
    }).pipe(IdsSubmissionFactEntity.pg.bigint("number"), IdsSubmissionFactEntity.pg.columnName("operative_date")),
    statement: IdsStatementFacts.annotateKey({
      description: "Presence and type of the 37 CFR 1.97(e) statement and the 1.98(a)(4) written assertion.",
    }).pipe(IdsSubmissionFactEntity.pg.jsonb()),
    submissionKind: IdsSubmissionKind.annotateKey({
      description: "Whether this record is an initial, supplemental, or correcting submission act.",
    }).pipe(IdsSubmissionFactEntity.pg.text(), IdsSubmissionFactEntity.pg.columnName("submission_kind")),
    ...IdsSubmissionFactEntity.identityFields,
  },
  $I.annote("IdsSubmissionFact", {
    description:
      "One information-disclosure submission act recorded as presence-only facts, with its own operative date.",
  }),
  IdsSubmissionFactEntity.entityExtras
) {}
