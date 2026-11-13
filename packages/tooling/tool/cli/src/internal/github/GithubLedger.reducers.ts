/**
 * Pure reducers of the GitHub budget ledger: identity and cost of an
 * observation, readings, the reserve signal, lanes, windows, hourly usage,
 * per-operation costs, rollups and the summary.
 *
 * **Details**
 *
 * Headers report the fleet-wide bucket after a response, not one request's
 * cost. One bucket key can hold several concurrent buckets (lanes), such as
 * two credentials of one login. Hourly usage therefore telescopes `used` per
 * lane and reset epoch, per-command points come from a minimum-positive
 * same-process estimator, and everything the host did not attribute is the
 * `unattributed` remainder.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { CredentialFingerprint } from "@beep/github/Resilience";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  ANONYMOUS_IDENTITY,
  BucketKey,
  BucketReading,
  bucketKeyString,
  CommandSpend,
  canonicalIdentity,
  DEFAULT_COMMAND_LABEL,
  fileKeyOf,
  GhSubcommand,
  GithubIdentityLabel,
  GithubLedgerRow,
  LedgerAnchor,
  LedgerHourCell,
  LedgerHourKey,
  LedgerHourRollup,
  LedgerSummary,
  LedgerWindow,
  OperationCost,
  RESERVE_READING_BOUND,
  ReserveSignal,
  ReserveState,
  reserveFloor,
  sourceOfRow,
  UNRESOLVED_IDENTITY,
  UnattributedSpend,
} from "./GithubLedger.schemas.ts";
import type { GitHubRateLimitResource, RateLimitObservation } from "@beep/github/Resilience";
import type {
  CalibrationRow,
  GhSpawnRow,
  GithubLedgerCommandLabel,
  GithubOperation,
  HostLabel,
  IdentityAliases,
  ReserveUnknownReason,
  SampleRow,
  TransportRow,
  WindowAnchor,
} from "./GithubLedger.schemas.ts";

/**
 * Stable physical credential key, with a source-specific fallback for old rows.
 *
 * **Example** (Inspect the key helper)
 *
 * ```ts
 * import { credentialKeyOf } from "@beep/repo-cli/test/SharedInternals"
 * console.log(typeof credentialKeyOf) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const credentialKeyOf = (row: TransportRow | SampleRow | GhSpawnRow): string =>
  O.getOrElse(row.credential, () => (row._tag === "Sample" ? `sample:${row.identity}` : `pid:${row.pid}`));

const isFingerprint = S.is(CredentialFingerprint);

const HOUR_MILLIS = Duration.toMillis(Duration.hours(1));
const EPOCH_JITTER_MILLIS = Duration.toMillis(Duration.seconds(5));
const CALIBRATION_LOOKBACK_MILLIS = Duration.toMillis(Duration.days(7));
const CALIBRATION_MIN_PAIRS = 6;
const CALIBRATION_MAX_DRIFT = 50;
const OPERATION_MIN_CANDIDATES = 3;
const SUMMARY_SPENDERS = 10;

const millis = DateTime.toEpochMillis;
const utc = (epochMillis: number): DateTime.Utc => DateTime.makeUnsafe(epochMillis);

/**
 * The row identity of an observation, from its credential and budget label.
 *
 * **Details**
 *
 * `unauthenticated` is `anonymous`; `app-jwt` with an `app:` label is that
 * label plus `/jwt`; `token` with a known `token:` alias is its owner, with any
 * other valid label is that label; everything else is `unresolved`.
 *
 * **Example** (Label an unauthenticated observation)
 *
 * ```ts
 * import { RateLimitObservation, RateLimitSnapshot } from "@beep/github/Resilience"
 * import { emptyIdentityAliases, identityOfObservation } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const observation = RateLimitObservation.make({
 *   snapshot: RateLimitSnapshot.make({ remaining: 59, limit: 60, resetEpochSeconds: 1 }),
 *   budgetLabel: O.none(), credential: "unauthenticated", operation: "GET /zen",
 *   kind: "rest", status: 200, outcome: "ok", at: DateTime.makeUnsafe(0)
 * })
 * console.log(identityOfObservation(observation, emptyIdentityAliases)) // "anonymous"
 * ```
 *
 * @param observation - The driver's observation.
 * @param aliases - The alias map.
 * @returns The canonical row identity.
 * @category utilities
 * @since 0.0.0
 */
export const identityOfObservation: {
  (aliases: IdentityAliases): (observation: RateLimitObservation) => GithubIdentityLabel;
  (observation: RateLimitObservation, aliases: IdentityAliases): GithubIdentityLabel;
} = dual(2, (observation: RateLimitObservation, aliases: IdentityAliases): GithubIdentityLabel => {
  const label = O.flatMap(observation.budgetLabel, S.decodeUnknownOption(GithubIdentityLabel));
  return observation.credential === "unauthenticated"
    ? ANONYMOUS_IDENTITY
    : observation.credential === "app-jwt"
      ? pipe(
          label,
          O.filter((value) => /^app:\d+\/\d+$/.test(value)),
          O.flatMap((value) => GithubIdentityLabel.makeOption(`${value}/jwt`)),
          O.getOrElse(() => UNRESOLVED_IDENTITY)
        )
      : pipe(
          label,
          O.map(canonicalIdentity(aliases)),
          O.getOrElse(() => UNRESOLVED_IDENTITY)
        );
});

/**
 * The nominal cost fixed at record time: 0 for a 304, for `GET /rate_limit`
 * and for a primary `rate-limited` refusal; 1 otherwise (GraphQL's floor).
 *
 * **Example** (Price a free read)
 *
 * ```ts
 * import { nominalCostOf } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(nominalCostOf({ status: 200, outcome: "ok", operation: "GET /rate_limit" })) // 0
 * console.log(nominalCostOf({ status: 200, outcome: "ok", operation: "GET /user" })) // 1
 * ```
 *
 * @param attempt - The attempt's status, outcome and normalised operation.
 * @returns The nominal cost.
 * @category utilities
 * @since 0.0.0
 */
export const nominalCostOf = (attempt: {
  readonly status: number;
  readonly outcome: RateLimitObservation["outcome"];
  readonly operation: string;
}): number =>
  attempt.status === 304 || attempt.outcome === "rate-limited" || attempt.operation === "GET /rate_limit" ? 0 : 1;

/**
 * The bucket reading a `Transport` row carries.
 *
 * **Example** (Read a transport row)
 *
 * ```ts
 * import { readingOfTransport } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(readingOfTransport.length) // 1
 * ```
 *
 * @param row - A transport row.
 * @returns Its reading.
 * @category utilities
 * @since 0.0.0
 */
export const readingOfTransport = (row: TransportRow): BucketReading =>
  BucketReading.make({
    key: BucketKey.make({ identity: row.identity, resource: row.resource }),
    limit: row.limit,
    remaining: row.remaining,
    used: row.used,
    resetAt: row.resetAt,
    asOf: row.at,
    source: credentialKeyOf(row),
    basis: "transport",
  });

/**
 * The bucket readings a `Sample` row carries, one per bucket.
 *
 * **Example** (Read a sample row)
 *
 * ```ts
 * import { readingsOfSample } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(readingsOfSample.length) // 1
 * ```
 *
 * @param row - A sample row.
 * @returns Its readings.
 * @category utilities
 * @since 0.0.0
 */
