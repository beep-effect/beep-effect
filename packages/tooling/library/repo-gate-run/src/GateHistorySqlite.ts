/**
 * The SQLite history store: one database file per repository, shared by
 * every clone and worktree, partitioned by branch.
 *
 * **Details**
 *
 * The driver is `@beep/sqlite`, loaded with a dynamic import the first time
 * the store is used, so importing this module never loads `bun:sqlite`; the
 * rest of the library, the Vitest adapter included, never imports it. Every
 * connection runs in write-ahead-log mode with a busy timeout (the driver's
 * defaults). Migrations are versioned by `PRAGMA user_version` and idempotent,
 * and run in one write transaction, so two first openers converge on one
 * schema. A run, its observations and the retention prune commit in one
 * transaction whose body never yields to the scheduler, the invariant
 * upstream holds with `References.PreventSchedulerYield`
 * (`packages/engine/src/utils/persist-transaction.ts`). A busy open or a
 * contended migration retries on a jittered exponential schedule. The
 * driver's errors never cross the store's port: each is translated into a
 * `GateHistoryError`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  DeltaFailure,
  DeltaRun,
  GateHistoryError,
  HistoryConfig,
  isFlaky,
  Observation,
  ObservationOrigin,
  ObservedOutcome,
} from "@beep/gate-report/History";
import { ItemKind } from "@beep/gate-report/Vocabulary";
import { $RepoGateRunId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Inspectable from "effect/Inspectable";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as References from "effect/References";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import * as SqlError from "effect/sql/SqlError";
import { HistoryAnswer } from "./GateHistory.ts";
import { HistoryItemSeries, HistoryRunView, KnownKey, observesAbsence, withAbsentPassed } from "./GateHistoryRecord.ts";
import { GateHistoryStore, makeGateHistoryStore } from "./GateHistoryStore.ts";
import type { GateHistoryErrorReason } from "@beep/gate-report/History";
import type * as SqlClient from "effect/sql/SqlClient";
import type {
  HistoryBackend,
  HistoryItemQuery,
  HistoryRunRecord,
  HistoryRunsQuery,
  LaneQuery,
  PreviousRunQuery,
  RecordedRunQuery,
} from "./GateHistoryRecord.ts";

const $I = $RepoGateRunId.create("GateHistorySqlite");

/**
 * Where the SQLite store lives and how it keeps history.
 *
 * **Details**
 *
 * `filename` names the database file; `":memory:"` opens a private database.
 * The file's directory must exist. `busyTimeoutMs` is how long a write
 * waits on another connection's lock (the driver's 5 s by default). Each lock
 * wait while opening or reading is capped at `config.deadlineMs`; an open
 * retries a busy store, so it can take several such waits.
 *
 * **Example** (A store file)
 *
 * ```ts
 * import { GateHistorySqliteOptions } from "@beep/repo-gate-run/GateHistorySqlite";
 *
 * const options = GateHistorySqliteOptions.make({ filename: "/home/alice/.local/state/beep/gate-history/x.sqlite" });
 * console.log(options.config.window); // 10
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GateHistorySqliteOptions extends S.Opaque<GateHistorySqliteOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    filename: S.NonEmptyString,
    config: HistoryConfig.pipe(S.withConstructorDefault(Effect.sync(() => HistoryConfig.make({})))),
    busyTimeoutMs: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.withConstructorDefault(Effect.succeed(5000))),
  }).pipe(
    $I.annoteSchema("GateHistorySqliteOptions", {
      description: "The SQLite history store's database file, its history configuration and its busy timeout.",
    })
  )
) {}

type Sql = SqlClient.SqlClient;

const BUSY_REASONS = ["LockTimeoutError", "DeadlockError"];

const unwrappedOptionField = (error: unknown, key: "cause" | "message"): unknown => {
  const value = P.hasProperty(error, key) ? error[key] : undefined;
  return O.isOption(value) ? O.getOrUndefined(value) : value;
};

const isBusy = (error: unknown): boolean =>
  SqlError.isSqlError(error)
    ? A.contains(BUSY_REASONS, error.reason._tag)
    : SqlError.isSqlError(unwrappedOptionField(error, "cause")) && isBusy(unwrappedOptionField(error, "cause"));

const messageOf = (error: unknown): string => {
  const message = unwrappedOptionField(error, "message");
  return P.isString(message) && Str.isNonEmpty(message) ? message : Inspectable.toStringUnknown(error);
};

/**
 * Translate a driver failure into the store's error: a busy or deadlocked
 * database (directly, or as the cause of a driver error) is `open-busy`,
 * anything else takes the operation's reason; the message is kept.
 *
 * **Example** (A failed write)
 *
 * ```ts
 * import { translateStoreError } from "@beep/repo-gate-run/GateHistorySqlite";
 *
 * console.log(translateStoreError("write-failed")(new Error("disk I/O error")).reason); // write-failed
 * ```
 *
 * @param reason - the reason when the failure is not contention
 * @returns a function from the driver's failure to a `GateHistoryError`
 * @category errors
 * @since 0.0.0
 */
