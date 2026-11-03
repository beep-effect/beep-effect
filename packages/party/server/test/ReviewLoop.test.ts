import { ActivityId, IdentifierId, OccurrenceId, PrincipalId } from "@beep/party-domain/Ids";
import { RecordRow } from "@beep/party-domain/Provenance";
import { ResolutionScope } from "@beep/party-domain/Resolution";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import {
  applyReviews,
  CaseEvidence,
  CaseMailbox,
  CollisionCase,
  CollisionDecision,
  DecisionClaimsInput,
  decisionClaims,
  isSettled,
  MailboxAnchorInput,
  mailboxParty,
  ReviewInput,
  ReviewVerdict,
  sealCase,
} from "@beep/party-server/ReviewLoop";
import { PartyLedger } from "@beep/party-use-cases/Ledger";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const at = (time: number) => DateTime.makeUnsafe(time);
const mailbox = (party: number) =>
  CaseMailbox.make({
    party: PartyId.make(party),
    identifiers: [IdentifierId.make(`party-ident:${party}`)],
    domains: [`org${party}.example`],
    span: O.none(),
  });
const evidence = (name: string, parties: A.NonEmptyReadonlyArray<number>) =>
  CaseEvidence.make({
    name,
    shape: "full-name",
    outcome: "unresolved",
    orgLead: "different-orgs-undated",
    mailboxes: A.map(parties, mailbox),
  });
const seal = (name: string, parties: A.NonEmptyReadonlyArray<number>) => sealCase(evidence(name, parties));
const decision = (
  current: CollisionCase,
  groups: A.NonEmptyReadonlyArray<A.NonEmptyReadonlyArray<number>>,
  time = 10
) =>
  CollisionDecision.make({
    name: current.evidence.name,
    basis: current.basis,
    verdict: ReviewVerdict.cases.Grouped.make({
      groups: A.map(groups, (group) => A.map(group, (party) => PartyId.make(party))),
    }),
    reviewer: PrincipalId.make("party-user:test"),
    reviewedAt: at(time),
    note: "",
    validity: { validFrom: at(0), validTo: O.none() },
    producedBy: ActivityId.make("party-act:review"),
    anchor: RecordRow.make({ occurrence: OccurrenceId.make("party-occ:reviews"), rowKey: current.evidence.name }),
  });
const apply = (
  cases: ReadonlyArray<CollisionCase>,
  decisions: ReadonlyArray<CollisionDecision>,
  asOf = 100,
  validAt = 50
) =>
  applyReviews(
    ReviewInput.make({ cases, decisions, scope: ResolutionScope.make({ asOf: at(asOf), validAt: at(validAt) }) })
  );

describe("review schemas and evidence sealing", () => {
  it("rejects a repeated party in review groups", () => {
    pipe(
      S.decodeResult(ReviewVerdict)({ _tag: "Grouped", groups: [[1], [1]] }),
      Result.isFailure,
      TestUtils.assertTrue
    );
  });
  it.effect("seals canonical sets with numeric party order and detects evidence changes", () =>
    Effect.gen(function* () {
      const first = yield* seal("Alex", [10, 2]);
      const reordered = yield* seal("Alex", [2, 10]);
      expect(first).toEqual(reordered);
      expect(A.map(first.evidence.mailboxes, (value) => value.party)).toEqual([2, 10]);
      const changed = yield* seal("Alex", [2, 3, 10]);
      expect(changed.basis).not.toBe(first.basis);
      const duplicated = yield* sealCase(
        CaseEvidence.make({
          ...first.evidence,
          mailboxes: A.map(first.evidence.mailboxes, (value) =>
            CaseMailbox.make({
              ...value,
              identifiers: A.appendAll(value.identifiers, value.identifiers),
              domains: A.appendAll(value.domains, value.domains),
            })
          ),
        })
      );
      expect(duplicated.basis).toBe(first.basis);
    })
  );
});

