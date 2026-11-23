import {
  ClaimGeneration,
  ClaimLedger,
  ClaimRecord,
  ClaimReviewRecord,
  mergeClaimLedgers,
  ReviewState,
  SourceAssertion,
} from "@beep/party-domain/Claim";
import { HeaderParticipant } from "@beep/party-domain/Communication";
import { PartyKey } from "@beep/party-domain/PartyKey";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { ResolutionScope, resolveParties } from "@beep/party-domain/Resolution";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import { LedgerSnapshot, PartyLedger } from "@beep/party-use-cases/Ledger";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { activityStart, at, LedgerLive, partyClaim, retraction } from "./fixtures/claims.ts";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import type { ClaimLedgerData } from "@beep/party-domain/Claim";
import type { PartyClaim } from "./fixtures/claims.ts";

const scope = (asOf: number) =>
  ResolutionScope.make({ scope: "synthetic", asOf: DateTime.makeUnsafe(asOf), validAt: DateTime.makeUnsafe(0) });
const pair = (tag: "SameParty" | "DistinctParty", left: number, right: number) =>
  Proposition.cases[tag].make({ left: PartyId.make(left), right: PartyId.make(right) });
const key = (token: string) => PartyKey.make(`pk:v1:${Str.repeat(64)(token)}`);
const assignment = (party: number, token: string) =>
  Proposition.cases.KeyAssignment.make({ party: PartyId.make(party), key: key(token) });
const merge12 = pair("SameParty", 1, 2);
const first = partyClaim({ proposition: merge12, knowledgeStart: 1 });
const change = (proposition: Proposition, knowledgeStart: number, supersedes?: ClaimId) =>
  partyClaim({ proposition, knowledgeStart, supersedes, operation: `change-${knowledgeStart}` });
const survivorsOf = (ledger: ClaimLedgerData, asOf: number) =>
  A.map(resolveParties(ledger, scope(asOf)).representatives, (row) => row.survivor);
const append = Effect.fnUntraced(function* (row: PartyClaim | ClaimLedger) {
  const ledger = yield* PartyLedger;
  yield* ledger.append("ledger" in row ? row.ledger : row);
});
const refuses = Effect.fnUntraced(function* (row: ClaimLedger, reason: string) {
  const ledger = yield* PartyLedger;
  const failure = yield* ledger.append(row).pipe(Effect.flip);
  expect(failure.reason).toBe(reason);
});
const unchanged = Effect.fnUntraced(function* (expected: LedgerSnapshot) {
  const ledger = yield* PartyLedger;
  const current = yield* ledger.snapshot;
  expect(current).toEqual(expected);
});
const resolvedAt = Effect.fnUntraced(function* (asOf: number) {
  const ledger = yield* PartyLedger;
  const current = yield* ledger.snapshot;
  return resolveParties(current, scope(asOf));
});

