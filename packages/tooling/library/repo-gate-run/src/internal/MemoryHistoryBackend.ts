/**
 * The in-memory history backend: the store's runs and observations held in
 * a `Ref` for the life of a layer, with the same idempotence, absent-key and
 * retention rules as the SQLite backend.
 *
 * @since 0.0.0
 */
import { DeltaRun, isFlaky, Observation } from "@beep/gate-report/History";
import { Text } from "@beep/gate-report/Scalars";
import { $RepoGateRunId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  HistoryItemSeries,
  HistoryRunRecord,
  HistoryRunView,
  KnownKey,
  withAbsentPassed,
} from "../GateHistoryRecord.ts";
import type { HistoryConfig } from "@beep/gate-report/History";
import type {
  HistoryBackend,
  HistoryItemQuery,
  HistoryRunsQuery,
  LaneQuery,
  PreviousRunQuery,
} from "../GateHistoryRecord.ts";

const $I = $RepoGateRunId.create("internal/MemoryHistoryBackend");

/**
 * One stored observation with its series coordinates.
 *
 * @since 0.0.0
 */
export class StoredObservation extends S.Opaque<StoredObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    fingerprint: Text,
    unit: Text,
    title: S.String,
    observation: Observation,
  }).pipe(
    $I.annoteSchema("StoredObservation", {
      description: "One observation the in-memory backend holds, with its gate, subject, key, unit and title.",
    })
  )
) {}

type State = { readonly runs: ReadonlyArray<HistoryRunRecord>; readonly rows: ReadonlyArray<StoredObservation> };

const newestRunFirst: Order.Order<HistoryRunRecord> = Order.flip(
  Order.mapInput(DateTime.Order, (run: HistoryRunRecord) => run.at)
);

const newestObservationFirst: Order.Order<StoredObservation> = Order.flip(
  Order.combine(
    Order.mapInput(DateTime.Order, (row: StoredObservation) => row.observation.at),
    Order.mapInput(Order.Number, (row: StoredObservation) => row.observation.attempt)
  )
);

const sameRunSeries = (left: HistoryRunRecord) => (right: HistoryRunRecord) =>
  left.gate === right.gate && left.subject === right.subject && left.branch === right.branch;

const seriesKey = (row: StoredObservation): string =>
  A.join([row.gate, row.subject, row.fingerprint, row.observation.branch, row.observation.origin], "\u0000");

const rowsOf = (record: HistoryRunRecord): ReadonlyArray<StoredObservation> =>
  A.map(record.entries, (entry) =>
    StoredObservation.make({
      gate: record.gate,
      subject: record.subject,
      fingerprint: entry.fingerprint,
      unit: entry.unit,
      title: entry.title,
      observation: Observation.make({
        runId: record.runId,
        inputFingerprint: record.inputFingerprint,
        head: record.head,
        branch: record.branch,
        origin: record.origin,
        outcome: entry.outcome,
        attempt: entry.attempt,
        at: record.at,
      }),
    })
  );

const knownIn = (state: State, record: HistoryRunRecord): ReadonlyArray<KnownKey> =>
  pipe(
    state.rows,
    A.filter(
      (row) =>
        row.gate === record.gate &&
        row.subject === record.subject &&
        row.observation.branch === record.branch &&
        row.observation.origin === record.origin
    ),
    A.map((row) => KnownKey.make({ fingerprint: row.fingerprint, unit: row.unit, title: row.title }))
  );

const pruneRuns = (runs: ReadonlyArray<HistoryRunRecord>, record: HistoryRunRecord, keep: number) => {
  const inSeries = sameRunSeries(record);
  return [
    ...A.filter(runs, (run) => !inSeries(run)),
    ...A.take(A.sort(A.filter(runs, inSeries), newestRunFirst), keep),
  ];
};

const pruneRows = (rows: ReadonlyArray<StoredObservation>, window: number): ReadonlyArray<StoredObservation> =>
  A.flatMap(R.values(A.groupBy(rows, seriesKey)), (series) => A.take(A.sort(series, newestObservationFirst), window));

const inserted = (state: State, record: HistoryRunRecord, config: HistoryConfig): State => {
  const full = withAbsentPassed(record, knownIn(state, record));
  return {
    runs: pruneRuns([...state.runs, full], full, config.retainRuns),
    rows: pruneRows([...state.rows, ...rowsOf(full)], config.window),
  };
};