describe("guarded reviewer claims", () => {
  it.effect("builds sourced accepted claims within and across groups", () =>
    Effect.gen(function* () {
      const current = yield* seal("Alex", [1, 2, 3]);
      const choice = decision(current, [[2, 1], [3]]);
      const result = yield* decisionClaims(DecisionClaimsInput.make({ case: current, decision: choice }));
      expect(A.map(result.versions, (version) => version.proposition._tag)).toEqual([
        "SameParty",
        "DistinctParty",
        "DistinctParty",
      ]);
      A.forEach(result.versions, (version) => {
        expect(version.review._tag).toBe("Accepted");
        expect(version.validTime._tag).toBe("Interval");
        const source = O.getOrThrow(
          A.findFirst(result.assertions, (assertion) => A.contains(version.supportedBy, assertion.id))
        );
        expect(source.proposition).toEqual(version.proposition);
        expect(source.anchors).toEqual([choice.anchor]);
      });
      const reordered = yield* decisionClaims(
        DecisionClaimsInput.make({ case: current, decision: decision(current, [[3], [1, 2]]) })
      );
      expect(reordered).toEqual(result);
      const later = yield* decisionClaims(
        DecisionClaimsInput.make({ case: current, decision: decision(current, [[1, 2], [3]], 11) })
      );
      expect(A.map(later.versions, (version) => version.id)).not.toEqual(
        A.map(result.versions, (version) => version.id)
      );
    })
  );
  it.effect("rejects stale, tampered and incomplete cases before emitting claims", () =>
    Effect.gen(function* () {
      const current = yield* seal("Alex", [1, 2]);
      const changed = yield* seal("Alex", [1, 2, 3]);
      const stale = yield* decisionClaims(
        DecisionClaimsInput.make({ case: changed, decision: decision(current, [[1, 2]]) })
      ).pipe(Effect.flip);
      expect(stale).toMatchObject({ reason: "stale-basis" });
      const tampered = CollisionCase.make({ ...current, evidence: changed.evidence });
      const invalid = yield* decisionClaims(
        DecisionClaimsInput.make({ case: tampered, decision: decision(current, [[1, 2]]) })
      ).pipe(Effect.flip);
      expect(invalid).toMatchObject({ reason: "tampered-case" });
      const partial = yield* decisionClaims(
        DecisionClaimsInput.make({ case: current, decision: decision(current, [[1]]) })
      ).pipe(Effect.flip);
      expect(partial).toMatchObject({ reason: "invalid-partition" });
    })
  );
});

