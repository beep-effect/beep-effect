/**
 * Turbo task-input affected proof harness for repo quality lanes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, Order, pipe } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { runCaptured } from "../../../internal/process/index.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Quality/internal/TurboConfigProof");

const TURBO_CONFIG_PROOF_TASK_VALUES = ["build", "check", "lint", "test", "type-test", "docgen"] as const;
const TURBO_CONFIG_PROOF_SELECTOR_VALUES = ["affected", "filter-range"] as const;
const defaultProofTasks: ReadonlyArray<TurboConfigProofTaskName> = ["lint", "check", "test", "type-test", "docgen"];

/**
 * Turbo task names supported by the scoped-config proof harness.
 *
 * @example
 * ```ts
 * import { TurboConfigProofTaskName } from "@beep/repo-cli/test/Quality"
 * const task = TurboConfigProofTaskName.pick("lint")
 * ```
 * @category models
 * @since 0.0.0
 */
export const TurboConfigProofTaskName = LiteralKit(TURBO_CONFIG_PROOF_TASK_VALUES).pipe(
  $I.annoteSchema("TurboConfigProofTaskName", {
    description: "Turbo task name included in scoped config proof reports.",
  })
);

/**
 * Turbo task name supported by the scoped-config proof harness.
 *
 * @example
 * ```ts
 * import type { TurboConfigProofTaskName } from "@beep/repo-cli/test/Quality"
 * const task: TurboConfigProofTaskName = "check"
 * ```
 * @category models
 * @since 0.0.0
 */
export type TurboConfigProofTaskName = typeof TurboConfigProofTaskName.Type;

/**
 * Selector mode used for Turbo dry-run proof.
 *
 * @example
 * ```ts
 * import { TurboConfigProofSelectorMode } from "@beep/repo-cli/test/Quality"
 * const mode = TurboConfigProofSelectorMode.pick("affected")
 * ```
 * @category models
 * @since 0.0.0
 */
export const TurboConfigProofSelectorMode = LiteralKit(TURBO_CONFIG_PROOF_SELECTOR_VALUES).pipe(
  $I.annoteSchema("TurboConfigProofSelectorMode", {
    description: "Turbo selector used by dry-run proof commands.",
  })
);

/**
 * Selector mode used for Turbo dry-run proof.
 *
 * @example
 * ```ts
 * import type { TurboConfigProofSelectorMode } from "@beep/repo-cli/test/Quality"
 * const mode: TurboConfigProofSelectorMode = "filter-range"
 * ```
 * @category models
 * @since 0.0.0
 */
export type TurboConfigProofSelectorMode = typeof TurboConfigProofSelectorMode.Type;

/**
 * Typed error raised while collecting Turbo scoped-config proof data.
 *
 * @category errors
 * @since 0.0.0
 */
