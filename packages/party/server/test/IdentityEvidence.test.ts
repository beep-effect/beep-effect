import { AccountId, AssertionId, EventId, IdentifierId } from "@beep/party-domain/Ids";
import {
  aggregatePairings,
  CardIdentifier,
  CollisionInput,
  cardMergeProposals,
  classifyDrift,
  MailboxClusterInput,
  MailboxGroupInput,
  mailboxClusters,
  mailboxesOf,
  NamedIdentifiers,
  observedSpan,
  PairingAggregationInput,
  PairingClaimsInput,
  PairingObservation,
  PairingSupport,
  pairingClaims,
  resolveCollisions,
} from "@beep/party-server/IdentityEvidence";
import { AliasPairing } from "@beep/party-server/MailIndex";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const dn = IdentifierId.make("party-ident:dn");
const smtp = IdentifierId.make("party-ident:smtp");
const other = IdentifierId.make("party-ident:other");
const isolated = IdentifierId.make("party-ident:isolated");
const support = PairingSupport.make({
  mailbox: AccountId.make("party-acct:test"),
  exchangeDn: dn,
  smtp,
  messages: 1,
  firstSeen: O.none(),
  lastSeen: O.none(),
  sample: [],
  assertions: [],
});
const clusters = mailboxClusters(MailboxClusterInput.make({ identifiers: [dn, smtp, other], supports: [support] }));
const card = (id: number, source: string, kind: CardIdentifier["kind"] = "EmailAddress", identifier = smtp) =>
  CardIdentifier.make({ identifier, kind, card: PartyId.make(id), source });
const contacts = (left: ReadonlyArray<number>, right: ReadonlyArray<number>) =>
  HashMap.make(
    [dn, HashSet.fromIterable(A.map(left, (id) => PartyId.make(id)))],
    [other, HashSet.fromIterable(A.map(right, (id) => PartyId.make(id)))]
  );
const outcome = (left: ReadonlyArray<number>, right: ReadonlyArray<number>) =>
  resolveCollisions(
    CollisionInput.make({
      identifiersByName: [NamedIdentifiers.make({ name: "Alex", identifiers: [smtp, dn, other] })],
      clusters,
      contactsOf: contacts(left, right),
    })
  );

describe("mailbox components", () => {
  it("joins paired identifiers while retaining isolated and unindexed identifiers", () => {
    expect(HashMap.get(clusters, dn)).toEqual(HashMap.get(clusters, smtp));
    expect(HashMap.get(clusters, dn)).not.toEqual(HashMap.get(clusters, other));
    const groups = mailboxesOf(MailboxGroupInput.make({ identifiers: [smtp, isolated, other, dn, dn], clusters }));
    expect(groups).toHaveLength(3);
    expect(groups).toContainEqual([dn, smtp]);
    expect(groups).toContainEqual([isolated]);
  });
  it("keeps component labels stable when evidence order changes", () => {
    const reversed = mailboxClusters(
      MailboxClusterInput.make({ identifiers: [other, smtp, dn], supports: [support, support] })
    );
    A.forEach([dn, smtp, other], (id) => expect(HashMap.get(reversed, id)).toEqual(HashMap.get(clusters, id)));
  });
  it("classifies all five contact evidence outcomes", () => {
    expect(A.map(outcome([], []), (row) => row.outcome)).toEqual(["unresolved"]);
    expect(A.map(outcome([1], []), (row) => row.outcome)).toEqual(["partially-resolved"]);
    expect(A.map(outcome([1], [1]), (row) => row.outcome)).toEqual(["same-person"]);
    expect(A.map(outcome([1], [2]), (row) => row.outcome)).toEqual(["distinct-people"]);
    expect(A.map(outcome([1, 2], [1]), (row) => row.outcome)).toEqual(["conflicting-contacts"]);
  });
  it("does not create a collision for aliases in one mailbox", () => {
    expect(
      resolveCollisions(
        CollisionInput.make({
          identifiersByName: [NamedIdentifiers.make({ name: "Alex", identifiers: [smtp, dn] })],
          clusters,
          contactsOf: HashMap.empty(),
        })
      )
    ).toEqual([]);
  });
});