describe("PartyLedgerMemory", () => {
  it.layer(Digest.layerWebCrypto)("generated identities", (it) => {
    it.effect.prop(
      "keeps generated claim identities intact through append and snapshot",
      [Proposition.cases.SameParty],
      ([proposition]) =>
        Effect.gen(function* () {
          const context = yield* Layer.build(PartyLedgerMemory);
          const ledger = Context.get(context, PartyLedger);
          const claim = yield* partyClaim({ proposition, knowledgeStart: 1 });
          yield* ledger.append(claim.ledger);
          const snapshot = yield* ledger.snapshot;
          return (
            snapshot.claims.length === 1 &&
            snapshot.claims[0]?.claim === claim.claim &&
            snapshot.claims[0]?.core.logicalKey === logicalKey(proposition)
          );
        }),
      { arbitrary: { runs: 100, seed: "party-ledger-endpoints" } }
    );
  });

  it.layer(LedgerLive)("allocation", (it) => {
    it.effect("allocates stable unique integer ids under concurrent requests", () =>
      Effect.gen(function* () {
        const ledger = yield* PartyLedger;
        const ids = yield* Effect.forEach(A.range(1, 20), () => ledger.allocatePartyId, { concurrency: 4 });
        expect(A.dedupe(ids)).toHaveLength(20);
        expect(A.min(ids, Order.Number)).toBe(1);
      })
    );
  });

  it.layer(LedgerLive)("history", (it) => {
    it.effect("retracts and supersedes by appending records while keeping historical snapshots intact", () =>
      Effect.gen(function* () {
        const ledger = yield* PartyLedger;
        const original = yield* first;
        yield* append(original);
        const before = yield* ledger.snapshot;
        expect(before.claims).toEqual([original.record]);
        yield* append(retraction({ claim: original.claim, at: 5 }));
        const after = yield* ledger.snapshot;
        expect(after.claims).toEqual([original.record]);
        expect(resolveParties(after, scope(4)).representatives).toHaveLength(2);
        expect(survivorsOf(after, 4)).toEqual([1, 1]);
        expect(resolveParties(after, scope(5)).reviewCases).toEqual([]);
        expect(A.map(resolveParties(after, scope(5)).representatives, (row) => [row.party, row.survivor])).toEqual([
          [1, 1],
          [2, 2],
        ]);
        const restored = yield* change(merge12, 9, original.claim);
        yield* append(restored);
        const final = yield* ledger.snapshot;
        expect(survivorsOf(final, 9)).toEqual([1, 1]);
        expect(resolveParties(final, scope(5))).toEqual(resolveParties(after, scope(5)));
        expect(A.map(final.claims, (row) => row.claim)).toEqual([original.claim, restored.claim]);
      })
    );
  });

  it.layer(LedgerLive)("conflicts", (it) => {
    it.effect("replays identical records once and rejects competing successors without partial writes", () =>
      Effect.gen(function* () {
        const ledger = yield* PartyLedger;
        const original = yield* first;
        yield* append(original);
        const once = yield* ledger.snapshot;
        yield* append(original);
        yield* unchanged(once);
        const next = yield* change(merge12, 5, original.claim);
        yield* append(next);
        const competing = yield* partyClaim({
          proposition: merge12,
          knowledgeStart: 5,
          supersedes: original.claim,
          operation: "competing",
        });
        yield* refuses(competing.ledger, "SupersessionFork");
        expect((yield* ledger.snapshot).claims).toHaveLength(2);
      })
    );
  });

  it.layer(LedgerLive)("integrity refusals", (it) => {
    it.effect("rejects malformed cores, generation receipts, orphan records and conflicting events", () =>
      Effect.gen(function* () {
        const ledger = yield* PartyLedger;
        const original = yield* first;
        yield* append(original);
        const before = yield* ledger.snapshot;
        const other = yield* change(pair("SameParty", 3, 4), 2);
        const forged = ClaimLedger.make({
          ...original.ledger,
          claims: [ClaimRecord.make({ claim: other.claim, core: original.record.core })],
        });
        yield* refuses(forged, "invalid-core");
        yield* refuses(ClaimLedger.make({ ...other.ledger, generations: [] }), "generation-required");
        yield* refuses(
          ClaimLedger.make({ ...other.ledger, generations: [other.generation, other.generation] }),
          "generation-required"
        );
        const late = ClaimGeneration.make({
          claim: other.claim,
          activity: activityStart({ operation: "late", started: 3 }),
          ended: at(2),
        });
        yield* refuses(ClaimLedger.make({ ...other.ledger, generations: [late] }), "generation-order");
        const foreign = ClaimGeneration.make({
          claim: other.claim,
          activity: activityStart({ operation: "foreign", started: 2 }),
          ended: at(2),
        });
        yield* refuses(ClaimLedger.make({ ...other.ledger, generations: [foreign] }), "generation-mismatch");
        const crossPartition = yield* change(pair("DistinctParty", 1, 2), 3, original.claim);
        yield* refuses(crossPartition.ledger, "SupersededAcrossPartitions");
        yield* refuses(
          ClaimLedger.make({
            reviews: [
              ClaimReviewRecord.make({ claim: other.claim, at: at(2), review: ReviewState.cases.Proposed.make({}) }),
            ],
          }),
          "unknown-claim"
        );
        const generatedBy = original.record.core.generatedBy;
        yield* refuses(
          ClaimLedger.make({
            challenges: [{ _tag: "ByActivity", from: other.claim, to: original.claim, kind: "rebut", generatedBy }],
          }),
          "unknown-claim"
        );
        yield* refuses(
          ClaimLedger.make({
            reviews: [
              ClaimReviewRecord.make({
                claim: original.claim,
                at: at(1),
                review: ReviewState.cases.Proposed.make({}),
              }),
            ],
          }),
          "conflicting-review"
        );
        yield* unchanged(before);
        const challenge = ClaimLedger.make({
          challenges: [{ _tag: "ByActivity", from: original.claim, to: original.claim, kind: "undercut", generatedBy }],
        });
        yield* append(challenge);
        yield* append(challenge);
        expect((yield* ledger.snapshot).challenges).toEqual(challenge.challenges);
      })
    );
  });
});

