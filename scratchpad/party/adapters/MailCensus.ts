/**
 * Aggregate census over adapted mail rows. Output is counts only, never names
 * or addresses, so a census of a confidential corpus can be shared safely.
 *
 * It measures exactly what the party model claims to fix:
 *
 * - alias spread: identifiers per display name, display names per identifier,
 * - X.500 ↔ SMTP unification rate from same-message pairings,
 * - delegation: messages whose composing sender differs from the represented mailbox,
 * - name-collision risk: display names a name-equality merger would collapse
 *   across mailboxes that no pairing links,
 * - parser hazards as issue counts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { isDelegated, Observation, voiceOf } from "../Communication.ts";
import type { IdentifierId } from "../Ids.ts";
import type { UtcInstant } from "../Time.ts";
import type { PairingAccumulator } from "./IdentityEvidence.ts";
import { accumulatePairing, mailboxClusters } from "./IdentityEvidence.ts";
import type { MailIngest } from "./MailIndex.ts";
import * as HashMap from "effect/HashMap";
import { thunk0, thunkUndefined } from "@beep/utils";

/**
 * Mutable accumulator; feed it with `observe`, read it with `summarize`.
 *
 * @category census
 * @since 0.0.0
 */
export interface MailCensus {
  rows: number;
  decodeFailures: number;
  events: number;
  delegatedEvents: number;
  readonly issues: MutableHashMap.MutableHashMap<string, number>;
  readonly identifierKinds: MutableHashMap.MutableHashMap<IdentifierId, string>;
  readonly namesByIdentifier: MutableHashMap.MutableHashMap<IdentifierId, MutableHashSet.MutableHashSet<string>>;
  readonly identifiersByName: MutableHashMap.MutableHashMap<string, MutableHashSet.MutableHashSet<IdentifierId>>;
  readonly smtpByDn: MutableHashMap.MutableHashMap<string, MutableHashSet.MutableHashSet<string>>;
  readonly dnBySmtp: MutableHashMap.MutableHashMap<string, MutableHashSet.MutableHashSet<string>>;
  readonly delegatedVoices: MutableHashSet.MutableHashSet<string>;
  readonly pairingSupport: PairingAccumulator;
  /** First and last message time each identifier was seen in any header role. */
  readonly identifierSpans: MutableHashMap.MutableHashMap<IdentifierId, readonly [UtcInstant, UtcInstant]>;
}

/**
 * A fresh census.
 *
 * @category census
 * @since 0.0.0
 */
export const emptyCensus = (): MailCensus => ({
  rows: 0,
  decodeFailures: 0,
  events: 0,
  delegatedEvents: 0,
  issues: MutableHashMap.empty(),
  identifierKinds: MutableHashMap.empty(),
  namesByIdentifier: MutableHashMap.empty(),
  identifiersByName: MutableHashMap.empty(),
  smtpByDn: MutableHashMap.empty(),
  dnBySmtp: MutableHashMap.empty(),
  delegatedVoices: MutableHashSet.empty(),
  pairingSupport: MutableHashMap.empty(),
  identifierSpans: MutableHashMap.empty(),
});

const addTo = <K, V>(map: MutableHashMap.MutableHashMap<K, MutableHashSet.MutableHashSet<V>>, key: K, value: V) =>
  O.match(MutableHashMap.get(map, key), {
    onNone: () => {
      MutableHashMap.set(map, key, MutableHashSet.make(value));
    },
    onSome: (set) => {
      MutableHashSet.add(set, value);
    },
  });

const bump = (map: MutableHashMap.MutableHashMap<string, number>, key: string) =>
  MutableHashMap.set(map, key, O.getOrElse(MutableHashMap.get(map, key), thunk0) + 1);

/**
 * Fold one adapted row into the census.
 *
 * @category census
 * @since 0.0.0
 */
