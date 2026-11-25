/**
 * What the history store records and answers, as schemas: the scope a
 * report is recorded under, one run with its observations, the queries and
 * their views, and the backend port the store persists through.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateReport } from "@beep/gate-report/GateReport";
import {
  checkedUnitOf,
  DeltaFailure,
  deltaRunOf,
  Observation,
  ObservationOrigin,
  ObservedOutcome,
  observedOutcomes,
} from "@beep/gate-report/History";
import { fingerprint } from "@beep/gate-report/ItemKey";
import { Count, IsoInstant, Text } from "@beep/gate-report/Scalars";
import { ItemKind } from "@beep/gate-report/Vocabulary";
import { $RepoGateRunId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { HistoryAnswer } from "./GateHistory.ts";
import type { DeltaRun, GateHistoryError } from "@beep/gate-report/History";
import type { Item } from "@beep/gate-report/Item";
import type * as HashMap from "effect/HashMap";

const $I = $RepoGateRunId.create("GateHistoryRecord");

/**
 * Where a report's runs are recorded when the report does not say: the
 * branch, the head commit and the origin.
 *
 * **Details**
 *
 * A report's own `branch` and `head` win over the scope's. `partial` marks a
 * report of part of what its gate checks, such as one quarantine incident: it
 * is never the run a delta compares with, and it says nothing about the items
 * it does not report.
 *
 * **Example** (A local scope)
 *
 * ```ts
 * import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * console.log(HistoryScope.make({ branch: "feature/a" }).origin); // local
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryScope extends S.Opaque<HistoryScope, { readonly brand: unique symbol }>()(
  S.Struct({
    branch: Text,
    head: S.OptionFromOptionalKey(Text).pipe(S.withConstructorDefault(Effect.succeedNone)),
    origin: ObservationOrigin.pipe(S.withConstructorDefault(Effect.succeed("local" as const))),
    partial: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("HistoryScope", {
      description:
        "The branch, head commit and origin a report is recorded under, and whether it reports only part of its gate.",
    })
  )
) {}

/**
 * One observation as a run records it: the item's key fingerprint, the
 * checked unit it counts under, a readable title, the outcome and the
 * attempt number.
 *
 * **Example** (A failed attempt)
 *
 * ```ts
 * import { HistoryEntry } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * const entry = HistoryEntry.make({ fingerprint: "test|1:a", unit: "a.test.ts", title: "a.test.ts > adds", outcome: "failed", attempt: 0 });
 * console.log(entry.outcome); // failed
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryEntry extends S.Opaque<HistoryEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    fingerprint: Text,
    unit: Text,
    title: S.String,
    outcome: ObservedOutcome,
    attempt: Count,
  }).pipe(
    $I.annoteSchema("HistoryEntry", {
      description: "One recorded observation: key fingerprint, checked unit, title, outcome and attempt.",
    })
  )
) {}

/**
 * **Details**
 *
 * `units` are the units the run checked; `failed` are its finally failed
 * items, which the next run's delta reads; `entries` are its observations;
 * `unobserved` are the items it reported that neither passed nor failed.
 * `answer` is what history answered when the run was rendered, kept so a
 * replay renders the same; `partial` is {@link HistoryScope}'s.
 *
 * **Example** (An empty run)
 *
 * ```ts
 * import { HistoryRunRecord } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = HistoryRunRecord.make({
 *   gate: "test", subject: "@beep/glob", branch: "feature/a", origin: "local", runId: "r1",
 *   inputFingerprint: "x", at: DateTime.makeUnsafe(0), itemKind: "test", units: [], failed: [], entries: [],
 * });
 * console.log(run.runId); // r1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryRunRecord extends S.Opaque<HistoryRunRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    branch: Text,
    origin: ObservationOrigin,
    runId: Text,
    inputFingerprint: Text,
    head: S.OptionFromOptionalKey(Text).pipe(S.withConstructorDefault(Effect.succeedNone)),
    at: IsoInstant,
    itemKind: ItemKind,
    units: Text.pipe(S.Array),
    failed: DeltaFailure.pipe(S.Array),
    entries: HistoryEntry.pipe(S.Array),
    unobserved: Text.pipe(S.Array, S.withConstructorDefault(Effect.succeed([]))),
    partial: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    answer: S.OptionFromOptionalKey(HistoryAnswer).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("HistoryRunRecord", {
      description:
        "One recorded run: its series coordinates, input, checked units, failed items, observations and answer.",
    })
  )
) {}

/**
 * What one ingest did: the run id and whether it was new.
 *
 * **Example** (A replayed run)
 *
 * ```ts
 * import { HistoryIngest } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * console.log(HistoryIngest.make({ runId: "r1", inserted: false }).inserted); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryIngest extends S.Opaque<HistoryIngest, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: Text,
    inserted: S.Boolean,
  }).pipe(
    $I.annoteSchema("HistoryIngest", {
      description: "The run an ingest recorded and whether it was new; a replayed run id adds nothing.",
    })
  )
) {}

/**
 * The lane observations a label read needs: the series of each item, before
 * the report and without its own run.
 *
 * **Example** (Read two items)
 *
 * ```ts
 * import { LaneQuery } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 *
 * const query = LaneQuery.make({
 *   gate: "test", subject: "@beep/glob", branch: "feature/a", fingerprints: ["a", "b"],
 *   excludeRunId: "r9", before: DateTime.makeUnsafe(0), window: 10,
 * });
 * console.log(query.fingerprints.length); // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LaneQuery extends S.Opaque<LaneQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    branch: Text,
    fingerprints: Text.pipe(S.Array),
    excludeRunId: Text,
    before: IsoInstant,
    window: Count,
  }).pipe(
    $I.annoteSchema("LaneQuery", {
      description: "The items, branch and cut-off of a lane series read, newest first and at most the window.",
    })
  )
) {}

/**
 * The run a delta compares with: the newest earlier local run of the gate
 * and subject on the branch, other than the report's own and not partial.
 *
 * **Example** (The run before a report)
 *
 * ```ts
 * import { PreviousRunQuery } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 *
 * const query = PreviousRunQuery.make({
 *   gate: "test", subject: "@beep/glob", branch: "feature/a", excludeRunId: "r9", before: DateTime.makeUnsafe(0),
 * });
 * console.log(query.branch); // feature/a
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PreviousRunQuery extends S.Opaque<PreviousRunQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    branch: Text,
    excludeRunId: Text,
    before: IsoInstant,
  }).pipe(
    $I.annoteSchema("PreviousRunQuery", {
      description: "The gate, subject, branch and cut-off of the run a delta compares with.",
    })
  )
) {}

/**
 * **Example** (A restored run)
 *
 * ```ts
 * import { RecordedRunQuery } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * console.log(RecordedRunQuery.make({ runId: "r1", branch: "feature/a" }).runId); // r1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RecordedRunQuery extends S.Opaque<RecordedRunQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: Text,
    branch: Text,
  }).pipe(
    $I.annoteSchema("RecordedRunQuery", {
      description: "The run id and branch whose recorded answer a replay reuses.",
    })
  )
) {}

/**
 * **Example** (Every branch)
 *
 * ```ts
 * import { HistoryRunsQuery } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as O from "effect/Option";
 *
 * console.log(O.isNone(HistoryRunsQuery.make({ gate: "test", subject: "@beep/glob" }).branch)); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryRunsQuery extends S.Opaque<HistoryRunsQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    branch: S.OptionFromOptionalKey(Text).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("HistoryRunsQuery", {
      description: "The gate and subject whose runs to list, and optionally one branch.",
    })
  )
) {}

/**
 * One listed run: where it ran, its input, and its counts.
 *
 * **Example** (A listed run)
 *
 * ```ts
 * import { HistoryRunView } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 *
 * const view = HistoryRunView.make({
 *   runId: "r1", branch: "feature/a", origin: "local", inputFingerprint: "x",
 *   at: DateTime.makeUnsafe(0), units: 1, failed: 0, observations: 3,
 * });
 * console.log(view.failed); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryRunView extends S.Opaque<HistoryRunView, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: Text,
    branch: Text,
    origin: ObservationOrigin,
    inputFingerprint: Text,
    head: S.OptionFromOptionalKey(Text).pipe(S.withConstructorDefault(Effect.succeedNone)),
    at: IsoInstant,
    units: Count,
    failed: Count,
    observations: Count,
  }).pipe(
    $I.annoteSchema("HistoryRunView", {
      description: "One recorded run: branch, origin, input, head, time and its unit, failure and observation counts.",
    })
  )
) {}

/**
 * **Example** (By title)
 *
 * ```ts
 * import { HistoryItemQuery } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * console.log(HistoryItemQuery.make({ gate: "test", subject: "@beep/glob", selector: "adds" }).selector); // adds
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryItemQuery extends S.Opaque<HistoryItemQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    selector: Text,
  }).pipe(
    $I.annoteSchema("HistoryItemQuery", {
      description: "The gate, subject and item fingerprint or title text whose series to show.",
    })
  )
) {}

/**
 * One item's series on one branch and origin, newest first, and whether the
 * one flaky rule holds over it.
 *
 * **Example** (An empty series)
 *
 * ```ts
 * import { HistoryItemSeries } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * const series = HistoryItemSeries.make({
 *   fingerprint: "a", title: "adds", branch: "feature/a", origin: "local", flaky: false, observations: [],
 * });
 * console.log(series.flaky); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HistoryItemSeries extends S.Opaque<HistoryItemSeries, { readonly brand: unique symbol }>()(
  S.Struct({
    fingerprint: Text,
    title: S.String,
    branch: Text,
    origin: ObservationOrigin,
    flaky: S.Boolean,
    observations: Observation.pipe(S.Array),
  }).pipe(
    $I.annoteSchema("HistoryItemSeries", {
      description: "One item's observations on one branch and origin, newest first, and whether it is flaky.",
    })
  )
) {}

/**
 * Persistence for the store: runs and their observations, and the reads the
 * labels, delta and queries need.
 *
 * **Details**
 *
 * `insert` is idempotent on run id and returns whether the run was new, also
 * for a run whose row was since pruned: the store keeps every run id it
 * ingested. In one step it records the run, its checked units and its observations, adds
 * a passed observation for each known diagnostic key absent from a unit the
 * run checked ({@link withAbsentPassed}), and prunes to the configuration:
 * the newest `retainRuns` runs per gate, subject and branch, and the newest
 * `window` observations per series. Pruning a run never removes the
 * observations still in a window. `recorded` gives the answer kept with a run
 * ingested on the same branch; `lane` answers each fingerprint's series
 * newest first; `previous` the newest earlier run that is not partial; `runs` and `series` the
 * queries.
 *
 * **Example** (Use the in-memory backend's shape)
 *
 * ```ts
 * import type { HistoryBackend } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * const insertOf = (backend: HistoryBackend) => backend.insert;
 * console.log(typeof insertOf); // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface HistoryBackend {
  readonly insert: (record: HistoryRunRecord) => Effect.Effect<boolean, GateHistoryError>;
  readonly lane: (
    query: LaneQuery
  ) => Effect.Effect<HashMap.HashMap<string, ReadonlyArray<Observation>>, GateHistoryError>;
  readonly previous: (query: PreviousRunQuery) => Effect.Effect<O.Option<DeltaRun>, GateHistoryError>;
  readonly recorded: (query: RecordedRunQuery) => Effect.Effect<O.Option<HistoryAnswer>, GateHistoryError>;
  readonly runs: (query: HistoryRunsQuery) => Effect.Effect<ReadonlyArray<HistoryRunView>, GateHistoryError>;
  readonly series: (query: HistoryItemQuery) => Effect.Effect<ReadonlyArray<HistoryItemSeries>, GateHistoryError>;
}

/**
 * A key the store already knows in a unit: its fingerprint, unit and title.
 *
 * **Example** (A known diagnostic)
 *
 * ```ts
 * import { KnownKey } from "@beep/repo-gate-run/GateHistoryRecord";
 *
 * console.log(KnownKey.make({ fingerprint: "d", unit: "@beep/glob", title: "TS2322" }).unit); // @beep/glob
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class KnownKey extends S.Opaque<KnownKey, { readonly brand: unique symbol }>()(
  S.Struct({
    fingerprint: Text,
    unit: Text,
    title: S.String,
  }).pipe(
    $I.annoteSchema("KnownKey", {
      description: "An item key the store already holds in a unit, with its title.",
    })
  )
) {}

/**
 * Whether a run says which known items passed by not reporting them: a whole
 * diagnostic run does, a test run and a partial run do not.
 *
 * **Example** (A test run)
 *
 * ```ts
 * import { HistoryRunRecord, observesAbsence } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = HistoryRunRecord.make({
 *   gate: "test", subject: "@beep/glob", branch: "a", origin: "local", runId: "r1", inputFingerprint: "x",
 *   at: DateTime.makeUnsafe(0), itemKind: "test", units: [], failed: [], entries: [],
 * });
 * console.log(observesAbsence(run)); // false
 * ```
 *
 * @param record - the run being recorded
 * @returns whether an absent known key counts as passed
 * @category predicates
 * @since 0.0.0
 */