describe("conservative source-card proposals", () => {
  it("forms a stable numeric chain across three independent sources", () => {
    const rows = [card(10, "c"), card(2, "a"), card(3, "b")];
    expect(A.map(cardMergeProposals(rows), (row) => [row.left, row.right])).toEqual([
      [2, 3],
      [3, 10],
    ]);
    expect(cardMergeProposals(A.reverse(rows))).toEqual(cardMergeProposals(rows));
  });
  it("suppresses phone, single-source and ambiguous-source evidence", () => {
    expect(cardMergeProposals([card(1, "a", "PhoneNumber"), card(2, "b", "PhoneNumber")])).toEqual([]);
    expect(cardMergeProposals([card(1, "a"), card(2, "a")])).toEqual([]);
    expect(cardMergeProposals([card(1, "a"), card(2, "a"), card(3, "b")])).toEqual([]);
  });
  it("deduplicates repeated evidence without inventing sources or self-merges", () => {
    expect(cardMergeProposals([card(1, "a"), card(1, "a")])).toEqual([]);
    expect(cardMergeProposals([card(1, "a"), card(1, "b")])).toEqual([]);
    expect(cardMergeProposals([card(1, "a"), card(1, "a"), card(2, "b")])).toHaveLength(1);
    expect(cardMergeProposals([card(1, "a"), card(1, "b"), card(2, "b")])).toEqual([]);
  });
  it("orders multiple identifier candidates deterministically", () => {
    const rows = [
      card(1, "a", "EmailAddress", smtp),
      card(2, "b", "EmailAddress", smtp),
      card(1, "a", "EmailAddress", other),
      card(3, "b", "EmailAddress", other),
    ];
    expect(cardMergeProposals(rows)).toEqual(cardMergeProposals(A.reverse(rows)));
  });
});

const timedSupport = (id: string, first: number, last: number) =>
  PairingSupport.make({
    ...support,
    exchangeDn: IdentifierId.make(`party-ident:${id}`),
    firstSeen: O.some(DateTime.makeUnsafe(first)),
    lastSeen: O.some(DateTime.makeUnsafe(last)),
  });
const driftKinds = (supports: ReadonlyArray<PairingSupport>) => A.map(classifyDrift(supports), (row) => row.kind);
describe("observed mailbox drift", () => {
  it("uses numeric time for sequential migration and inclusive bounds for concurrency", () => {
    expect(driftKinds([timedSupport("a", 2, 9), timedSupport("b", 10, 20)])).toEqual(["sequential-migration"]);
    expect(driftKinds([timedSupport("a", 2, 9), timedSupport("b", 9, 20)])).toEqual(["concurrent-aliases"]);
  });
  it("preserves undated uncertainty without hiding known overlap", () => {
    expect(driftKinds([support, timedSupport("b", 2, 9)])).toEqual(["undated"]);
    expect(driftKinds([support, timedSupport("b", 2, 9), timedSupport("c", 3, 4)])).toEqual(["concurrent-aliases"]);
  });
  it("requires distinct DNs and counts a repeated DN once", () => {
    expect(classifyDrift([support, support])).toEqual([]);
    expect(A.map(classifyDrift([support, support, timedSupport("b", 2, 9)]), (row) => row.dns)).toEqual([2]);
  });
  it("rejects reversed or partial observation bounds", () => {
    const base = {
      mailbox: "party-acct:test",
      exchangeDn: "party-ident:dn",
      smtp: "party-ident:smtp",
      messages: 1,
      sample: [],
      assertions: [],
    };
    pipe(
      S.decodeResult(PairingSupport)({ ...base, firstSeen: 4, lastSeen: 3 }),
      Result.isFailure,
      TestUtils.assertTrue
    );
    pipe(
      S.decodeResult(PairingSupport)({ ...base, firstSeen: 4, lastSeen: null }),
      Result.isFailure,
      TestUtils.assertTrue
    );
    pipe(
      S.decodeResult(PairingSupport)({ ...base, firstSeen: 4, lastSeen: 4 }),
      Result.isSuccess,
      TestUtils.assertTrue
    );
  });
});

const pairingObservation = (event: string, assertion: string, time: O.Option<number>, identifier = smtp) =>
  PairingObservation.make({
    pairing: AliasPairing.make({
      mailbox: support.mailbox,
      exchangeDn: dn,
      smtp: identifier,
      displayName: "Alex",
      role: "from",
      event: EventId.make(`party-evt:${event}`),
      assertion: AssertionId.make(`party-asrt:${assertion}`),
    }),
    sentAt: O.map(time, DateTime.makeUnsafe),
  });