export const observe = ({ census, ingest }: {
  readonly census: MailCensus;
  readonly ingest: MailIngest
}): void => {
  census.rows += 1;
  A.forEach(ingest.issues, (i) => bump(census.issues, i._tag));
  A.forEach(ingest.identifiers, (i) => {
    MutableHashMap.set(census.identifierKinds, i.id, i._tag);
  });
  A.forEach(ingest.observations, (o) => {
    if (!Observation.guards.HeaderParticipant(o)) return;
    O.match(o.displayName, {
      onNone: thunkUndefined,
      onSome: (name) => {
        const key = pipe(name, Str.toLowerCase, Str.replace(/\s+/g, " "), Str.trim);
        addTo(census.namesByIdentifier, o.identifier, key);
        addTo(census.identifiersByName, key, o.identifier);
      },
    });
  });
  const sentAt = O.flatMap(ingest.event, (e) => e.sentAt);
  O.match(sentAt, {
    onNone: thunkUndefined,
    onSome: (t) =>
      A.forEach(ingest.identifiers, (i) => {
        const [first, last] = O.getOrElse(MutableHashMap.get(census.identifierSpans, i.id), () => [t, t] as const);
        MutableHashMap.set(census.identifierSpans, i.id, [t < first ? t : first, t > last ? t : last] as const);
      }),
  });
  A.forEach(ingest.pairings, (p) => {
    addTo(census.smtpByDn, p.exchangeDn, p.smtp);
    addTo(census.dnBySmtp, p.smtp, p.exchangeDn);
    accumulatePairing({
      acc: census.pairingSupport,
      pairing: p,
      sentAt,
      sampleSize: 5,
    });
  });
  O.match(ingest.event, {
    onNone: thunkUndefined,
    onSome: (event) => {
      census.events += 1;
      const voice = voiceOf(event);
      if (isDelegated(voice)) {
        census.delegatedEvents += 1;
        MutableHashSet.add(census.delegatedVoices, voice.id);
      }
    },
  });
};

const sizes = <K, V>(map: MutableHashMap.MutableHashMap<K, MutableHashSet.MutableHashSet<V>>) =>
  pipe(map, MutableHashMap.values, A.fromIterable, A.map(MutableHashSet.size));

const histogram = (ns: ReadonlyArray<number>) => ({
  "1": A.length(A.filter(ns, (n) => n === 1)),
  "2": A.length(A.filter(ns, (n) => n === 2)),
  "3-5": A.length(A.filter(ns, (n) => n >= 3 && n <= 5)),
  "6+": A.length(A.filter(ns, (n) => n >= 6)),
  max: A.reduce(ns, 0, (m, n) => (n > m ? n : m)),
});

/**
 * Display name → identifiers seen under it, as branded ids.
 *
 * @category census
 * @since 0.0.0
 */
export const identifiersByName = (census: MailCensus): ReadonlyArray<readonly [string, ReadonlyArray<IdentifierId>]> =>
  pipe(
    census.identifiersByName,
    A.fromIterable,
    A.map(([name, ids]) => [name, A.sort(A.fromIterable(ids), Order.String)] as const),
  );

/**
 * Count-only summary of a census.
 *
 * @category census
 * @since 0.0.0
 */
export const summarize = (census: MailCensus) => {
  const kindEntries: ReadonlyArray<readonly [IdentifierId, string]> = A.fromIterable(census.identifierKinds);
  const dns = A.filter(kindEntries, ([, k]) => k === "ExchangeDn");
  const pairedDns = A.filter(dns, ([id]) => MutableHashMap.has(census.smtpByDn, id));

  const clusters = mailboxClusters({
    identifiers: A.map(kindEntries, ([id]) => id),
    supports: pipe(census.pairingSupport, MutableHashMap.values, A.fromIterable),
  });
  const nameCollisions = pipe(
    identifiersByName(census),
    A.filter(([, ids]) =>
      pipe(
        ids,
        A.map((i) => HashMap.get(clusters, i)),
        A.dedupeWith((x, y) => O.getOrUndefined(x) === O.getOrUndefined(y)),
        A.length,
      ) > 1,
    ),
    A.length,
  );
  const issueEntries: ReadonlyArray<readonly [string, number]> = A.fromIterable(census.issues);

  return {
    rows: census.rows,
    decodeFailures: census.decodeFailures,
    events: census.events,
    issues: R.fromEntries(issueEntries),
    identifiers: {
      total: A.length(kindEntries),
      email: A.length(A.filter(kindEntries, ([, k]) => k === "EmailAddress")),
      exchangeDn: A.length(dns),
    },
    displayNames: MutableHashMap.size(census.identifiersByName),
    displayNamesPerIdentifier: histogram(pipe(census.namesByIdentifier, sizes)),
    identifiersPerDisplayName: histogram(pipe(census.identifiersByName, sizes)),
    exchangeUnification: {
      dnsWithSmtpPairing: A.length(pairedDns),
      dnsWithoutPairing: A.length(dns) - A.length(pairedDns),
      dnsPairedToMultipleSmtp: A.length(A.filter(pipe(census.smtpByDn, sizes), (n) => n > 1)),
      smtpPairedToMultipleDns: A.length(A.filter(pipe(census.dnBySmtp, sizes), (n) => n > 1)),
    },
    delegation: {
      delegatedEvents: census.delegatedEvents,
      distinctDelegatedVoices: MutableHashSet.size(census.delegatedVoices),
    },
    nameEqualityCollisionRisk: nameCollisions,
  };
};