const earlierLocal =
  (query: { readonly excludeRunId: string; readonly before: DateTime.Utc; readonly branch: string }) =>
  (observation: Observation): boolean =>
    observation.origin === "local" &&
    observation.branch === query.branch &&
    observation.runId !== query.excludeRunId &&
    DateTime.isLessThan(observation.at, query.before);

const laneOf = (state: State, query: LaneQuery): HashMap.HashMap<string, ReadonlyArray<Observation>> =>
  pipe(
    state.rows,
    A.filter(
      (row) =>
        row.gate === query.gate &&
        row.subject === query.subject &&
        A.contains(query.fingerprints, row.fingerprint) &&
        earlierLocal(query)(row.observation)
    ),
    A.groupBy((row) => row.fingerprint),
    R.map((rows) => A.map(A.take(A.sort(rows, newestObservationFirst), query.window), (row) => row.observation)),
    (byKey) => HashMap.fromIterable(R.toEntries(byKey))
  );

const previousOf = (state: State, query: PreviousRunQuery): O.Option<DeltaRun> =>
  pipe(
    state.runs,
    A.filter(
      (run) =>
        run.gate === query.gate &&
        run.subject === query.subject &&
        run.origin === "local" &&
        run.branch === query.branch &&
        run.runId !== query.excludeRunId &&
        DateTime.isLessThan(run.at, query.before)
    ),
    A.sort(newestRunFirst),
    A.head,
    O.map((run) => DeltaRun.make({ units: run.units, failed: run.failed }))
  );

const viewOf = (run: HistoryRunRecord): HistoryRunView =>
  HistoryRunView.make({
    runId: run.runId,
    branch: run.branch,
    origin: run.origin,
    inputFingerprint: run.inputFingerprint,
    head: run.head,
    at: run.at,
    units: A.length(run.units),
    failed: A.length(run.failed),
    observations: A.length(run.entries),
  });

const runsOf = (state: State, query: HistoryRunsQuery): ReadonlyArray<HistoryRunView> =>
  pipe(
    state.runs,
    A.filter(
      (run) =>
        run.gate === query.gate &&
        run.subject === query.subject &&
        O.match(query.branch, { onNone: () => true, onSome: (branch) => branch === run.branch })
    ),
    A.sort(newestRunFirst),
    A.map(viewOf)
  );

const seriesOf = (rows: A.NonEmptyReadonlyArray<StoredObservation>): HistoryItemSeries => {
  const first = A.headNonEmpty(rows);
  const observations = A.map(A.sort(rows, newestObservationFirst), (row) => row.observation);
  return HistoryItemSeries.make({
    fingerprint: first.fingerprint,
    title: first.title,
    branch: first.observation.branch,
    origin: first.observation.origin,
    flaky: isFlaky(observations),
    observations,
  });
};

const itemSeriesOf = (state: State, query: HistoryItemQuery): ReadonlyArray<HistoryItemSeries> =>
  pipe(
    state.rows,
    A.filter(
      (row) =>
        row.gate === query.gate &&
        row.subject === query.subject &&
        (row.fingerprint === query.selector || Str.includes(query.selector)(row.title))
    ),
    A.groupBy(seriesKey),
    R.values,
    A.map(seriesOf)
  );

/**
 * Build an in-memory backend that lives as long as the effect's caller holds
 * it.
 *
 * @since 0.0.0
 */
export const makeMemoryBackend = Effect.fnUntraced(function* (config: HistoryConfig) {
  const state = yield* Ref.make<State>({ runs: [], rows: [] });
  const read = <A>(f: (current: State) => A) => Effect.map(Ref.get(state), f);
  const backend: HistoryBackend = {
    insert: (record) =>
      Ref.modify(state, (current): readonly [boolean, State] =>
        A.some(current.runs, (run) => run.runId === record.runId)
          ? [false, current]
          : [true, inserted(current, HistoryRunRecord.make(record), config)]
      ),
    lane: (query) => read((current) => laneOf(current, query)),
    previous: (query) => read((current) => previousOf(current, query)),
    runs: (query) => read((current) => runsOf(current, query)),
    series: (query) => read((current) => itemSeriesOf(current, query)),
  };
  return backend;
});