export const readingsOfSample = (row: SampleRow): ReadonlyArray<BucketReading> =>
  A.map(row.buckets, (bucket) =>
    BucketReading.make({
      key: BucketKey.make({ identity: row.identity, resource: bucket.resource }),
      limit: bucket.limit,
      remaining: bucket.remaining,
      used: O.some(bucket.used),
      resetAt: bucket.resetAt,
      asOf: row.at,
      source: credentialKeyOf(row),
      basis: "sample",
    })
  );

/**
 * Map a row's identity through the alias map.
 *
 * **Example** (Canonicalise a row)
 *
 * ```ts
 * import { canonicalRow, emptyIdentityAliases } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(typeof canonicalRow(emptyIdentityAliases)) // "function"
 * ```
 *
 * @param aliases - The alias map.
 * @returns A function from a row to the same row with its canonical identity.
 * @category utilities
 * @since 0.0.0
 */
export const canonicalRow =
  (aliases: IdentityAliases) =>
  (row: GithubLedgerRow): GithubLedgerRow => {
    const identity = canonicalIdentity(aliases)(row.identity);
    return identity === row.identity ? row : { ...row, identity };
  };

const isTransport = GithubLedgerRow.guards.Transport;
const isSample = GithubLedgerRow.guards.Sample;
const isGhSpawn = GithubLedgerRow.guards.GhSpawn;
const isCalibration = GithubLedgerRow.guards.Calibration;

const byAt = Order.mapInput(Order.Number, (row: { readonly at: DateTime.Utc }) => millis(row.at));

const median = (values: ReadonlyArray<number>): O.Option<number> =>
  pipe(A.sort(values, Order.Number), (sorted) => A.get(sorted, Math.floor(A.length(sorted) / 2)));

/**
 * Whether calibration admits sample-basis `graphql` readings for an identity:
 * at least six `Calibration` rows in the last seven days with a median
 * `|restUsed − graphqlUsed|` of at most 50 points.
 *
 * **Example** (Refuse without calibration)
 *
 * ```ts
 * import { GithubIdentityLabel, calibrationOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(calibrationOf({ now: DateTime.makeUnsafe(0), identity: GithubIdentityLabel.make("user:octocat") })([])) // false
 * ```
 *
 * @param input - The current time and the canonical identity.
 * @returns A predicate over the ledger rows.
 * @category utilities
 * @since 0.0.0
 */
export const calibrationOf =
  ({ now, identity }: { readonly now: DateTime.Utc; readonly identity: GithubIdentityLabel }) =>
  (rows: ReadonlyArray<GithubLedgerRow>): boolean => {
    const since = millis(now) - CALIBRATION_LOOKBACK_MILLIS;
    const pairs = A.filter(
      rows,
      (row): row is CalibrationRow => isCalibration(row) && row.identity === identity && millis(row.at) > since
    );
    return (
      A.length(pairs) >= CALIBRATION_MIN_PAIRS &&
      O.exists(
        median(A.map(pairs, (pair) => Math.abs(pair.restUsed - pair.graphqlUsed))),
        (drift) => drift <= CALIBRATION_MAX_DRIFT
      )
    );
  };

const byAsOf = Order.mapInput(Order.Number, (reading: BucketReading) => millis(reading.asOf));

const resetGap = (self: { readonly resetAt: DateTime.Utc }, that: { readonly resetAt: DateTime.Utc }): number =>
  Math.abs(millis(self.resetAt) - millis(that.resetAt));

const sameReset = (self: { readonly resetAt: DateTime.Utc }, that: { readonly resetAt: DateTime.Utc }): boolean =>
  resetGap(self, that) <= EPOCH_JITTER_MILLIS;

// Chain items into runs: an item extends the current run when `joins(last, item)`, else starts a new one.
const runsOf = <Item>(
  items: ReadonlyArray<Item>,
  joins: (last: Item, next: Item) => boolean
): ReadonlyArray<A.NonEmptyReadonlyArray<Item>> =>
  A.reduce(items, A.empty<A.NonEmptyReadonlyArray<Item>>(), (runs, item) =>
    O.match(A.last(runs), {
      onNone: () => A.append(runs, A.of(item)),
      onSome: (run) =>
        joins(A.lastNonEmpty(run), item)
          ? A.append(A.dropRight(runs, 1), A.append(run, item))
          : A.append(runs, A.of(item)),
    })
  );

// The least headroom above the floor first; on a tie, the newer reading.
const mostConstrained = Order.combine(
  Order.mapInput(Order.Number, (reading: BucketReading) => reading.remaining - reserveFloor(reading.limit)),
  Order.flip(byAsOf)
);

// Use the same credential lanes as window accounting. The newest fresh live
// reading per lane competes on headroom; with none, retain the newest fallback.
const judgedReadingOf = (
  now: DateTime.Utc,
  resource: GitHubRateLimitResource,
  usable: ReadonlyArray<BucketReading>
): O.Option<BucketReading> => {
  const live = A.filter(
    usable,
    (reading) =>
      millis(now) - millis(reading.asOf) <= Duration.toMillis(RESERVE_READING_BOUND) &&
      millis(reading.resetAt) > millis(now)
  );
  const lanes = partitionCredentials(
    usable,
    (reading) => ({
      source: reading.source,
      at: reading.asOf,
      resetAt: reading.resetAt,
      used: O.getOrElse(reading.used, () => reading.limit - reading.remaining),
    }),
    resource
  );
  const buckets = A.flatMap(lanes, (lane) =>
    A.fromOption(
      A.last(
        A.sort(
          A.filter(lane, (reading) => A.contains(live, reading)),
          byAsOf
        )
      )
    )
  );
  return A.match(buckets, {
    onEmpty: () => A.last(A.sort(usable, byAsOf)),
    onNonEmpty: (present) => O.some(A.min(present, mostConstrained)),
  });
};

/**
 * Retain one newest reading per credential or unknown reset instance.
 *
 * **Details**
 *
 * Unknown instances use one-second reset buckets and reuse the lexicographically
 * earliest retained key within five seconds, separately for idle and busy
 * readings. All matching neighbours consolidate into that key. This preserves
 * distinct windows even when one PID observes both. The last entry is the
 * updated instance, so persistence, cache and throttling share its exact key.
 *
 * **Example** (Start a retention table)
 *
 * ```ts
 * import { BucketKey, BucketReading, GithubIdentityLabel, retainLatestReading } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * const reading = BucketReading.make({
 *   key: BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" }),
 *   source: "pid:42", limit: 5000, remaining: 4990, used: O.some(10),
 *   asOf: DateTime.makeUnsafe(0), resetAt: DateTime.makeUnsafe(3_600_000), basis: "transport"
 * })
 * const retained = retainLatestReading(reading, [])
 * console.log(retained[0][0]) // "user_octocat-core-instance-busy-3600"
 * ```
 *
 * @param reading - The incoming reading.
 * @param entries - Existing logical filename stems and their readings.
 * @returns Consolidated entries, with the updated credential or instance last.
 * @category utilities
 * @since 0.0.0
 */
