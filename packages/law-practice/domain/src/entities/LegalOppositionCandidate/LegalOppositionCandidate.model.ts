/**
 * Legal opposition candidate entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import { LegalOppositionCandidateInput } from "../../values/LegalOppositionCandidateInput/index.ts";
import { PriorityBasis } from "../../values/PriorityBasis/index.ts";
import { LegalVerdictAssignment } from "./LegalOppositionCandidate.values.ts";

const $I = $LawPracticeDomainId.create("entities/LegalOppositionCandidate/LegalOppositionCandidate.model");
const LegalOppositionCandidateEntity = ProductEntity.make(LawPractice.LegalOppositionCandidateId);

/**
 * One appended law-side record that two stored relations were screened as
 * prima facie opposed.
 *
 * **When to use**
 *
 * Use to keep a screened pair on the record together with whatever an attorney
 * later recorded about it. It is the law-side durable form of the policy's
 * candidate input, and it is not a submission to anything.
 *
 * **Details**
 *
 * `candidate` is the screening result exactly as the policy emitted it, stored
 * whole rather than unpacked. The pair inside it is an unordered set of two, so
 * no reading of this record can put one relation ahead of the other.
 *
 * `priorityBasis` records the basis a party offered for its position prevailing
 * — the authority, forum, source precedence, specificity, and the rest — and it
 * is one basis, not a collection, because a basis names its own party. A second
 * party's basis is a second appended record, which is also why nothing here can
 * accumulate into a ranking.
 *
 * `verdictFamily` is present only when an attorney assigned one, and it carries
 * that attorney with it.
 *
 * **Gotchas**
 *
 * Recording a candidate finds nothing. That the scopes overlap and the
 * positions are prima facie opposed are set-theoretic facts about recorded
 * values; whether the pair *is* a contradiction, which family it belongs to,
 * and which position prevails are attributed human judgments this package never
 * computes and never proxies.
 *
 * Priority is uncomputable by construction and stays that way: the basis fields
 * carry no order, no score, and no comparison, so no reader can rank two of
 * them.
 *
 * **Example** (Inspect the recorded candidate surface)
 *
 * ```ts
 * import { LegalOppositionCandidate } from "@beep/law-practice-domain"
 *
 * console.log(LegalOppositionCandidate.fields.candidate !== undefined) // true
 * console.log(LegalOppositionCandidate.fields.verdictFamily !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class LegalOppositionCandidate extends LegalOppositionCandidateEntity.Entity<LegalOppositionCandidate>(
  LegalOppositionCandidateEntity.tableName
)(
  {
    candidate: LegalOppositionCandidateInput.annotateKey({
      description: "Screening result as the policy emitted it, with its unordered pair of stored relations.",
    }).pipe(LegalOppositionCandidateEntity.pg.jsonb()),
    priorityBasis: S.OptionFromNullOr(PriorityBasis)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Basis a party offered for its position prevailing; absent until one is recorded." })
      .pipe(LegalOppositionCandidateEntity.pg.jsonb(), LegalOppositionCandidateEntity.pg.columnName("priority_basis")),
    verdictFamily: S.OptionFromNullOr(LegalVerdictAssignment)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({ description: "Attorney-assigned family with its assigner; absent until an attorney assigns one." })
      .pipe(LegalOppositionCandidateEntity.pg.jsonb(), LegalOppositionCandidateEntity.pg.columnName("verdict_family")),
    ...LegalOppositionCandidateEntity.identityFields,
  },
  $I.annote("LegalOppositionCandidate", {
    description: "One appended record that two stored relations were screened as prima facie opposed.",
  }),
  LegalOppositionCandidateEntity.entityExtras
) {}
