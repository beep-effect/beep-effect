import { ClaimVersion, SourceAssertion } from "@beep/party-domain/Claim";
import { HeaderParticipant } from "@beep/party-domain/Communication";
import { ClaimVersionId } from "@beep/party-domain/Ids";
import { PartyKey } from "@beep/party-domain/PartyKey";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import { ResolutionScope, resolveParties } from "@beep/party-domain/Resolution";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import { LedgerSnapshot, PartyLedger } from "@beep/party-use-cases/Ledger";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const absent = { _tag: "Absent", reason: "not-assessed" };
const proposition = Proposition.cases.SameParty.make({ left: PartyId.make(1), right: PartyId.make(2) });
const first = S.decodeUnknownEffect(ClaimVersion)({
  id: "party-cv:first",
  proposition,
  logicalKey: logicalKey(proposition),
  supportedBy: ["party-asrt:synthetic"],
  challengedBy: [],
  supersedes: null,
  knowledge: { recordedAt: 1, expiredAt: null },
  validTime: { _tag: "Interval", validFrom: 0, validTo: null },
  review: {
    _tag: "Accepted",
    disposition: {
      disposition: "accepted",
      reviewer: "party-user:test",
      basis: "1234567812345678123456781234567812345678123456781234567812345678",
      reviewedAt: 1,
      reason: "Synthetic review",
    },
  },
  signals: {
    sourceTrust: absent,
    sourceAssertedConfidence: absent,
    extractorConfidence: absent,
    validator: absent,
    reviewer: absent,
  },
});
const scope = (asOf: number) =>
  ResolutionScope.make({ asOf: DateTime.makeUnsafe(asOf), validAt: DateTime.makeUnsafe(0) });

describe("PartyLedgerMemory", () => {
  it.effect.prop(
    "keeps generated claim identities intact through append and snapshot",
    [Proposition.cases.SameParty],
    ([proposition]) =>
      Effect.gen(function* () {
        const context = yield* Layer.build(PartyLedgerMemory);
        const ledger = Context.get(context, PartyLedger);
        const original = yield* first;
        const claim = ClaimVersion.make({ ...original, proposition, logicalKey: logicalKey(proposition) });
        yield* ledger.append(claim);
        const snapshot = yield* ledger.snapshot;
        return snapshot.versions.length === 1 && snapshot.versions[0]?.logicalKey === logicalKey(proposition);
      }),
    { arbitrary: { runs: 100, seed: "party-ledger-endpoints" } }
  );

  it.layer(PartyLedgerMemory)("allocation", (it) => {
    it.effect("allocates stable unique integer ids under concurrent requests", () =>
      Effect.gen(function* () {
        const ledger = yield* PartyLedger;
        const ids = yield* Effect.forEach(A.range(1, 20), () => ledger.allocatePartyId, { concurrency: 4 });
        expect(A.dedupe(ids)).toHaveLength(20);
        expect(A.min(ids, Order.Number)).toBe(1);
      })
    );
  });

  it.layer(PartyLedgerMemory)("history", (it) => {
    it.effect("supersedes by appending and keeps historical snapshots intact", () =>
      Effect.gen(function* () {
        const ledger = yield* PartyLedger;
        const original = yield* first;
        yield* ledger.append(original);
        const before = yield* ledger.snapshot;
        const retraction = ClaimVersion.make({
          ...original,
          id: ClaimVersionId.make("party-cv:retracted"),
          supersedes: O.some(original.id),
          knowledge: { recordedAt: DateTime.makeUnsafe(5), expiredAt: O.none() },
          review: { _tag: "Retracted", at: DateTime.makeUnsafe(5), reason: "Mistaken match" },
        });
        yield* ledger.append(retraction);
        const after = yield* ledger.snapshot;
        TestUtils.assertNone(original.knowledge.expiredAt);
        expect(before.versions).toEqual([original]);
        expect(resolveParties(after.versions, scope(4)).representatives).toHaveLength(2);
        expect(resolveParties(after.versions, scope(5)).reviewCases).toEqual([]);
        expect(
          A.map(resolveParties(after.versions, scope(5)).representatives, (row) => [row.party, row.survivor])
        ).toEqual([
          [1, 1],
          [2, 2],
        ]);
        const restored = ClaimVersion.make({
          ...original,
          id: ClaimVersionId.make("party-cv:restored"),
          supersedes: O.some(retraction.id),
          knowledge: { recordedAt: DateTime.makeUnsafe(9), expiredAt: O.none() },
        });
        yield* ledger.append(restored);
        const final = yield* ledger.snapshot;
        expect(resolveParties(final.versions, scope(9)).representatives).toHaveLength(2);
        expect(resolveParties(final.versions, scope(5))).toEqual(resolveParties(after.versions, scope(5)));
      })
    );
  });

  it.layer(PartyLedgerMemory)("conflicts", (it) => {
    it.effect("rejects duplicates and competing successors without partial writes", () =>
      Effect.gen(function* () {
        const ledger = yield* PartyLedger;
        const original = yield* first;
        yield* ledger.append(original);
        expect((yield* ledger.append(original).pipe(Effect.flip)).reason).toBe("duplicate-version");
        const next = ClaimVersion.make({
          ...original,
          id: ClaimVersionId.make("party-cv:next"),
          supersedes: O.some(original.id),
          knowledge: { recordedAt: DateTime.makeUnsafe(5), expiredAt: O.none() },
        });
        yield* ledger.append(next);
        const competing = ClaimVersion.make({ ...next, id: ClaimVersionId.make("party-cv:competing") });
        expect((yield* ledger.append(competing).pipe(Effect.flip)).reason).toBe("predecessor-already-superseded");
        expect((yield* ledger.snapshot).versions).toHaveLength(2);
      })
    );
  });
});

