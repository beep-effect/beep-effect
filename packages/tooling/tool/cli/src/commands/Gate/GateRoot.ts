/**
 * A gate at the repository root: Turbo ran the gate's task for many
 * packages, each of which wrote (or, on a cache hit, had restored) its own
 * record. This module reads the records of the packages that ran, folds them
 * into one workspace report, writes the root record and the run's raw log
 * under `.beep/gates/<gate>/<run-id>.json|.log` (newest twenty kept), and
 * prints one console.
 *
 * **Details**
 *
 * The packages that ran come from Turbo's run summary. A cache hit's record
 * is the one Turbo restored; a task that ran must have written its record
 * during this run, or it counts as left without one. Every count and the
 * duration come from the package records, so a cache hit prints the same
 * console as the run it replays.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateReport, Unit } from "@beep/gate-report/GateReport";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { worstReason } from "@beep/gate-report/Vocabulary";
import { $RepoCliId } from "@beep/identity/packages";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { inputFingerprint } from "@beep/repo-gate-record/PackageLocation";
import { makeRunId } from "@beep/repo-gate-record/RunId";
import { WORKSPACE_SUBJECT } from "@beep/repo-gate-run/ConsoleDefaults";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { consoleSettings, EventRun, GateServicesConfig, recordEventRun } from "./GateRuntime.ts";
import type { AudienceFlagInput } from "@beep/cli-kit/CliAudience";
import type { ItemKind } from "@beep/gate-report/Vocabulary";
import type { ContractGate } from "@beep/repo-gate-run/RepoPointers";
import type { CapturedRun } from "./GateRuntime.ts";

const $I = $RepoCliId.create("commands/Gate/GateRoot");

/**
 * **Example** (Describe a summary task)
 *
 * ```ts
 * import { TurboSummaryTask } from "@beep/repo-cli/commands/Gate"
 *
 * const task = TurboSummaryTask.make({ task: "test", package: "@beep/glob", directory: "packages/glob" })
 * console.log(task.package) // @beep/glob
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboSummaryTask extends S.Opaque<TurboSummaryTask, { readonly brand: unique symbol }>()(
  S.Struct({
    task: S.String,
    package: S.String,
    directory: S.String,
    cache: S.optionalKey(S.Struct({ status: S.optionalKey(S.String) })),
    execution: S.optionalKey(S.Struct({ exitCode: S.Int.pipe(S.NullOr, S.optionalKey) })),
  }).pipe(
    $I.annoteSchema("TurboSummaryTask", {
      description: "One task of a Turbo run summary: name, package, directory, cache status and exit code.",
    })
  )
) {}

class TurboSummary extends S.Opaque<TurboSummary, { readonly brand: unique symbol }>()(
  S.Struct({ tasks: S.Array(TurboSummaryTask) }).pipe(
    $I.annoteSchema("TurboSummary", { description: "The tasks of a Turbo run summary file." })
  )
) {}

const decodeSummary = S.decodeUnknownEffect(S.fromJsonString(TurboSummary));

const SUMMARY_LINE = /Summary:\s+(\S+\.json)/u;

/**
 * The run summary file Turbo named in its output, if it wrote one.
 *
 * **Example** (Find the summary path)
 *
 * ```ts
 * import { summaryPathOf } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(summaryPathOf("Summary:    /repo/.turbo/runs/abc.json\n")) // { _id: 'Option', _tag: 'Some', value: '/repo/.turbo/runs/abc.json' }
 * ```
 *
 * @param output - Turbo's whole output.
 * @returns The path Turbo printed after `Summary:`, or none when the run wrote no summary file.
 * @category utilities
 * @since 0.0.0
 */