export const retainLatestReading: {
  (
    reading: BucketReading,
    entries: ReadonlyArray<readonly [string, BucketReading]>
  ): A.NonEmptyReadonlyArray<readonly [string, BucketReading]>;
  (
    entries: ReadonlyArray<readonly [string, BucketReading]>
  ): (reading: BucketReading) => A.NonEmptyReadonlyArray<readonly [string, BucketReading]>;
} = dual(
  2,
  (
    reading: BucketReading,
    entries: ReadonlyArray<readonly [string, BucketReading]>
  ): A.NonEmptyReadonlyArray<readonly [string, BucketReading]> => {
    const used = (value: BucketReading) => O.getOrElse(value.used, () => value.limit - value.remaining);
    const known = isFingerprint(reading.source);
    const matches = A.filter(
      entries,
      ([, other]) =>
        bucketKeyString(other.key) === bucketKeyString(reading.key) &&
        (known
          ? other.source === reading.source
          : !isFingerprint(other.source) && (used(other) === 0) === (used(reading) === 0) && sameReset(other, reading))
    );
    const prefix = `${fileKeyOf(reading.key.identity)}-${reading.key.resource}-`;
    const key = pipe(
      A.map(matches, ([key]) => key),
      A.sort(Order.String),
      A.head,
      O.getOrElse(
        () =>
          `${prefix}${known ? reading.source : `instance-${used(reading) === 0 ? "idle" : "busy"}-${Math.floor(millis(reading.resetAt) / 1000)}`}`
      )
    );
    const newest = A.reduce(matches, reading, (newest, [, other]) =>
      millis(other.asOf) > millis(newest.asOf) ? other : newest
    );
    return A.append(
      A.filter(entries, (entry) => !A.contains(matches, entry)),
      Tuple.make(key, newest)
    );
  }
);

/**
 * Whether an unknown retained instance has reached its reset.
 *
 * **Example** (Build a retention predicate)
 *
 * ```ts
 * import { BucketKey, BucketReading, GithubIdentityLabel, expiredUnknownReading } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * const reading = BucketReading.make({
 *   key: BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" }),
 *   source: "pid:42", limit: 5000, remaining: 4990, used: O.some(10),
 *   asOf: DateTime.makeUnsafe(0), resetAt: DateTime.makeUnsafe(60_000), basis: "transport"
 * })
 * console.log(expiredUnknownReading(reading, DateTime.makeUnsafe(60_000))) // true
 * ```
 *
 * @param reading - The retained reading.
 * @param now - The retention cycle time.
 * @returns True only for an unknown instance whose reset is at or before now.
 * @category utilities
 * @since 0.0.0
 */
export const expiredUnknownReading: {
  (reading: BucketReading, now: DateTime.Utc): boolean;
  (now: DateTime.Utc): (reading: BucketReading) => boolean;
} = dual(
  2,
  (reading: BucketReading, now: DateTime.Utc): boolean =>
    !isFingerprint(reading.source) && millis(reading.resetAt) <= millis(now)
);

/**
 * The reading of a bucket that its reserve verdict rests on.
 *
 * **Details**
 *
 * For a `graphql` key, sample-basis readings count only when
 * `admitGraphqlSamples`, because REST misreports the GraphQL bucket. Every
 * other key takes readings of either basis. A key may hold several concurrent
 * buckets, such as two credentials of one login: the fresh (at most ten
 * minutes old) and live (reset after `now`) readings use the same credential
 * and co-observation partition as window accounting, and the newest reading of the
 * most constrained group (least `remaining − floor`) is the one returned. With
 * no fresh live reading it is the newest reading. This is the reading
 * {@link reserveOf} judges, so a caller that shows a bucket's numbers next to
 * its verdict shows the same reading.
 *
 * **Example** (An uncalibrated GraphQL sample is not usable)
 *
 * ```ts
 * import { BucketKey, BucketReading, GithubIdentityLabel, usableReadingOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const key = BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "graphql" })
 * const sample = BucketReading.make({
 *   key,
 *   limit: 5000,
 *   remaining: 4000,
 *   used: O.none(),
 *   resetAt: DateTime.makeUnsafe(60_000),
 *   asOf: DateTime.makeUnsafe(0),
 *   basis: "sample"
 * })
 * const usable = usableReadingOf({ now: DateTime.makeUnsafe(0), admitGraphqlSamples: false })
 * console.log(O.isNone(usable(key, [sample]))) // true
 * ```
 *
 * @param input - The current time and whether calibration admits sample-basis `graphql` readings.
 * @returns A function from a key and readings to the reading that key's verdict rests on.
 * @category utilities
 * @since 0.0.0
 */
export const usableReadingOf =
  ({ now, admitGraphqlSamples }: { readonly now: DateTime.Utc; readonly admitGraphqlSamples: boolean }) =>
  (key: BucketKey, readings: ReadonlyArray<BucketReading>): O.Option<BucketReading> =>
    judgedReadingOf(
      now,
      key.resource,
      A.filter(
        readings,
        (reading) =>
          bucketKeyString(reading.key) === bucketKeyString(key) &&
          (key.resource !== "graphql" || reading.basis === "transport" || admitGraphqlSamples)
      )
    );

/**
 * The reserve signal of one bucket key from its readings.
 *
 * **Details**
 *
 * For a `graphql` key, sample-basis readings count only when
 * `admitGraphqlSamples`; with only sample readings and no admission the state is
 * `Unknown{uncalibrated}`. No reading is `Unknown{no-reading}`. A key may hold
 * several concurrent buckets (two credentials of one login, folded by the alias
 * map): the signal is the most constrained live bucket, judged on the newest
 * fresh reading of each (see {@link usableReadingOf}). It is `Below` when that
 * bucket's `remaining < ceil(0.15 × limit)`, so when any live bucket is below
 * its floor, and `Clear` otherwise. With no reading that is both fresh and
 * live, the newest reading decides: older than ten minutes is
 * `Unknown{stale}`, a reset at or before `now` is `Unknown{window-reset}`.
 *
 * **Example** (No reading is unknown)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, reserveOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const key = BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" })
 * console.log(reserveOf({ now: DateTime.makeUnsafe(0), admitGraphqlSamples: false })(key, []).state._tag) // "Unknown"
 * ```
 *
 * @param input - The current time and whether calibration admits sample-basis `graphql` readings.
 * @returns A function from a key and its readings to the signal.
 * @category utilities
 * @since 0.0.0
 */
export const reserveOf =
  ({ now, admitGraphqlSamples }: { readonly now: DateTime.Utc; readonly admitGraphqlSamples: boolean }) =>
  (key: BucketKey, readings: ReadonlyArray<BucketReading>): ReserveSignal => {
    const own = A.filter(readings, (reading) => bucketKeyString(reading.key) === bucketKeyString(key));
    const unknown = (reason: ReserveUnknownReason, asOf: O.Option<DateTime.Utc>) =>
      ReserveSignal.make({ key, state: ReserveState.cases.Unknown.make({ reason, asOf }) });
    const judged = usableReadingOf({ now, admitGraphqlSamples })(key, own);
    return O.match(judged, {
      onNone: () => unknown(A.isReadonlyArrayNonEmpty(own) ? "uncalibrated" : "no-reading", O.none()),
      onSome: (reading) => {
        const floor = reserveFloor(reading.limit);
        const fields = {
          remaining: reading.remaining,
          limit: reading.limit,
          floor,
          resetAt: reading.resetAt,
          asOf: reading.asOf,
          basis: reading.basis,
        };
        return millis(now) - millis(reading.asOf) > Duration.toMillis(RESERVE_READING_BOUND)
          ? unknown("stale", O.some(reading.asOf))
          : millis(reading.resetAt) <= millis(now)
            ? unknown("window-reset", O.some(reading.asOf))
            : ReserveSignal.make({
                key,
                state:
                  reading.remaining < floor
                    ? ReserveState.cases.Below.make(fields)
                    : ReserveState.cases.Clear.make(fields),
              });
      },
    });
  };