const change = (
  original: ClaimVersion,
  id: string,
  proposition: Proposition,
  at: number,
  supersedes = O.none<ClaimVersionId>()
) =>
  ClaimVersion.make({
    ...original,
    id: ClaimVersionId.make(`party-cv:${id}`),
    proposition,
    logicalKey: logicalKey(proposition),
    supersedes,
    knowledge: { recordedAt: DateTime.makeUnsafe(at), expiredAt: O.none() },
  });
const retract = (original: ClaimVersion, id: string, at: number) =>
  ClaimVersion.make({
    ...change(original, id, original.proposition, at, O.some(original.id)),
    review: { _tag: "Retracted", at: DateTime.makeUnsafe(at), reason: "Synthetic correction" },
  });
const key = (token: string) => PartyKey.make(`pk:v1:${Str.repeat(64)(token)}`);
const assignment = (party: number, token: string) =>
  Proposition.cases.KeyAssignment.make({ party: PartyId.make(party), key: key(token) });
const pair = (tag: "SameParty" | "DistinctParty", left: number, right: number) =>
  Proposition.cases[tag].make({ left: PartyId.make(left), right: PartyId.make(right) });

it.layer(PartyLedgerMemory)("key redirects and retractions", (it) => {
  it.effect("splits keys on retraction, restores merges, and replays historical views", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const original = yield* first;
      yield* ledger.append(change(original, "key-a", assignment(1, "a"), 0));
      yield* ledger.append(change(original, "key-b", assignment(2, "b"), 0));
      yield* ledger.append(original);
      const merged = resolveParties((yield* ledger.snapshot).versions, scope(1));
      expect(A.map(merged.keys, (row) => [row.party, row.survivor])).toEqual([
        [1, 1],
        [2, 1],
      ]);
      const retracted = retract(original, "split", 5);
      yield* ledger.append(retracted);
      const split = resolveParties((yield* ledger.snapshot).versions, scope(5));
      expect(A.map(split.keys, (row) => [row.party, row.survivor])).toEqual([
        [1, 1],
        [2, 2],
      ]);
      yield* ledger.append(change(original, "restore", original.proposition, 9, O.some(retracted.id)));
      const rows = (yield* ledger.snapshot).versions;
      expect(resolveParties(rows, scope(1))).toEqual(merged);
      expect(resolveParties(rows, scope(5))).toEqual(split);
      expect(A.map(resolveParties(rows, scope(9)).keys, (row) => row.survivor)).toEqual([1, 1]);
      expect(resolveParties(A.reverse(rows), scope(9))).toEqual(resolveParties(rows, scope(9)));
    })
  );
});

