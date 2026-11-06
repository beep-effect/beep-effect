/**
 * Turbo task-input affected proof harness for repo quality lanes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { commandErrorFields } from "@beep/repo-cli-kit/cli/CommandErrorFields";
import { runCaptured } from "@beep/repo-cli-kit/process/index";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as SecureRandom from "effect/crypto/SecureRandom";

export { QualityArtifactGeneratorError } from "./QualityArtifactSupport.ts";

import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const UnknownJson = S.fromJsonString(S.Unknown);

const $I = $RepoCliId.create("commands/Quality/internal/TurboConfigProof");

// Package roles first: `test:property` and `package-test-typecheck` ride `^transit` like `test`, so
// a dependency edit's cascade (quality audit M10) is measurable task by task.
const TURBO_CONFIG_PROOF_TASK_VALUES = [
  "build",
  "check",
  "lint",
  "test",
  "test:property",
  "package-test-typecheck",
  "docgen",
  "doctest",
  "lint:deprecated-apis",
  "lint:jsdoc",
  "lint:laws",
  "//#lint:jsdoc:root",
  "//#lint:policy-fingerprint",
  "//#lint:native-runtime:roots",
  "//#lint:package-scripts",
  "//#knowledge:semantic-delta",
  "//#knowledge:refs-check",
  "//#lint:schema-first",
  "//#lint:schema-catalog",
  "//#lint:identity-registry",
  "//#lint:effect-imports",
  "//#lint:tsgo-rules",
  "//#lint:oxlint",
  "//#lint:deprecated-imports",
  "//#lint:shadcn",
  "//#lint:allowlist",
  "//#lint:jsdoc-module-tags",
  "//#goals:doctor",
  "//#lint:roadmap-refs",
  "//#lint:judge-rubric",
  "//#lint:typos",
  "//#fallow:audit:check",
  "//#fallow:health:check",
  "//#fallow:health:advisory",
  "//#fallow:boundaries:advisory",
  "//#fallow:flags:advisory",
  "//#fallow:security:advisory",
  "//#fallow:fix-preview:advisory",
  "//#jsdoc:inventory:check",
  "//#lint:tsconfig-overlay",
  "//#lint:package-test-typecheck",
  "//#lint:effect-vitest",
  "//#lint:opaque-roundtrips",
  "//#jsdoc:ratchet:check",
  "//#changeset:status",
  "//#lint:circular",
  "//#lint:effect-imports-markdown",
  "//#lint:markdown-fences",
  "//#lint:retired-effect-paths",
  "//#lint:retired-iri-authorities",
  "//#lint:schema-tag-idioms",
  "//#lint:holds",
  "//#lint:ecosystem-polarity",
  "//#goals:index-check",
  "//#lint:reflection-artifacts",
  "//#fallow:dead-code:check",
  "//#config-sync:check",
  "//#repo-sanity:changeset-graph",
  "//#repo-sanity:syncpack",
  "//#repo-sanity:sherif",
  "//#repo-sanity:versions",
  "//#repo-sanity:bun-audit",
  "//#fallow:boundaries:config-check",
  "//#topo-sort",
] as const;
const TURBO_CONFIG_PROOF_SELECTOR_VALUES = ["affected", "filter-range"] as const;
const defaultProofTasks: ReadonlyArray<TurboConfigProofTaskName> = ["lint", "check", "test", "docgen", "doctest"];

/**
 * Turbo task names supported by the scoped-config proof harness.
 *
 * **Example** (Prove Turbo configuration)
 *
 * ```ts
 * import { TurboConfigProofTaskName } from "@beep/repo-cli/test/Quality"
 * const task = TurboConfigProofTaskName.pick("lint")
 * ```
 *
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
 * **Example** (Prove Turbo configuration)
 *
 * ```ts
 * import type { TurboConfigProofTaskName } from "@beep/repo-cli/test/Quality"
 * const task: TurboConfigProofTaskName = "check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurboConfigProofTaskName = typeof TurboConfigProofTaskName.Type;

/**
 * Selector mode used for Turbo dry-run proof.
 *
 * **Example** (Prove Turbo configuration)
 *
 * ```ts
 * import { TurboConfigProofSelectorMode } from "@beep/repo-cli/test/Quality"
 * const mode = TurboConfigProofSelectorMode.pick("affected")
 * ```
 *
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
 * **Example** (Prove Turbo configuration)
 *
 * ```ts
 * import type { TurboConfigProofSelectorMode } from "@beep/repo-cli/test/Quality"
 * const mode: TurboConfigProofSelectorMode = "filter-range"
 * ```
 *
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
export class TurboConfigProofError extends S.TaggedError<TurboConfigProofError, { readonly brand: unique symbol }>(
  $I`TurboConfigProofError`
)(
  "TurboConfigProofError",
  commandErrorFields,
  $I.annoteError<TurboConfigProofError>("TurboConfigProofError", {
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
export class TurboConfigProofCountSummary extends S.Opaque<
  TurboConfigProofCountSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    total: S.Finite,
    packages: S.Finite,
    byTask: S.Record(S.String, S.Finite),
    byReason: S.Record(S.String, S.Finite),
    byStatus: S.Record(S.String, S.Finite),
  }).pipe(
    $I.annoteSchema("TurboConfigProofCountSummary", {
      description: "Aggregated package, task, reason, and cache-status counts from one Turbo probe.",
    })
  )
) {}

/**
 * Per-task dry-run proof summary.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigProofDryRunSummary extends S.Opaque<
  TurboConfigProofDryRunSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    task: TurboConfigProofTaskName,
    selector: TurboConfigProofSelectorMode,
    command: S.String,
    summary: TurboConfigProofCountSummary,
  }).pipe(
    $I.annoteSchema("TurboConfigProofDryRunSummary", {
      description: "Dry-run proof summary for a single Turbo task.",
    })
  )
) {}

/**
 * Complete scoped-config proof report.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigProofReport extends S.Opaque<TurboConfigProofReport, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.String,
    head: S.String,
    tasks: S.Array(TurboConfigProofTaskName),
    selector: TurboConfigProofSelectorMode,
    queryCommand: S.String,
    query: TurboConfigProofCountSummary,
    dryRuns: S.Array(TurboConfigProofDryRunSummary),
  }).pipe(
    $I.annoteSchema("TurboConfigProofReport", {
      description: "Scoped Turbo config proof report for a base/head comparison.",
    })
  )
) {}

/**
 * Options for collecting a scoped-config proof report.
 *
 * @category models
 * @since 0.0.0
 */