const transportUsed = (row: TransportRow): number => O.getOrElse(row.used, () => row.limit - row.remaining);

const sameKey =
  (key: BucketKey) => (row: { readonly identity: GithubIdentityLabel; readonly resource: GitHubRateLimitResource }) =>
    row.identity === key.identity && row.resource === key.resource;

// One bucket's own transport and gh-spawn rows, shared by windowsOf and hourOf.
const keyRowsOf = (key: BucketKey, rows: ReadonlyArray<GithubLedgerRow>) => ({
  transports: A.filter(rows, (row): row is TransportRow => isTransport(row) && sameKey(key)(row)),
  spawns: A.filter(rows, (row): row is GhSpawnRow => isGhSpawn(row) && sameKey(key)(row)),
});

/**
 * The anchors of one bucket: `Sample` buckets for REST resources; this host's
 * GraphQL `Transport` rows for `graphql`, plus sample buckets when calibration
 * admits them. Sorted by time.
 *
 * **Example** (No rows, no anchors)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, anchorsOf } from "@beep/repo-cli/test/SharedInternals"
 *
 * const key = BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" })
 * console.log(anchorsOf({ key, rows: [], admitGraphqlSamples: false }).length) // 0
 * ```
 *
 * @param input - The bucket, the canonical rows and whether sample-basis `graphql` readings are admitted.
 * @returns The anchors, oldest first.
 * @category utilities
 * @since 0.0.0
 */
export const anchorsOf = ({
  key,
  rows,
  admitGraphqlSamples,
}: {
  readonly key: BucketKey;
  readonly rows: ReadonlyArray<GithubLedgerRow>;
  readonly admitGraphqlSamples: boolean;
}): ReadonlyArray<LedgerAnchor> => {
  const samples =
    key.resource === "graphql" && !admitGraphqlSamples
      ? A.empty<LedgerAnchor>()
      : pipe(
          A.filter(rows, (row): row is SampleRow => isSample(row) && row.identity === key.identity),
          A.flatMap((row) =>
            pipe(
              A.filter(row.buckets, (bucket) => bucket.resource === key.resource),
              A.map((bucket) =>
                LedgerAnchor.make({
                  source: credentialKeyOf(row),
                  resource: key.resource,
                  at: row.at,
                  used: bucket.used,
                  resetAt: bucket.resetAt,
                  anchor: "sample",
                })
              )
            )
          )
        );
  const transports =
    key.resource === "graphql"
      ? pipe(
          A.filter(rows, (row): row is TransportRow => isTransport(row) && row.kind === "graphql" && sameKey(key)(row)),
          A.map((row) =>
            LedgerAnchor.make({
              source: credentialKeyOf(row),
              resource: key.resource,
              at: row.at,
              used: transportUsed(row),
              resetAt: row.resetAt,
              anchor: "transport",
            })
          )
        )
      : A.empty<LedgerAnchor>();
  return A.sort(A.appendAll(samples, transports), byAt);
};

// An idle bucket reports `reset = now + 1 h` on every read, so after `used == 0` the reset is not anchored.
const sameEpoch = (
  earlier: { readonly used: number; readonly resetAt: DateTime.Utc },
  later: { readonly resetAt: DateTime.Utc }
): boolean => earlier.used === 0 || sameReset(earlier, later);

// Only known credentials retain continuity across resets. Unknown observations
// first form physical window instances. GraphQL instances attach to one known
// lane; REST instances may join a shared known bucket sequence.
const partitionCredentials = <Item>(
  items: ReadonlyArray<Item>,
  anchorOf: (item: Item) => {
    readonly source: string;
    readonly at: DateTime.Utc;
    readonly resetAt: DateTime.Utc;
    readonly used: number;
  },
  resource: GitHubRateLimitResource
): ReadonlyArray<A.NonEmptyReadonlyArray<Item>> => {
  const known = A.filter(items, (item) => isFingerprint(anchorOf(item).source));
  const unknown = A.filter(items, (item) => !isFingerprint(anchorOf(item).source));
  const byReset = Order.mapInput(DateTime.Order, (item: Item) => anchorOf(item).resetAt);
  // Idle and busy observations never share an instance. Sorting by reset makes
  // adjacent jitter matches the transitive reset cluster, independent of PID.
  const instances = A.flatMap(R.values(A.groupBy(unknown, (item): string => `${anchorOf(item).used === 0}`)), (group) =>
    runsOf(A.sort(group, byReset), (last, next) => sameReset(anchorOf(last), anchorOf(next)))
  );
  const knownGroups = R.values(A.groupBy(known, (item) => anchorOf(item).source));
  const shares = (left: Item, right: Item): boolean => {
    const a = anchorOf(left);
    const b = anchorOf(right);
    return (
      a.used > 0 &&
      b.used > 0 &&
      sameReset(a, b) &&
      millis(a.at) < millis(a.resetAt) &&
      millis(b.at) < millis(b.resetAt)
    );
  };
  const merge = (
    pending: ReadonlyArray<A.NonEmptyReadonlyArray<Item>>,
    lane: A.NonEmptyReadonlyArray<Item>
  ): ReadonlyArray<A.NonEmptyReadonlyArray<Item>> => {
    const joins = (group: A.NonEmptyReadonlyArray<Item>) => A.some(group, (a) => A.some(lane, (b) => shares(a, b)));
    const joined = A.filter(pending, joins);
    const rest = A.filter(pending, (group) => !joins(group));
    return A.isReadonlyArrayNonEmpty(joined) ? merge(rest, A.appendAll(lane, A.flatten(joined))) : A.append(rest, lane);
  };
  // Attach each unknown GraphQL instance once, using only direct known-anchor
  // evidence. It can never act as a union edge between known fingerprints.
  const firstAt = (group: A.NonEmptyReadonlyArray<Item>) =>
    A.min(
      A.map(group, (item) => anchorOf(item).at),
      DateTime.Order
    );
  const orderedKnown: ReadonlyArray<A.NonEmptyReadonlyArray<Item>> = A.sort(
    knownGroups,
    Order.mapInput(DateTime.Order, firstAt)
  );
  const orderedInstances = A.sort(instances, Order.mapInput(DateTime.Order, firstAt));
  const attached = () =>
    A.reduce(orderedInstances, orderedKnown, (current, instance) => {
      const lanes = A.sort(current, Order.mapInput(DateTime.Order, firstAt));
      const candidates = A.flatMap(lanes, (lane, index) => {
        const gaps = A.flatMap(instance, (a) =>
          A.flatMap(lane, (b) =>
            isFingerprint(anchorOf(b).source) && shares(a, b) ? [resetGap(anchorOf(a), anchorOf(b))] : []
          )
        );
        return A.match(gaps, {
          onEmpty: () => [],
          onNonEmpty: (present) => [Tuple.make(index, A.min(present, Order.Number))],
        });
      });
      const chosen = A.head(
        A.sort(
          candidates,
          Order.combine(
            Order.mapInput(Order.Number, (entry: readonly [number, number]) => entry[1]),
            Order.mapInput(Order.Number, (entry: readonly [number, number]) => entry[0])
          )
        )
      );
      return O.match(chosen, {
        onNone: () => A.append(lanes, instance),
        onSome: ([chosenIndex]) =>
          A.map(lanes, (lane, index) => (index === chosenIndex ? A.appendAll(lane, instance) : lane)),
      });
    });
  return pipe(
    resource === "graphql"
      ? attached()
      : A.reduce(A.appendAll(knownGroups, instances), A.empty<A.NonEmptyReadonlyArray<Item>>(), merge),
    A.map((group) =>
      A.sort(
        group,
        Order.mapInput(DateTime.Order, (item: Item) => anchorOf(item).at)
      )
    ),
    A.sort(Order.mapInput(DateTime.Order, (group: A.NonEmptyReadonlyArray<Item>) => anchorOf(A.headNonEmpty(group)).at))
  );
};