describe("scoped review application", () => {
  it.effect("settles valid partitions while preserving all queue statuses", () =>
    Effect.gen(function* () {
      const same = yield* seal("same", [1, 2]);
      const distinct = yield* seal("distinct", [3, 4]);
      const grouped = yield* seal("grouped", [5, 6, 7]);
      const pending = yield* seal("pending", [8, 9]);
      const partial = yield* seal("partial", [10, 11]);
      const before = yield* seal("stale", [12, 13]);
      const after = yield* seal("stale", [12, 13, 14]);
      const skip = yield* seal("skip", [15, 16]);
      const rows = yield* apply(
        [same, distinct, grouped, pending, partial, after, skip],
        [
          decision(same, [[1, 2]]),
          decision(distinct, [[3], [4]]),
          decision(grouped, [[5, 6], [7]]),
          decision(partial, [[10]]),
          decision(before, [[12, 13]]),
          CollisionDecision.make({ ...decision(skip, [[15, 16]]), verdict: ReviewVerdict.cases.Skip.make({}) }),
        ]
      );
      expect(A.map(rows, (row) => row.status)).toEqual([
        "reviewed-same",
        "reviewed-distinct",
        "reviewed-grouped",
        "unreviewed",
        "invalid-decision",
        "stale-review",
        "skipped",
      ]);
      A.forEach(
        A.filter(rows, (row) => !isSettled(row.status)),
        (row) => expect(row.evidence).toEqual({ assertions: [], versions: [] })
      );
    })
  );
  it.effect("lets a valid separation veto a later cross-case merge", () =>
    Effect.gen(function* () {
      const name = yield* seal("Alex", [1, 2]);
      const alias = yield* seal("A", [1, 2]);
      const rows = yield* apply([name, alias], [decision(name, [[1], [2]]), decision(alias, [[1, 2]], 20)]);
      expect(A.map(rows, (row) => row.status)).toEqual(["reviewed-distinct", "conflicting-review"]);
      expect(O.getOrThrow(A.last(rows)).evidence.versions).toEqual([]);
    })
  );
  it.effect("prevents a foreign-party invalid partition from poisoning a valid review", () =>
    Effect.gen(function* () {
      const invalid = yield* seal("invalid", [1, 2]);
      const valid = yield* seal("valid", [1, 99]);
      const rows = yield* apply([invalid, valid], [decision(invalid, [[1], [99]]), decision(valid, [[1, 99]])]);
      expect(A.map(rows, (row) => row.status)).toEqual(["invalid-decision", "reviewed-same"]);
    })
  );
  it.effect("uses numeric latest time and rejects conflicting simultaneous decisions", () =>
    Effect.gen(function* () {
      const current = yield* seal("Alex", [1, 2]);
      const earlier = decision(current, [[1], [2]], 9);
      const later = decision(current, [[1, 2]], 10);
      expect(A.map(yield* apply([current], [later, earlier]), (row) => row.status)).toEqual(["reviewed-same"]);
      expect(A.map(yield* apply([current], [later, decision(current, [[1], [2]], 10)]), (row) => row.status)).toEqual([
        "conflicting-review",
      ]);
      expect(A.map(yield* apply([current], [later, later]), (row) => row.status)).toEqual(["reviewed-same"]);
      expect(A.map(yield* apply([current], [later], 9), (row) => row.status)).toEqual(["unreviewed"]);
    })
  );
  it.effect("keeps an explicit expired validity interval out of the current view", () =>
    Effect.gen(function* () {
      const current = yield* seal("Alex", [1, 2]);
      const bounded = CollisionDecision.make({
        ...decision(current, [[1, 2]]),
        validity: { validFrom: at(0), validTo: O.some(at(20)) },
      });
      expect(A.map(yield* apply([current], [bounded], 100, 19), (row) => row.status)).toEqual(["reviewed-same"]);
      expect(A.map(yield* apply([current], [bounded], 100, 20), (row) => row.status)).toEqual(["out-of-scope"]);
    })
  );
});

it.layer(PartyLedgerMemory)("integer mailbox anchors", (it) => {
  it.effect("reuses an anchor regardless of identifier order without asserting identity", () =>
    Effect.gen(function* () {
      const a = IdentifierId.make("party-ident:a");
      const b = IdentifierId.make("party-ident:b");
      const first = yield* mailboxParty(MailboxAnchorInput.make({ identifiers: [b, a] }));
      const second = yield* mailboxParty(MailboxAnchorInput.make({ identifiers: [a, b, a] }));
      expect(second).toBe(first);
      expect(Number.isInteger(first)).toBe(true);
      const ledger = yield* PartyLedger;
      expect((yield* ledger.snapshot).versions).toEqual([]);
      expect((yield* ledger.snapshot).assertions).toEqual([]);
    })
  );
  it.effect("serializes concurrent allocation and shares the integer allocator", () =>
    Effect.gen(function* () {
      const input = MailboxAnchorInput.make({ identifiers: [IdentifierId.make("party-ident:concurrent")] });
      const ids = yield* Effect.all(
        A.makeBy(20, () => mailboxParty(input)),
        { concurrency: "unbounded" }
      );
      expect(A.dedupe(ids)).toHaveLength(1);
      const ledger = yield* PartyLedger;
      const unrelated = yield* ledger.allocatePartyId;
      expect(A.contains(ids, unrelated)).toBe(false);
      const other = yield* mailboxParty(
        MailboxAnchorInput.make({ identifiers: [IdentifierId.make("party-ident:other")] })
      );
      expect(A.contains(ids, other)).toBe(false);
      expect(other).not.toBe(unrelated);
    })
  );
});