export const translateStoreError =
  (reason: GateHistoryErrorReason) =>
  (error: unknown): GateHistoryError =>
    GateHistoryError.make({ reason: isBusy(error) ? "open-busy" : reason, message: messageOf(error) });

const translate = translateStoreError;

const decodeRows =
  <Row, I>(schema: S.Codec<ReadonlyArray<Row>, I>) =>
  <E>(rows: Effect.Effect<ReadonlyArray<unknown>, E>) =>
    Effect.flatMap(rows, (raw) => Effect.orDie(S.decodeUnknownEffect(schema)(raw)));

const MIGRATIONS: ReadonlyArray<(sql: Sql) => Effect.Effect<unknown, SqlError.SqlError>> = [
  (sql) =>
    Effect.all(
      [
        sql`CREATE TABLE IF NOT EXISTS gate_history_runs (
          run_id TEXT PRIMARY KEY,
          gate TEXT NOT NULL,
          subject TEXT NOT NULL,
          branch TEXT NOT NULL,
          origin TEXT NOT NULL,
          input_fingerprint TEXT NOT NULL,
          head TEXT,
          at_ms INTEGER NOT NULL,
          item_kind TEXT NOT NULL,
          units_json TEXT NOT NULL,
          failed_json TEXT NOT NULL,
          observations INTEGER NOT NULL
        )`,
        sql`CREATE INDEX IF NOT EXISTS gate_history_runs_series ON gate_history_runs (gate, subject, branch, at_ms)`,
        sql`CREATE TABLE IF NOT EXISTS gate_history_observations (
          run_id TEXT NOT NULL,
          gate TEXT NOT NULL,
          subject TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          unit TEXT NOT NULL,
          title TEXT NOT NULL,
          branch TEXT NOT NULL,
          origin TEXT NOT NULL,
          input_fingerprint TEXT NOT NULL,
          head TEXT,
          at_ms INTEGER NOT NULL,
          outcome TEXT NOT NULL,
          attempt INTEGER NOT NULL,
          PRIMARY KEY (run_id, fingerprint, attempt)
        )`,
        sql`CREATE INDEX IF NOT EXISTS gate_history_observations_series
          ON gate_history_observations (gate, subject, fingerprint, branch, origin, at_ms)`,
        sql`CREATE INDEX IF NOT EXISTS gate_history_observations_units
          ON gate_history_observations (gate, subject, branch, origin, unit)`,
      ],
      { concurrency: 1, discard: true }
    ),
  (sql) =>
    Effect.all(
      [
        sql`CREATE TABLE IF NOT EXISTS gate_history_ingested (
          run_id TEXT PRIMARY KEY,
          branch TEXT NOT NULL,
          answer_json TEXT
        )`,
        sql`INSERT OR IGNORE INTO gate_history_ingested (run_id, branch) SELECT run_id, branch FROM gate_history_runs`,
        sql`INSERT OR IGNORE INTO gate_history_ingested (run_id, branch)
          SELECT DISTINCT run_id, branch FROM gate_history_observations`,
        sql`ALTER TABLE gate_history_runs ADD COLUMN partial INTEGER NOT NULL DEFAULT 0`,
      ],
      { concurrency: 1, discard: true }
    ),
];