it.layer(LedgerLive)("key redirects and retractions", (it) => {
  it.effect("splits keys on retraction, restores merges, and replays historical views", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const keyA = yield* partyClaim({ proposition: assignment(1, "a"), knowledgeStart: 0, operation: "key-a" });
      const keyB = yield* partyClaim({ proposition: assignment(2, "b"), knowledgeStart: 0, operation: "key-b" });
      const original = yield* first;
      yield* append(keyA);
      yield* append(keyB);
      yield* append(original);
      const merged = yield* resolvedAt(1);
      expect(A.map(merged.keys, (row) => [row.party, row.survivor])).toEqual([
        [1, 1],
        [2, 1],
      ]);
      yield* append(retraction({ claim: original.claim, at: 5 }));
      const split = yield* resolvedAt(5);
      expect(A.map(split.keys, (row) => [row.party, row.survivor])).toEqual([
        [1, 1],
        [2, 2],
      ]);
      const restored = yield* change(merge12, 9, original.claim);
      yield* append(restored);
      const rows = yield* ledger.snapshot;
      expect(resolveParties(rows, scope(1))).toEqual(merged);
      expect(resolveParties(rows, scope(5))).toEqual(split);
      expect(A.map(resolveParties(rows, scope(9)).keys, (row) => row.survivor)).toEqual([1, 1]);
      const reversed = LedgerSnapshot.make({ ...rows, claims: A.reverse(rows.claims) });
      expect(resolveParties(reversed, scope(9))).toEqual(resolveParties(rows, scope(9)));
    })
  );
});

it.layer(LedgerLive)("veto retraction history", (it) => {
  it.effect("re-enables a blocked merge, then reapplies a restored veto", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const original = yield* first;
      const later = yield* change(pair("SameParty", 2, 3), 2);
      const veto = yield* change(pair("DistinctParty", 1, 3), 3);
      yield* append(original);
      yield* append(later);
      yield* append(veto);
      const blocked = yield* resolvedAt(3);
      expect(A.map(blocked.representatives, (row) => row.survivor)).toEqual([1, 1, 3]);
      expect(blocked.reviewCases[0]?.blockedClaim).toBe(later.claim);
      expect(blocked.reviewCases[0]?.vetoClaims).toEqual([veto.claim]);
      yield* append(retraction({ claim: veto.claim, at: 5 }));
      const enabled = yield* resolvedAt(5);
      expect(A.map(enabled.representatives, (row) => row.survivor)).toEqual([1, 1, 1]);
      expect(enabled.reviewCases).toEqual([]);
      const restored = yield* change(pair("DistinctParty", 1, 3), 7, veto.claim);
      yield* append(restored);
      const rows = yield* ledger.snapshot;
      expect(resolveParties(rows, scope(3))).toEqual(blocked);
      expect(resolveParties(rows, scope(5))).toEqual(enabled);
      expect(A.map(resolveParties(rows, scope(7)).representatives, (row) => row.survivor)).toEqual([1, 1, 3]);
      expect(resolveParties(rows, scope(7)).reviewCases[0]?.vetoClaims).toEqual([restored.claim]);
    })
  );
});

