/**
 * The GitHub budget ledger service: it records what each GitHub request made
 * by repo tooling cost, keyed identity × resource × command × host, and
 * answers reserve, reading and rollup questions from what it recorded.
 *
 * **Details**
 *
 * The write side never fails and never lets a defect out: a store failure is
 * logged at debug and the request it describes is unaffected. The read side
 * never resolves an identity; it enumerates keys from `latest/*.json` and the
 * in-process cache only, mapped through the alias map.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeOS from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { constant, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import {
  anchorsOf,
  calibrationOf,
  canonicalRow,
  ghSpawnFieldsOf,
  hourStartOf,
  identityOfObservation,
  keysOfRows,
  nominalCostOf,
  readingOfTransport,
  readingsOfSample,
  reserveOf,
  rollupOf,
  summaryOf,
  usableReadingOf,
} from "./GithubLedger.reducers.ts";
import {
  BucketKey,
  bucketKeyString,
  canonicalIdentity,
  DEFAULT_COMMAND_LABEL,
  emptyIdentityAliases,
  GithubLedgerRow,
  hostLabelOf,
  LedgerRange,
  LegacyLedgerHour,
  normalizeOperation,
  RetentionCutoffs,
  UNRESOLVED_IDENTITY,
} from "./GithubLedger.schemas.ts";
import { GithubLedgerStore, hoursOfRange, layerGithubLedgerStoreLive } from "./GithubLedger.store.ts";
import type { CredentialFingerprint, RateLimitObservation, RateLimitSinkShape } from "@beep/github/Resilience";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { GhSpawnObservation, GhSpawnSinkShape } from "../repo-run/GhSpawnSink.ts";
import type {
  BucketReading,
  CalibrationRow,
  GithubIdentityLabel,
  GithubLedgerCommandLabel,
  GithubLedgerError,
  HostLabel,
  IdentityAliases,
  LedgerHourResult,
  LedgerHourRollup,
  LedgerRollupRead,
  LedgerSummary,
  ReserveSignal,
  SampleRow,
} from "./GithubLedger.schemas.ts";

const $I = $RepoCliId.create("internal/github/GithubLedger.service");

const TRANSPORT_LATEST_INTERVAL = Duration.seconds(30);
const RAW_RETENTION = Duration.hours(72);
const ROLLUP_RETENTION = Duration.days(35);
const RAW_KEEP_AT_LEAST = Duration.hours(24);
const RAW_MAX_BYTES = 256 * 1024 * 1024;
const ROLLUP_GRACE = Duration.minutes(75);
const ROLLUP_IDLE = Duration.hours(3);
const ROLLUP_CONTEXT_BEFORE = Duration.hours(2);
const ROLLUP_CONTEXT_AFTER = Duration.hours(24);
const CALIBRATION_LOOKBACK = Duration.days(7);
const LATEST_RETENTION = Duration.hours(24);
const RESERVE_RESOURCES: ReadonlyArray<string> = ["core", "graphql", "search"];

/**
 * The beep command the current fiber runs, for ledger rows. Read per record,
 * so the order in which the root provides it and the ledger does not matter.
 *
 * **Example** (Read the default command)
 *
 * ```ts
 * import { GithubLedgerCommand } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(GithubLedgerCommand)) // "beep"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const GithubLedgerCommand: Context.Reference<GithubLedgerCommandLabel> =
  Context.Reference<GithubLedgerCommandLabel>($I`GithubLedgerCommand`, { defaultValue: () => DEFAULT_COMMAND_LABEL });

/**
 * The ledger's operations.
 *
 * @category services
 * @since 0.0.0
 */