/**
 * The schema version the store migrates to.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { SCHEMA_VERSION } from "@beep/repo-gate-run/GateHistorySqlite";
 *
 * console.log(SCHEMA_VERSION); // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SCHEMA_VERSION = MIGRATIONS.length;

const VersionRows = S.Array(S.Struct({ user_version: S.Finite }));

const schemaVersion = (sql: Sql) =>
  sql`PRAGMA user_version`.pipe(decodeRows(VersionRows), Effect.map(A.reduce(0, (_, row) => row.user_version)));

const migrate = Effect.fnUntraced(function* (sql: Sql) {
  const found = yield* schemaVersion(sql);
  if (found >= SCHEMA_VERSION) return;
  yield* sql.withTransaction(
    Effect.gen(function* () {
      const current = yield* schemaVersion(sql);
      yield* Effect.forEach(A.drop(MIGRATIONS, current), (step) => step(sql), { concurrency: 1, discard: true });
      yield* sql.unsafe(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    })
  );
});

const Units = S.String.pipe(S.Array, S.fromJsonString);
const Failures = DeltaFailure.pipe(S.Array, S.fromJsonString);

const ObservationRow = S.Struct({
  run_id: S.String,
  fingerprint: S.String,
  unit: S.String,
  title: S.String,
  branch: S.String,
  origin: ObservationOrigin,
  input_fingerprint: S.String,
  head: S.NullOr(S.String),
  at_ms: S.Finite,
  outcome: ObservedOutcome,
  attempt: S.Finite,
});
type ObservationRow = typeof ObservationRow.Type;
const ObservationRows = S.Array(ObservationRow);

const RunRow = S.Struct({
  run_id: S.String,
  branch: S.String,
  origin: ObservationOrigin,
  input_fingerprint: S.String,
  head: S.NullOr(S.String),
  at_ms: S.Finite,
  item_kind: ItemKind,
  units_json: Units,
  failed_json: Failures,
  observations: S.Finite,
});
const RunRows = S.Array(RunRow);
const KnownRows = S.Array(S.Struct({ fingerprint: S.String, unit: S.String, title: S.String }));
const AnswerRows = S.Array(S.Struct({ branch: S.String, answer_json: S.NullOr(S.String) }));
const Answer = S.fromJsonString(HistoryAnswer);

const millis = (at: DateTime.Utc): number => DateTime.toEpochMillis(at);

const observationOf = (row: ObservationRow): Observation =>
  Observation.make({
    runId: row.run_id,
    inputFingerprint: row.input_fingerprint,
    head: O.fromNullOr(row.head),
    branch: row.branch,
    origin: row.origin,
    outcome: row.outcome,
    attempt: row.attempt,
    at: DateTime.makeUnsafe(row.at_ms),
  });

const ingestedRow = (sql: Sql, runId: string) =>
  sql`SELECT branch, answer_json FROM gate_history_ingested WHERE run_id = ${runId}`.pipe(
    decodeRows(AnswerRows),
    Effect.map(A.head)
  );

const insertIngested = Effect.fnUntraced(function* (sql: Sql, record: HistoryRunRecord) {
  const answer = yield* pipe(
    O.toArray(record.answer),
    Effect.forEach((kept) => S.encodeEffect(Answer)(kept), { concurrency: 1 }),
    Effect.orDie
  );
  return yield* sql`INSERT INTO gate_history_ingested ${sql.insert({
    run_id: record.runId,
    branch: record.branch,
    answer_json: O.getOrNull(A.head(answer)),
  })}`;
});

const knownKeys = (sql: Sql, record: HistoryRunRecord) =>
  sql`SELECT DISTINCT fingerprint, unit, title FROM gate_history_observations
      WHERE gate = ${record.gate} AND subject = ${record.subject}
        AND branch = ${record.branch} AND origin = ${record.origin}`.pipe(
    decodeRows(KnownRows),
    Effect.map(A.map((row) => KnownKey.make(row)))
  );

const insertRun = Effect.fnUntraced(function* (sql: Sql, record: HistoryRunRecord) {
  const units = yield* Effect.orDie(S.encodeEffect(Units)(record.units));
  const failed = yield* Effect.orDie(S.encodeEffect(Failures)(record.failed));
  return yield* sql`INSERT INTO gate_history_runs ${sql.insert({
    run_id: record.runId,
    gate: record.gate,
    subject: record.subject,
    branch: record.branch,
    origin: record.origin,
    input_fingerprint: record.inputFingerprint,
    head: O.getOrNull(record.head),
    at_ms: millis(record.at),
    item_kind: record.itemKind,
    units_json: units,
    failed_json: failed,
    observations: A.length(record.entries),
    partial: record.partial ? 1 : 0,
  })}`;
});

const insertObservations = (sql: Sql, record: HistoryRunRecord) =>
  Effect.forEach(
    A.chunksOf(record.entries, 200),
    (entries) =>
      sql`INSERT INTO gate_history_observations ${sql.insert(
        A.map(entries, (entry) => ({
          run_id: record.runId,
          gate: record.gate,
          subject: record.subject,
          fingerprint: entry.fingerprint,
          unit: entry.unit,
          title: entry.title,
          branch: record.branch,
          origin: record.origin,
          input_fingerprint: record.inputFingerprint,
          head: O.getOrNull(record.head),
          at_ms: millis(record.at),
          outcome: entry.outcome,
          attempt: entry.attempt,
        }))
      )}`,
    { concurrency: 1, discard: true }
  );

const prune = (sql: Sql, record: HistoryRunRecord, config: HistoryConfig) =>
  Effect.all(
    [
      sql`DELETE FROM gate_history_runs
          WHERE gate = ${record.gate} AND subject = ${record.subject} AND branch = ${record.branch}
            AND run_id NOT IN (
              SELECT run_id FROM gate_history_runs
              WHERE gate = ${record.gate} AND subject = ${record.subject} AND branch = ${record.branch}
              ORDER BY at_ms DESC, run_id DESC LIMIT ${config.retainRuns})`,
      sql`DELETE FROM gate_history_observations WHERE rowid IN (
            SELECT rowid FROM (
              SELECT rowid, ROW_NUMBER() OVER (
                PARTITION BY fingerprint ORDER BY at_ms DESC, attempt DESC) AS position
              FROM gate_history_observations
              WHERE gate = ${record.gate} AND subject = ${record.subject}
                AND branch = ${record.branch} AND origin = ${record.origin}
                AND fingerprint IN (SELECT fingerprint FROM gate_history_observations WHERE run_id = ${record.runId}))
            WHERE position > ${config.window})`,
    ],
    { concurrency: 1, discard: true }
  );

const insertWithin = (sql: Sql, config: HistoryConfig) =>
  Effect.fnUntraced(function* (record: HistoryRunRecord) {
    const ingested = yield* ingestedRow(sql, record.runId);
    if (O.isSome(ingested)) return false;
    const known = observesAbsence(record) ? yield* knownKeys(sql, record) : [];
    const full = withAbsentPassed(record, known);
    yield* insertIngested(sql, full);
    yield* insertRun(sql, full);
    yield* insertObservations(sql, full);
    yield* prune(sql, full, config);
    return true;
  });

const laneRows = (sql: Sql, query: LaneQuery) =>
  sql`SELECT * FROM (
        SELECT o.*, ROW_NUMBER() OVER (PARTITION BY fingerprint ORDER BY at_ms DESC, attempt DESC) AS position
        FROM gate_history_observations o
        WHERE gate = ${query.gate} AND subject = ${query.subject} AND branch = ${query.branch}
          AND origin = 'local' AND run_id <> ${query.excludeRunId} AND at_ms < ${millis(query.before)}
          AND ${sql.in("fingerprint", query.fingerprints)})
      WHERE position <= ${query.window}
      ORDER BY fingerprint, position`.pipe(decodeRows(ObservationRows));

const laneOf = (sql: Sql) => (query: LaneQuery) =>
  A.isReadonlyArrayEmpty(query.fingerprints)
    ? Effect.succeed(HashMap.empty<string, ReadonlyArray<Observation>>())
    : Effect.map(laneRows(sql, query), (rows) =>
        HashMap.fromIterable(
          R.toEntries(
            R.map(
              A.groupBy(rows, (row) => row.fingerprint),
              A.map(observationOf)
            )
          )
        )
      );

const recordedOf = (sql: Sql) => (query: RecordedRunQuery) =>
  Effect.map(
    ingestedRow(sql, query.runId),
    flow(
      O.filter((row) => row.branch === query.branch),
      O.flatMapNullishOr((row) => row.answer_json),
      O.flatMap(S.decodeUnknownOption(Answer))
    )
  );

const previousOf = (sql: Sql) => (query: PreviousRunQuery) =>
  sql`SELECT * FROM gate_history_runs
      WHERE gate = ${query.gate} AND subject = ${query.subject} AND branch = ${query.branch}
        AND origin = 'local' AND partial = 0
        AND run_id <> ${query.excludeRunId} AND at_ms < ${millis(query.before)}
      ORDER BY at_ms DESC, run_id DESC LIMIT 1`.pipe(
    decodeRows(RunRows),
    Effect.map(
      flow(
        A.head,
        O.map((row) => DeltaRun.make({ units: row.units_json, failed: row.failed_json }))
      )
    )
  );

const runsOf = (sql: Sql) => (query: HistoryRunsQuery) =>
  sql`SELECT * FROM gate_history_runs
      WHERE gate = ${query.gate} AND subject = ${query.subject}
        AND (${O.getOrNull(query.branch)} IS NULL OR branch = ${O.getOrNull(query.branch)})
      ORDER BY at_ms DESC, run_id DESC`.pipe(
    decodeRows(RunRows),
    Effect.map(
      A.map((row) =>
        HistoryRunView.make({
          runId: row.run_id,
          branch: row.branch,
          origin: row.origin,
          inputFingerprint: row.input_fingerprint,
          head: O.fromNullOr(row.head),
          at: DateTime.makeUnsafe(row.at_ms),
          units: A.length(row.units_json),
          failed: A.length(row.failed_json),
          observations: row.observations,
        })
      )
    )
  );

const seriesOfRows = (rows: A.NonEmptyReadonlyArray<ObservationRow>): HistoryItemSeries => {
  const first = A.headNonEmpty(rows);
  const observations = A.map(rows, observationOf);
  return HistoryItemSeries.make({
    fingerprint: first.fingerprint,
    title: first.title,
    branch: first.branch,
    origin: first.origin,
    flaky: isFlaky(observations),
    observations,
  });
};

const seriesOf = (sql: Sql) => (query: HistoryItemQuery) =>
  sql`SELECT * FROM gate_history_observations
      WHERE gate = ${query.gate} AND subject = ${query.subject}
        AND (fingerprint = ${query.selector} OR instr(title, ${query.selector}) > 0)
      ORDER BY at_ms DESC, attempt DESC`.pipe(
    decodeRows(ObservationRows),
    Effect.map((rows) =>
      pipe(
        A.groupBy(rows, (row) => A.join([row.fingerprint, row.branch, row.origin], "\u0000")),
        R.values,
        A.map(seriesOfRows)
      )
    )
  );

const waitAtMost = (sql: Sql, millis: number) => sql.unsafe(`PRAGMA busy_timeout = ${millis}`);

const backendOn = (sql: Sql, options: GateHistorySqliteOptions): HistoryBackend => {
  const insert = insertWithin(sql, options.config);
  const read = <A>(effect: Effect.Effect<A, SqlError.SqlError>) =>
    waitAtMost(sql, options.config.deadlineMs).pipe(Effect.andThen(effect), Effect.mapError(translate("open-failed")));
  return {
    insert: (record) =>
      waitAtMost(sql, options.busyTimeoutMs).pipe(
        Effect.andThen(sql.withTransaction(insert(record))),
        Effect.provideService(References.PreventSchedulerYield, true),
        Effect.mapError(translate("write-failed"))
      ),
    recorded: (query) => read(recordedOf(sql)(query)),
    lane: (query) => read(laneOf(sql)(query)),
    previous: (query) => read(previousOf(sql)(query)),
    runs: (query) => read(runsOf(sql)(query)),
    series: (query) => read(seriesOf(sql)(query)),
  };
};

const retryBusy =
  (config: HistoryConfig) =>
  <A, R>(effect: Effect.Effect<A, GateHistoryError, R>): Effect.Effect<A, GateHistoryError, R> =>
    Effect.retry(effect, {
      schedule: Duration.millis(config.retryBaseMs).pipe(Schedule.exponential, Schedule.jittered),
      times: config.retryAttempts - 1,
      while: (error) => error.reason === "open-busy",
    });

const loadDriver = Effect.promise(() => import("@beep/sqlite"));

const openBackend = Effect.fnUntraced(function* (options: GateHistorySqliteOptions) {
  const driver = yield* loadDriver;
  const sql = yield* driver
    .make({ filename: options.filename, busyTimeout: Duration.millis(options.config.deadlineMs) })
    .pipe(Effect.mapError(translate("open-failed")), retryBusy(options.config));
  yield* migrate(sql).pipe(Effect.mapError(translate("migrate-failed")), retryBusy(options.config));
  return backendOn(sql, options);
});

const lazyBackend = (opened: Effect.Effect<HistoryBackend, GateHistoryError>): HistoryBackend => ({
  insert: (record) => Effect.flatMap(opened, (backend) => backend.insert(record)),
  recorded: (query) => Effect.flatMap(opened, (backend) => backend.recorded(query)),
  lane: (query) => Effect.flatMap(opened, (backend) => backend.lane(query)),
  previous: (query) => Effect.flatMap(opened, (backend) => backend.previous(query)),
  runs: (query) => Effect.flatMap(opened, (backend) => backend.runs(query)),
  series: (query) => Effect.flatMap(opened, (backend) => backend.series(query)),
});

const makeLazyBackend = Effect.fnUntraced(function* (options: GateHistorySqliteOptions) {
  const scope = yield* Effect.scope;
  const context = yield* Effect.context<Reactivity.Reactivity>();
  const held = yield* Ref.make(O.none<HistoryBackend>());
  const open = Effect.gen(function* () {
    const child = yield* Scope.fork(scope);
    const backend = yield* openBackend(options).pipe(
      Scope.provide(child),
      Effect.provideContext(context),
      Effect.onError((cause) => Scope.close(child, Exit.failCause(cause)))
    );
    yield* Ref.set(held, O.some(backend));
    return backend;
  });
  const shared = Effect.flatMap(Ref.get(held), O.match({ onNone: () => open, onSome: Effect.succeed }));
  const gate = yield* Semaphore.make(1);
  return lazyBackend(gate.withPermit(shared));
});

const makeStore = Effect.fnUntraced(function* (options: GateHistorySqliteOptions) {
  const backend = yield* makeLazyBackend(options);
  const store = yield* makeGateHistoryStore(options.config, backend);
  return GateHistoryStore.of(store);
});

/**
 * The history store over a SQLite file.
 *
 * **Details**
 *
 * Building the layer never fails and never touches the file: the database
 * is opened and migrated on the store's first use and closed with the
 * layer's scope. Opening on a missing directory, on a file that is not a
 * database or on a store locked past the retry schedule fails that use with
 * a `GateHistoryError` (`open-failed`, `open-busy` or `migrate-failed`), which
 * a caller turns into one console line. A successful open is shared by every
 * later use; a failed one closes what it opened, and the next use opens
 * again. An open whose schema is already current reads it without the write
 * lock, so it never waits on a writer. Runs keep the newest `retainRuns` per
 * gate, subject and branch, and observations the newest `window` per series;
 * a pruned run's observations stay while they are in a window (upstream
 * `0003_run_retention.ts`). Every ingested run id is kept past the pruning of
 * its run row, with the answer it rendered.
 *
 * **Gotchas**
 *
 * The store runs under Bun only: outside Bun the driver does not load and
 * the first use dies, which a gate run absorbs like any history defect. The
 * driver waits on a lock synchronously, so each lock wait of an open or a
 * read is capped at the read deadline (`deadlineMs`); only a write, which
 * runs after the console was printed, gets the longer `busyTimeoutMs`.
 *
 * **Example** (Provide the store)
 *
 * ```ts
 * import { GateHistorySqliteOptions, layerSqlite } from "@beep/repo-gate-run/GateHistorySqlite";
 * import * as Layer from "effect/Layer";
 *
 * const store = layerSqlite(GateHistorySqliteOptions.make({ filename: ":memory:" }));
 * console.log(Layer.isLayer(store)); // true
 * ```
 *
 * @param options - the database file and the history configuration
 * @returns a layer providing the history store
 * @category layers
 * @since 0.0.0
 */
export const layerSqlite = (options: GateHistorySqliteOptions): Layer.Layer<GateHistoryStore> =>
  Layer.effect(GateHistoryStore, makeStore(options)).pipe(Layer.provide(Reactivity.layer));