export class TurboConfigProofOptions extends S.Opaque<TurboConfigProofOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.String,
    head: S.String,
    selector: TurboConfigProofSelectorMode,
    tasks: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("TurboConfigProofOptions", {
      description: "Base, head, selector, and task inputs for scoped Turbo config proof collection.",
    })
  )
) {}

type CommandOutput = {
  readonly command: string;
  readonly exitCode: number;
  readonly output: string;
};

const UnknownStringRecord = S.Record(S.String, S.Unknown);
/** Required query envelope; an absent task array is not an empty selection. */
class TurboQuerySelection extends S.Opaque<TurboQuerySelection, { readonly brand: unique symbol }>()(
  S.Struct({
    data: S.Struct({ affectedTasks: S.Struct({ items: S.Array(UnknownStringRecord) }) }),
  }).pipe(
    $I.annoteSchema("TurboQuerySelection", {
      description: "Native affected query envelope with an explicitly reported task array.",
    })
  )
) {}
/** Required dry-run envelope, retaining the optional package inventory. */
class TurboDrySelection extends S.Opaque<TurboDrySelection, { readonly brand: unique symbol }>()(
  S.Struct({
    tasks: S.Array(UnknownStringRecord),
    packages: S.Unknown.pipe(S.Array, S.OptionFromOptionalKey),
  }).pipe(
    $I.annoteSchema("TurboDrySelection", {
      description: "Native dry-run envelope with an explicit task array and optional package inventory.",
    })
  )
) {}
const decodeJsonText = S.decodeUnknownEffect(UnknownJson);
const decodeQuerySelection = S.decodeUnknownEffect(TurboQuerySelection);
const decodeDrySelection = S.decodeUnknownEffect(TurboDrySelection);
const decodeUnknownRecordOption = S.decodeUnknownOption(UnknownStringRecord);
const encodeReportJson = S.encodeUnknownEffect(UnknownJson);
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

const getString = (value: unknown): O.Option<string> => (P.isString(value) ? O.some(value) : O.none());

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

const parseTurboJsonOutput = Effect.fn("TurboConfigProof.parseTurboJsonOutput")(function* (
  output: string
): Effect.fn.Return<unknown, TurboConfigProofError> {
  const payload = pipe(
    jsonPayloadFromOutput(output),
    O.getOrElse(() => "{}")
  );
  return yield* decodeJsonText(payload).pipe(
    Effect.mapError(() => TurboConfigProofError.new("Turbo command output did not contain valid JSON."))
  );
});

/**
 * Convert `turbo query affected` JSON into package, task, and reason counts.
 *
 * **Details**
 *
 * A task array must be explicitly present. Invalid payloads fail without
 * retaining their raw values in the error; a reported empty array yields zero.
 *
 * **Example** (Count an explicitly empty affected selection)
 *
 * ```ts
 * import { summarizeTurboQueryAffectedOutput } from "@beep/repo-cli/commands/Quality";
 * import * as Effect from "effect/Effect";
 *
 * const count = summarizeTurboQueryAffectedOutput('{"data":{"affectedTasks":{"items":[]}}}').pipe(
 *   Effect.map((summary) => summary.total)
 * );
 * void count;
 * ```
 *
 * @param output - Captured command output.
 * @returns Count summary for affected tasks.
 * @category parsing
 * @since 0.0.0
 */