/**
 * Partition one key's anchors by credential and positive live co-observation.
 *
 * **Details**
 *
 * Credential groups merge to a fixed point only when positive readings observed
 * before their reset agree within five seconds. Idle groups never merge. A
 * known credential stays in its lane across resets. GraphQL keeps known
 * fingerprints distinct and attaches an unknown instance to at most one directly
 * co-observed known lane, choosing closest reset then earliest current lane ID. Unknown anchors cluster into reset-scoped
 * instances across sources, with idle and busy instances kept separate. Unknown
 * instances never continue across resets. Lane ids follow first anchor time.
 *
 * **Example** (No credentials, no lanes)
 *
 * ```ts
 * import { lanesOf } from "@beep/repo-cli/test/SharedInternals"
 * console.log(lanesOf([]).length) // 0
 * ```
 *
 * @param anchors - One key's anchors.
 * @param resource - The resource; shared REST buckets merge co-observations, GraphQL isolates known fingerprints.
 * @returns Lanes and anchors sorted by time.
 * @category utilities
 * @since 0.0.0
 */
export const lanesOf: {
  (anchors: ReadonlyArray<LedgerAnchor>): ReadonlyArray<A.NonEmptyReadonlyArray<LedgerAnchor>>;
  (
    anchors: ReadonlyArray<LedgerAnchor>,
    resource: GitHubRateLimitResource
  ): ReadonlyArray<A.NonEmptyReadonlyArray<LedgerAnchor>>;
  (
    resource: GitHubRateLimitResource
  ): (anchors: ReadonlyArray<LedgerAnchor>) => ReadonlyArray<A.NonEmptyReadonlyArray<LedgerAnchor>>;
} = dual(
  (args) => A.isArray(args[0]),
  (
    anchors: ReadonlyArray<LedgerAnchor>,
    resource: GitHubRateLimitResource = O.match(A.head(anchors), {
      onNone: (): GitHubRateLimitResource => "core",
      onSome: (anchor) => anchor.resource,
    })
  ) => partitionCredentials(anchors, (anchor) => anchor, resource)
);

const inWindow = (from: number, to: number) => (row: { readonly at: DateTime.Utc }) =>
  millis(row.at) > from && millis(row.at) <= to;

const byWindowEnd = Order.combine(
  Order.mapInput(Order.Number, (window: LedgerWindow) => millis(window.to)),
  Order.mapInput(Order.Number, (window: LedgerWindow) => window.lane)
);

/**
 * The windows of one bucket key, between consecutive anchors of each lane.
 *
 * **Details**
 *
 * Anchors are split into lanes by {@link lanesOf} and paired only within a
 * lane, so readings of concurrent buckets never pair. A same-epoch window's
 * `delta` is the signed `used` difference. A window whose later anchor starts
 * a new epoch while the earlier one had `used > 0` crosses a reset: its
 * `resetLowerBound` is `used(to) + max(0, peakBefore − used(from))`, where
 * `peakBefore` is the highest `used` seen before `to` among the lane's anchors
 * and that lane's `Transport` rows with a reset within five seconds of the
 * earlier anchor's. `attributedNominal` sums this host's `Transport` nominal
 * costs for the key in the window; `ghSpawns` counts its `GhSpawn` rows.
 *
 * **Example** (No anchors, no windows)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, windowsOf } from "@beep/repo-cli/test/SharedInternals"
 *
 * const key = BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" })
 * console.log(windowsOf({ key, rows: [], admitGraphqlSamples: false }).length) // 0
 * ```
 *
 * @param input - The bucket, the canonical rows and whether sample-basis `graphql` readings are admitted.
 * @returns The windows, sorted by end and then lane.
 * @category utilities
 * @since 0.0.0
 */
export const windowsOf = ({
  key,
  rows,
  admitGraphqlSamples,
}: {
  readonly key: BucketKey;
  readonly rows: ReadonlyArray<GithubLedgerRow>;
  readonly admitGraphqlSamples: boolean;
}): ReadonlyArray<LedgerWindow> => {
  const { transports, spawns } = keyRowsOf(key, rows);
  const windowsOfLane = (lane: A.NonEmptyReadonlyArray<LedgerAnchor>, index: number): ReadonlyArray<LedgerWindow> =>
    A.map(A.zip(lane, A.drop(lane, 1)), ([from, to]) => {
      const same = A.every(lane, (anchor) => !isFingerprint(anchor.source)) || sameEpoch(from, to);
      const crossesReset = !same && from.used > 0;
      const before = (row: { readonly at: DateTime.Utc; readonly resetAt: DateTime.Utc }) =>
        millis(row.at) < millis(to.at) && sameReset(row, from);
      const peakBefore = pipe(
        A.map(A.filter(lane, before), (anchor) => anchor.used),
        A.appendAll(
          A.map(
            A.filter(
              key.resource === "graphql" ? [] : transports,
              (row) => before(row) && A.some(lane, (anchor) => anchor.source === credentialKeyOf(row))
            ),
            transportUsed
          )
        ),
        A.reduce(from.used, (peak, used) => Math.max(peak, used))
      );
      const within = inWindow(millis(from.at), millis(to.at));
      return LedgerWindow.make({
        key,
        lane: index,
        inferred: A.some(lane, (anchor) => !isFingerprint(anchor.source)),
        from: from.at,
        to: to.at,
        anchor: to.anchor,
        sameEpoch: same,
        delta: same ? to.used - from.used : 0,
        crossesReset,
        resetLowerBound: crossesReset ? to.used + Math.max(0, peakBefore - from.used) : 0,
        attributedNominal: Num.sumAll(A.map(A.filter(transports, within), (row) => row.nominalCost)),
        ghSpawns: A.length(A.filter(spawns, within)),
      });
    });
  return A.sort(
    A.flatMap(lanesOf(anchorsOf({ key, rows, admitGraphqlSamples }), key.resource), windowsOfLane),
    byWindowEnd
  );
};

/**
 * Estimated point cost per GraphQL operation.
 *
 * **Details**
 *
 * For each pair of consecutive `graphql` `Transport` rows from the same
 * process, bucket and epoch, a positive `Δused` is a candidate cost for the
 * second row's operation. Fleet traffic only adds to `Δ`, so the cost is the
 * minimum candidate, reported only with at least three candidates; otherwise
 * the operation costs its nominal floor of 1.
 *
 * **Example** (No rows, no costs)
 *
 * ```ts
 * import { operationCostsOf } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(operationCostsOf([]).length) // 0
 * ```
 *
 * @param rows - Canonical rows.
 * @returns One cost per GraphQL operation seen.
 * @category utilities
 * @since 0.0.0
 */
