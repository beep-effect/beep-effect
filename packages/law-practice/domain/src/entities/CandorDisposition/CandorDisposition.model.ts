/**
 * Candor disposition entity model.
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
import { ObservationVersionRef } from "../../values/ObservationVersionRef/index.ts";
import { CandorDispositionLifecycle, CandorJudgment } from "./CandorDisposition.values.ts";

const $I = $LawPracticeDomainId.create("entities/CandorDisposition/CandorDisposition.model");
const CandorDispositionEntity = ProductEntity.make(LawPractice.CandorDispositionId);

/**
 * One dated attorney judgment about one exact patent citation observation.
 *
 * **When to use**
 *
 * Use to record that a human decided something about a specific occurrence.
 * This entity is the only place attorney judgment exists, and every value in it
 * is recorded, never derived.
 *
 * **Details**
 *
 * Two judgment slots are kept distinct and neither is derived from the other.
 * `rule56Judgment` records the decision made under the duty of candor;
 * `litigationFrameJudgment` records a separately-reached decision under a
 * litigation frame. Keeping both representable from the first rung means a
 * later vocabulary expansion does not have to reshape recorded history.
 *
 * Authorship is the `createdByPrincipal` every entity already carries. The
 * predicate that consumes this entity fails closed on that discriminator: only
 * a `User`-kind principal's disposition covers an event, so an agent can never
 * dispose of its own AI-discovered finding.
 *
 * **Gotchas**
 *
 * A recorded disposition is never edited. Revision and withdrawal append a new
 * record whose `supersedes` names the prior one, so what was decided at filing
 * time stays readable exactly as decided.
 *
 * Recording that a human decided is not proof the human was authorized to. No
 * practitioner-authority substrate exists in this repo, so the trust boundary
 * stops at principal kind and is deliberately not represented as more.
 *
 * **Example** (Inspect the recorded judgment surface)
 *
 * ```ts
 * import { CandorDisposition } from "@beep/law-practice-domain"
 *
 * console.log(CandorDisposition.fields.rule56Judgment !== undefined) // true
 * console.log(CandorDisposition.fields.disposes !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class CandorDisposition extends CandorDispositionEntity.Entity<CandorDisposition>(
  CandorDispositionEntity.tableName
)(
  {
    citingApplication: CitingApplicationIdentity.annotateKey({
      description: "Filing this judgment was made for, scoping the decision to one prosecution.",
    }).pipe(CandorDispositionEntity.pg.jsonb(), CandorDispositionEntity.pg.columnName("citing_application")),
    decidedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Time the attorney recorded this judgment.",
    }).pipe(CandorDispositionEntity.pg.bigint("number"), CandorDispositionEntity.pg.columnName("decided_at")),
    disposes: ObservationVersionRef.annotateKey({
      description: "Version-exact binding to the observation this judgment answers.",
    }).pipe(CandorDispositionEntity.pg.jsonb()),
    lifecycle: CandorDispositionLifecycle.annotateKey({
      description: "Declared standing of this appended record within its append-only history.",
    }).pipe(CandorDispositionEntity.pg.text()),
    litigationFrameJudgment: S.OptionFromNullOr(CandorJudgment)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Separately-reached decision recorded under a litigation frame; never derived from Rule 56.",
      })
      .pipe(CandorDispositionEntity.pg.text(), CandorDispositionEntity.pg.columnName("litigation_frame_judgment")),
    rule56Judgment: S.OptionFromNullOr(CandorJudgment)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Decision recorded under the duty of candor; its absence leaves the event uncovered.",
      })
      .pipe(CandorDispositionEntity.pg.text(), CandorDispositionEntity.pg.columnName("rule56_judgment")),
    supersedes: S.OptionFromNullOr(LawPractice.CandorDispositionId)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Prior disposition this record retires, appended rather than edited." })
      .pipe(CandorDispositionEntity.pg.integer()),
    ...CandorDispositionEntity.identityFields,
  },
  $I.annote("CandorDisposition", {
    description: "One dated attorney judgment bound to one exact patent citation observation version.",
  }),
  CandorDispositionEntity.entityExtras
) {}