export const summarizeTurboQueryAffectedOutput = Effect.fn("TurboConfigProof.summarizeTurboQueryAffectedOutput")(
  function* (output: string): Effect.fn.Return<TurboConfigProofCountSummary, TurboConfigProofError> {
    const parsed = yield* parseTurboJsonOutput(output);
    const document = yield* decodeQuerySelection(parsed).pipe(
      Effect.mapError(() => TurboConfigProofError.new("Invalid Turbo affected query task envelope."))
    );
    const items = document.data.affectedTasks.items;
    const packages = pipe(
      items,
      A.filterMap((item) =>
        pipe(
          O.fromUndefinedOr(item.package),
          O.flatMap(getRecord),
          O.flatMap((record) => getString(record.name))
        )
      ),
      A.dedupe,
      A.length
    );
    return A.reduce(items, TurboConfigProofCountSummary.make({ ...emptySummary(), packages }), (summary, item) =>
      TurboConfigProofCountSummary.make({
        ...summary,
        total: summary.total + 1,
        byTask: increment(summary.byTask, taskNameFromQueryItem(item)),
        byReason: increment(summary.byReason, reasonNameFromQueryItem(item)),
      })
    );
  }
);

/**
 * Summarize `turbo run --dry-run=json` output.
 *
 * **Details**
 *
 * Missing or malformed task arrays fail with a payload-safe typed error.
 * An explicit empty array remains a valid zero-task selection.
 *
 * **Example** (Count a reported dry-run task)
 *
 * ```ts
 * import { summarizeTurboDryRunOutput } from "@beep/repo-cli/commands/Quality";
 * import * as Effect from "effect/Effect";
 *
 * const count = summarizeTurboDryRunOutput('{"tasks":[{"task":"check"}]}').pipe(
 *   Effect.map((summary) => summary.total)
 * );
 * void count;
 * ```
 *
 * @param output - Captured command output.
 * @returns Count summary for selected dry-run tasks.
 * @category parsing
 * @since 0.0.0
 */
export const summarizeTurboDryRunOutput = Effect.fn("TurboConfigProof.summarizeTurboDryRunOutput")(function* (
  output: string
): Effect.fn.Return<TurboConfigProofCountSummary, TurboConfigProofError> {
  const parsed = yield* parseTurboJsonOutput(output);
  const document = yield* decodeDrySelection(parsed).pipe(
    Effect.mapError(() => TurboConfigProofError.new("Invalid Turbo dry-run task envelope."))
  );
  const packages = pipe(
    document.packages,
    O.map(A.length),
    O.getOrElse(() => 0)
  );
  return A.reduce(document.tasks, TurboConfigProofCountSummary.make({ ...emptySummary(), packages }), (summary, item) =>
    TurboConfigProofCountSummary.make({
      ...summary,
      total: summary.total + 1,
      byTask: increment(summary.byTask, taskNameFromDryRunItem(item)),
      byStatus: increment(summary.byStatus, cacheStatusFromDryRunItem(item)),
    })
  );
});

const commandText = (command: string, args: ReadonlyArray<string>): string => A.join([command, ...args], " ");

const runCommandOutput = Effect.fn("TurboConfigProof.runCommandOutput")(function* (
  repoRoot: string,
  command: string,
  args: ReadonlyArray<string>,
  options: TurboConfigProofOptions
): Effect.fn.Return<
  CommandOutput,
  TurboConfigProofError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const renderedCommand = commandText(command, args);
  const result = yield* runCaptured({
    command,
    args,
    cwd: repoRoot,
    env: { TURBO_SCM_BASE: options.base, TURBO_SCM_HEAD: options.head },
    extendEnv: true,
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
 * **Details**
 *
 * The query and every dry run receive the requested source range. Explicit
 * child environment values override inherited Turbo SCM refs while preserving
 * the surrounding tool environment. No task command executes.
 *
 * **Gotchas**
 *
 * Use immutable commit SHAs when branch refs may move during the comparison.
 *
 * **Example** (Plan a named source range)
 *
 * ```ts
 * import { runTurboConfigProof, TurboConfigProofOptions } from "@beep/repo-cli/commands/Quality";
 *
 * const proof = runTurboConfigProof(".", TurboConfigProofOptions.make({
 *   base: "origin/main",
 *   head: "HEAD",
 *   selector: "affected",
 *   tasks: ["lint", "check"],
 * }));
 * void proof;
 * ```
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
): Effect.fn.Return<
  TurboConfigProofReport,
  TurboConfigProofError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const tasks = normalizeProofTasks(options.tasks);
  const queryArgs = ["turbo", "query", "affected", "--tasks", ...tasks, "--base", options.base, "--head", options.head];
  const queryOutput = yield* runCommandOutput(repoRoot, "bunx", queryArgs, options);
  const query = yield* summarizeTurboQueryAffectedOutput(queryOutput.output);
  const dryRunSelectorArgs = selectorArgs(options.selector, options.base, options.head);
  const dryRuns = yield* Effect.forEach(
    tasks,
    Effect.fn(function* (task) {
      const args = ["turbo", "run", task, ...dryRunSelectorArgs, "--dry-run=json", "--ui=stream"];
      const output = yield* runCommandOutput(repoRoot, "bunx", args, options);
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