export const operationCostsOf = (rows: ReadonlyArray<GithubLedgerRow>): ReadonlyArray<OperationCost> => {
  const graphql = A.filter(
    rows,
    (row): row is TransportRow => isTransport(row) && row.kind === "graphql" && row.resource === "graphql"
  );
  const groups = A.groupBy(graphql, (row) => `${row.pid}|${row.identity}|${credentialKeyOf(row)}`);
  const candidates = pipe(
    R.values(groups),
    A.flatMap((group) => {
      const sorted = A.sort(group, byAt);
      return pipe(
        A.zip(sorted, A.drop(sorted, 1)),
        A.filter(([first, second]) => sameReset(first, second)),
        A.map(([first, second]) => ({
          operation: second.operation,
          delta: transportUsed(second) - transportUsed(first),
        }))
      );
    })
  );
  const operations = A.dedupe(A.map(graphql, (row) => row.operation));
  return A.map(operations, (operation) => {
    const positive = pipe(
      A.filter(candidates, (candidate) => candidate.operation === operation && candidate.delta > 0),
      A.map((candidate) => candidate.delta)
    );
    return OperationCost.make({
      operation,
      points:
        A.length(positive) >= OPERATION_MIN_CANDIDATES
          ? A.reduce(positive, Number.MAX_SAFE_INTEGER, (low, delta) => Math.min(low, delta))
          : 1,
      observations: A.length(positive),
    });
  });
};

const costOfRow =
  (costs: HashMap.HashMap<GithubOperation, number>) =>
  (row: TransportRow): number =>
    row.nominalCost === 0
      ? 0
      : row.kind === "graphql"
        ? O.getOrElse(HashMap.get(costs, row.operation), () => row.nominalCost)
        : row.nominalCost;

const costTable = (costs: ReadonlyArray<OperationCost>): HashMap.HashMap<GithubOperation, number> =>
  HashMap.fromIterable(A.map(costs, (cost): readonly [GithubOperation, number] => [cost.operation, cost.points]));

const commandSpendsOf = (
  transports: ReadonlyArray<TransportRow>,
  spawns: ReadonlyArray<GhSpawnRow>,
  costs: HashMap.HashMap<GithubOperation, number>
): ReadonlyArray<CommandSpend> => {
  const commands = A.dedupe(
    A.appendAll(
      A.map(transports, (row) => row.command),
      A.map(spawns, (row) => row.command)
    )
  );
  return pipe(
    A.map(commands, (command: GithubLedgerCommandLabel) => {
      const own = A.filter(transports, (row) => row.command === command);
      return CommandSpend.make({
        command,
        requests: A.length(own),
        nominal: Num.sumAll(A.map(own, (row) => row.nominalCost)),
        estimatedPoints: Num.sumAll(A.map(own, costOfRow(costs))),
        ghSpawns: A.length(A.filter(spawns, (row) => row.command === command)),
      });
    }),
    A.sort(
      Order.combine(
        Order.mapInput(Order.flip(Order.Number), (spend: CommandSpend) => spend.estimatedPoints),
        Order.mapInput(Order.flip(Order.Number), (spend: CommandSpend) => spend.requests)
      )
    )
  );
};

/**
 * The UTC hour that contains an instant.
 *
 * **Example** (Truncate to the hour)
 *
 * ```ts
 * import { hourStartOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(DateTime.formatIso(hourStartOf(DateTime.makeUnsafe("2026-11-10T14:59:59.900Z")))) // "2026-11-10T14:00:00.000Z"
 * ```
 *
 * @param at - An instant.
 * @returns The start of its UTC hour.
 * @category utilities
 * @since 0.0.0
 */
export const hourStartOf = (at: DateTime.Utc): DateTime.Utc => utc(Math.floor(millis(at) / HOUR_MILLIS) * HOUR_MILLIS);

/**
 * The file name stem of an hour: `2026-11-10T14`.
 *
 * **Example** (Name an hour file)
 *
 * ```ts
 * import { hourFileKey } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(hourFileKey(DateTime.makeUnsafe("2026-11-10T14:30:00.000Z"))) // "2026-11-10T14"
 * ```
 *
 * @param at - An instant.
 * @returns Its UTC hour stem.
 * @category utilities
 * @since 0.0.0
 */
export const hourFileKey = (at: DateTime.Utc): string => at.pipe(hourStartOf, DateTime.formatIso, Str.slice(0, 13));

/**
 * The buckets rows mention: every `Transport` key and every `Sample` bucket.
 *
 * **Example** (No rows, no keys)
 *
 * ```ts
 * import { keysOfRows } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(keysOfRows([]).length) // 0
 * ```
 *
 * @param rows - Canonical rows.
 * @returns The distinct keys.
 * @category utilities
 * @since 0.0.0
 */
export const keysOfRows = (rows: ReadonlyArray<GithubLedgerRow>): ReadonlyArray<BucketKey> => {
  const keys = A.flatMap(rows, (row) =>
    isTransport(row)
      ? [BucketKey.make({ identity: row.identity, resource: row.resource })]
      : isSample(row)
        ? A.map(row.buckets, (bucket) => BucketKey.make({ identity: row.identity, resource: bucket.resource }))
        : A.empty<BucketKey>()
  );
  return A.dedupeWith(keys, (self, that) => bucketKeyString(self) === bucketKeyString(that));
};

/**
 * One bucket key's hourly usage from known credential windows and inferred instances.
 *
 * **Details**
 *
 * `fleetUsed` telescopes known lanes' runs of chained same-epoch windows
 * (`last − first`, each run floored once at 0), sums them over the key's
 * known lanes and adds each confirmed reset-crossing lower bound. Unknown
 * reset instances use the last in-hour anchor against the last before-hour
 * anchor, a zero baseline for a window beginning in the hour, or the first
 * in-hour anchor with a lower-bound flag. Known lanes apply that zero-baseline
 * test to their first window too. Concurrent lanes' windows overlap in time, so
 * `attributedNominal` and `ghSpawns` count each `Transport` and `GhSpawn` row
 * once in its timestamp hour. `ghEstimated = min(ghSpawns, max(0,
 * fleetUsed − estimatedPoints))` and `unattributed = max(0, fleetUsed −
 * estimatedPoints − ghEstimated)`.
 *
 * **Example** (An empty hour)
 *
 * ```ts
 * import { BucketKey, GithubIdentityLabel, hourOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const key = BucketKey.make({ identity: GithubIdentityLabel.make("user:octocat"), resource: "core" })
 * console.log(O.isNone(hourOf({ hour: DateTime.makeUnsafe(0), key, rows: [], windows: [], costs: [] }).fleetUsed)) // true
 * ```
 *
 * @param input - The hour, bucket, rows, windows, operation costs and calibration admission used to select anchors.
 * @returns The hour's usage for the bucket.
 * @category utilities
 * @since 0.0.0
 */