export interface GithubBudgetLedgerShape {
  /** The alias map; empty when it cannot be read. */
  readonly aliases: Effect.Effect<IdentityAliases>;
  /** The repo-run `gh` sink bound to this ledger. */
  readonly ghSink: GhSpawnSinkShape;
  /**
   * The hourly rollups of a range, computing missing or incomplete ones from
   * rows; retained v1 hours without raw rows carry an explicit legacy marker.
   */
  readonly hours: (range: LedgerRange) => Effect.Effect<ReadonlyArray<LedgerHourResult>, GithubLedgerError>;
  /** When the identity was last sampled. */
  readonly lastSampleAt: (identity: GithubIdentityLabel) => Effect.Effect<O.Option<DateTime.Utc>, GithubLedgerError>;
  /** The newest reading of a bucket, from memory and `latest/` only. */
  readonly latest: (key: BucketKey) => Effect.Effect<O.Option<BucketReading>, GithubLedgerError>;
  /**
   * The reading of a bucket that its reserve verdict rests on: the newest
   * reading of the most constrained fresh, live bucket under the key, else the
   * newest reading; for a `graphql` key, sample readings only when calibration
   * admits them. Reads memory, `latest/` and the calibration file only.
   */
  readonly latestUsable: (key: BucketKey) => Effect.Effect<O.Option<BucketReading>, GithubLedgerError>;
  /** Write due rollups and the summary, then apply retention, `latest/` readings older than 24 h included. */
  readonly prune: Effect.Effect<void, GithubLedgerError>;
  /** Record that a `token:` label belongs to a user label; never fails. */
  readonly recordAlias: (token: GithubIdentityLabel, user: GithubIdentityLabel) => Effect.Effect<void>;
  /** Record one calibration pair; never fails. */
  readonly recordCalibration: (row: CalibrationRow) => Effect.Effect<void>;
  /** Record one `/rate_limit` sample and replace the identity's latest sample; never fails. */
  readonly recordSample: (sample: SampleRow) => Effect.Effect<void>;
  /** Record one `gh` spawn; never fails. */
  readonly recordSpawn: (spawn: GhSpawnObservation) => Effect.Effect<void>;
  /** Record one transport observation; never fails. */
  readonly recordTransport: (observation: RateLimitObservation) => Effect.Effect<void>;
  /** The reserve signal of a bucket. */
  readonly reserve: (key: BucketKey) => Effect.Effect<ReserveSignal, GithubLedgerError>;
  /** The reserve signal of every known identity's `core`, `graphql` and `search` buckets. */
  readonly reserves: Effect.Effect<ReadonlyArray<ReserveSignal>, GithubLedgerError>;
  /** The driver-facing sink bound to this ledger. */
  readonly sink: RateLimitSinkShape;
  /** The precomputed hot-parcel summary. */
  readonly summary: Effect.Effect<O.Option<LedgerSummary>, GithubLedgerError>;
}

/**
 * The GitHub budget ledger.
 *
 * **Example** (Read the default command through the service module)
 *
 * ```ts
 * import { GithubBudgetLedger, layerGithubBudgetLedger, layerGithubLedgerStoreMemory } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const layer = layerGithubBudgetLedger().pipe(Layer.provide(layerGithubLedgerStoreMemory))
 * const summary = Effect.runSync(GithubBudgetLedger.use((ledger) => ledger.summary).pipe(Effect.provide(layer)))
 * console.log(summary._tag) // "None"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GithubBudgetLedger extends Context.Service<GithubBudgetLedger, GithubBudgetLedgerShape>()(
  $I`GithubBudgetLedger`
) {}

/**
 * How a ledger instance labels its rows.
 *
 * @category models
 * @since 0.0.0
 */
export interface GithubBudgetLedgerOptions {
  /** The environment token fingerprint for gh; defaults to unknown. */
  readonly ghCredential?: Effect.Effect<O.Option<CredentialFingerprint>>;
  /** The `gh` CLI identity, for spawn rows; defaults to `unresolved`. */
  readonly ghIdentity?: Effect.Effect<GithubIdentityLabel>;
  /** The host label; defaults to the short hostname. */
  readonly host?: HostLabel;
}

const absorb =
  (operation: string) =>
  <E, R>(effect: Effect.Effect<void, E, R>): Effect.Effect<void, never, R> =>
    effect.pipe(
      Effect.catchCause((cause) =>
        Effect.logDebug("github.ledger.record", cause).pipe(Effect.annotateLogs({ operation }))
      )
    );