export const observesAbsence = (record: HistoryRunRecord): boolean =>
  record.itemKind === "diagnostic" && !record.partial;

/**
 * Add a passed observation for every known key absent from a unit a
 * diagnostic run checked.
 *
 * **Details**
 *
 * A diagnostic gate records only failing items, so a key it knew in a unit
 * it checked and no longer reports passed. A key the run reports without
 * deciding it (a warning) is present, not passed. Test runs record every item,
 * and partial runs only some, so both are returned unchanged.
 *
 * **Example** (A diagnostic that went away)
 *
 * ```ts
 * import { HistoryRunRecord, KnownKey, withAbsentPassed } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = HistoryRunRecord.make({
 *   gate: "check", subject: "@beep/glob", branch: "a", origin: "local", runId: "r2", inputFingerprint: "x",
 *   at: DateTime.makeUnsafe(0), itemKind: "diagnostic", units: ["@beep/glob"], failed: [], entries: [],
 * });
 * const known = [KnownKey.make({ fingerprint: "d", unit: "@beep/glob", title: "TS2322" })];
 * console.log(withAbsentPassed(run, known).entries[0]?.outcome); // passed
 * ```
 *
 * @param record - the run being recorded
 * @param known - the keys the store holds in the run's units
 * @returns the run with a passed entry for each absent known key
 * @category utilities
 * @since 0.0.0
 */