export const hourOf = ({
  hour,
  key,
  rows,
  windows,
  costs,
  admitGraphqlSamples = A.some(windows, (window) => window.anchor === "sample"),
}: {
  readonly hour: DateTime.Utc;
  readonly key: BucketKey;
  readonly rows: ReadonlyArray<GithubLedgerRow>;
  readonly windows: ReadonlyArray<LedgerWindow>;
  readonly costs: ReadonlyArray<OperationCost>;
  readonly admitGraphqlSamples?: boolean;
}): LedgerHourKey => {
  const start = millis(hour);
  const inHour = (at: DateTime.Utc) => millis(at) >= start && millis(at) < start + HOUR_MILLIS;
  const ending = A.filter(windows, (window) => inHour(window.to));
  const table = costTable(costs);
  const { transports, spawns } = keyRowsOf(key, rows);
  const hourTransports = A.filter(transports, (row) => inHour(row.at));
  const estimatedPoints = Num.sumAll(A.map(hourTransports, costOfRow(table)));
  const ghSpawns = A.length(A.filter(spawns, (row) => inHour(row.at)));
  const lanes = lanesOf(anchorsOf({ key, rows, admitGraphqlSamples }), key.resource);
  const knownLane = (lane: A.NonEmptyReadonlyArray<LedgerAnchor>) =>
    A.some(lane, (anchor) => isFingerprint(anchor.source));
  const inferredIndexes = A.flatMap(lanes, (lane, index) => (knownLane(lane) ? [] : [index]));
  const knownEnding = A.filter(ending, (window) => !A.contains(inferredIndexes, window.lane));
  const crossing = A.filter(knownEnding, (window) => window.crossesReset);
  const inferred = A.flatMap(lanes, (lane, index) => {
    if (!A.contains(inferredIndexes, index)) return [];
    const present = A.filter(lane, (anchor) => inHour(anchor.at));
    return A.match(present, {
      onEmpty: () => [],
      onNonEmpty: (anchors) => {
        const before = A.last(A.filter(lane, (anchor) => millis(anchor.at) < start));
        const earliestReset = A.reduce(lane, millis(A.headNonEmpty(lane).resetAt), (reset, anchor) =>
          Math.min(reset, millis(anchor.resetAt))
        );
        const startsHere = earliestReset - HOUR_MILLIS >= start;
        const baseline = O.match(before, {
          onSome: (anchor) => anchor.used,
          onNone: () => (startsHere ? 0 : A.headNonEmpty(anchors).used),
        });
        return [Tuple.make(Math.max(0, A.lastNonEmpty(anchors).used - baseline), O.isNone(before) && !startsHere)];
      },
    });
  });
  const initial = A.flatMap(lanes, (lane, index) => {
    const first = A.headNonEmpty(lane);
    if (!knownLane(lane) || !inHour(first.at)) return [];
    const firstCross = A.findFirst(windows, (window) => window.lane === index && window.crossesReset);
    const epoch = A.takeWhile(
      lane,
      (anchor) => O.isNone(firstCross) || millis(anchor.at) <= millis(firstCross.value.from)
    );
    const earliestReset = A.reduce(epoch, millis(first.resetAt), (reset, anchor) =>
      Math.min(reset, millis(anchor.resetAt))
    );
    const startsHere = earliestReset - HOUR_MILLIS >= start;
    return [Tuple.make(startsHere ? Math.max(0, first.used) : 0, !startsHere)];
  });
  const contributions = A.appendAll(inferred, initial);
  const telescoped = pipe(
    A.filter(knownEnding, (window) => window.sameEpoch),
    A.groupBy((window) => `${window.lane}`),
    R.values,
    A.flatMap((lane) => runsOf(lane, (last, next) => millis(last.to) === millis(next.from))),
    A.map((run) => Math.max(0, Num.sumAll(A.map(run, (window) => window.delta)))),
    Num.sumAll
  );
  const fleetUsed =
    A.isReadonlyArrayNonEmpty(knownEnding) || A.isReadonlyArrayNonEmpty(contributions)
      ? O.some(
          telescoped +
            Num.sumAll(A.map(crossing, (window) => window.resetLowerBound)) +
            Num.sumAll(A.map(contributions, ([used]) => used))
        )
      : O.none<number>();
  const ghEstimated = O.match(fleetUsed, {
    onNone: () => 0,
    onSome: (used) => Math.min(ghSpawns, Math.max(0, used - estimatedPoints)),
  });
  return LedgerHourKey.make({
    key,
    fleetUsed,
    lanesInferred:
      A.isReadonlyArrayNonEmpty(inferred) ||
      A.some(
        lanes,
        (lane) =>
          knownLane(lane) && inHour(A.headNonEmpty(lane).at) && A.some(lane, (anchor) => !isFingerprint(anchor.source))
      ) ||
      A.some(knownEnding, (window) => window.inferred),
    fleetUsedIsLowerBound: A.isReadonlyArrayNonEmpty(crossing) || A.some(contributions, ([, lowerBound]) => lowerBound),
    anchor: pipe(
      A.last(ending),
      O.map((window): WindowAnchor => window.anchor),
      O.getOrElse((): WindowAnchor => (key.resource === "graphql" ? "transport" : "sample"))
    ),
    attributedNominal: Num.sumAll(A.map(hourTransports, (row) => row.nominalCost)),
    estimatedPoints,
    ghSpawns,
    ghEstimated,
    unattributed: O.map(fleetUsed, (used) => Math.max(0, used - estimatedPoints - ghEstimated)),
    overAttributed: O.exists(fleetUsed, (used) => estimatedPoints > used),
    byCommand: commandSpendsOf(
      hourTransports,
      A.filter(spawns, (row) => inHour(row.at)),
      table
    ),
  });
};

const cellsOf = (rows: ReadonlyArray<GithubLedgerRow>): ReadonlyArray<LedgerHourCell> => {
  const entries = A.map(rows, (row) =>
    LedgerHourCell.make({
      ...GithubLedgerRow.match(row, {
        Transport: (transport) => ({
          identity: transport.identity,
          resource: transport.resource,
          command: transport.command,
          nominal: transport.nominalCost,
          rateLimited: transport.outcome === "rate-limited" || transport.outcome === "secondary-limited" ? 1 : 0,
        }),
        GhSpawn: (spawn) => ({
          identity: spawn.identity,
          resource: spawn.resource,
          command: spawn.command,
          nominal: 0,
          rateLimited: 0,
        }),
        // A /rate_limit read is a core endpoint and free.
        Sample: (sample) => ({
          identity: sample.identity,
          resource: "core" as const,
          command: sample.command,
          nominal: 0,
          rateLimited: 0,
        }),
        Calibration: (calibration) => ({
          identity: calibration.identity,
          resource: "graphql" as const,
          command: DEFAULT_COMMAND_LABEL,
          nominal: calibration.graphqlCost,
          rateLimited: 0,
        }),
      }),
      source: sourceOfRow(row),
      requests: 1,
    })
  );
  const groups = A.groupBy(entries, (cell) => `${cell.identity}|${cell.resource}|${cell.command}|${cell.source}`);
  return A.map(A.filter(R.values(groups), P.isNotUndefined), (group) =>
    LedgerHourCell.make({
      ...A.headNonEmpty(group),
      requests: A.length(group),
      nominal: Num.sumAll(A.map(group, (cell) => cell.nominal)),
      rateLimited: Num.sumAll(A.map(group, (cell) => cell.rateLimited)),
    })
  );
};

