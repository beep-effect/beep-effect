/**
 * Pure reducers of the GitHub budget ledger: identity and cost of an
 * observation, readings, the reserve signal, reset epochs, windows, hourly
 * usage, per-operation costs, rollups and the summary.
 *
 * **Details**
 *
 * Headers report the fleet-wide bucket after a response, not one request's
 * cost. Hourly usage therefore telescopes `used` per reset epoch, per-command
 * points come from a minimum-positive same-process estimator, and everything
 * the host did not attribute is the `unattributed` remainder.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

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
import {
  ANONYMOUS_IDENTITY,
  BucketKey,
  BucketReading,
  bucketKeyString,
  CommandSpend,
  canonicalIdentity,
  DEFAULT_COMMAND_LABEL,
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

/**
 * The newest reading of a bucket that its reserve verdict may rest on.
 *
 * **Details**
 *
 * For a `graphql` key, sample-basis readings count only when
 * `admitGraphqlSamples`, because REST misreports the GraphQL bucket. Every
 * other key takes its newest reading of either basis. This is the reading
 * {@link reserveOf} judges, so a caller that shows a bucket's numbers next
 * to its verdict shows the same reading.
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
 * console.log(O.isNone(usableReadingOf({ admitGraphqlSamples: false })(key, [sample]))) // true
 * ```
 *
 * @param input - Whether calibration admits sample-basis `graphql` readings.
 * @returns A function from a key and readings to the newest usable reading of that key.
 * @category utilities
 * @since 0.0.0
 */
export const usableReadingOf =
  ({ admitGraphqlSamples }: { readonly admitGraphqlSamples: boolean }) =>
  (key: BucketKey, readings: ReadonlyArray<BucketReading>): O.Option<BucketReading> =>
    pipe(
      readings,
      A.filter(
        (reading) =>
          bucketKeyString(reading.key) === bucketKeyString(key) &&
          (key.resource !== "graphql" || reading.basis === "transport" || admitGraphqlSamples)
      ),
      A.sort(Order.mapInput(Order.Number, (reading: BucketReading) => millis(reading.asOf))),
      A.last
    );

/**
 * The reserve signal of one bucket from its readings.
 *
 * **Details**
 *
 * For a `graphql` key, sample-basis readings count only when
 * `admitGraphqlSamples`; with only sample readings and no admission the state is
 * `Unknown{uncalibrated}`. No reading is `Unknown{no-reading}`; a newest reading
 * older than ten minutes is `Unknown{stale}`; a reset at or before `now` is
 * `Unknown{window-reset}`; `remaining < ceil(0.15 × limit)` is `Below`;
 * otherwise `Clear`.
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
    const newest = usableReadingOf({ admitGraphqlSamples })(key, own);
    return O.match(newest, {
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
                LedgerAnchor.make({ at: row.at, used: bucket.used, resetAt: bucket.resetAt, anchor: "sample" })
              )
            )
          )
        );
  const transports =
    key.resource === "graphql"
      ? pipe(
          A.filter(rows, (row): row is TransportRow => isTransport(row) && row.kind === "graphql" && sameKey(key)(row)),
          A.map((row) =>
            LedgerAnchor.make({ at: row.at, used: transportUsed(row), resetAt: row.resetAt, anchor: "transport" })
          )
        )
      : A.empty<LedgerAnchor>();
  return A.sort(A.appendAll(samples, transports), byAt);
};

const sameEpoch = (
  earlier: { readonly used: number; readonly resetAt: DateTime.Utc },
  later: { readonly resetAt: DateTime.Utc }
): boolean => earlier.used === 0 || Math.abs(millis(later.resetAt) - millis(earlier.resetAt)) <= EPOCH_JITTER_MILLIS;

/**
 * Split time-ordered anchors into reset epochs.
 *
 * **Details**
 *
 * Two consecutive anchors share an epoch when their resets differ by at most
 * five seconds, or when the earlier one has `used == 0` (an idle bucket reports
 * `reset = now + 1 h` on every read, so its reset is not anchored).
 *
 * **Example** (One anchor, one epoch)
 *
 * ```ts
 * import { LedgerAnchor, epochsOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as DateTime from "effect/DateTime"
 *
 * const anchor = LedgerAnchor.make({ at: DateTime.makeUnsafe(0), used: 1, resetAt: DateTime.makeUnsafe(1), anchor: "sample" })
 * console.log(epochsOf([anchor]).length) // 1
 * ```
 *
 * @param anchors - Anchors, oldest first.
 * @returns The epochs, oldest first.
 * @category utilities
 * @since 0.0.0
 */
