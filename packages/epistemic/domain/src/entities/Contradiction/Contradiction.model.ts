/**
 * Durable contradiction-candidate entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  CanonicalContradictionBeliefPair,
  ContradictionAssessment,
  ContradictionCandidateDigest,
  ContradictionCandidateKey,
  ContradictionDispositionDecision,
  ContradictionMatchBasis,
  ContradictionReceiptKey,
} from "@beep/epistemic-domain/values/Contradiction";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("entities/Contradiction/Contradiction.model");
const CandidateEntity = ProductEntity.make(Epistemic.ContradictionCandidateId);
const ReceiptEntity = ProductEntity.make(Epistemic.ContradictionReceiptId);
const DispositionEntity = ProductEntity.make(Epistemic.ContradictionDispositionId);

/**
 * Immutable, evidence-backed proposal that two exact belief versions
 * contradict.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction"
 *
 * console.log(ContradictionCandidate.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ContradictionCandidate extends CandidateEntity.Entity<ContradictionCandidate>(CandidateEntity.tableName)(
  {
    candidateKey: ContradictionCandidateKey.annotateKey({
      description: "Order-independent duplicate-suppression key for the pair and match basis.",
    }).pipe(CandidateEntity.pg.text(), CandidateEntity.pg.columnName("candidate_key")),
    candidateDigest: ContradictionCandidateDigest.annotateKey({
      description: "Collision guard over the complete immutable candidate payload.",
    }).pipe(CandidateEntity.pg.text(), CandidateEntity.pg.columnName("candidate_digest")),
    assessment: ContradictionAssessment.annotateKey({
      description: "Detector confidence and explicit proposals presented for human review.",
    }).pipe(CandidateEntity.pg.jsonb()),
    matchBasis: ContradictionMatchBasis.annotateKey({
      description: "Evidence references and detector revision forming the exact match basis.",
    }).pipe(CandidateEntity.pg.jsonb(), CandidateEntity.pg.columnName("match_basis")),
    pair: CanonicalContradictionBeliefPair.annotateKey({
      description: "Canonical pair of immutable belief-version references.",
    }).pipe(CandidateEntity.pg.jsonb(), CandidateEntity.pg.columnName("belief_pair")),
    recordedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant when this candidate first became known.",
    }).pipe(CandidateEntity.pg.bigint("number"), CandidateEntity.pg.columnName("recorded_at")),
    validFrom: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound of the detected contradiction.",
    }).pipe(CandidateEntity.pg.bigint("number"), CandidateEntity.pg.columnName("valid_from")),
    validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Exclusive valid-time upper bound; absent while the contradiction remains temporally applicable.",
      })
      .pipe(CandidateEntity.pg.bigint("number"), CandidateEntity.pg.columnName("valid_to")),
    ...CandidateEntity.identityFields,
  },
  $I.annote("ContradictionCandidate", {
    description: "Immutable evidence-backed proposal that two exact belief versions contradict.",
  }),
  (columns) => [
    CandidateEntity.Table.index("epistemic_contradiction_candidate_recorded_at_btree_idx", [columns.recordedAt]),
    CandidateEntity.Table.index("epistemic_contradiction_candidate_valid_from_btree_idx", [columns.validFrom]),
    ...CandidateEntity.entityExtras(columns),
  ]
) {}

/**
 * Durable receipt proving a submission was observed even when its candidate
 * was duplicate-suppressed.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { ContradictionReceipt } from "@beep/epistemic-domain/entities/Contradiction"
 *
 * console.log(ContradictionReceipt.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ContradictionReceipt extends ReceiptEntity.Entity<ContradictionReceipt>(ReceiptEntity.tableName)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Canonical candidate this submission resolved to.",
    }).pipe(ReceiptEntity.pg.integer(), ReceiptEntity.pg.columnName("candidate_id")),
    receiptKey: ContradictionReceiptKey.annotateKey({
      description: "Caller-owned idempotency key for this submission receipt.",
    }).pipe(ReceiptEntity.pg.text(), ReceiptEntity.pg.columnName("receipt_key")),
    receivedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant when the submission was received.",
    }).pipe(ReceiptEntity.pg.bigint("number"), ReceiptEntity.pg.columnName("received_at")),
    receivedBy: Principal.annotateKey({
      description: "Principal responsible for the submitted candidate.",
    }).pipe(ReceiptEntity.pg.jsonb(), ReceiptEntity.pg.columnName("received_by")),
    ...ReceiptEntity.identityFields,
  },
  $I.annote("ContradictionReceipt", {
    description: "Durable receipt for a contradiction submission, including duplicate submissions.",
  }),
  (columns) => [
    ReceiptEntity.Table.index("epistemic_contradiction_receipt_candidate_id_btree_idx", [columns.candidateId]),
    ...ReceiptEntity.entityExtras(columns),
  ]
) {}

/**
 * Append-only record of a human contradiction review.
 *
 * **Example** (Log entity table name)
 *
 * ```ts
 * import { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction"
 *
 * console.log(ContradictionDisposition.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ContradictionDisposition extends DispositionEntity.Entity<ContradictionDisposition>(
  DispositionEntity.tableName
)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Contradiction candidate resolved by this disposition.",
    }).pipe(DispositionEntity.pg.integer(), DispositionEntity.pg.columnName("candidate_id")),
    decision: ContradictionDispositionDecision.annotateKey({
      description: "Typed rejection or completed supersession outcome.",
    }).pipe(DispositionEntity.pg.jsonb()),
    resolvedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant when the human disposition was recorded.",
    }).pipe(DispositionEntity.pg.bigint("number"), DispositionEntity.pg.columnName("resolved_at")),
    resolvedBy: Principal.annotateKey({
      description: "Principal who decided the contradiction disposition.",
    }).pipe(DispositionEntity.pg.jsonb(), DispositionEntity.pg.columnName("resolved_by")),
    ...DispositionEntity.identityFields,
  },
  $I.annote("ContradictionDisposition", {
    description: "Append-only human disposition rejecting a contradiction or recording its atomic supersession.",
  }),
  (columns) => [
    DispositionEntity.Table.uniqueIndex("epistemic_contradiction_disposition_candidate_id_unique_idx", [
      columns.candidateId,
    ]),
    ...DispositionEntity.entityExtras(columns),
  ]
) {}
