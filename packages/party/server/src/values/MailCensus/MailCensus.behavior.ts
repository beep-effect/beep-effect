/**
 * Pure census folding and count-only reporting over graduated mail evidence.
 * @packageDocumentation
 * @since 0.0.0
 */
import { isDelegated, Observation, voiceOf } from "@beep/party-domain/Communication";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { aggregatePairings, mailboxClusters, mailboxesOf } from "../IdentityEvidence/IdentityEvidence.behavior.ts";
import {
  MailboxClusterInput,
  MailboxGroupInput,
  NamedIdentifiers,
  PairingAggregationInput,
  PairingObservation,
} from "../IdentityEvidence/IdentityEvidence.model.ts";
import { ObservedSpan } from "../OrgEvidence/OrgEvidence.model.ts";
import {
  CensusHistogram,
  CensusSummary,
  DelegationCounts,
  ExchangeUnificationCounts,
  IdentifierCounts,
  MailCensus,
} from "./MailCensus.model.ts";
import type { MailIngest } from "../MailIndex/MailIndex.model.ts";

/**
 * Create an empty immutable census.
 * **Example** (Start a census)
 * ```ts
 * import { emptyCensus } from "@beep/party-server/MailCensus"
 * const census = emptyCensus()
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const emptyCensus = (): MailCensus =>
  MailCensus.make({
    rows: 0,
    decodeFailures: 0,
    events: 0,
    delegatedEvents: 0,
    issues: HashMap.empty(),
    identifierKinds: HashMap.empty(),
    namesByIdentifier: HashMap.empty(),
    identifiersByName: HashMap.empty(),
    smtpByDn: HashMap.empty(),
    dnBySmtp: HashMap.empty(),
    delegatedVoices: HashSet.empty(),
    pairingObservations: HashMap.empty(),
    identifierSpans: HashMap.empty(),
  });

const addTo = <K, V>(map: HashMap.HashMap<K, HashSet.HashSet<V>>, key: K, value: V) =>
  HashMap.set(map, key, HashSet.add(O.getOrElse(HashMap.get(map, key), HashSet.empty<V>), value));

/**
 * Count an undecodable source row without retaining its private payload.
 * **Example** (Count a rejected row)
 * ```ts
 * import { emptyCensus, recordDecodeFailure } from "@beep/party-server/MailCensus"
 * recordDecodeFailure(emptyCensus())
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const recordDecodeFailure = (census: MailCensus): MailCensus =>
  MailCensus.make({ ...census, rows: census.rows + 1, decodeFailures: census.decodeFailures + 1 });

/**
 * Fold one adapted row, returning a new census while preserving prior snapshots.
 * **Details**
 * Rows and events count ingestion attempts. Identifier and voice counts are
 * distinct; pairing support independently counts distinct messages. Only
 * display-name indexing normalizes whitespace and case. It never merges parties.
 * **Example** (Use a census fold)
 * ```ts
 * import { observe } from "@beep/party-server/MailCensus"
 * const fold = observe
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const observe: {
  (ingest: MailIngest): (census: MailCensus) => MailCensus;
  (census: MailCensus, ingest: MailIngest): MailCensus;
} = dual(2, (census: MailCensus, ingest: MailIngest): MailCensus => {
  let issues = census.issues;
  let identifierKinds = census.identifierKinds;
  let namesByIdentifier = census.namesByIdentifier;
  let identifiersByName = census.identifiersByName;
  let smtpByDn = census.smtpByDn;
  let dnBySmtp = census.dnBySmtp;
  let pairingObservations = census.pairingObservations;
  let identifierSpans = census.identifierSpans;
  A.forEach(ingest.issues, (issue) => {
    issues = HashMap.set(issues, issue._tag, O.getOrElse(HashMap.get(issues, issue._tag), () => 0) + 1);
  });
  A.forEach(ingest.identifiers, (identifier) => {
    identifierKinds = HashMap.set(identifierKinds, identifier.id, identifier.value._tag);
  });
  A.forEach(ingest.observations, (observation) => {
    if (!Observation.guards.HeaderParticipant(observation)) return;
    O.map(observation.displayName, (name) => {
      const key = Str.trim(Str.replace(/\s+/g, " ")(Str.toLowerCase(name)));
      if (!Str.isNonEmpty(key)) return;
      namesByIdentifier = addTo(namesByIdentifier, observation.identifier, key);
      identifiersByName = addTo(identifiersByName, key, observation.identifier);
    });
  });
  const sentAt = O.flatMap(ingest.event, (event) => event.sentAt);
  O.map(sentAt, (time) => {
    A.forEach(ingest.identifiers, (identifier) => {
      const prior = O.getOrElse(HashMap.get(identifierSpans, identifier.id), () =>
        ObservedSpan.make({ first: time, last: time })
      );
      identifierSpans = HashMap.set(
        identifierSpans,
        identifier.id,
        ObservedSpan.make({
          first: DateTime.toEpochMillis(time) < DateTime.toEpochMillis(prior.first) ? time : prior.first,
          last: DateTime.toEpochMillis(time) > DateTime.toEpochMillis(prior.last) ? time : prior.last,
        })
      );
    });
  });
  A.forEach(ingest.pairings, (pairing) => {
    smtpByDn = addTo(smtpByDn, pairing.exchangeDn, pairing.smtp);
    dnBySmtp = addTo(dnBySmtp, pairing.smtp, pairing.exchangeDn);
    pairingObservations = HashMap.set(
      pairingObservations,
      pairing.assertion,
      PairingObservation.make({ pairing, sentAt })
    );
  });
  const voice = O.map(ingest.event, voiceOf);
  const delegated = O.filter(voice, isDelegated);
  return MailCensus.make({
    ...census,
    rows: census.rows + 1,
    events: census.events + (O.isSome(ingest.event) ? 1 : 0),
    delegatedEvents: census.delegatedEvents + (O.isSome(delegated) ? 1 : 0),
    delegatedVoices: O.match(delegated, {
      onNone: () => census.delegatedVoices,
      onSome: (value) => HashSet.add(census.delegatedVoices, value.id),
    }),
    issues,
    identifierKinds,
    namesByIdentifier,
    identifiersByName,
    smtpByDn,
    dnBySmtp,
    pairingObservations,
    identifierSpans,
  });
});

const sizes = <K, V>(map: HashMap.HashMap<K, HashSet.HashSet<V>>) =>
  pipe(map, HashMap.values, A.fromIterable, A.map(HashSet.size));
const histogram = (values: ReadonlyArray<number>) =>
  CensusHistogram.make({
    "1": A.length(A.filter(values, (value) => value === 1)),
    "2": A.length(A.filter(values, (value) => value === 2)),
    "3-5": A.length(A.filter(values, (value) => value >= 3 && value <= 5)),
    "6+": A.length(A.filter(values, (value) => value >= 6)),
    max: A.reduce(values, 0, (max, value) => (value > max ? value : max)),
  });

/**
 * Expose private display-name evidence for review-case construction.
 * **Example** (Read an empty name index)
 * ```ts
 * import { emptyCensus, identifiersByName } from "@beep/party-server/MailCensus"
 * identifiersByName(emptyCensus())
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const identifiersByName = (census: MailCensus): ReadonlyArray<NamedIdentifiers> =>
  A.sort(
    A.map(A.fromIterable(census.identifiersByName), ([name, identifiers]) =>
      NamedIdentifiers.make({ name, identifiers: A.sort(A.fromIterable(identifiers), Order.String) })
    ),
    Order.mapInput(Order.String, (value: NamedIdentifiers) => value.name)
  );

/**
 * Extract deterministic pairing support with the census's five-message sample.
 * **Example** (Read an empty pairing summary)
 * ```ts
 * import { emptyCensus, pairingSupport } from "@beep/party-server/MailCensus"
 * pairingSupport(emptyCensus())
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const pairingSupport = (census: MailCensus) =>
  aggregatePairings(
    PairingAggregationInput.make({
      observations: pipe(census.pairingObservations, HashMap.values, A.fromIterable),
      sampleSize: 5,
    })
  );

/**
 * Build a count-only summary; no evidence names, addresses or ids are exported.
 * **Example** (Summarize an empty census)
 * ```ts
 * import { emptyCensus, summarize } from "@beep/party-server/MailCensus"
 * summarize(emptyCensus())
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const summarize = (census: MailCensus): CensusSummary => {
  const kinds = A.fromIterable(census.identifierKinds);
  const dns = A.filter(kinds, ([, kind]) => kind === "ExchangeDn");
  const pairedDns = A.filter(dns, ([id]) => HashMap.has(census.smtpByDn, id));
  const clusters = mailboxClusters(
    MailboxClusterInput.make({ identifiers: A.map(kinds, ([id]) => id), supports: pairingSupport(census) })
  );
  const collisions = A.filter(
    identifiersByName(census),
    (named) => A.length(mailboxesOf(MailboxGroupInput.make({ identifiers: named.identifiers, clusters }))) > 1
  );
  return CensusSummary.make({
    rows: census.rows,
    decodeFailures: census.decodeFailures,
    events: census.events,
    issues: R.fromEntries(census.issues),
    identifiers: IdentifierCounts.make({
      total: A.length(kinds),
      email: A.length(A.filter(kinds, ([, kind]) => kind === "EmailAddress")),
      exchangeDn: A.length(dns),
    }),
    displayNames: HashMap.size(census.identifiersByName),
    displayNamesPerIdentifier: pipe(census.namesByIdentifier, sizes, histogram),
    identifiersPerDisplayName: pipe(census.identifiersByName, sizes, histogram),
    exchangeUnification: ExchangeUnificationCounts.make({
      dnsWithSmtpPairing: A.length(pairedDns),
      dnsWithoutPairing: A.length(dns) - A.length(pairedDns),
      dnsPairedToMultipleSmtp: pipe(
        census.smtpByDn,
        sizes,
        A.filter((size) => size > 1),
        A.length
      ),
      smtpPairedToMultipleDns: pipe(
        census.dnBySmtp,
        sizes,
        A.filter((size) => size > 1),
        A.length
      ),
    }),
    delegation: DelegationCounts.make({
      delegatedEvents: census.delegatedEvents,
      distinctDelegatedVoices: HashSet.size(census.delegatedVoices),
    }),
    nameEqualityCollisionRisk: A.length(collisions),
  });
};