/**
 * Roll up one hour of one host's canonical rows.
 *
 * **Details**
 *
 * `rows` should span the hour plus its neighbours, so the windows that end in
 * the hour have both anchors. Cells count only the hour's rows.
 *
 * **Example** (Roll up an empty hour)
 *
 * ```ts
 * import { HostLabel, rollupOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const rollup = rollupOf({ hour: DateTime.makeUnsafe(0), host: HostLabel.make("hub"), complete: true, rows: [], admitGraphqlSamples: () => false })
 * console.log(rollup.keys.length) // 0
 * ```
 *
 * @param input - The hour, host, completeness, canonical rows and calibration admission.
 * @returns The rollup.
 * @category utilities
 * @since 0.0.0
 */
export const rollupOf = (input: {
  readonly hour: DateTime.Utc;
  readonly host: HostLabel;
  readonly complete: boolean;
  readonly rows: ReadonlyArray<GithubLedgerRow>;
  readonly admitGraphqlSamples: (identity: GithubIdentityLabel) => boolean;
}): LedgerHourRollup => {
  const hour = hourStartOf(input.hour);
  const start = millis(hour);
  const hourRows = A.filter(input.rows, (row) => millis(row.at) >= start && millis(row.at) < start + HOUR_MILLIS);
  const costs = operationCostsOf(input.rows);
  const hourCosts = A.filter(costs, (cost) =>
    A.some(hourRows, (row) => isTransport(row) && row.operation === cost.operation)
  );
  const keyed = A.map(keysOfRows(hourRows), (key) => {
    const windows = windowsOf({ key, rows: input.rows, admitGraphqlSamples: input.admitGraphqlSamples(key.identity) });
    return {
      key,
      windows: A.filter(windows, (window) => millis(window.to) >= start && millis(window.to) < start + HOUR_MILLIS),
      all: windows,
    };
  });
  return LedgerHourRollup.make({
    hour,
    host: input.host,
    complete: input.complete,
    cells: cellsOf(hourRows),
    keys: A.map(keyed, ({ key, all }) =>
      hourOf({
        hour,
        key,
        rows: input.rows,
        windows: all,
        costs,
        admitGraphqlSamples: input.admitGraphqlSamples(key.identity),
      })
    ),
    operationCosts: hourCosts,
    windows: A.flatMap(keyed, ({ windows }) => windows),
  });
};

/**
 * The hot-parcel summary: this host's top spenders over the last 60 minutes
 * (at most ten), the last complete hour's unattributed points and the newest
 * row time.
 *
 * **Example** (Summarise nothing)
 *
 * ```ts
 * import { summaryOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * console.log(summaryOf({ now: DateTime.makeUnsafe(0), rows: [], lastComplete: O.none() }).spenders.length) // 0
 * ```
 *
 * @param input - The current time, canonical rows and the last complete hour's rollup, when there is one.
 * @returns The summary.
 * @category utilities
 * @since 0.0.0
 */
export const summaryOf = ({
  now,
  rows,
  lastComplete,
}: {
  readonly now: DateTime.Utc;
  readonly rows: ReadonlyArray<GithubLedgerRow>;
  readonly lastComplete: O.Option<LedgerHourRollup>;
}): LedgerSummary => {
  const recent = A.filter(rows, (row) => millis(row.at) > millis(now) - HOUR_MILLIS && millis(row.at) <= millis(now));
  const table = costTable(operationCostsOf(rows));
  return LedgerSummary.make({
    generatedAt: now,
    spenders: A.take(
      commandSpendsOf(A.filter(recent, isTransport), A.filter(recent, isGhSpawn), table),
      SUMMARY_SPENDERS
    ),
    unattributedLastHour: pipe(
      lastComplete,
      O.map((rollup) =>
        A.map(rollup.keys, (hour) => UnattributedSpend.make({ key: hour.key, unattributed: hour.unattributed }))
      ),
      O.getOrElse(A.empty<UnattributedSpend>)
    ),
    lastRowAt: pipe(
      A.map(rows, (row) => millis(row.at)),
      A.match({
        onEmpty: O.none<number>,
        onNonEmpty: (values) => O.some(A.reduce(values, 0, (latest, value) => Math.max(latest, value))),
      }),
      O.map(utc)
    ),
  });
};

const GRAPHQL_GH_COMMANDS: ReadonlyArray<string> = ["pr", "issue", "repo", "release"];
const CORE_GH_COMMANDS: ReadonlyArray<string> = ["run", "workflow", "cache", "secret", "variable", "label"];

type GhSpawnFields = { readonly subcommand: GhSubcommand; readonly resource: GitHubRateLimitResource };

const isPlainGhWord = (word: string): boolean => /^[a-z][a-z-]{0,31}$/.test(word);

const ghApiFieldsOf = (args: ReadonlyArray<string>): GhSpawnFields => {
  const graphql = O.exists(A.get(args, 1), (word) => word === "graphql");
  if (graphql) return { subcommand: GhSubcommand.make("api graphql"), resource: "graphql" };
  const endpoint = O.getOrElse(
    A.findFirst(A.drop(args, 1), (word) => !Str.startsWith("-")(word)),
    () => ""
  );
  return { subcommand: GhSubcommand.make("api rest"), resource: /^\/?search\//.test(endpoint) ? "search" : "core" };
};

const ghCommandResourceOf = (first: string): GitHubRateLimitResource =>
  A.contains(GRAPHQL_GH_COMMANDS, first) ? "graphql" : A.contains(CORE_GH_COMMANDS, first) ? "core" : "unknown";

const ghCommandFieldsOf = (first: string, second: O.Option<string>): GhSpawnFields => {
  const subcommand = isPlainGhWord(first)
    ? O.match(O.filter(second, isPlainGhWord), {
        onNone: () => first,
        onSome: (word) => `${first} ${word}`,
      })
    : "unknown";
  return { subcommand: GhSubcommand.make(subcommand), resource: ghCommandResourceOf(first) };
};

/**
 * Reduce a `gh` argv to the persisted subcommand and its inferred resource.
 *
 * **Details**
 *
 * The subcommand is the first word, plus the second when it is a plain word;
 * `api` becomes `api graphql` or `api rest`, and its endpoint is never kept.
 * `api graphql` and `pr`/`issue`/`repo`/`release` read GraphQL; `api rest` on
 * a `search/` path is `search`, other `api rest` and `run`/`workflow`/`cache`/
 * `secret`/`variable`/`label` are `core`; anything else is `unknown`.
 *
 * **Example** (Reduce an api call)
 *
 * ```ts
 * import { ghSpawnFieldsOf } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(ghSpawnFieldsOf(["api", "repos/o/r/rules/branches/main"])) // { subcommand: "api rest", resource: "core" }
 * console.log(ghSpawnFieldsOf(["pr", "view", "12"])) // { subcommand: "pr view", resource: "graphql" }
 * ```
 *
 * @param args - The `gh` argv.
 * @returns The subcommand and resource.
 * @category utilities
 * @since 0.0.0
 */
export const ghSpawnFieldsOf = (
  args: ReadonlyArray<string>
): { readonly subcommand: GhSubcommand; readonly resource: GitHubRateLimitResource } => {
  const first = O.getOrElse(A.get(args, 0), () => "");
  return first === "api" ? ghApiFieldsOf(args) : ghCommandFieldsOf(first, A.get(args, 1));
};