export const withAbsentPassed: {
  (record: HistoryRunRecord, known: ReadonlyArray<KnownKey>): HistoryRunRecord;
  (known: ReadonlyArray<KnownKey>): (record: HistoryRunRecord) => HistoryRunRecord;
} = dual(2, (record: HistoryRunRecord, known: ReadonlyArray<KnownKey>): HistoryRunRecord => {
  if (!observesAbsence(record)) return record;
  const present = HashSet.fromIterable([...A.map(record.entries, (entry) => entry.fingerprint), ...record.unobserved]);
  const absent = pipe(
    known,
    A.filter((key) => A.contains(record.units, key.unit) && !HashSet.has(present, key.fingerprint)),
    A.dedupeWith((left, right) => left.fingerprint === right.fingerprint),
    A.map((key) => HistoryEntry.make({ ...key, outcome: "passed", attempt: 0 }))
  );
  return HistoryRunRecord.make({ ...record, entries: [...record.entries, ...absent] });
});

const titleOf = (item: Item): string => A.join([item.unit, ...item.path, item.name], " > ");

const entriesOf =
  (report: GateReport) =>
  (item: Item): ReadonlyArray<HistoryEntry> =>
    A.map(observedOutcomes(item), (outcome, attempt) =>
      HistoryEntry.make({
        fingerprint: fingerprint(item.key),
        unit: checkedUnitOf(report, item),
        title: titleOf(item),
        outcome,
        attempt,
      })
    );

