/**
 * The history store: records every gate report by branch, answers the
 * labels and delta for a report from the lane's earlier runs, and serves the
 * history queries. It fills core's {@link GateHistory} slot.
 *
 * **Details**
 *
 * The store's semantics live here, over a small {@link HistoryBackend} port
 * that persists runs and observations. This module ships the in-memory
 * backend; the SQLite backend is the separate entry
 * `@beep/repo-gate-run/GateHistorySqlite`, which loads the driver with a
 * dynamic import, so nothing here reaches `bun:sqlite`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  classifyItem,
  deltaOf,
  deltaRunOf,
  HistoryConfig,
  Observation,
  observedOutcomes,
  SeriesEvidence,
} from "@beep/gate-report/History";
import { fingerprint } from "@beep/gate-report/ItemKey";
import { $RepoGateRunId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import { GateHistory, HistoryAnswer, HistoryReadError } from "./GateHistory.ts";
import {
  HistoryIngest,
  HistoryRunRecord,
  LaneQuery,
  PreviousRunQuery,
  RecordedRunQuery,
  runRecordOf,
  scopedReport,
} from "./GateHistoryRecord.ts";
import { makeMemoryBackend } from "./internal/MemoryHistoryBackend.ts";
import type { GateReport } from "@beep/gate-report/GateReport";
import type { DeltaRun, GateHistoryError } from "@beep/gate-report/History";
import type { Item } from "@beep/gate-report/Item";
import type { HistoryLabel } from "@beep/gate-report/Vocabulary";
import type {
  HistoryBackend,
  HistoryItemQuery,
  HistoryItemSeries,
  HistoryRunsQuery,
  HistoryRunView,
  HistoryScope,
} from "./GateHistoryRecord.ts";

const $I = $RepoGateRunId.create("GateHistoryStore");

const currentObservations = (report: GateReport, branch: string, item: Item): ReadonlyArray<Observation> =>
  A.map(observedOutcomes(item), (outcome, attempt) =>
    Observation.make({
      runId: report.runId,
      inputFingerprint: report.inputFingerprint,
      head: report.head,
      branch,
      origin: "local",
      outcome,
      attempt,
      at: report.startedAt,
    })
  );

/**
 * Why a lane's report has no main baseline until hosted reports reach it.
 *
 * **Example** (Read the reason)
 *
 * ```ts
 * import { NO_MAIN_BASELINE } from "@beep/repo-gate-run/GateHistoryStore";
 *
 * console.log(NO_MAIN_BASELINE); // no hosted main report reaches this lane yet
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NO_MAIN_BASELINE = "no hosted main report reaches this lane yet";

const labelEntry =
  (report: GateReport, branch: string, lane: HashMap.HashMap<string, ReadonlyArray<Observation>>) =>
  (item: Item): O.Option<readonly [string, HistoryLabel]> => {
    const key = fingerprint(item.key);
    const evidence = SeriesEvidence.make({
      current: currentObservations(report, branch, item),
      lane: O.getOrElse(HashMap.get(lane, key), A.empty),
    });
    return O.map(classifyItem(item.outcome, evidence), (label) => [key, label] as const);
  };

const answerOn = Effect.fnUntraced(function* (
  backend: HistoryBackend,
  config: HistoryConfig,
  report: GateReport,
  branch: string,
  partial: boolean
) {
  const kept = yield* backend.recorded(RecordedRunQuery.make({ runId: report.runId, branch }));
  if (O.isSome(kept)) return kept.value;
  const series = {
    gate: report.gate,
    subject: report.subject,
    branch,
    excludeRunId: report.runId,
    before: report.startedAt,
  };
  const lane = yield* backend.lane(
    LaneQuery.make({
      ...series,
      fingerprints: A.dedupe(A.map(report.items, (item) => fingerprint(item.key))),
      window: config.window,
    })
  );
  const previous = partial ? O.none<DeltaRun>() : yield* backend.previous(PreviousRunQuery.make(series));
  return HistoryAnswer.make({
    labels: R.fromEntries(A.getSomes(A.map(report.items, labelEntry(report, branch, lane)))),
    delta: O.map(previous, deltaOf(deltaRunOf(report))),
    baseline: A.some(report.items, (item) => item.outcome === "failed") ? O.some(NO_MAIN_BASELINE) : O.none(),
  });
});

/**
 * The history store's operations.
 *
 * **Details**
 *
 * `ingest` records a report under a scope, once per run id. `answer` labels
 * a report's items and computes its delta from the lane's earlier local runs
 * on the report's branch, excluding observations that carry the report's
 * own run id. `ingest` keeps with the run the answer this process rendered
 * for it, the one its console showed (or, when the console had no answer, the
 * one it can read now, or none), and a replayed record
 * on the same branch is answered with it, so it renders as the run it replays
 * whatever was recorded or pruned since. `runs`
 * lists a subject's history; `series` shows one item's series by branch.
 *
 * **Example** (Read through the shape)
 *
 * ```ts
 * import type { GateHistoryStoreShape } from "@beep/repo-gate-run/GateHistoryStore";
 *
 * const answerOf = (store: GateHistoryStoreShape) => store.answer;
 * console.log(typeof answerOf); // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GateHistoryStoreShape {
  readonly answer: (report: GateReport, scope: HistoryScope) => Effect.Effect<HistoryAnswer, GateHistoryError>;
  readonly ingest: (report: GateReport, scope: HistoryScope) => Effect.Effect<HistoryIngest, GateHistoryError>;
  readonly runs: (query: HistoryRunsQuery) => Effect.Effect<ReadonlyArray<HistoryRunView>, GateHistoryError>;
  readonly series: (query: HistoryItemQuery) => Effect.Effect<ReadonlyArray<HistoryItemSeries>, GateHistoryError>;
}

/**
 * Build the store's operations over a backend.
 *
 * **Example** (Over the in-memory backend)
 *
 * ```ts
 * import { HistoryConfig } from "@beep/gate-report/History";
 * import { makeGateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(makeGateHistoryStore(HistoryConfig.make({})))); // true
 * ```
 *
 * @param config - the window, retention and retry configuration
 * @param backend - the persistence, in memory when omitted
 * @returns the store's operations
 * @category constructors
 * @since 0.0.0
 */