it.layer(LedgerLive)("corrected propositions and source history", (it) => {
  it.effect("records a correction as a retraction plus a new claim while retaining immutable source records", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const original = yield* first;
      yield* append(original);
      const replacement = yield* change(pair("DistinctParty", 1, 2), 5);
      yield* append(mergeClaimLedgers([retraction({ claim: original.claim, at: 5 }), replacement.ledger]));
      const rows = yield* ledger.snapshot;
      expect(survivorsOf(rows, 4)).toEqual([1, 1]);
      expect(survivorsOf(rows, 5)).toEqual([1, 2]);
      const anchor = { _tag: "HeaderField", occurrence: "party-occ:synthetic", namespace: "rfc5322", field: "From" };
      const observation = yield* S.decodeUnknownEffect(HeaderParticipant)({
        _tag: "HeaderParticipant",
        id: "party-obs:synthetic",
        producedBy: "party-act:ingest",
        observedAt: 0,
        event: "party-evt:synthetic",
        role: "from",
        identifier: "party-ident:synthetic",
        displayName: null,
        anchor,
      });
      const assertion = yield* S.decodeUnknownEffect(SourceAssertion)({
        id: "party-asrt:synthetic",
        proposition: original.record.core.proposition,
        stance: "asserts",
        anchors: [anchor],
        producedBy: "party-act:ingest",
        validTime: { _tag: "Unknown" },
        recordedAt: 0,
      });
      yield* ledger.recordObservation(observation);
      yield* ledger.recordAssertion(assertion);
      const before = yield* ledger.snapshot;
      yield* ledger.recordObservation(observation);
      yield* ledger.recordAssertion(assertion);
      yield* unchanged(before);
      const conflictingObservation = yield* ledger
        .recordObservation(HeaderParticipant.make({ ...observation, observedAt: at(9) }))
        .pipe(Effect.flip);
      expect(conflictingObservation.reason).toBe("conflicting-observation");
      const conflictingAssertion = yield* ledger
        .recordAssertion(SourceAssertion.make({ ...assertion, stance: "denies" }))
        .pipe(Effect.flip);
      expect(conflictingAssertion.reason).toBe("conflicting-assertion");
      const resolved1 = yield* ledger.snapshot;
      expect(resolved1).toEqual(before);
      expect(before.observations).toEqual([observation]);
      expect(before.assertions).toEqual([assertion]);
    })
  );
});

it.layer(LedgerLive)("atomic evidence batches", (it) => {
  it.effect("rolls back earlier categories and rows when a later record conflicts", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const original = yield* first;
      yield* append(original);
      const observation = yield* S.decodeEffect(HeaderParticipant)({
        _tag: "HeaderParticipant",
        id: "party-obs:batch",
        producedBy: "party-act:batch",
        observedAt: 0,
        event: "party-evt:batch",
        role: "from",
        identifier: "party-ident:batch",
        displayName: null,
        anchor: { _tag: "HeaderField", occurrence: "party-occ:batch", namespace: "rfc5322", field: "From" },
      });
      const before = yield* ledger.snapshot;
      const fresh = yield* change(pair("SameParty", 2, 3), 2);
      const fork = yield* partyClaim({ proposition: merge12, knowledgeStart: 3, supersedes: original.claim });
      const forkTwin = yield* partyClaim({
        proposition: merge12,
        knowledgeStart: 3,
        supersedes: original.claim,
        operation: "twin",
      });
      const failed = yield* ledger
        .appendEvidence(
          LedgerSnapshot.make({
            ...mergeClaimLedgers([fresh.ledger, fork.ledger, forkTwin.ledger]),
            observations: [observation],
            assertions: [],
          })
        )
        .pipe(Effect.flip);
      expect(failed.reason).toBe("SupersessionFork");
      yield* unchanged(before);
      const repeated = yield* ledger
        .appendEvidence(
          LedgerSnapshot.make({
            ...fresh.ledger,
            observations: [observation, HeaderParticipant.make({ ...observation, observedAt: at(1) })],
            assertions: [],
          })
        )
        .pipe(Effect.flip);
      expect(repeated.reason).toBe("conflicting-observation");
      yield* unchanged(before);
      yield* ledger.appendEvidence(
        LedgerSnapshot.make({ ...fresh.ledger, observations: [observation, observation], assertions: [] })
      );
      expect((yield* ledger.snapshot).observations).toHaveLength(1);
      expect((yield* ledger.snapshot).claims).toHaveLength(2);
    })
  );
});
