/**
 * Bitemporal joins over immutable party cores and independent record streams.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { validAt } from "@beep/epistemics/Claim";
import { claimsAt, knowledgeInterval } from "@beep/epistemics/ClaimLog";
import { ClaimLogEntry } from "@beep/epistemics/ClaimLog.schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { ClaimEvidenceLinks, ClaimLedger, ClaimRead, ClaimReviewRecord, ClaimSignalRecord } from "./Claim.model.ts";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type * as Equivalence from "effect/Equivalence";
import type { ClaimLedgerData, ClaimReadScope } from "./Claim.model.ts";

const evidenceEqual = S.toEquivalence(ClaimEvidenceLinks);
const reviewEqual = S.toEquivalence(ClaimReviewRecord);
const signalsEqual = S.toEquivalence(ClaimSignalRecord);
type ReadScope = Pick<ClaimReadScope, "scope" | "asOf" | "validAt" | "states">;

const latestAt = <R extends { readonly claim: ClaimId; readonly at: DateTime.Utc }>(
  records: ReadonlyArray<R>,
  claim: ClaimId,
  asOf: DateTime.Utc,
  same: Equivalence.Equivalence<R>
): O.Option<R> => {
  const available = A.filter(
    records,
    (row) => Eq.equals(row.claim, claim) && DateTime.isLessThanOrEqualTo(row.at, asOf)
  );
  const ordered = A.sort(
    available,
    Order.mapInput(DateTime.Order, (row: R) => row.at)
  );
  return O.filter(A.last(ordered), (last) =>
    A.every(available, (row) => DateTime.isLessThan(row.at, last.at) || same(row, last))
  );
};

/**
 * Project generation-backed cores into the shared append-law representation.
 *
 * **Example** (An empty history has no intervals)
 *
 * ```ts
 * import { ClaimLedger, claimLog } from "@beep/party-domain/Claim"
 * console.log(claimLog(ClaimLedger.make({})).length)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const claimLog = (ledger: ClaimLedgerData): ReadonlyArray<ClaimLogEntry> =>
  A.flatMap(ledger.claims, (record) =>
    O.toArray(
      O.map(
        A.findFirst(ledger.generations, (generation) => Eq.equals(generation.claim, record.claim)),
        (generation) => ClaimLogEntry.make({ ...record.core, claim: record.claim, generatedAt: generation.ended })
      )
    )
  );

/**
 * Retain each core while selecting only observations known by the supplied time.
 *
 * **Details**
 * Missing generation yields an absent interval. Missing or contradictory simultaneous review
 * events yield absent review; neither case invents a proposed or accepted state.
 *
 * **Example** (Read without an implicit clock)
 *
 * ```ts
 * import { ClaimLedger, readClaims } from "@beep/party-domain/Claim"
 * import * as DateTime from "effect/DateTime"
 * console.log(readClaims(ClaimLedger.make({}), DateTime.makeUnsafe(0)))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const readClaims: {
  (asOf: DateTime.Utc): (ledger: ClaimLedgerData) => ReadonlyArray<ClaimRead>;
  (ledger: ClaimLedgerData, asOf: DateTime.Utc): ReadonlyArray<ClaimRead>;
} = dual(2, (ledger: ClaimLedgerData, asOf: DateTime.Utc): ReadonlyArray<ClaimRead> => {
  const log = claimLog(ledger);
  return A.map(ledger.claims, (record) =>
    ClaimRead.make({
      record,
      knowledge: knowledgeInterval(log, record.claim),
      evidence: latestAt(ledger.evidence, record.claim, asOf, evidenceEqual),
      review: latestAt(ledger.reviews, record.claim, asOf, reviewEqual),
      signals: latestAt(ledger.signals, record.claim, asOf, signalsEqual),
    })
  );
});

/**
 * Select one partition on explicit knowledge, valid-time and review coordinates.
 *
 * **Example** (Select an empty accepted view)
 *
 * ```ts
 * import { ClaimLedger, claimsAtScope } from "@beep/party-domain/Claim"
 * import * as DateTime from "effect/DateTime"
 * const at = DateTime.makeUnsafe(0)
 * console.log(claimsAtScope(ClaimLedger.make({}), { scope: "synthetic", asOf: at, validAt: at, states: ["Accepted"] }))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const claimsAtScope: {
  (scope: ReadScope): (ledger: ClaimLedgerData) => ReadonlyArray<ClaimRead>;
  (ledger: ClaimLedgerData, scope: ReadScope): ReadonlyArray<ClaimRead>;
} = dual(2, (ledger: ClaimLedgerData, scope: ReadScope): ReadonlyArray<ClaimRead> => {
  const selected = claimsAt(claimLog(ledger), scope.asOf);
  return A.filter(
    readClaims(ledger, scope.asOf),
    (row) =>
      row.record.core.scope === scope.scope &&
      A.some(selected, (entry) => Eq.equals(entry.claim, row.record.claim)) &&
      validAt(row.record.core.valid, scope.validAt) &&
      O.exists(row.review, (event) => A.contains(scope.states, event.review._tag)) &&
      !A.some(
        ledger.retractions,
        (event) => Eq.equals(event.claim, row.record.claim) && DateTime.isLessThanOrEqualTo(event.at, scope.asOf)
      )
  );
});

/**
 * Combine independently constructed batches without embedding their coordinates in cores.
 *
 * **Example** (Combine no batches)
 *
 * ```ts
 * import { mergeClaimLedgers } from "@beep/party-domain/Claim"
 * console.log(mergeClaimLedgers([]).claims.length)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mergeClaimLedgers = (ledgers: ReadonlyArray<ClaimLedgerData>): ClaimLedger =>
  ClaimLedger.make({
    claims: A.flatMap(ledgers, (row) => row.claims),
    generations: A.flatMap(ledgers, (row) => row.generations),
    evidence: A.flatMap(ledgers, (row) => row.evidence),
    reviews: A.flatMap(ledgers, (row) => row.reviews),
    signals: A.flatMap(ledgers, (row) => row.signals),
    challenges: A.flatMap(ledgers, (row) => row.challenges),
    retractions: A.flatMap(ledgers, (row) => row.retractions),
    admissions: A.flatMap(ledgers, (row) => row.admissions),
    stances: A.flatMap(ledgers, (row) => row.stances),
  });