export const makeGateHistoryStore = Effect.fnUntraced(function* (
  config: HistoryConfig,
  backend?: HistoryBackend
): Effect.fn.Return<GateHistoryStoreShape> {
  const store = backend ?? (yield* makeMemoryBackend(config));
  const rendered = yield* Ref.make(HashMap.empty<string, HistoryAnswer>());
  const answer = Effect.fnUntraced(function* (report: GateReport, scope: HistoryScope) {
    const branch = O.getOrElse(report.branch, () => scope.branch);
    const found = yield* answerOn(store, config, scopedReport(report, scope), branch, scope.partial);
    yield* Ref.update(rendered, HashMap.set(report.runId, found));
    return found;
  });
  const answerToKeep = Effect.fnUntraced(function* (report: GateReport, scope: HistoryScope) {
    const byRun = yield* Ref.get(rendered);
    const shown = HashMap.get(byRun, report.runId);
    return O.isSome(shown) ? shown : yield* Effect.option(answer(report, scope));
  });
  return {
    ingest: Effect.fnUntraced(function* (report, scope) {
      const record = runRecordOf(report, scope);
      const kept = yield* answerToKeep(report, scope);
      const inserted = yield* store.insert(HistoryRunRecord.make({ ...record, answer: kept }));
      return HistoryIngest.make({ runId: record.runId, inserted });
    }),
    answer,
    runs: store.runs,
    series: store.series,
  };
});

/**
 * The history store service.
 *
 * **Example** (Provide the in-memory store)
 *
 * ```ts
 * import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
 * import * as Layer from "effect/Layer";
 *
 * console.log(Layer.isLayer(GateHistoryStore.layerMemory())); // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GateHistoryStore extends Context.Service<GateHistoryStore, GateHistoryStoreShape>()($I`GateHistoryStore`) {
  /**
   * A store held in memory for the life of the layer, for tests.
   *
   * **Example** (A three-run window)
   *
   * ```ts
   * import { HistoryConfig } from "@beep/gate-report/History";
   * import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateHistoryStore.layerMemory(HistoryConfig.make({ window: 3 })))); // true
   * ```
   *
   * @param config - the window and retention, the defaults when omitted
   * @category layers
   * @since 0.0.0
   */
  static readonly layerMemory = (config: HistoryConfig = HistoryConfig.make({})): Layer.Layer<GateHistoryStore> =>
    Layer.effect(GateHistoryStore, Effect.map(makeGateHistoryStore(config), GateHistoryStore.of));

  /**
   * Fill core's history slot from the store under a scope: a read answers
   * the report's labels and delta, and a store failure is a read failure.
   *
   * **Example** (Read history from the store)
   *
   * ```ts
   * import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord";
   * import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
   * import * as Layer from "effect/Layer";
   *
   * const history = GateHistoryStore.historyLayer(HistoryScope.make({ branch: "feature/a" }));
   * console.log(Layer.isLayer(history)); // true
   * ```
   *
   * @param scope - the branch, head and origin reports are read under
   * @category layers
   * @since 0.0.0
   */
  static readonly historyLayer = (scope: HistoryScope): Layer.Layer<GateHistory, never, GateHistoryStore> =>
    Layer.effect(
      GateHistory,
      Effect.map(GateHistoryStore, (store) =>
        GateHistory.of({
          read: Effect.fn("GateHistory.read")(function* (report) {
            return yield* store
              .answer(report, scope)
              .pipe(
                Effect.mapError((error) => HistoryReadError.make({ message: `${error.reason}: ${error.message}` }))
              );
          }),
        })
      )
    );
}
