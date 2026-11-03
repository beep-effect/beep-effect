/**
 * Canonical evidence sealing and guarded reviewer claim construction.
 * @packageDocumentation
 * @since 0.0.0
 */

import { ValidTime } from "@beep/epistemics/Claim";
import { holdsAt } from "@beep/epistemics/ValidInterval";
import { EvidenceSignals, ReviewerDisposition, SourceAssertion } from "@beep/party-domain/Claim";
import { AssertionId, Digest } from "@beep/party-domain/Ids";
import { SourceRecordInput, sourceRecordPartyKey } from "@beep/party-domain/PartyKey";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { resolveParties } from "@beep/party-domain/Resolution";
import { PartyLedger } from "@beep/party-use-cases/Ledger";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { claimFromAssertion } from "../../internal/claimFromAssertion.ts";
import {
  CaseEvidence,
  CaseMailbox,
  CollisionCase,
  CollisionDecision,
  DecisionClaimsInput,
  ReviewApplication,
  ReviewDecisionError,
  ReviewEvidence,
  ReviewVerdict,
} from "./ReviewLoop.model.ts";
import type { PartyId } from "@beep/shared-domain/identity/Party";
import type { MailboxAnchorInput, ReviewInput, ReviewStatus } from "./ReviewLoop.model.ts";

const digest = (text: string) => Digest.make(bytesToHex(sha256(utf8ToBytes(text))));
const emptyEvidence = () => ReviewEvidence.make({ assertions: [], versions: [] });

const encodeCaseEvidence = S.encodeEffect(S.fromJsonString(CaseEvidence));
const encodeCollisionDecision = S.encodeEffect(S.fromJsonString(CollisionDecision));

