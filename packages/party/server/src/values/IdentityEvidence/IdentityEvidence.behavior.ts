/**
 * Mailbox components and conservative contact-card reconciliation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ValidTime } from "@beep/epistemics/Claim";
import { ClaimVersion, EvidenceSignals } from "@beep/party-domain/Claim";
import { ClaimVersionId } from "@beep/party-domain/Ids";
import { logicalKey, Proposition } from "@beep/party-domain/Proposition";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Tuple from "effect/Tuple";
import {
  CardMergeProposal,
  Collision,
  CollisionOutcome,
  DriftEvidence,
  DriftKind,
  MailboxGroupInput,
  PairingSupport,
} from "./IdentityEvidence.model.ts";
import type { AccountId, IdentifierId } from "@beep/party-domain/Ids";
import type { PartyId } from "@beep/shared-domain/identity/Party";
import type {
  CardIdentifier,
  CollisionInput,
  MailboxClusterInput,
  PairingAggregationInput,
  PairingClaimsInput,
} from "./IdentityEvidence.model.ts";

/**
 * Derive review-only mailbox components using Graph.connectedComponents.
 * **Details**
 * Input identifiers are sorted so component labels do not depend on ingestion
 * order. These labels never become PartyIds and cannot authorize person merges.
 * **Example** (Build mailbox components)
 * ```ts
 * import { mailboxClusters } from "@beep/party-server/IdentityEvidence"
 * const cluster = mailboxClusters
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const mailboxClusters = (input: MailboxClusterInput): HashMap.HashMap<IdentifierId, number> => {
  const identifiers = pipe(
    input.identifiers,
    A.appendAll(A.flatMap(input.supports, (support) => [support.exchangeDn, support.smtp])),
    A.dedupe,
    A.sort(Order.String)
  );
  let index = HashMap.empty<IdentifierId, Graph.NodeIndex>();
  const graph = Graph.undirected<IdentifierId, AccountId>((mutable) => {
    A.forEach(identifiers, (identifier) => {
      index = HashMap.set(index, identifier, Graph.addNode(mutable, identifier));
    });
    A.forEach(input.supports, (support) => {
      const endpoints = O.all([HashMap.get(index, support.exchangeDn), HashMap.get(index, support.smtp)]);
      O.map(endpoints, ([left, right]) => Graph.addEdge(mutable, left, right, support.mailbox));
    });
  });
  return pipe(
    Graph.connectedComponents(graph),
    A.flatMap((component, cluster) =>
      A.flatMap(component, (node) =>
        O.toArray(O.map(Graph.getNode(graph, node), (identifier) => Tuple.make(identifier, cluster)))
      )
    ),
    HashMap.fromIterable
  );
};

/**
 * Group one name's identifiers by mailbox, preserving unpaired identifiers.
 * **Example** (Group named identifiers)
 * ```ts
 * import { mailboxesOf } from "@beep/party-server/IdentityEvidence"
 * const group = mailboxesOf
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const mailboxesOf = (input: MailboxGroupInput): ReadonlyArray<A.NonEmptyReadonlyArray<IdentifierId>> =>
  R.values(
    A.groupBy(A.sort(A.dedupe(input.identifiers), Order.String), (identifier) =>
      O.match(HashMap.get(input.clusters, identifier), {
        onNone: () => `identifier:${identifier}`,
        onSome: (cluster) => `cluster:${cluster}`,
      })
    )
  );

/**
 * Classify name collisions against source-card evidence without emitting identity claims.
 * **Example** (Build a collision review queue)
 * ```ts
 * import { resolveCollisions } from "@beep/party-server/IdentityEvidence"
 * const classify = resolveCollisions
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const resolveCollisions = (input: CollisionInput): ReadonlyArray<Collision> =>
  A.flatMap(input.identifiersByName, (named) => {
    const mailboxes = mailboxesOf(MailboxGroupInput.make({ identifiers: named.identifiers, clusters: input.clusters }));
    if (A.length(mailboxes) < 2) return [];
    const contacts = A.map(mailboxes, (identifiers) =>
      A.reduce(identifiers, HashSet.empty<PartyId>(), (acc, identifier) =>
        HashSet.union(acc, O.getOrElse(HashMap.get(input.contactsOf, identifier), HashSet.empty<PartyId>))
      )
    );
    const sizes = A.map(contacts, HashSet.size);
    const parties = A.dedupe(A.flatMap(contacts, A.fromIterable));
    const outcome = A.some(sizes, (size) => size > 1)
      ? CollisionOutcome.Enum["conflicting-contacts"]
      : A.every(sizes, (size) => size === 0)
        ? CollisionOutcome.Enum.unresolved
        : A.some(sizes, (size) => size === 0)
          ? CollisionOutcome.Enum["partially-resolved"]
          : A.length(parties) === 1
            ? CollisionOutcome.Enum["same-person"]
            : CollisionOutcome.Enum["distinct-people"];
    return [Collision.make({ name: named.name, mailboxes, outcome })];
  });

/**
 * Propose only emails listed on one card per source across multiple sources.
 * **Details**
 * Phones never found a merge. Repeated evidence rows do not add independent
 * sources. Ambiguity in any source suppresses the proposal. Numeric PartyId
 * ordering makes the output stable under replay and avoids self-merges.
 * **Example** (Find conservative card candidates)
 * ```ts
 * import { cardMergeProposals } from "@beep/party-server/IdentityEvidence"
 * cardMergeProposals([])
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const cardMergeProposals = (rows: ReadonlyArray<CardIdentifier>): ReadonlyArray<CardMergeProposal> =>
  A.flatMap(
    A.sort(
      R.values(A.groupBy(rows, (row) => row.identifier)),
      Order.mapInput(Order.String, (group: A.NonEmptyReadonlyArray<CardIdentifier>) => A.headNonEmpty(group).identifier)
    ),
    (group: A.NonEmptyReadonlyArray<CardIdentifier>) => {
      const evidence = A.dedupeWith(group, (left, right) => left.card === right.card && left.source === right.source);
      const perSource = R.values(A.groupBy(evidence, (row) => row.source));
      const eligible =
        A.every(group, (row) => row.kind === "EmailAddress") &&
        A.length(perSource) >= 2 &&
        A.every(perSource, (source) => A.length(source) === 1);
      if (!eligible) return [];
      const cards = A.sort(A.dedupe(A.map(evidence, (row) => row.card)), Order.Number);
      return A.map(A.zip(cards, A.drop(cards, 1)), ([left, right]) =>
        CardMergeProposal.make({ identifier: A.headNonEmpty(group).identifier, left, right })
      );
    }
  );

/**
 * Classify temporal drift across distinct DNs without accepting mailbox identity.
 * **Details**
 * Inclusive observation bounds overlap at a shared endpoint. Known overlap
 * takes precedence over undated evidence. Repeated rows of the same DN never
 * create a drift lead by themselves.
 * **Example** (Find temporal review leads)
 * ```ts
 * import { classifyDrift } from "@beep/party-server/IdentityEvidence"
 * classifyDrift([])
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const classifyDrift = (supports: ReadonlyArray<PairingSupport>): ReadonlyArray<DriftEvidence> =>
  A.flatMap(R.values(A.groupBy(supports, (support) => support.smtp)), (group) => {
    const dns = HashSet.size(HashSet.fromIterable(A.map(group, (support) => support.exchangeDn)));
    if (dns < 2) return [];
    const overlaps = A.some(group, (left, index) =>
      A.some(A.drop(group, index + 1), (right) => {
        if (left.exchangeDn === right.exchangeDn) return false;
        return O.match(O.all([left.firstSeen, left.lastSeen, right.firstSeen, right.lastSeen]), {
          onNone: () => false,
          onSome: ([leftFirst, leftLast, rightFirst, rightLast]) =>
            DateTime.toEpochMillis(leftFirst) <= DateTime.toEpochMillis(rightLast) &&
            DateTime.toEpochMillis(rightFirst) <= DateTime.toEpochMillis(leftLast),
        });
      })
    );
    const kind = overlaps
      ? DriftKind.Enum["concurrent-aliases"]
      : A.some(group, (support: PairingSupport) => O.isNone(support.firstSeen) || O.isNone(support.lastSeen))
        ? DriftKind.Enum.undated
        : DriftKind.Enum["sequential-migration"];
    return [DriftEvidence.make({ smtp: A.headNonEmpty(group).smtp, kind, dns })];
  });

/**
 * Aggregate source-backed pairings with deterministic bounded message samples.
 * **Details**
 * Counts distinct messages, not duplicate rows or repeated extractions. The
 * sample preserves all assertion references for its selected messages. Numeric
 * time bounds cover all observations, independently of the bounded sample.
 * **Example** (Aggregate no observations)
 * ```ts
 * import { aggregatePairings, PairingAggregationInput } from "@beep/party-server/IdentityEvidence"
 * aggregatePairings(PairingAggregationInput.make({ observations: [], sampleSize: 5 }))
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const aggregatePairings = (input: PairingAggregationInput): ReadonlyArray<PairingSupport> => {
  const groups = R.values(
    A.groupBy(
      input.observations,
      ({ pairing }) =>
        `${pairing.mailbox.length}:${pairing.mailbox}${pairing.exchangeDn.length}:${pairing.exchangeDn}${pairing.smtp.length}:${pairing.smtp}`
    )
  );
  const result = A.map(groups, (group) => {
    const first = A.headNonEmpty(group).pairing;
    const events = A.sort(A.dedupe(A.map(group, (row) => row.pairing.event)), Order.String);
    const sample = A.take(events, input.sampleSize);
    const assertions = A.sort(
      A.dedupe(A.flatMap(group, (row) => (A.contains(sample, row.pairing.event) ? [row.pairing.assertion] : []))),
      Order.String
    );
    const times = A.sort(
      A.flatMap(group, (row) => O.toArray(O.map(row.sentAt, DateTime.toEpochMillis))),
      Order.Number
    );
    return PairingSupport.make({
      mailbox: first.mailbox,
      exchangeDn: first.exchangeDn,
      smtp: first.smtp,
      messages: A.length(events),
      sample,
      assertions,
      firstSeen: O.map(A.head(times), DateTime.makeUnsafe),
      lastSeen: O.map(A.last(times), DateTime.makeUnsafe),
    });
  });
  return A.sort(
    result,
    Order.mapInput(
      Order.String,
      (support: PairingSupport) =>
        `${support.mailbox.length}:${support.mailbox}${support.exchangeDn.length}:${support.exchangeDn}${support.smtp.length}:${support.smtp}`
    )
  );
};

/**
 * Represent inclusive observed milliseconds as a proposed half-open validity span.
 * **Details**
 * This span is evidence of observation, not proof of continuous ownership.
 * A reviewer must assess it before acceptance. The last observed millisecond
 * is included by advancing the exclusive endpoint one millisecond; at the
 * maximum representable instant the endpoint is open. Undated support stays unknown.
 * **Example** (Use observed pairing bounds)
 * ```ts
 * import { observedSpan } from "@beep/party-server/IdentityEvidence"
 * const span = observedSpan
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const observedSpan = (support: PairingSupport): ValidTime =>
  O.match(O.all([support.firstSeen, support.lastSeen]), {
    onNone: () => ValidTime.cases.Unknown.make({}),
    onSome: ([first, last]) =>
      ValidTime.cases.Interval.make({
        validFrom: first,
        validTo: DateTime.make(DateTime.toEpochMillis(last) + 1),
      }),
  });

/**
 * Propose account-identifier claims backed by sampled source assertions.
 * **Details**
 * Empty evidence produces no claim. Claims remain Proposed and never merge
 * people. Version identity includes the exact assertion set, observed bounds
 * and knowledge time so changed evidence cannot reuse an immutable version id.
 * **Example** (Build pairing proposals)
 * ```ts
 * import { pairingClaims } from "@beep/party-server/IdentityEvidence"
 * const propose = pairingClaims
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const pairingClaims = (input: PairingClaimsInput): ReadonlyArray<ClaimVersion> => {
  const absent = EvidenceSignals.fields.sourceTrust.cases.Absent.make({ reason: "not-assessed" });
  const signals = EvidenceSignals.make({
    sourceTrust: absent,
    sourceAssertedConfidence: absent,
    extractorConfidence: absent,
    validator: absent,
    reviewer: absent,
  });
  return A.flatMap(input.supports, (support) => {
    const assertions = A.sort(A.dedupe(support.assertions), Order.String);
    if (!A.isArrayNonEmpty(assertions)) return [];
    const proposition = Proposition.cases.AccountIdentifier.make({
      account: support.mailbox,
      identifier: support.smtp,
    });
    const key = logicalKey(proposition);
    const frame = (value: string) => `${value.length}:${value}`;
    const bound = (value: O.Option<DateTime.Utc>) =>
      O.match(value, { onNone: () => "unknown", onSome: (time) => `${DateTime.toEpochMillis(time)}` });
    const identity = A.join(
      A.map(
        [
          key,
          `${DateTime.toEpochMillis(input.recordedAt)}`,
          bound(support.firstSeen),
          bound(support.lastSeen),
          ...assertions,
        ],
        frame
      ),
      ""
    );
    return [
      ClaimVersion.make({
        id: ClaimVersionId.make(`party-cv:pairing:${encodeURIComponent(identity)}`),
        proposition,
        logicalKey: key,
        supportedBy: assertions,
        challengedBy: [],
        supersedes: O.none(),
        knowledge: { recordedAt: input.recordedAt, expiredAt: O.none() },
        validTime: observedSpan(support),
        review: { _tag: "Proposed" },
        signals,
      }),
    ];
  });
};