export class TurboConfigProofError extends TaggedErrorClass<TurboConfigProofError>($I`TurboConfigProofError`)(
  "TurboConfigProofError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("TurboConfigProofError", {
    description: "Failure raised by the Turbo scoped-config proof harness.",
  })
) {
  /**
   * Construct or map a Turbo scoped-config proof error.
   *
   * @param message - Human-readable failure summary for CLI output.
   * @param options - Optional command details copied into the error payload.
   * @returns Turbo scoped-config proof error value.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (message: string, options: { readonly command?: string; readonly exitCode?: number } = {}) =>
    TurboConfigProofError.make({
      message,
      ...O.getSomesStruct({ command: O.fromUndefinedOr(options.command) }),
      ...O.getSomesStruct({ exitCode: O.fromUndefinedOr(options.exitCode) }),
    });

  /**
   * Map an unknown cause to a Turbo scoped-config proof error.
   *
   * @param message - Human-readable failure summary for CLI output.
   * @param options - Optional command details copied into the error payload.
   * @returns Mapper that preserves the unknown cause on a typed error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError =
    (message: string, options: { readonly command?: string; readonly exitCode?: number } = {}) =>
    (cause: unknown) =>
      TurboConfigProofError.make({
        cause,
        message,
        ...O.getSomesStruct({ command: O.fromUndefinedOr(options.command) }),
        ...O.getSomesStruct({ exitCode: O.fromUndefinedOr(options.exitCode) }),
      });
}

/**
 * Count summary for a Turbo proof probe.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigProofCountSummary extends S.Class<TurboConfigProofCountSummary>(
  $I`TurboConfigProofCountSummary`
)(
  {
    total: S.Finite,
    packages: S.Finite,
    byTask: S.Record(S.String, S.Finite),
    byReason: S.Record(S.String, S.Finite),
    byStatus: S.Record(S.String, S.Finite),
  },
  $I.annote("TurboConfigProofCountSummary", {
    description: "Aggregated package, task, reason, and cache-status counts from one Turbo probe.",
  })
) {}

/**
 * Per-task dry-run proof summary.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigProofDryRunSummary extends S.Class<TurboConfigProofDryRunSummary>(
  $I`TurboConfigProofDryRunSummary`
)(
  {
    task: TurboConfigProofTaskName,
    selector: TurboConfigProofSelectorMode,
    command: S.String,
    summary: TurboConfigProofCountSummary,
  },
  $I.annote("TurboConfigProofDryRunSummary", {
    description: "Dry-run proof summary for a single Turbo task.",
  })
) {}

/**
 * Complete scoped-config proof report.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigProofReport extends S.Class<TurboConfigProofReport>($I`TurboConfigProofReport`)(
  {
    base: S.String,
    head: S.String,
    tasks: S.Array(TurboConfigProofTaskName),
    selector: TurboConfigProofSelectorMode,
    queryCommand: S.String,
    query: TurboConfigProofCountSummary,
    dryRuns: S.Array(TurboConfigProofDryRunSummary),
  },
  $I.annote("TurboConfigProofReport", {
    description: "Scoped Turbo config proof report for a base/head comparison.",
  })
) {}

/**
 * Options for collecting a scoped-config proof report.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigProofOptions extends S.Class<TurboConfigProofOptions>($I`TurboConfigProofOptions`)(
  {
    base: S.String,
    head: S.String,
    selector: TurboConfigProofSelectorMode,
    tasks: S.Array(S.String),
  },
  $I.annote("TurboConfigProofOptions", {
    description: "Base, head, selector, and task inputs for scoped Turbo config proof collection.",
  })
) {}

type CommandOutput = {
  readonly command: string;
  readonly exitCode: number;
  readonly output: string;
};

const UnknownStringRecord = S.Record(S.String, S.Unknown);
const decodeJsonText = S.decodeUnknownEffect(S.UnknownFromJsonString);
const decodeUnknownRecordOption = S.decodeUnknownOption(UnknownStringRecord);
const encodeReportJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const isProofTaskName = S.is(TurboConfigProofTaskName);

const emptySummary = () =>
  TurboConfigProofCountSummary.make({
    total: 0,
    packages: 0,
    byTask: {},
    byReason: {},
    byStatus: {},
  });

const increment = (record: Record<string, number>, key: string): Record<string, number> => ({
  ...record,
  [key]: (record[key] ?? 0) + 1,
});

const getRecord = (value: unknown): O.Option<Record<string, unknown>> =>
  A.isArray(value) ? O.none() : decodeUnknownRecordOption(value);

const getArray = (value: unknown): ReadonlyArray<unknown> => (A.isArray(value) ? value : A.empty<unknown>());

const getString = (value: unknown): O.Option<string> => (P.isString(value) ? O.some(value) : O.none());

const getPath = (value: unknown, path: ReadonlyArray<string>): O.Option<unknown> =>
  A.reduce(path, O.some(value) as O.Option<unknown>, (current, key) =>
    pipe(
      current,
      O.flatMap(getRecord),
      O.flatMap((record) => O.fromUndefinedOr(record[key]))
    )
  );

const jsonPayloadFromOutput = (output: string): O.Option<string> => {
  const start = Str.indexOf("{")(output);
  if (O.isNone(start)) {
    return O.none();
  }
  return O.some(Str.slice(start.value)(output));
};

const taskNameFromDryRunItem = (item: Record<string, unknown>): string =>
  pipe(
    O.fromUndefinedOr(item.task),
    O.orElse(() =>
      pipe(
        O.fromUndefinedOr(item.taskId),
        O.flatMap(getString),
        O.map((taskId) =>
          pipe(
            Str.split("#")(taskId),
            A.last,
            O.getOrElse(() => taskId)
          )
        )
      )
    ),
    O.flatMap(getString),
    O.getOrElse(() => "unknown")
  );

const taskNameFromQueryItem = (item: Record<string, unknown>): string =>
  pipe(
    O.fromUndefinedOr(item.name),
    O.flatMap(getString),
    O.getOrElse(() => "unknown")
  );

const reasonNameFromQueryItem = (item: Record<string, unknown>): string =>
  pipe(
    O.fromUndefinedOr(item.reason),
    O.flatMap(getRecord),
    O.flatMap((reason) => O.fromUndefinedOr(reason.__typename)),
    O.flatMap(getString),
    O.getOrElse(() => "unknown")
  );

const cacheStatusFromDryRunItem = (item: Record<string, unknown>): string =>
  pipe(
    O.fromUndefinedOr(item.cache),
    O.flatMap(getRecord),
    O.flatMap((cache) => O.fromUndefinedOr(cache.status)),
    O.orElse(() => O.fromUndefinedOr(item.cacheStatus)),
    O.flatMap(getString),
    O.getOrElse(() => "unknown")
  );

const packageCountFromDocument = (document: unknown): number =>
  pipe(
    getPath(document, ["packages"]),
    O.map(getArray),
    O.map(A.length),
    O.getOrElse(() => 0)
  );

const parseTurboJsonOutput = Effect.fn("TurboConfigProof.parseTurboJsonOutput")(function* (
  output: string
): Effect.fn.Return<unknown, TurboConfigProofError> {
  const payload = pipe(
    jsonPayloadFromOutput(output),
    O.getOrElse(() => "{}")
  );
  return yield* decodeJsonText(payload).pipe(
    Effect.mapError(TurboConfigProofError.mapError("Turbo command output did not contain valid JSON."))
  );
});

/**
 * Convert `turbo query affected` JSON into package, task, and reason counts.
 *
 * @param output - Captured command output.
 * @returns Count summary for affected tasks.
 * @category parsing
 * @since 0.0.0
 */
export const summarizeTurboQueryAffectedOutput = Effect.fn("TurboConfigProof.summarizeTurboQueryAffectedOutput")(
  function* (output: string): Effect.fn.Return<TurboConfigProofCountSummary, TurboConfigProofError> {
    const document = yield* parseTurboJsonOutput(output);
    const items = pipe(getPath(document, ["data", "affectedTasks", "items"]), O.map(getArray), O.getOrElse(A.empty));

    return A.reduce(items, emptySummary(), (summary, item) =>
      pipe(
        getRecord(item),
        O.match({
          onNone: () => summary,
          onSome: (record) => {
            const task = taskNameFromQueryItem(record);
            const reason = reasonNameFromQueryItem(record);
            return TurboConfigProofCountSummary.make({
              ...summary,
              total: summary.total + 1,
              byTask: increment(summary.byTask, task),
              byReason: increment(summary.byReason, reason),
            });
          },
        })
      )
    );
  }
);

/**
 * Summarize `turbo run --dry-run=json` output.
 *
 * @param output - Captured command output.
 * @returns Count summary for selected dry-run tasks.
 * @category parsing
 * @since 0.0.0
 */
// fallow-ignore-next-line code-duplication
export const summarizeTurboDryRunOutput = Effect.fn("TurboConfigProof.summarizeTurboDryRunOutput")(function* (
  output: string
): Effect.fn.Return<TurboConfigProofCountSummary, TurboConfigProofError> {
  const document = yield* parseTurboJsonOutput(output);
  const items = pipe(getPath(document, ["tasks"]), O.map(getArray), O.getOrElse(A.empty));
  const packages = packageCountFromDocument(document);

  return A.reduce(items, TurboConfigProofCountSummary.make({ ...emptySummary(), packages }), (summary, item) =>
    pipe(
      getRecord(item),
      O.match({
        onNone: () => summary,
        onSome: (record) => {
          const task = taskNameFromDryRunItem(record);
          const status = cacheStatusFromDryRunItem(record);
          return TurboConfigProofCountSummary.make({
            ...summary,
            total: summary.total + 1,
            byTask: increment(summary.byTask, task),
            byStatus: increment(summary.byStatus, status),
          });
        },
      })
    )
  );
});

const commandText = (command: string, args: ReadonlyArray<string>): string => A.join([command, ...args], " ");

const runCommandOutput = Effect.fn("TurboConfigProof.runCommandOutput")(function* (
  repoRoot: string,
  command: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<CommandOutput, TurboConfigProofError, ChildProcessSpawner.ChildProcessSpawner> {
  const renderedCommand = commandText(command, args);
  const result = yield* runCaptured({
    command,
    args,
    cwd: repoRoot,
  }).pipe(
    Effect.mapError(TurboConfigProofError.mapError(`Failed to spawn ${renderedCommand}.`, { command: renderedCommand }))
  );

  if (result.exitCode !== 0) {
    return yield* TurboConfigProofError.new(`Turbo proof command failed with exit code ${result.exitCode}.`, {
      command: renderedCommand,
      exitCode: result.exitCode,
    });
  }

  return {
    command: renderedCommand,
    exitCode: result.exitCode,
    output: result.output,
  };
});

const normalizeProofTasks = (tasks: ReadonlyArray<string>): ReadonlyArray<TurboConfigProofTaskName> => {
  const normalized = pipe(tasks, A.filter(isProofTaskName), A.dedupe);
  return A.isReadonlyArrayEmpty(normalized) ? defaultProofTasks : normalized;
};

const selectorArgs = (selector: TurboConfigProofSelectorMode, base: string, head: string): ReadonlyArray<string> =>
  selector === "filter-range" ? [`--filter=[${base}...${head}]`] : ["--affected"];

/**
 * Collect a Turbo scoped-config proof report.
 *
 * @param repoRoot - Repository root.
 * @param options - Base/head, task, and selector options.
 * @returns Structured proof report.
 * @category use-cases
 * @since 0.0.0
 */
export const runTurboConfigProof = Effect.fn("TurboConfigProof.runTurboConfigProof")(function* (
  repoRoot: string,
  options: TurboConfigProofOptions
): Effect.fn.Return<TurboConfigProofReport, TurboConfigProofError, ChildProcessSpawner.ChildProcessSpawner> {
  const tasks = normalizeProofTasks(options.tasks);
  const queryArgs = ["turbo", "query", "affected", "--tasks", ...tasks, "--base", options.base, "--head", options.head];
  const queryOutput = yield* runCommandOutput(repoRoot, "bunx", queryArgs);
  const query = yield* summarizeTurboQueryAffectedOutput(queryOutput.output);
  const dryRunSelectorArgs = selectorArgs(options.selector, options.base, options.head);
  const dryRuns = yield* Effect.forEach(
    tasks,
    Effect.fn(function* (task) {
      const args = ["turbo", "run", task, ...dryRunSelectorArgs, "--dry-run=json", "--ui=stream"];
      const output = yield* runCommandOutput(repoRoot, "bunx", args);
      const summary = yield* summarizeTurboDryRunOutput(output.output);
      return TurboConfigProofDryRunSummary.make({
        task,
        selector: options.selector,
        command: output.command,
        summary,
      });
    }),
    { concurrency: 1 }
  );

  return TurboConfigProofReport.make({
    base: options.base,
    head: options.head,
    tasks,
    selector: options.selector,
    queryCommand: queryOutput.command,
    query,
    dryRuns,
  });
});

/**
 * Render a scoped-config proof report as JSON.
 *
 * @param report - Proof report to encode.
 * @returns JSON report text.
 * @category formatting
 * @since 0.0.0
 */
export const renderTurboConfigProofReportJson = (
  report: TurboConfigProofReport
): Effect.Effect<string, TurboConfigProofError> =>
  encodeReportJson(report).pipe(
    Effect.mapError(TurboConfigProofError.mapError("Failed to encode Turbo config proof report as JSON."))
  );

const countRecordSummary = (record: Readonly<Record<string, number>>): string =>
  R.isEmptyReadonlyRecord(record)
    ? "none"
    : pipe(
        R.toEntries(record),
        A.sortBy(Order.mapInput(Order.String, ([key]) => key)),
        A.map(([key, value]) => `${key}:${value}`),
        A.join(", ")
      );

/**
 * Render a scoped-config proof report as a compact human-readable summary.
 *
 * @param report - Proof report to render.
 * @returns Human-readable summary text.
 * @category formatting
 * @since 0.0.0
 */
export const renderTurboConfigProofReport = (report: TurboConfigProofReport): string =>
  A.join(
    [
      `Turbo config proof (${report.selector})`,
      `base: ${report.base}`,
      `head: ${report.head}`,
      `query: ${report.query.total} affected task(s); tasks ${countRecordSummary(report.query.byTask)}; reasons ${countRecordSummary(report.query.byReason)}`,
      ...A.map(
        report.dryRuns,
        (entry) =>
          `${entry.task}: ${entry.summary.total} dry-run task(s); packages ${entry.summary.packages}; tasks ${countRecordSummary(entry.summary.byTask)}; cache ${countRecordSummary(entry.summary.byStatus)}`
      ),
    ],
    "\n"
  );