it.layer(PartyLedgerMemory)("veto retraction history", (it) => {
  it.effect("re-enables a blocked merge, then reapplies a restored veto", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const original = yield* first;
      const later = change(original, "later", pair("SameParty", 2, 3), 2);
      const veto = change(original, "veto", pair("DistinctParty", 1, 3), 3);
      yield* ledger.append(original);
      yield* ledger.append(later);
      yield* ledger.append(veto);
      const blocked = resolveParties((yield* ledger.snapshot).versions, scope(3));
      expect(A.map(blocked.representatives, (row) => row.survivor)).toEqual([1, 1, 3]);
      expect(blocked.reviewCases[0]?.blockedClaim).toBe(later.id);
      expect(blocked.reviewCases[0]?.vetoClaims).toEqual([veto.id]);
      const withdrawn = retract(veto, "veto-withdrawn", 5);
      yield* ledger.append(withdrawn);
      const enabled = resolveParties((yield* ledger.snapshot).versions, scope(5));
      expect(A.map(enabled.representatives, (row) => row.survivor)).toEqual([1, 1, 1]);
      expect(enabled.reviewCases).toEqual([]);
      yield* ledger.append(change(veto, "veto-restored", veto.proposition, 7, O.some(withdrawn.id)));
      const rows = (yield* ledger.snapshot).versions;
      expect(resolveParties(rows, scope(3))).toEqual(blocked);
      expect(resolveParties(rows, scope(5))).toEqual(enabled);
      expect(A.map(resolveParties(rows, scope(7)).representatives, (row) => row.survivor)).toEqual([1, 1, 3]);
      expect(resolveParties(rows, scope(7)).reviewCases[0]?.vetoClaims).toEqual(["party-cv:veto-restored"]);
    })
  );
});

it.layer(PartyLedgerMemory)("corrected propositions and source history", (it) => {
  it.effect("allows a correction to change proposition while retaining immutable source records", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const original = yield* first;
      yield* ledger.append(original);
      const replacement = change(
        original,
        "different-proposition",
        pair("DistinctParty", 1, 2),
        5,
        O.some(original.id)
      );
      yield* ledger.append(replacement);
      const rows = (yield* ledger.snapshot).versions;
      expect(A.map(resolveParties(rows, scope(4)).representatives, (row) => row.survivor)).toEqual([1, 1]);
      expect(A.map(resolveParties(rows, scope(5)).representatives, (row) => row.survivor)).toEqual([1, 2]);
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
        proposition: original.proposition,
        stance: "asserts",
        anchors: [anchor],
        producedBy: "party-act:ingest",
        validTime: { _tag: "Unknown" },
        recordedAt: 0,
      });
      yield* ledger.recordObservation(observation);
      yield* ledger.recordAssertion(assertion);
      const before = yield* ledger.snapshot;
      expect((yield* ledger.recordObservation(observation).pipe(Effect.flip)).reason).toBe("duplicate-observation");
      expect((yield* ledger.recordAssertion(assertion).pipe(Effect.flip)).reason).toBe("duplicate-assertion");
      const resolved1 = yield* ledger.snapshot;
      expect(resolved1).toEqual(before);
      expect(before.observations).toEqual([observation]);
      expect(before.assertions).toEqual([assertion]);
    })
  );
});

it.layer(PartyLedgerMemory)("atomic evidence batches", (it) => {
  it.effect("rolls back earlier categories and rows when a later version conflicts", () =>
    Effect.gen(function* () {
      const ledger = yield* PartyLedger;
      const original = yield* first;
      yield* ledger.append(original);
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
      const fresh = change(original, "batch-fresh", pair("SameParty", 2, 3), 2);
      const failed = yield* ledger
        .appendEvidence(
          LedgerSnapshot.make({ observations: [observation], assertions: [], versions: [fresh, original] })
        )
        .pipe(Effect.flip);
      expect(failed.reason).toBe("duplicate-version");
      const resolved2 = yield* ledger.snapshot;
      expect(resolved2).toEqual(before);
      const repeated = yield* ledger
        .appendEvidence(
          LedgerSnapshot.make({ observations: [observation, observation], assertions: [], versions: [fresh] })
        )
        .pipe(Effect.flip);
      expect(repeated.reason).toBe("duplicate-observation");
      const resolved3 = yield* ledger.snapshot;
      expect(resolved3).toEqual(before);
      yield* ledger.appendEvidence(
        LedgerSnapshot.make({ observations: [observation], assertions: [], versions: [fresh] })
      );
      expect((yield* ledger.snapshot).observations).toHaveLength(1);
      expect((yield* ledger.snapshot).versions).toHaveLength(2);
    })
  );
});
