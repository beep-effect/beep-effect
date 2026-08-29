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
const pg = ProductEntity.pg;

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
export class ContradictionCandidate extends ProductEntity.Entity<ContradictionCandidate>()(
  Epistemic.ContradictionCandidateId
)(
  {
    candidateKey: ContradictionCandidateKey.annotateKey({
      description: "Order-independent duplicate-suppression key for the pair and match basis.",
    }).pipe(pg.text(), pg.columnName("candidate_key")),
    candidateDigest: ContradictionCandidateDigest.annotateKey({
      description: "Collision guard over the complete immutable candidate payload.",
    }).pipe(pg.text(), pg.columnName("candidate_digest")),
    assessment: ContradictionAssessment.annotateKey({
      description: "Detector confidence and explicit proposals presented for human review.",
    }).pipe(pg.jsonb()),
    matchBasis: ContradictionMatchBasis.annotateKey({
      description: "Evidence references and detector revision forming the exact match basis.",
    }).pipe(pg.jsonb(), pg.columnName("match_basis")),
    pair: CanonicalContradictionBeliefPair.annotateKey({
      description: "Canonical pair of immutable belief-version references.",
    }).pipe(pg.jsonb(), pg.columnName("belief_pair")),
    recordedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant when this candidate first became known.",
    }).pipe(pg.bigint("number"), pg.columnName("recorded_at"), pg.index()),
    validFrom: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound of the detected contradiction.",
    }).pipe(pg.bigint("number"), pg.columnName("valid_from"), pg.index()),
    validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr)
      .annotateKey({
        description: "Exclusive valid-time upper bound; absent while the contradiction remains temporally applicable.",
      })
      .pipe(pg.bigint("number"), pg.columnName("valid_to")),
  },
  $I.annote("ContradictionCandidate", {
    description: "Immutable evidence-backed proposal that two exact belief versions contradict.",
  })
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
export class ContradictionReceipt extends ProductEntity.Entity<ContradictionReceipt>()(
  Epistemic.ContradictionReceiptId
)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Canonical candidate this submission resolved to.",
    }).pipe(pg.integer(), pg.columnName("candidate_id"), pg.index()),
    receiptKey: ContradictionReceiptKey.annotateKey({
      description: "Caller-owned idempotency key for this submission receipt.",
    }).pipe(pg.text(), pg.columnName("receipt_key")),
    receivedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant when the submission was received.",
    }).pipe(pg.bigint("number"), pg.columnName("received_at")),
    receivedBy: Principal.annotateKey({
      description: "Principal responsible for the submitted candidate.",
    }).pipe(pg.jsonb(), pg.columnName("received_by")),
  },
  $I.annote("ContradictionReceipt", {
    description: "Durable receipt for a contradiction submission, including duplicate submissions.",
  })
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
export class ContradictionDisposition extends ProductEntity.Entity<ContradictionDisposition>()(
  Epistemic.ContradictionDispositionId
)(
  {
    candidateId: Epistemic.ContradictionCandidateId.annotateKey({
      description: "Contradiction candidate resolved by this disposition.",
    }).pipe(pg.integer(), pg.columnName("candidate_id"), pg.uniqueIndex()),
    decision: ContradictionDispositionDecision.annotateKey({
      description: "Typed rejection or completed supersession outcome.",
    }).pipe(pg.jsonb()),
    resolvedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant when the human disposition was recorded.",
    }).pipe(pg.bigint("number"), pg.columnName("resolved_at")),
    resolvedBy: Principal.annotateKey({
      description: "Principal who decided the contradiction disposition.",
    }).pipe(pg.jsonb(), pg.columnName("resolved_by")),
  },
  $I.annote("ContradictionDisposition", {
    description: "Append-only human disposition rejecting a contradiction or recording its atomic supersession.",
  })
) {}