const newer = (self: BucketReading, that: BucketReading): BucketReading =>
  DateTime.toEpochMillis(that.asOf) >= DateTime.toEpochMillis(self.asOf) ? that : self;

const byAsOf = Order.mapInput(Order.Number, (reading: BucketReading) => DateTime.toEpochMillis(reading.asOf));

/**
 * Build a ledger over the provided {@link GithubLedgerStore}.
 *
 * **Example** (Build against the memory store)
 *
 * ```ts
 * import { layerGithubLedgerStoreMemory, makeGithubBudgetLedger } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * const ledger = Effect.runSync(makeGithubBudgetLedger().pipe(Effect.provide(layerGithubLedgerStoreMemory)))
 * console.log(typeof ledger.recordTransport) // "function"
 * ```
 *
 * @param options - The host label and `gh` identity.
 * @returns The ledger.
 * @category constructors
 * @since 0.0.0
 */
export const makeGithubBudgetLedger = Effect.fn("GithubBudgetLedger.make")(function* (
  options: GithubBudgetLedgerOptions = {}
) {
  const store = yield* GithubLedgerStore;
  const host = options.host ?? hostLabelOf(NodeOS.hostname());
  const pid = yield* Effect.sync(() => process.pid);
  const ghIdentity = yield* Effect.cached(options.ghIdentity ?? Effect.succeed(UNRESOLVED_IDENTITY));
  const ghCredential = options.ghCredential ?? Effect.succeedNone;
  const cache = yield* Ref.make(HashMap.empty<string, BucketReading>());
  const lastLatestWrite = yield* Ref.make(HashMap.empty<string, number>());
  const aliasCache = yield* Ref.make(O.none<IdentityAliases>());

  const aliases: Effect.Effect<IdentityAliases> = Effect.flatMap(
    Ref.get(aliasCache),
    O.match({
      onSome: Effect.succeed,
      onNone: () =>
        store.readAliases.pipe(
          Effect.tap((loaded) => Ref.set(aliasCache, O.some(loaded))),
          Effect.catchCause((cause) => Effect.as(Effect.logDebug("github.ledger.aliases", cause), emptyIdentityAliases))
        ),
    })
  );

  const remember = (reading: BucketReading) =>
    Ref.update(cache, (current) => {
      const key = `${bucketKeyString(reading.key)}|${reading.source}`;
      return HashMap.set(
        current,
        key,
        O.match(HashMap.get(current, key), { onNone: () => reading, onSome: (old) => newer(old, reading) })
      );
    });

  const writeLatestThrottled = Effect.fnUntraced(function* (reading: BucketReading) {
    const key = `${bucketKeyString(reading.key)}|${reading.source}`;
    const now = DateTime.toEpochMillis(reading.asOf);
    const due = yield* Ref.modify(lastLatestWrite, (current) => {
      const last = HashMap.get(current, key);
      const ready = O.match(last, {
        onNone: () => true,
        onSome: (at) => now - at >= Duration.toMillis(TRANSPORT_LATEST_INTERVAL),
      });
      return [ready, ready ? HashMap.set(current, key, now) : current] as const;
    });
    if (due) yield* store.writeLatestTransport(reading);
  });

  const recordTransport = Effect.fnUntraced(function* (observation: RateLimitObservation) {
    const command = yield* GithubLedgerCommand;
    const current = yield* aliases;
    const identity = identityOfObservation(observation, current);
    const operation = normalizeOperation(observation.operation);
    const snapshot = observation.snapshot;
    const row = GithubLedgerRow.cases.Transport.make({
      at: observation.at,
      host,
      command,
      identity,
      credential:
        observation.credential === "token" && !Str.startsWith("app:")(identity) ? observation.fingerprint : O.none(),
      resource: snapshot.resource,
      kind: observation.kind,
      operation,
      status: observation.status,
      outcome: observation.outcome,
      limit: snapshot.limit,
      remaining: snapshot.remaining,
      used: snapshot.used,
      resetAt: DateTime.makeUnsafe(snapshot.resetEpochSeconds * 1000),
      nominalCost: nominalCostOf({ status: observation.status, outcome: observation.outcome, operation }),
      pid,
    });
    yield* store.append(row);
    const reading = readingOfTransport(row);
    yield* remember(reading);
    yield* writeLatestThrottled(reading);
  }, absorb("recordTransport"));

  const recordSpawn = Effect.fnUntraced(function* (spawn: GhSpawnObservation) {
    const command = yield* GithubLedgerCommand;
    const current = yield* aliases;
    const gh = yield* ghIdentity;
    const fields = ghSpawnFieldsOf(spawn.args);
    const credential = yield* ghCredential;
    const identity = canonicalIdentity(current)(gh);
    yield* store.append(
      GithubLedgerRow.cases.GhSpawn.make({
        at: spawn.at,
        host,
        command,
        identity,
        credential: Str.startsWith("app:")(identity) ? O.none() : credential,
        pid,
        subcommand: fields.subcommand,
        resource: fields.resource,
        exitCode: spawn.exitCode,
        durationMillis: spawn.durationMillis,
      })
    );
  }, absorb("recordSpawn"));

  const recordSample = Effect.fnUntraced(function* (sample: SampleRow) {
    const current = yield* aliases;
    const identity = canonicalIdentity(current)(sample.identity);
    const row = { ...sample, identity, credential: Str.startsWith("app:")(identity) ? O.none() : sample.credential };
    yield* store.append(row);
    yield* store.writeLatestSample(row);
    yield* Effect.forEach(readingsOfSample(row), remember, { discard: true });
  }, absorb("recordSample"));

  const recordCalibration = (row: CalibrationRow) =>
    store.append(row).pipe(Effect.andThen(store.appendCalibration(row)), absorb("recordCalibration"));

  const recordAlias = (token: GithubIdentityLabel, user: GithubIdentityLabel) =>
    store.writeAlias(token, user).pipe(Effect.andThen(Ref.set(aliasCache, O.none())), absorb("recordAlias"));

  const canonicalKey = (current: IdentityAliases) => (key: BucketKey) =>
    BucketKey.make({ identity: canonicalIdentity(current)(key.identity), resource: key.resource });

  const canonicalReading = (current: IdentityAliases) => (reading: BucketReading) => {
    const key = canonicalKey(current)(reading.key);
    return key.identity === reading.key.identity ? reading : { ...reading, key };
  };

  // Keys and readings come only from the cache and latest/*.json, never from an identity resolution.
  const readings = Effect.gen(function* () {
    const current = yield* aliases;
    const cached = yield* Ref.get(cache);
    const transports = yield* store.latestTransport;
    const sampled = yield* store.latestSamples;
    return cached.pipe(
      HashMap.values,
      A.fromIterable,
      A.appendAll(transports),
      A.appendAll(A.flatMap(sampled, readingsOfSample)),
      A.map(canonicalReading(current))
    );
  });

  const readingsFor = (key: BucketKey, all: ReadonlyArray<BucketReading>) =>
    A.filter(all, (reading) => bucketKeyString(reading.key) === bucketKeyString(key));

  const latest = Effect.fnUntraced(function* (key: BucketKey) {
    const current = yield* aliases;
    const all = yield* readings;
    return A.last(A.sort(readingsFor(canonicalKey(current)(key), all), byAsOf));
  });

  // The calibration file, never the raw hours: the read side and every prune judge calibration from it.
  const calibrationRows = Effect.fnUntraced(function* (now: DateTime.Utc) {
    const current = yield* aliases;
    const since = DateTime.toEpochMillis(now) - Duration.toMillis(CALIBRATION_LOOKBACK);
    const rows = yield* store.calibrations;
    return A.map(
      A.filter(rows, (row) => DateTime.toEpochMillis(row.at) > since),
      canonicalRow(current)
    );
  });

  // Calibration is read only when a graphql verdict depends on sample readings.
  const admitsSamples = Effect.fnUntraced(function* (key: BucketKey, own: ReadonlyArray<BucketReading>) {
    const now = yield* DateTime.now;
    const needsCalibration =
      key.resource === "graphql" &&
      A.some(own, (reading) => reading.basis === "sample") &&
      !A.some(own, (reading) => reading.basis === "transport");
    if (!needsCalibration) return false;
    const calibration = yield* calibrationRows(now);
    return calibrationOf({ now, identity: key.identity })(calibration);
  });

  const signalOf = Effect.fnUntraced(function* (key: BucketKey, all: ReadonlyArray<BucketReading>) {
    const now = yield* DateTime.now;
    const own = readingsFor(key, all);
    const admitGraphqlSamples = yield* admitsSamples(key, own);
    return reserveOf({ now, admitGraphqlSamples })(key, own);
  });

  const reserve = Effect.fnUntraced(function* (key: BucketKey) {
    const current = yield* aliases;
    const all = yield* readings;
    return yield* signalOf(canonicalKey(current)(key), all);
  });

  const latestUsable = Effect.fnUntraced(function* (key: BucketKey) {
    const now = yield* DateTime.now;
    const current = yield* aliases;
    const all = yield* readings;
    const target = canonicalKey(current)(key);
    const own = readingsFor(target, all);
    const admitGraphqlSamples = yield* admitsSamples(target, own);
    return usableReadingOf({ now, admitGraphqlSamples })(target, own);
  });

  const reserves = Effect.gen(function* () {
    const all = yield* readings;
    const keys = pipe(
      A.map(all, (reading): BucketKey => reading.key),
      A.filter((key) => A.contains(RESERVE_RESOURCES, key.resource)),
      A.dedupeWith((self: BucketKey, that: BucketKey) => bucketKeyString(self) === bucketKeyString(that))
    );
    return yield* Effect.forEach(keys, (key) => signalOf(key, all));
  });

  const lastSampleAt = Effect.fnUntraced(function* (identity: GithubIdentityLabel) {
    const current = yield* aliases;
    const target = canonicalIdentity(current)(identity);
    const sampled = yield* store.latestSamples;
    return pipe(
      sampled,
      A.filter((sample) => canonicalIdentity(current)(sample.identity) === target),
      A.map((sample) => sample.at),
      A.sort(DateTime.Order),
      A.last
    );
  });

  const contextRange = (hour: DateTime.Utc, now: DateTime.Utc): LedgerRange =>
    LedgerRange.make({
      from: DateTime.subtract(hour, { milliseconds: Duration.toMillis(ROLLUP_CONTEXT_BEFORE) }),
      to: DateTime.min(now, DateTime.add(hour, { milliseconds: Duration.toMillis(ROLLUP_CONTEXT_AFTER) })),
    });

  // One read of the union of the hours' context ranges, sliced per hour in memory, so a
  // run of incomplete hours costs one pass over the raw files instead of 26 hours each.
  const contextRowsFor = Effect.fnUntraced(function* (pending: ReadonlyArray<DateTime.Utc>, now: DateTime.Utc) {
    // With nothing pending no hour is ever sliced, so no read is needed.
    if (!A.isReadonlyArrayNonEmpty(pending)) return constant(A.empty<GithubLedgerRow>());
    const current = yield* aliases;
    const union = LedgerRange.make({
      from: contextRange(A.headNonEmpty(pending), now).from,
      to: contextRange(A.lastNonEmpty(pending), now).to,
    });
    const unionRows = yield* store.rows(union);
    const rows = A.map(unionRows, canonicalRow(current));
    return (hour: DateTime.Utc): ReadonlyArray<GithubLedgerRow> => {
      const range = contextRange(hour, now);
      const from = DateTime.toEpochMillis(range.from);
      const to = DateTime.toEpochMillis(range.to);
      return A.filter(rows, (row) => DateTime.toEpochMillis(row.at) > from && DateTime.toEpochMillis(row.at) <= to);
    };
  });

  const admitter =
    (now: DateTime.Utc, calibration: ReadonlyArray<GithubLedgerRow>) =>
    (identity: GithubIdentityLabel): boolean =>
      calibrationOf({ now, identity })(calibration);

  const isRipe = (
    hour: DateTime.Utc,
    rows: ReadonlyArray<GithubLedgerRow>,
    admit: (identity: GithubIdentityLabel) => boolean
  ): boolean => {
    const start = DateTime.toEpochMillis(hour);
    const end = start + Duration.toMillis(Duration.hours(1));
    const at = (row: { readonly at: DateTime.Utc }) => DateTime.toEpochMillis(row.at);
    const hourRows = A.filter(rows, (row) => at(row) >= start && at(row) < end);
    return A.every(keysOfRows(hourRows), (key) => {
      const anchors = anchorsOf({ key, rows, admitGraphqlSamples: admit(key.identity) });
      const anchoredInHour = A.some(anchors, (anchor) => at(anchor) >= start && at(anchor) < end);
      return !anchoredInHour || A.some(anchors, (anchor) => at(anchor) >= end);
    });
  };

  const storedComplete = (hour: DateTime.Utc) =>
    Effect.map(
      store.readRollup(hour),
      (stored) =>
        [
          hour,
          O.filter(stored, (rollup) => rollup.schemaVersion === "github-ledger-rollup/v2" && rollup.complete),
        ] as const
    );

  const incompleteHours = (
    stored: ReadonlyArray<readonly [DateTime.Utc, O.Option<LedgerRollupRead>]>
  ): ReadonlyArray<DateTime.Utc> =>
    A.map(
      A.filter(stored, ([, complete]) => O.isNone(complete)),
      ([hour]) => hour
    );

  const hours = Effect.fnUntraced(function* (range: LedgerRange) {
    const now = yield* DateTime.now;
    const calibration = yield* calibrationRows(now);
    const admit = admitter(now, calibration);
    const stored = yield* Effect.forEach(hoursOfRange(range), storedComplete);
    const contextOf = yield* contextRowsFor(incompleteHours(stored), now);
    return yield* Effect.forEach(
      stored,
      Effect.fnUntraced(function* ([hour, complete]): Effect.fn.Return<LedgerHourResult, GithubLedgerError> {
        if (O.isSome(complete) && complete.value.schemaVersion === "github-ledger-rollup/v2") return complete.value;
        const rows = contextOf(hour);
        const original = yield* store.readRollup(hour);
        const start = DateTime.toEpochMillis(hour);
        const hasRows = A.some(
          rows,
          (row) =>
            DateTime.toEpochMillis(row.at) >= start &&
            DateTime.toEpochMillis(row.at) < start + Duration.toMillis(Duration.hours(1))
        );
        if (!hasRows && O.isSome(original) && original.value.schemaVersion === "github-ledger-rollup/v1") {
          const legacy = original.value;
          return LegacyLedgerHour.make({
            hour: legacy.hour,
            host: legacy.host,
            complete: false,
            cells: A.map(legacy.cells, (cell) => ({ ...cell, nominal: null })),
            keys: A.map(legacy.keys, (key) => ({
              ...key,
              fleetUsed: O.none(),
              fleetUsedIsLowerBound: false,
              attributedNominal: null,
              estimatedPoints: null,
              ghSpawns: null,
              ghEstimated: O.none(),
              unattributed: O.none(),
              overAttributed: false,
              byCommand: A.map(key.byCommand, (command) => ({ ...command, nominal: null, estimatedPoints: null })),
            })),
            operationCosts: [],
            windows: [],
          });
        }
        return rollupOf({ hour, host, complete: false, rows, admitGraphqlSamples: admit });
      })
    );
  });

  const prune = Effect.gen(function* () {
    const now = yield* DateTime.now;
    const nowMillis = DateTime.toEpochMillis(now);
    const current = yield* aliases;
    const calibration = yield* calibrationRows(now);
    const admit = admitter(now, calibration);
    const rowHours = yield* store.rowHours;
    const graced = A.filter(
      rowHours,
      (hour) => nowMillis >= DateTime.toEpochMillis(hour) + Duration.toMillis(ROLLUP_GRACE)
    );
    const stored = yield* Effect.forEach(graced, storedComplete);
    const pending = incompleteHours(stored);
    const contextOf = yield* contextRowsFor(pending, now);
    yield* Effect.forEach(
      pending,
      (hour) => {
        const rows = contextOf(hour);
        const complete = isRipe(hour, rows, admit);
        return complete || nowMillis >= DateTime.toEpochMillis(hour) + Duration.toMillis(ROLLUP_IDLE)
          ? store.writeRollup(rollupOf({ hour, host, complete, rows, admitGraphqlSamples: admit }))
          : Effect.void;
      },
      { discard: true }
    );
    const recentRows = yield* store.rows(LedgerRange.make({ from: DateTime.subtract(now, { hours: 1 }), to: now }));
    const previous = yield* store.readRollup(DateTime.subtract(hourStartOf(now), { hours: 1 }));
    yield* store.writeSummary(
      summaryOf({
        now,
        rows: A.map(recentRows, canonicalRow(current)),
        lastComplete: O.filter(
          previous,
          (rollup): rollup is LedgerHourRollup => rollup.schemaVersion === "github-ledger-rollup/v2" && rollup.complete
        ),
      })
    );
    yield* store.removeBefore(
      RetentionCutoffs.make({
        rowsBefore: DateTime.subtract(now, { milliseconds: Duration.toMillis(RAW_RETENTION) }),
        rollupsBefore: DateTime.subtract(now, { milliseconds: Duration.toMillis(ROLLUP_RETENTION) }),
        rowsMaxBytes: RAW_MAX_BYTES,
        rowsKeepAfter: DateTime.subtract(now, { milliseconds: Duration.toMillis(RAW_KEEP_AT_LEAST) }),
        latestBefore: DateTime.subtract(now, { milliseconds: Duration.toMillis(LATEST_RETENTION) }),
        calibrationsBefore: DateTime.subtract(now, { milliseconds: Duration.toMillis(CALIBRATION_LOOKBACK) }),
      })
    );
  }).pipe(Effect.withSpan("GithubBudgetLedger.prune"));

  const ledger: GithubBudgetLedgerShape = {
    recordTransport,
    recordSpawn,
    recordSample,
    recordCalibration,
    recordAlias,
    aliases,
    sink: { record: recordTransport },
    ghSink: { record: recordSpawn },
    latest,
    latestUsable,
    reserve,
    reserves,
    lastSampleAt,
    summary: store.readSummary,
    hours,
    prune,
  };
  return ledger;
});