/**
 * A report with the scope's branch and head filled in where the report does
 * not name its own.
 *
 * **Example** (Place a report on a branch)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { HistoryScope, scopedReport } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({}),
 * });
 * console.log(O.getOrNull(scopedReport(report, HistoryScope.make({ branch: "feature/a" })).branch)); // feature/a
 * ```
 *
 * @param report - the report to place
 * @param scope - the branch and head to use when the report names none
 * @returns the report with a branch and, when known, a head
 * @category utilities
 * @since 0.0.0
 */
export const scopedReport: {
  (report: GateReport, scope: HistoryScope): GateReport;
  (scope: HistoryScope): (report: GateReport) => GateReport;
} = dual(
  2,
  (report: GateReport, scope: HistoryScope): GateReport =>
    GateReport.make({
      ...report,
      branch: O.orElse(report.branch, () => O.some(scope.branch)),
      head: O.orElse(report.head, () => scope.head),
    })
);

/**
 * The run record of a report under a scope.
 *
 * **Example** (Record a report)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { HistoryScope, runRecordOf } from "@beep/repo-gate-run/GateHistoryRecord";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({}),
 * });
 * console.log(runRecordOf(report, HistoryScope.make({ branch: "feature/a" })).branch); // feature/a
 * ```
 *
 * @param report - the run to record
 * @param scope - the branch, head and origin when the report does not name them
 * @returns the record the store keeps for the run
 * @category constructors
 * @since 0.0.0
 */
export const runRecordOf: {
  (report: GateReport, scope: HistoryScope): HistoryRunRecord;
  (scope: HistoryScope): (report: GateReport) => HistoryRunRecord;
} = dual(2, (report: GateReport, scope: HistoryScope): HistoryRunRecord => {
  const placed = scopedReport(report, scope);
  const delta = deltaRunOf(placed);
  return HistoryRunRecord.make({
    gate: placed.gate,
    subject: placed.subject,
    branch: O.getOrElse(report.branch, () => scope.branch),
    origin: scope.origin,
    runId: placed.runId,
    inputFingerprint: placed.inputFingerprint,
    head: placed.head,
    at: placed.startedAt,
    itemKind: placed.itemKind,
    units: delta.units,
    failed: delta.failed,
    entries: A.flatMap(placed.items, entriesOf(placed)),
    unobserved: delta.unobserved,
    partial: scope.partial,
  });
});