/**
 * Seal canonical case evidence with a SHA-256 digest.
 * **Details**
 * Mailboxes sort by numeric PartyId. Identifier and domain sets sort and
 * deduplicate before encoding through the evidence schema. Changed evidence
 * changes the basis; array presentation order does not.
 * **Example** (Use evidence sealing)
 * ```ts
 * import { sealCase } from "@beep/party-server/ReviewLoop"
 * const seal = sealCase
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const sealCase = Effect.fn("PartyReview.sealCase")(function* (evidence: CaseEvidence) {
  const canonical = CaseEvidence.make({
    ...evidence,
    mailboxes: A.sort(
      A.map(evidence.mailboxes, (mailbox) =>
        CaseMailbox.make({
          ...mailbox,
          identifiers: A.sort(A.dedupe(mailbox.identifiers), Order.String),
          domains: A.sort(A.dedupe(mailbox.domains), Order.String),
        })
      ),
      Order.mapInput(Order.Number, (mailbox: CaseMailbox) => mailbox.party)
    ),
  });
  const encoded = yield* encodeCaseEvidence(canonical);
  return CollisionCase.make({ evidence: canonical, basis: digest(encoded) });
});

const canonicalDecision = (decision: CollisionDecision): CollisionDecision =>
  CollisionDecision.make({
    ...decision,
    verdict: ReviewVerdict.match(decision.verdict, {
      Skip: () => ReviewVerdict.cases.Skip.make({}),
      Grouped: ({ groups }) =>
        ReviewVerdict.cases.Grouped.make({
          groups: A.sort(
            A.map(groups, (group) => A.sort(group, Order.Number)),
            Order.mapInput(Order.Number, (group: A.NonEmptyReadonlyArray<PartyId>) => A.headNonEmpty(group))
          ),
        }),
    }),
  });

/**
 * Validate a sealed case and construct the sourced claims for one decision.
 * **Details**
 * Rejects altered case digests, stale decisions and incomplete or foreign
 * partitions before producing evidence. The returned accepted candidates must
 * still pass cross-case conflict evaluation before publication to the ledger.
 * **Example** (Use guarded decision construction)
 * ```ts
 * import { decisionClaims } from "@beep/party-server/ReviewLoop"
 * const build = decisionClaims
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const decisionClaims = Effect.fn("PartyReview.decisionClaims")(function* (input: DecisionClaimsInput) {
  const current = yield* sealCase(input.case.evidence);
  if (current.basis !== input.case.basis) return yield* ReviewDecisionError.make({ reason: "tampered-case" });
  if (input.decision.basis !== current.basis || input.decision.name !== current.evidence.name)
    return yield* ReviewDecisionError.make({ reason: "stale-basis" });
  const decision = canonicalDecision(input.decision);
  if (ReviewVerdict.guards.Skip(decision.verdict)) return emptyEvidence();
  const parties = A.map(current.evidence.mailboxes, (mailbox) => mailbox.party);
  const listed = A.flatten(decision.verdict.groups);
  if (A.length(listed) !== A.length(parties) || !A.every(parties, (party) => A.contains(listed, party)))
    return yield* ReviewDecisionError.make({ reason: "invalid-partition" });
  const encoded = yield* encodeCollisionDecision(decision);
  const decisionId = digest(encoded);
  const disposition = ReviewerDisposition.make({
    disposition: "accepted",
    reviewer: decision.reviewer,
    basis: decision.basis,
    reviewedAt: decision.reviewedAt,
    reason: Str.isNonEmpty(Str.trim(decision.note)) ? decision.note : "Reviewed identity collision",
  });
  const absent = EvidenceSignals.fields.sourceTrust.cases.Absent.make({ reason: "not-assessed" });
  const signals = EvidenceSignals.make({
    sourceTrust: absent,
    sourceAssertedConfidence: absent,
    extractorConfidence: absent,
    validator: absent,
    reviewer: EvidenceSignals.fields.reviewer.cases.Present.make({ value: disposition }),
  });
  const groups = decision.verdict.groups;
  const within = A.flatMap(groups, (group) =>
    A.map(A.zip(group, A.drop(group, 1)), ([left, right]) => Proposition.cases.SameParty.make({ left, right }))
  );
  const across = A.flatMap(groups, (group, index) =>
    A.flatMap(A.drop(groups, index + 1), (other) =>
      A.flatMap(group, (left) => A.map(other, (right) => Proposition.cases.DistinctParty.make({ left, right })))
    )
  );
  const propositions = A.appendAll(within, across);
  const validTime = ValidTime.cases.Interval.make(decision.validity);
  const assertions = A.map(propositions, (proposition) =>
    SourceAssertion.make({
      id: AssertionId.make(`party-asrt:review:${decisionId}:${encodeURIComponent(logicalKey(proposition))}`),
      proposition,
      stance: "asserts",
      anchors: [decision.anchor],
      producedBy: decision.producedBy,
      validTime,
      recordedAt: decision.reviewedAt,
    })
  );
  const versions = A.map(assertions, (assertion) =>
    claimFromAssertion(
      assertion,
      { _tag: "Accepted", disposition: { ...disposition, disposition: "accepted" } },
      signals
    )
  );
  return ReviewEvidence.make({ assertions, versions });
});

/**
 * Recognize statuses allowed to leave the review queue and publish evidence.
 * **Example** (Recognize a settled status)
 * ```ts
 * import { isSettled } from "@beep/party-server/ReviewLoop"
 * isSettled("reviewed-same")
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isSettled = (status: ReviewStatus): boolean =>
  status === "reviewed-same" || status === "reviewed-distinct" || status === "reviewed-grouped";

const groupedStatus = (groups: ReadonlyArray<ReadonlyArray<PartyId>>): ReviewStatus => {
  if (A.length(groups) === 1) return "reviewed-same";
  return A.every(groups, (group) => A.length(group) === 1) ? "reviewed-distinct" : "reviewed-grouped";
};

/**
 * Apply current decisions, retaining stale, invalid and conflicting cases in the queue.
 * **Details**
 * Uses numeric review time within the query's knowledge scope. Distinct
 * decisions tied at the latest instant are conflicts. Invalid partitions
 * never enter resolution. Conflicting cases are removed monotonically and
 * resolution repeats until no settled case relies on a removed claim.
 * Only settled applications carry publishable assertions and versions.
 * **Example** (Use the scoped review loop)
 * ```ts
 * import { applyReviews } from "@beep/party-server/ReviewLoop"
 * const apply = applyReviews
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const applyReviews = Effect.fn("PartyReview.applyReviews")(function* (input: ReviewInput) {
  let applications = yield* Effect.forEach(input.cases, (current) =>
    Effect.gen(function* () {
      const candidates = A.filter(
        input.decisions,
        (decision) =>
          decision.name === current.evidence.name &&
          DateTime.toEpochMillis(decision.reviewedAt) <= DateTime.toEpochMillis(input.scope.asOf)
      );
      const row = (status: ReviewStatus, decision: O.Option<CollisionDecision>, evidence = emptyEvidence()) =>
        ReviewApplication.make({ case: current, status, decision, evidence });
      if (!A.isArrayNonEmpty(candidates)) return row("unreviewed", O.none());
      const latest = A.max(
        candidates,
        Order.mapInput(Order.Number, (decision: CollisionDecision) => DateTime.toEpochMillis(decision.reviewedAt))
      );
      const ties = A.dedupeWith(
        A.map(
          A.filter(
            candidates,
            (decision) => DateTime.toEpochMillis(decision.reviewedAt) === DateTime.toEpochMillis(latest.reviewedAt)
          ),
          canonicalDecision
        ),
        S.toEquivalence(CollisionDecision)
      );
      if (A.length(ties) > 1) return row("conflicting-review", O.none());
      if (latest.basis !== current.basis) return row("stale-review", O.none());
      const candidate = yield* Effect.result(
        decisionClaims(DecisionClaimsInput.make({ case: current, decision: latest }))
      );
      if (Result.isFailure(candidate)) return row("invalid-decision", O.some(latest));
      if (ReviewVerdict.guards.Skip(latest.verdict)) return row("skipped", O.some(latest));
      if (!holdsAt(latest.validity, input.scope.validAt)) return row("out-of-scope", O.some(latest));
      return row(groupedStatus(latest.verdict.groups), O.some(latest), candidate.success);
    })
  );
  let changed = true;
  while (changed) {
    changed = false;
    const view = resolveParties(
      A.flatMap(applications, (application) => application.evidence.versions),
      input.scope
    );
    const representative = (party: PartyId) =>
      O.match(
        A.findFirst(view.representatives, (row) => row.party === party),
        {
          onNone: () => party,
          onSome: (row) => row.survivor,
        }
      );
    applications = A.map(applications, (application) => {
      if (
        !isSettled(application.status) ||
        O.isNone(application.decision) ||
        ReviewVerdict.guards.Skip(application.decision.value.verdict)
      )
        return application;
      const groups = application.decision.value.verdict.groups;
      const coherent =
        A.every(groups, (group) => A.length(A.dedupe(A.map(group, representative))) === 1) &&
        A.every(groups, (group, index) =>
          A.every(A.drop(groups, index + 1), (other) =>
            A.every(group, (left) => A.every(other, (right) => representative(left) !== representative(right)))
          )
        );
      if (coherent) return application;
      changed = true;
      return ReviewApplication.make({ ...application, status: "conflicting-review", evidence: emptyEvidence() });
    });
  }
  return applications;
});

/**
 * Allocate or reuse the integer anchor for a mailbox's smallest identifier.
 * **Details**
 * Stability is scoped to the ledger instance. The memory Layer is not durable
 * storage. Allocation uses a dedicated source namespace and emits no accepted
 * identity claim. Adding a smaller identifier changes the provisional anchor;
 * review must resolve identity rather than rewriting existing parties.
 * **Example** (Use mailbox anchor allocation)
 * ```ts
 * import { mailboxParty } from "@beep/party-server/ReviewLoop"
 * const allocate = mailboxParty
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const mailboxParty = Effect.fn("PartyReview.mailboxParty")(function* (input: MailboxAnchorInput) {
  const ledger = yield* PartyLedger;
  const key = yield* sourceRecordPartyKey(
    SourceRecordInput.make({ namespace: "party-mailbox", recordId: A.min(input.identifiers, Order.String) })
  );
  return yield* ledger.allocateAnchorParty(key);
});