export const epochsOf = (anchors: ReadonlyArray<LedgerAnchor>): ReadonlyArray<A.NonEmptyReadonlyArray<LedgerAnchor>> =>
  A.reduce(anchors, A.empty<A.NonEmptyReadonlyArray<LedgerAnchor>>(), (epochs, anchor) =>
    O.match(A.last(epochs), {
      onNone: () => A.append(epochs, A.of(anchor)),
      onSome: (current) =>
        sameEpoch(A.lastNonEmpty(current), anchor)
          ? A.append(A.dropRight(epochs, 1), A.append(current, anchor))
          : A.append(epochs, A.of(anchor)),
    })
  );

const inWindow = (from: number, to: number) => (row: { readonly at: DateTime.Utc }) =>
  millis(row.at) > from && millis(row.at) <= to;

/**
 * The windows of one bucket, between consecutive anchors.
 *
 * **Details**
 *
 * A same-epoch window's `delta` is the signed `used` difference. A window whose
 * later anchor starts a new epoch while the earlier one had `used > 0` crosses a
 * reset: its `resetLowerBound` is `used(to) + max(0, peakBefore − used(from))`,
 * where `peakBefore` is the highest `used` seen for the key with a reset within
 * five seconds of the earlier anchor's. `attributedNominal` sums this host's
 * `Transport` nominal costs for the key in the window; `ghSpawns` counts its
 * `GhSpawn` rows.
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
 * @returns The windows, oldest first.
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
  const anchors = anchorsOf({ key, rows, admitGraphqlSamples });
  const transports = A.filter(rows, (row): row is TransportRow => isTransport(row) && sameKey(key)(row));
  const spawns = A.filter(rows, (row): row is GhSpawnRow => isGhSpawn(row) && sameKey(key)(row));
  return A.map(A.zip(anchors, A.drop(anchors, 1)), ([from, to]) => {
    const same = sameEpoch(from, to);
    const crossesReset = !same && from.used > 0;
    const matchesFromEpoch = (resetAt: DateTime.Utc) =>
      Math.abs(millis(resetAt) - millis(from.resetAt)) <= EPOCH_JITTER_MILLIS;
    const peakBefore = pipe(
      A.filter(anchors, (anchor) => millis(anchor.at) < millis(to.at) && matchesFromEpoch(anchor.resetAt)),
      A.map((anchor) => anchor.used),
      A.appendAll(
        pipe(
          A.filter(transports, (row) => millis(row.at) < millis(to.at) && matchesFromEpoch(row.resetAt)),
          A.map(transportUsed)
        )
      ),
      A.reduce(from.used, (peak, used) => Math.max(peak, used))
    );
    const within = inWindow(millis(from.at), millis(to.at));
    return LedgerWindow.make({
      key,
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
  const groups = A.groupBy(graphql, (row) => `${row.pid}|${row.identity}`);
  const candidates = pipe(
    R.values(groups),
    A.flatMap((group) => {
      const sorted = A.sort(group, byAt);
      return pipe(
        A.zip(sorted, A.drop(sorted, 1)),
        A.filter(([first, second]) => sameEpoch({ used: transportUsed(first), resetAt: first.resetAt }, second)),
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
 * One bucket's usage in hour `hour`, from the windows that end in it.
 *
 * **Details**
 *
 * `fleetUsed` telescopes per epoch (`last − first`, floored once at 0) and
 * adds each reset-crossing window's lower bound; it is none when no window
 * ends in the hour. `ghEstimated = min(ghSpawns, max(0, fleetUsed −
 * estimatedPoints))` and `unattributed = max(0, fleetUsed − estimatedPoints −
 * ghEstimated)`.
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
 * @param input - The hour start, the bucket, canonical rows, the bucket's windows and the operation costs.
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
}: {
  readonly hour: DateTime.Utc;
  readonly key: BucketKey;
  readonly rows: ReadonlyArray<GithubLedgerRow>;
  readonly windows: ReadonlyArray<LedgerWindow>;
  readonly costs: ReadonlyArray<OperationCost>;
}): LedgerHourKey => {
  const start = millis(hour);
  const inHour = (at: DateTime.Utc) => millis(at) >= start && millis(at) < start + HOUR_MILLIS;
  const ending = A.filter(windows, (window) => inHour(window.to));
  const table = costTable(costs);
  const transports = A.filter(
    rows,
    (row): row is TransportRow => isTransport(row) && sameKey(key)(row) && inHour(row.at)
  );
  const spawns = A.filter(rows, (row): row is GhSpawnRow => isGhSpawn(row) && sameKey(key)(row) && inHour(row.at));
  const estimatedPoints = Num.sumAll(A.map(transports, costOfRow(table)));
  const ghSpawns = Num.sumAll(A.map(ending, (window) => window.ghSpawns));
  const crossing = A.filter(ending, (window) => window.crossesReset);
  const telescoped = pipe(
    A.filter(ending, (window) => window.sameEpoch),
    // Consecutive same-epoch windows chain end to start; a gap is a new epoch run.
    A.reduce(A.empty<A.NonEmptyReadonlyArray<LedgerWindow>>(), (runs, window) =>
      O.match(A.last(runs), {
        onNone: () => A.append(runs, A.of(window)),
        onSome: (run) =>
          millis(A.lastNonEmpty(run).to) === millis(window.from)
            ? A.append(A.dropRight(runs, 1), A.append(run, window))
            : A.append(runs, A.of(window)),
      })
    ),
    A.map((run) => Math.max(0, Num.sumAll(A.map(run, (window) => window.delta)))),
    Num.sumAll
  );
  const fleetUsed = A.isReadonlyArrayNonEmpty(ending)
    ? O.some(telescoped + Num.sumAll(A.map(crossing, (window) => window.resetLowerBound)))
    : O.none<number>();
  const ghEstimated = O.match(fleetUsed, {
    onNone: () => 0,
    onSome: (used) => Math.min(ghSpawns, Math.max(0, used - estimatedPoints)),
  });
  return LedgerHourKey.make({
    key,
    fleetUsed,
    fleetUsedIsLowerBound: A.isReadonlyArrayNonEmpty(crossing),
    anchor: pipe(
      A.last(ending),
      O.map((window): WindowAnchor => window.anchor),
      O.getOrElse((): WindowAnchor => (key.resource === "graphql" ? "transport" : "sample"))
    ),
    attributedNominal: Num.sumAll(A.map(ending, (window) => window.attributedNominal)),
    estimatedPoints,
    ghSpawns,
    ghEstimated,
    unattributed: O.map(fleetUsed, (used) => Math.max(0, used - estimatedPoints - ghEstimated)),
    overAttributed: O.exists(fleetUsed, (used) => estimatedPoints > used),
    byCommand: commandSpendsOf(transports, spawns, table),
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
    keys: A.map(keyed, ({ key, all }) => hourOf({ hour, key, rows: input.rows, windows: all, costs })),
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
  const second = A.get(args, 1);
  const plainWord = (word: string) => /^[a-z][a-z-]{0,31}$/.test(word);
  if (first === "api") {
    const graphql = O.exists(second, (word) => word === "graphql");
    const endpoint = O.getOrElse(
      A.findFirst(A.drop(args, 1), (word) => !Str.startsWith("-")(word)),
      () => ""
    );
    return {
      subcommand: GhSubcommand.make(graphql ? "api graphql" : "api rest"),
      resource: graphql ? "graphql" : /^\/?search\//.test(endpoint) ? "search" : "core",
    };
  }
  const subcommand = plainWord(first)
    ? O.match(O.filter(second, plainWord), {
        onNone: () => first,
        onSome: (word) => `${first} ${word}`,
      })
    : "unknown";
  return {
    subcommand: GhSubcommand.make(subcommand),
    resource: A.contains(GRAPHQL_GH_COMMANDS, first)
      ? "graphql"
      : A.contains(CORE_GH_COMMANDS, first)
        ? "core"
        : "unknown",
  };
};
