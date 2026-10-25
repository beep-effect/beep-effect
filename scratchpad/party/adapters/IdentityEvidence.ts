/**
 * From alias pairings and contact cards to identity claims, drift intervals,
 * and a collision review queue.
 *
 * Three pure steps:
 *
 * 1. **Pairing support.** Every same-message X.500↔SMTP pairing is a
 *    source-local observation. Support aggregates per pair: message count,
 *    first and last time seen, sample events. Each pair becomes one *Proposed*
 *    `AccountIdentifier` claim version whose valid time is the observed span.
 *    That span is a lower bound on validity, not the validity itself.
 * 2. **Drift.** An SMTP address paired to several DNs is classified as a
 *    sequential migration (pairwise-disjoint observed spans, i.e. valid-time
 *    successors), concurrent aliases (overlapping spans), or undated.
 * 3. **Collisions.** Identifiers are clustered into mailboxes with
 *    `Graph.connectedComponents` over pairing edges. A display name spanning
 *    ≥ 2 mailboxes is then checked against client-file contact evidence:
 *    same person, distinct people, conflicting contacts, partially or wholly
 *    unresolved. Only the unresolved ones go to human review.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { LiteralKit } from "@beep/schema";
import * as A from "@beep/utils/Array";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import { ClaimVersion, ReviewState } from "../Claim.ts";
import { AssertionId, ClaimVersionId } from "../Ids.ts";
import type { AccountId, EventId, IdentifierId, PartyId } from "../Ids.ts";
import { logicalKey, Proposition } from "../Proposition.ts";
import { TemporalExtent, UtcInstant } from "../Time.ts";
import type { AliasPairing } from "./MailIndex.ts";

// ---------------------------------------------------------------------------
// 1. Pairing support → claims
// ---------------------------------------------------------------------------

/**
 * Aggregated support for one X.500↔SMTP pair.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export interface PairingSupport {
  readonly mailbox: AccountId;
  readonly exchangeDn: IdentifierId;
  readonly smtp: IdentifierId;
  readonly messages: number;
  readonly firstSeen: O.Option<UtcInstant>;
  readonly lastSeen: O.Option<UtcInstant>;
  readonly sample: ReadonlyArray<EventId>;
}

/**
 * Mutable per-pair accumulator keyed by `dn|smtp`.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export type PairingAccumulator = MutableHashMap.MutableHashMap<string, PairingSupport>;

const minInstant = (a: O.Option<UtcInstant>, b: O.Option<UtcInstant>) =>
  O.match(a, {
    onNone: () => b,
    onSome: (x) => O.some(O.match(b, {
      onNone: () => x,
      onSome: (y) => (y < x ? y : x),
    })),
  });
const maxInstant = (a: O.Option<UtcInstant>, b: O.Option<UtcInstant>) =>
  O.match(a, {
    onNone: () => b,
    onSome: (x) => O.some(O.match(b, {
      onNone: () => x,
      onSome: (y) => (y > x ? y : x),
    })),
  });

/**
 * Fold one pairing (with its message time) into the accumulator.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const accumulatePairing = ({
                                    acc,
                                    pairing,
                                    sentAt,
                                    sampleSize,
                                  }: {
  readonly acc: PairingAccumulator;
  readonly pairing: AliasPairing;
  readonly sentAt: O.Option<UtcInstant>;
  readonly sampleSize: number;
}): void => {
  const key = `${pairing.exchangeDn}|${pairing.smtp}`;
  const next = O.match(MutableHashMap.get(acc, key), {
    onNone: (): PairingSupport => ({
      mailbox: pairing.mailbox,
      exchangeDn: pairing.exchangeDn,
      smtp: pairing.smtp,
      messages: 1,
      firstSeen: sentAt,
      lastSeen: sentAt,
      sample: [pairing.event],
    }),
    onSome: (s): PairingSupport => ({
      ...s,
      messages: s.messages + 1,
      firstSeen: minInstant(s.firstSeen, sentAt),
      lastSeen: maxInstant(s.lastSeen, sentAt),
      sample: A.length(s.sample) < sampleSize ? A.append(s.sample, pairing.event) : s.sample,
    }),
  });
  MutableHashMap.set(acc, key, next);
};

/**
 * Observed span of a pair as a valid-time lower bound.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const observedSpan = (s: PairingSupport): TemporalExtent =>
  O.match(O.all([s.firstSeen, s.lastSeen]), {
    onNone: (): TemporalExtent => TemporalExtent.cases.Unknown.make({}),
    onSome: ([from, to]): TemporalExtent => (from < to ? TemporalExtent.cases.Interval.make({
      from,
      to,
    }) : TemporalExtent.cases.Instant.make({ at: from })),
  });

/**
 * One Proposed `AccountIdentifier` claim version per SMTP address of each
 * Exchange mailbox (the DN itself identifies the mailbox). Support ids point
 * at per-message assertions named after the sampled events.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const pairingClaims = ({
                                supports,
                                recordedAt,
                              }: {
  readonly supports: ReadonlyArray<PairingSupport>;
  readonly recordedAt: UtcInstant;
}): ReadonlyArray<ClaimVersion> =>
  A.flatMap(supports, (s) =>
    A.matchLeft(s.sample, {
      onEmpty: A.emptyReadonly,
      onNonEmpty: (first, rest) => {
        const proposition = Proposition.cases.AccountIdentifier.make({
          account: s.mailbox,
          identifier: s.smtp,
        });
        const key = logicalKey(proposition);
        const absent = {
          _tag: "Absent" as const,
          reason: "not-assessed" as const,
        };
        return [
          {
            id: ClaimVersionId.make(`cv:${encodeURIComponent(key)}`),
            logicalKey: key,
            proposition,
            supportedBy: A.map(A.prepend(rest, first), (e) => AssertionId.make(`asrt:pairing:${e}`)),
            challengedBy: [],
            validTime: observedSpan(s),
            knowledge: { recordedAt, expiredAt: O.none() },
            supersedes: O.none(),
            review: ReviewState.cases.Proposed.make({}),
            signals: {
              sourceTrust: absent,
              sourceAssertedConfidence: absent,
              extractorConfidence: absent,
              validator: absent,
              reviewer: absent,
            },
          },
        ];
      },
    }),
  );

// ---------------------------------------------------------------------------
// 2. Drift
// ---------------------------------------------------------------------------

/**
 * How an SMTP address paired to several DNs drifted.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const DriftKind = LiteralKit(["sequential-migration", "concurrent-aliases", "undated"]);
export type DriftKind = typeof DriftKind.Type;

const spanBounds = (s: PairingSupport) => O.all([s.firstSeen, s.lastSeen]);

/**
 * Classify every SMTP address paired to more than one DN.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const classifyDrift = (supports: ReadonlyArray<PairingSupport>): ReadonlyArray<{
  readonly smtp: IdentifierId;
  readonly kind: DriftKind;
  readonly dns: number;
}> => {
  const bySmtp = A.groupBy(supports, (s) => s.smtp);
  return A.flatMap(R.values(bySmtp), (group) => {
    if (A.length(group) < 2) return [];
    const bounds = A.flatMap(group, (s) => O.toArray(spanBounds(s)));
    const kind: DriftKind =
      A.length(bounds) < A.length(group)
        ? "undated"
        : pipe(
          A.sort(bounds, Order.mapInput(Order.String, ([from]: readonly [UtcInstant, UtcInstant]) => from)),
          (sorted) => A.every(A.zip(sorted, A.drop(sorted, 1)), ([[, endA], [startB]]) => endA < startB),
        )
          ? "sequential-migration"
          : "concurrent-aliases";
    return [{ smtp: A.headNonEmpty(group).smtp, kind, dns: A.length(group) }];
  });
};

// ---------------------------------------------------------------------------
// 3. Mailbox clusters and collision resolution
// ---------------------------------------------------------------------------

/**
 * Mailbox clusters: identifiers joined by pairing edges, as connected
 * components of an undirected `effect/Graph`. Returns identifier → cluster id.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const mailboxClusters = ({
                                  identifiers,
                                  supports,
                                }: {
  readonly identifiers: Iterable<IdentifierId>;
  readonly supports: ReadonlyArray<PairingSupport>;
}): HashMap.HashMap<IdentifierId, number> => {
  let index = HashMap.empty<IdentifierId, Graph.NodeIndex>();
  const graph = Graph.undirected<IdentifierId, AccountId>((g) => {
    const node = (i: IdentifierId) =>
      O.getOrElse(HashMap.get(index, i), () => {
        const n = Graph.addNode(g, i);
        index = HashMap.set(index, i, n);
        return n;
      });
    A.forEach(A.fromIterable(identifiers), (i) => {
      node(i);
    });
    A.forEach(supports, (s) => {
      Graph.addEdge(g, node(s.exchangeDn), node(s.smtp), s.mailbox);
    });
  });
  return pipe(
    Graph.connectedComponents(graph),
    A.flatMap((component, cluster) =>
      A.flatMap(component, (n) => O.toArray(O.map(Graph.getNode(graph, n), (i) => [i, cluster] as const))),
    ),
    HashMap.fromIterable,
  );
};

/**
 * Outcome for one display name that spans several mailboxes.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const CollisionOutcome = LiteralKit([
  "same-person",
  "distinct-people",
  "conflicting-contacts",
  "partially-resolved",
  "unresolved",
]);
export type CollisionOutcome = typeof CollisionOutcome.Type;

/**
 * Group one name's identifiers by mailbox cluster.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const mailboxesOf = ({
                              identifiers,
                              clusters,
                            }: {
  readonly identifiers: ReadonlyArray<IdentifierId>;
  readonly clusters: HashMap.HashMap<IdentifierId, number>;
}): ReadonlyArray<A.NonEmptyReadonlyArray<IdentifierId>> =>
  R.values(
    A.groupBy(identifiers, (i) =>
      O.match(HashMap.get(clusters, i), {
        onNone: () => `identifier:${i}`,
        onSome: (c) => `cluster:${c}`,
      }),
    ),
  );

/**
 * Resolve name collisions against client-file contact evidence. `contactsOf`
 * maps an identifier to the contact-card parties that list it.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const resolveCollisions = ({
                                    identifiersByName,
                                    clusters,
                                    contactsOf,
                                  }: {
  readonly identifiersByName: ReadonlyArray<readonly [string, ReadonlyArray<IdentifierId>]>;
  readonly clusters: HashMap.HashMap<IdentifierId, number>;
  readonly contactsOf: HashMap.HashMap<IdentifierId, HashSet.HashSet<PartyId>>;
}): ReadonlyArray<{
  readonly name: string;
  readonly mailboxes: ReadonlyArray<A.NonEmptyReadonlyArray<IdentifierId>>;
  readonly outcome: CollisionOutcome;
}> =>
  A.flatMap(identifiersByName, ([name, identifiers]) => {
    const mailboxes = mailboxesOf({ identifiers, clusters });
    if (A.length(mailboxes) < 2) return [];
    const sizes = A.map(mailboxes, (ids) =>
      HashSet.size(
        A.reduce(ids, HashSet.empty<PartyId>(), (acc, i) =>
          HashSet.union(acc, O.getOrElse(HashMap.get(contactsOf, i), () => HashSet.empty<PartyId>())),
        ),
      ),
    );
    const parties = A.dedupe(
      A.flatMap(mailboxes, (ids) =>
        A.flatMap(ids, (i) => A.fromIterable(O.getOrElse(HashMap.get(contactsOf, i), () => HashSet.empty<PartyId>()))),
      ),
    );
    const outcome: CollisionOutcome = A.some(sizes, (n) => n > 1)
      ? "conflicting-contacts"
      : A.every(sizes, (n) => n === 0)
        ? "unresolved"
        : A.some(sizes, (n) => n === 0)
          ? "partially-resolved"
          : A.length(parties) === 1
            ? "same-person"
            : "distinct-people";
    return [{ name, mailboxes, outcome }];
  });

// ---------------------------------------------------------------------------
// 4. Contact-card reconciliation
// ---------------------------------------------------------------------------

/**
 * One personal identifier listed on one contact card.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export interface CardIdentifier {
  readonly identifier: IdentifierId;
  readonly kind: "EmailAddress" | "PhoneNumber" | "other";
  readonly card: PartyId;
  readonly source: string;
}

/**
 * Conservative card-merge proposals. Only an **email** listed by at most one
 * card per source, across at least two sources, proposes `SameParty` (the
 * same person exported by several systems). An identifier that one source
 * lists on two cards is shared (team inbox, ambiguous duplicate); phones
 * never found a merge (office lines). Those behave as shared-template
 * evidence, never as identity.
 *
 * @category identity-evidence
 * @since 0.0.0
 */
export const cardMergeProposals = (
  rows: ReadonlyArray<CardIdentifier>,
): ReadonlyArray<{
  readonly identifier: IdentifierId;
  readonly left: PartyId;
  readonly right: PartyId
}> =>
  A.flatMap(R.values(A.groupBy(rows, (r) => r.identifier)), (group) => {
    const cards = A.dedupeWith(group, (a, b) => a.card === b.card);
    const perSource = R.values(A.groupBy(cards, (c) => c.source));
    const eligible =
      A.every(cards, (c) => c.kind === "EmailAddress") &&
      A.length(perSource) >= 2 &&
      A.every(perSource, (cs) => A.length(cs) === 1);
    return eligible
      ? A.map(A.zip(cards, A.drop(cards, 1)), ([a, b]) => ({
        identifier: a.identifier,
        left: a.card,
        right: b.card,
      }))
      : [];
  });