export const summaryPathOf = (output: string): O.Option<string> =>
  O.flatMap(O.fromNullishOr(SUMMARY_LINE.exec(Str.replace(/\u001b\[[0-9;]*m/gu, "")(output))), (match) =>
    O.fromNullishOr(match[1])
  );

const readSummaryTasks = Effect.fnUntraced(function* (output: string, gate: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* pipe(
    summaryPathOf(output),
    O.match({
      onNone: () => Effect.succeed(A.empty<TurboSummaryTask>()),
      onSome: (file) =>
        fs.readFileString(file).pipe(
          Effect.flatMap(decodeSummary),
          Effect.map((summary) => A.filter(summary.tasks, (task) => task.task === gate)),
          Effect.orElseSucceed(A.empty<TurboSummaryTask>)
        ),
    })
  );
});

/**
 * **Example** (Describe a package without a record)
 *
 * ```ts
 * import { PackageRun, TurboSummaryTask } from "@beep/repo-cli/commands/Gate"
 * import * as O from "effect/Option"
 *
 * const run = PackageRun.make({
 *   task: TurboSummaryTask.make({ task: "test", package: "@beep/glob", directory: "packages/glob" }),
 *   report: O.none(),
 * })
 * console.log(O.isNone(run.report)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageRun extends S.Opaque<PackageRun, { readonly brand: unique symbol }>()(
  S.Struct({
    task: TurboSummaryTask,
    report: S.Option(GateReport),
  }).pipe(
    $I.annoteSchema("PackageRun", {
      description: "A package that ran under a root gate task, with its report when it has a current record.",
    })
  )
) {}

/**
 * **Example** (Describe an empty fold)
 *
 * ```ts
 * import { WorkspaceFold } from "@beep/repo-cli/commands/Gate"
 * import * as DateTime from "effect/DateTime"
 *
 * const fold = WorkspaceFold.make({
 *   gate: "test", runId: "r1", startedAt: DateTime.makeUnsafe(0), inputFingerprint: "x", exitCode: 0, runs: [],
 * })
 * console.log(fold.runs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkspaceFold extends S.Opaque<WorkspaceFold, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: S.NonEmptyString,
    runId: S.NonEmptyString,
    startedAt: S.DateTimeUtc,
    inputFingerprint: S.NonEmptyString,
    exitCode: S.Int,
    runs: S.Array(PackageRun),
  }).pipe(
    $I.annoteSchema("WorkspaceFold", {
      description: "A root gate run's gate, id, start, input fingerprint, Turbo exit code and package runs.",
    })
  )
) {}

const isCacheHit = (task: TurboSummaryTask): boolean => task.cache?.status === "HIT";

const currentReport = Effect.fnUntraced(function* (input: {
  readonly repoRoot: string;
  readonly gate: string;
  readonly startedAt: DateTime.Utc;
  readonly task: TurboSummaryTask;
}) {
  const store = yield* GateRecordStore.make(input.repoRoot);
  const target = RecordTarget.cases.PackageTarget.makeOption({ packageDir: input.task.directory, gate: input.gate });
  const record = yield* O.match(target, {
    onNone: () => Effect.succeedNone,
    onSome: (packageTarget) => Effect.option(store.readRecord(packageTarget)),
  });
  return pipe(
    O.filter(
      record,
      (found) => isCacheHit(input.task) || DateTime.isGreaterThanOrEqualTo(found.generatedAt, input.startedAt)
    ),
    O.map((found) => found.report)
  );
});

const under = (dir: string, report: GateReport) => (unit: string) =>
  unit === report.subject ? unit : `${dir}/${unit}`;

const placedKey = (dir: string, report: GateReport, key: ItemKey): ItemKey =>
  ItemKey.match(key, {
    TestKey: (test) => ItemKey.cases.TestKey.make({ file: `${dir}/${test.file}`, fullName: test.fullName }),
    DiagnosticKey: (diagnostic) =>
      ItemKey.cases.DiagnosticKey.make({
        file: `${dir}/${diagnostic.file}`,
        code: diagnostic.code,
        shape: diagnostic.shape,
      }),
    FaultKey: (fault) => ItemKey.cases.FaultKey.make({ ...fault, unit: under(dir, report)(fault.unit) }),
  });

const placedItem = (dir: string, report: GateReport) => (item: Item) =>
  Item.make({
    ...item,
    key: placedKey(dir, report, item.key),
    unit: under(dir, report)(item.unit),
    location: O.map(item.location, (location) => Location.make({ ...location, file: `${dir}/${location.file}` })),
  });

const reportEvents = (dir: string, report: GateReport): ReadonlyArray<GateEvent> => [
  GateEvent.cases.UnitQueued.make({ unit: Unit.make({ id: report.subject, kind: "package" }) }),
  ...A.map(
    A.filter(report.units, (unit) => unit.id !== report.subject),
    (unit) =>
      GateEvent.cases.UnitQueued.make({
        unit: Unit.make({ ...unit, id: `${dir}/${unit.id}`, parent: O.some(report.subject) }),
      })
  ),
  ...A.map(report.items, (item) => GateEvent.cases.ItemFinished.make({ item: placedItem(dir, report)(item) })),
];

const unrecordedEvents = (gate: string, task: TurboSummaryTask): ReadonlyArray<GateEvent> => {
  const exitCode = task.execution?.exitCode ?? 0;
  return [
    GateEvent.cases.UnitQueued.make({ unit: Unit.make({ id: task.package, kind: "package" }) }),
    GateEvent.cases.ItemFinished.make({
      item: Item.make({
        key: ItemKey.cases.FaultKey.make({ unit: task.package, kind: "unhandled", name: "no record" }),
        unit: task.package,
        path: [],
        name: `the ${gate} task left no record`,
        outcome: exitCode === 0 ? "skipped" : "failed",
        failureKind: exitCode === 0 ? O.none() : O.some("unhandled"),
        detail: ItemDetail.makeOption({
          message: `the ${gate} task of ${task.package} exited ${exitCode} and wrote no record`,
        }),
      }),
    }),
  ];
};

const runEvents = (gate: string, run: PackageRun): ReadonlyArray<GateEvent> =>
  O.match(run.report, {
    onNone: () => unrecordedEvents(gate, run.task),
    onSome: (report) => reportEvents(run.task.directory, report),
  });

/**
 * The events of the workspace report folded from the package runs.
 *
 * **Details**
 *
 * Package files and items move under the package directory so two packages'
 * `test/a.test.ts` stay apart. The run's reason is the worst package reason,
 * its count of collected items the sum of the packages' (each unrecorded
 * package counts one), and its duration the sum of the package durations, so
 * the console of a cache hit equals the console of the run it restores.
 *
 * **Example** (Fold no package runs)
 *
 * ```ts
 * import { WorkspaceFold, workspaceEvents } from "@beep/repo-cli/commands/Gate"
 * import * as DateTime from "effect/DateTime"
 *
 * const events = workspaceEvents(
 *   WorkspaceFold.make({ gate: "test", runId: "r1", startedAt: DateTime.makeUnsafe(0), inputFingerprint: "x", exitCode: 0, runs: [] })
 * )
 * console.log(events.map((event) => event._tag).join(" ")) // RunStarted RunFinished
 * ```
 *
 * @param input - The root run's identity, Turbo's exit code and the package runs.
 * @returns The events that reduce to the workspace report.
 *
 * @category folding
 * @since 0.0.0
 */
export const workspaceEvents = (input: WorkspaceFold): ReadonlyArray<GateEvent> => {
  const reports = A.getSomes(A.map(input.runs, (run) => run.report));
  return [
    GateEvent.cases.RunStarted.make({
      runId: input.runId,
      gate: input.gate,
      subject: WORKSPACE_SUBJECT,
      itemKind: pipe(
        A.head(reports),
        O.map((report) => report.itemKind),
        O.getOrElse((): ItemKind => (input.gate === "check" ? "diagnostic" : "test"))
      ),
      startedAt: input.startedAt,
      inputFingerprint: input.inputFingerprint,
    }),
    ...A.flatMap(input.runs, (run) => runEvents(input.gate, run)),
    GateEvent.cases.RunFinished.make({
      durationMs: A.reduce(reports, 0, (total, report) => total + report.durationMs),
      reason: worstReason(A.map(reports, (report) => report.reason)),
      exitCode: O.some(input.exitCode),
      collected: O.some(
        A.reduce(reports, 0, (total, report) => total + report.totals.collected) + (input.runs.length - reports.length)
      ),
    }),
  ];
};

/**
 * Record a root gate run Turbo finished and print its one console: the
 * records of the packages that ran folded into the workspace report, the
 * root record and raw log written under `.beep/gates/<gate>/`.
 *
 * **Gotchas**
 *
 * A cache hit's package record is the one Turbo restored; any other package counts only a
 * record generated at or after Turbo started. A task without one is failed when it failed, and
 * otherwise listed as skipped so the record still names it.
 *
 * **Example** (Record a root test run)
 *
 * ```ts
 * import { CapturedRun, recordRootRun } from "@beep/repo-cli/commands/Gate"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 *
 * const program = recordRootRun({
 *   repoRoot: "/repo",
 *   gate: "test",
 *   startedAt: DateTime.makeUnsafe(0),
 *   captured: CapturedRun.make({ exitCode: 0, output: new Uint8Array() }),
 *   flags: { audience: [], human: [], agent: [], ci: [] },
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param input - The repository root, the gate, when Turbo started, its captured run and the audience flags.
 * @returns The report printed.
 * @category use-cases
 * @since 0.0.0
 */
export const recordRootRun = Effect.fn("Gate.recordRootRun")(function* (input: {
  readonly repoRoot: string;
  readonly gate: ContractGate;
  readonly startedAt: DateTime.Utc;
  readonly captured: CapturedRun;
  readonly flags: AudienceFlagInput;
}) {
  const settings = yield* consoleSettings(input.flags);
  const tasks = yield* readSummaryTasks(new TextDecoder().decode(input.captured.output), input.gate);
  const runs = yield* Effect.forEach(
    tasks,
    (task) =>
      Effect.map(
        currentReport({ repoRoot: input.repoRoot, gate: input.gate, startedAt: input.startedAt, task }),
        (report) => PackageRun.make({ task, report })
      ),
    { concurrency: 8 }
  );
  const runId = yield* makeRunId;
  const fingerprint = yield* inputFingerprint(runId);
  const events = workspaceEvents(
    WorkspaceFold.make({
      gate: input.gate,
      runId,
      startedAt: input.startedAt,
      inputFingerprint: fingerprint,
      exitCode: input.captured.exitCode,
      runs: A.sort(
        runs,
        Order.mapInput(Order.String, (run: PackageRun) => run.task.directory)
      ),
    })
  );
  const result = yield* recordEventRun(GateServicesConfig.make({ repoRoot: input.repoRoot, settings }))(
    EventRun.make({
      target: RecordTarget.cases.RootTarget.make({ gate: input.gate, runId }),
      events,
      exitCode: input.captured.exitCode,
      output: input.captured.output,
    })
  );
  return result.report;
});