/**
 * {@link GithubBudgetLedger} over the provided {@link GithubLedgerStore}.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { layerGithubBudgetLedger } from "@beep/repo-cli/test/SharedInternals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerGithubBudgetLedger())) // true
 * ```
 *
 * @param options - The host label and `gh` identity.
 * @returns The ledger layer.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubBudgetLedger = (
  options: GithubBudgetLedgerOptions = {}
): Layer.Layer<GithubBudgetLedger, never, GithubLedgerStore> =>
  Layer.effect(GithubBudgetLedger, makeGithubBudgetLedger(options));

/**
 * {@link GithubBudgetLedger} over the host-scoped file store.
 *
 * **Example** (Inspect the live layer)
 *
 * ```ts
 * import { layerGithubBudgetLedgerLive } from "@beep/repo-cli/test/SharedInternals"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerGithubBudgetLedgerLive())) // true
 * ```
 *
 * @param options - The host label and `gh` identity.
 * @returns The ledger layer over the file store.
 * @category layers
 * @since 0.0.0
 */
export const layerGithubBudgetLedgerLive = (
  options: GithubBudgetLedgerOptions = {}
): Layer.Layer<GithubBudgetLedger, never, FileSystem.FileSystem | Path.Path> =>
  layerGithubBudgetLedger(options).pipe(Layer.provide(layerGithubLedgerStoreLive));