describe("pairing support aggregation", () => {
  it("counts distinct messages and retains real assertions for bounded samples", () => {
    const first = pairingObservation("a", "a", O.some(10));
    const rows = [
      pairingObservation("b", "b", O.some(2)),
      first,
      first,
      pairingObservation("a", "reextract", O.some(10)),
    ];
    const result = aggregatePairings(PairingAggregationInput.make({ observations: rows, sampleSize: 1 }));
    expect(result).toHaveLength(1);
    const value = O.getOrThrow(A.head(result));
    expect(value.messages).toBe(2);
    expect(value.sample).toEqual([EventId.make("party-evt:a")]);
    expect(value.assertions).toEqual([AssertionId.make("party-asrt:a"), AssertionId.make("party-asrt:reextract")]);
    TestUtils.assertSome(O.map(value.firstSeen, DateTime.toEpochMillis), 2);
    TestUtils.assertSome(O.map(value.lastSeen, DateTime.toEpochMillis), 10);
    expect(aggregatePairings(PairingAggregationInput.make({ observations: A.reverse(rows), sampleSize: 1 }))).toEqual(
      result
    );
  });
  it("honors a zero sample and preserves undated support", () => {
    const result = aggregatePairings(
      PairingAggregationInput.make({ observations: [pairingObservation("a", "a", O.none())], sampleSize: 0 })
    );
    const value = O.getOrThrow(A.head(result));
    expect(value.messages).toBe(1);
    expect(value.sample).toEqual([]);
    expect(value.assertions).toEqual([]);
    TestUtils.assertNone(value.firstSeen);
    TestUtils.assertNone(value.lastSeen);
  });
  it("keeps different pairs separate and stable across input order", () => {
    const rows = [pairingObservation("a", "a", O.none()), pairingObservation("a", "b", O.none(), other)];
    const first = aggregatePairings(PairingAggregationInput.make({ observations: rows, sampleSize: 2 }));
    expect(first).toHaveLength(2);
    expect(aggregatePairings(PairingAggregationInput.make({ observations: A.reverse(rows), sampleSize: 2 }))).toEqual(
      first
    );
  });
});

describe("pairing claim proposals", () => {
  it.prop(
    "preserves inclusive observation endpoints across generated millisecond spans",
    [
      S.Tuple([
        S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 })),
        S.Int.check(S.isBetween({ minimum: 0, maximum: 1000000 })),
      ]),
    ],
    ([[a, b]]) => {
      const first = Math.min(a, b);
      const last = Math.max(a, b);
      const interval = observedSpan(timedSupport("generated", first, last));
      return (
        interval._tag === "Interval" &&
        DateTime.toEpochMillis(interval.validFrom) === first &&
        O.getOrElse(O.map(interval.validTo, DateTime.toEpochMillis), () => -1) === last + 1
      );
    },
    { arbitrary: { runs: 100, seed: "party-observation-spans" } }
  );
  it("includes the last observed millisecond and preserves single-instant evidence", () => {
    const interval = observedSpan(timedSupport("a", 2, 9));
    expect(interval._tag).toBe("Interval");
    if (interval._tag === "Interval") {
      expect(DateTime.toEpochMillis(interval.validFrom)).toBe(2);
      TestUtils.assertSome(O.map(interval.validTo, DateTime.toEpochMillis), 10);
    }
    const instant = observedSpan(timedSupport("a", 9, 9));
    if (instant._tag === "Interval") {
      expect(DateTime.toEpochMillis(instant.validFrom)).toBe(9);
      TestUtils.assertSome(O.map(instant.validTo, DateTime.toEpochMillis), 10);
    } else throw new Error("Expected a one-millisecond interval");
    expect(observedSpan(support)._tag).toBe("Unknown");
  });
  it("handles the maximum representable observation without a throwing date conversion", () => {
    const interval = observedSpan(timedSupport("a", 8640000000000000, 8640000000000000));
    expect(interval._tag).toBe("Interval");
    if (interval._tag === "Interval") TestUtils.assertNone(interval.validTo);
  });
  it("emits no claim without sampled assertions and keeps supported claims proposed", () => {
    const recordedAt = DateTime.makeUnsafe(100);
    expect(pairingClaims(PairingClaimsInput.make({ supports: [support], recordedAt }))).toEqual([]);
    const backed = PairingSupport.make({ ...support, assertions: [AssertionId.make("party-asrt:a")] });
    const claims = pairingClaims(PairingClaimsInput.make({ supports: [backed], recordedAt }));
    const claim = O.getOrThrow(A.head(claims));
    expect(claim.review._tag).toBe("Proposed");
    expect(claim.proposition).toMatchObject({ _tag: "AccountIdentifier", account: support.mailbox, identifier: smtp });
    expect(claim.supportedBy).toEqual(backed.assertions);
    expect(claim.validTime._tag).toBe("Unknown");
  });
  it("binds immutable version identity to evidence, observation bounds and knowledge time", () => {
    const a = AssertionId.make("party-asrt:a");
    const b = AssertionId.make("party-asrt:b");
    const backed = PairingSupport.make({ ...timedSupport("a", 2, 9), assertions: [b, a] });
    const build = (value: PairingSupport, time = 100) =>
      O.getOrThrow(
        A.head(pairingClaims(PairingClaimsInput.make({ supports: [value], recordedAt: DateTime.makeUnsafe(time) })))
      );
    const original = build(backed);
    expect(build(PairingSupport.make({ ...backed, assertions: [a, b, a] }))).toEqual(original);
    expect(build(PairingSupport.make({ ...backed, assertions: [a] })).id).not.toBe(original.id);
    expect(build(PairingSupport.make({ ...backed, lastSeen: O.some(DateTime.makeUnsafe(10)) })).id).not.toBe(
      original.id
    );
    expect(build(backed, 101).id).not.toBe(original.id);
  });
});
