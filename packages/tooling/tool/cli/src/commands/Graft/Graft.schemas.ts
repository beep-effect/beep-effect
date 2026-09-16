/**
 * Plans, receipts, and refresh status for clone-local Graft meaning artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt } from "@beep/schema";
import { DurationUnit } from "@beep/schema/Duration";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SystemdUnitPath } from "../../internal/systemd/index.ts";

const $I = $RepoCliId.create("commands/Graft/Graft.schemas");

/**
 * Meaning-tier artifact families in their copy order.
 *
 * **Details**
 *
 * Concepts include only Markdown files at the Graft root, including INDEX.md.
 * The manifest is graft/manifest.json, the deep-layer index used by Graft queries.
 *
 * **Example** (Inspect copy order)
 *
 * ```ts import.meta.vitest name="Inspect copy order"
 * import { GraftCacheArtifact } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftCacheArtifact.Options) // ["summaries", "concepts", "wiring", "manifest"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraftCacheArtifact = LiteralKit(["summaries", "concepts", "wiring", "manifest"]).pipe(
  $I.annoteSchema("GraftCacheArtifact", { description: "Ordered families of reusable Graft meaning-tier artifacts." })
);

/**
 * A reusable meaning-tier artifact family.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftCacheArtifact = typeof GraftCacheArtifact.Type;

/**
 * The intended operation for one artifact destination.
 *
 * **Details**
 *
 * Refusals retain a reason and never authorize a write. A removal names a
 * root-level concept node the target still has and the source no longer does.
 *
 * **Example** (Recognize a refusal)
 *
 * ```ts import.meta.vitest name="Recognize a refusal"
 * import { GraftCacheSyncAction } from "@beep/repo-cli/commands/Graft"
 * GraftCacheSyncAction.is.refuse("refuse") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraftCacheSyncAction = LiteralKit(["copy", "skip-missing-source", "refuse", "remove"]).pipe(
  $I.annoteSchema("GraftCacheSyncAction", {
    description: "Copy, missing-source skip, safety refusal, or removal of a target-only concept node.",
  })
);

/**
 * An operation recorded in a sync plan.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftCacheSyncAction = typeof GraftCacheSyncAction.Type;

/**
 * A destination clone and its only permitted write directory.
 *
 * **Details**
 *
 * Planning canonicalizes existing clone roots before checking overlap.
 *
 * **Example** (Describe a target clone)
 *
 * ```ts import.meta.vitest name="Describe a target clone"
 * import { GraftCacheSyncTarget } from "@beep/repo-cli/commands/Graft"
 * const target = GraftCacheSyncTarget.make({ root: "/clones/beep-effect2", graftDir: "/clones/beep-effect2/graft" })
 * target.graftDir // => "/clones/beep-effect2/graft"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncTarget extends S.Class<GraftCacheSyncTarget>($I`GraftCacheSyncTarget`)(
  { root: S.String, graftDir: S.String },
  $I.annote("GraftCacheSyncTarget", { description: "Clone root and the Graft directory that bounds all writes." })
) {}

/**
 * One source file's planned operation for one target clone.
 *
 * **Details**
 *
 * Missing INDEX.md receives its own skip even when other concept nodes exist.
 *
 * **Example** (Plan a missing wiring artifact)
 *
 * ```ts import.meta.vitest name="Plan a missing wiring artifact"
 * import { GraftCacheSyncPlanEntry, GraftCacheSyncTarget } from "@beep/repo-cli/commands/Graft"
 * const entry = GraftCacheSyncPlanEntry.make({
 *   target: GraftCacheSyncTarget.make({ root: "/clones/b", graftDir: "/clones/b/graft" }),
 *   artifact: "wiring", action: "skip-missing-source", reason: "Source artifact is missing.",
 *   sourcePath: "/clones/a/graft/.graph/wiring.json", targetPath: "/clones/b/graft/.graph/wiring.json"
 * })
 * entry.action // => "skip-missing-source"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncPlanEntry extends S.Class<GraftCacheSyncPlanEntry>($I`GraftCacheSyncPlanEntry`)(
  {
    target: GraftCacheSyncTarget,
    artifact: GraftCacheArtifact,
    action: GraftCacheSyncAction,
    reason: S.optional(S.String),
    sourcePath: S.String,
    targetPath: S.String,
  },
  $I.annote("GraftCacheSyncPlanEntry", { description: "A copy, skip, or refusal for one artifact file and clone." })
) {}

/**
 * A read-only snapshot of the selected source and destination operations.
 *
 * **Details**
 *
 * Applying a plan revalidates its paths and refuses stale or modified entries.
 *
 * **Example** (Represent an empty sibling discovery)
 *
 * ```ts import.meta.vitest name="Represent an empty sibling discovery"
 * import { GraftCacheSyncPlan } from "@beep/repo-cli/commands/Graft"
 * GraftCacheSyncPlan.make({ source: "/clones/beep-effect", entries: [] }).entries.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncPlan extends S.Class<GraftCacheSyncPlan>($I`GraftCacheSyncPlan`)(
  { source: S.String, entries: S.Array(GraftCacheSyncPlanEntry) },
  $I.annote("GraftCacheSyncPlan", { description: "Source clone and ordered artifact operations for selected targets." })
) {}

/**
 * Counts completed file copies, removals, skips, refusals, and bytes written.
 *
 * **Details**
 *
 * Counts are per file and target; each concept node contributes one entry. A
 * plan with any refusal is applied to nothing, so a report never mixes writes
 * with refused destinations.
 *
 * **Example** (Construct an empty receipt)
 *
 * ```ts import.meta.vitest name="Construct an empty receipt"
 * import { GraftCacheSyncPlan, GraftCacheSyncReport } from "@beep/repo-cli/commands/Graft"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * const zero = NonNegativeInt.make(0)
 * const report = GraftCacheSyncReport.make({
 *   plan: GraftCacheSyncPlan.make({ source: "/clones/a", entries: [] }),
 *   copied: zero, removed: zero, skipped: zero, refused: zero, bytes: zero
 * })
 * report.bytes // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncReport extends S.Class<GraftCacheSyncReport>($I`GraftCacheSyncReport`)(
  {
    plan: GraftCacheSyncPlan,
    copied: NonNegativeInt,
    removed: NonNegativeInt,
    skipped: NonNegativeInt,
    refused: NonNegativeInt,
    bytes: NonNegativeInt,
  },
  $I.annote("GraftCacheSyncReport", {
    description: "Applied sync plan with copy, removal, skip, and refusal counts and exact bytes copied.",
  })
) {}

/**
 * Ordered stages of one nightly meaning-tier refresh.
 *
 * **Details**
 *
 * The status file records the stage a run reached, so an interrupted run is
 * distinguishable from a finished one by its phase rather than by its outcome.
 *
 * **Example** (Inspect the refresh stages)
 *
 * ```ts import.meta.vitest name="Inspect the refresh stages"
 * import { GraftDeepRefreshPhase } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftDeepRefreshPhase.Options)
 * // ["preflight", "pull", "install", "build", "seed", "rebuild", "done"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraftDeepRefreshPhase = LiteralKit([
  "preflight",
  "pull",
  "install",
  "build",
  "seed",
  "rebuild",
  "done",
]).pipe(
  $I.annoteSchema("GraftDeepRefreshPhase", {
    description: "Ordered stages of a nightly Graft meaning-tier refresh run.",
  })
);

/**
 * A stage reached by a nightly meaning-tier refresh.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftDeepRefreshPhase = typeof GraftDeepRefreshPhase.Type;

/**
 * Verdict a finished refresh run reports to its operator.
 *
 * **Details**
 *
 * Only `failed` is worth paging for: it means a step refused or exited
 * non-zero. A `degraded` run still seeded the siblings, so the nightly timer
 * exits zero on it.
 *
 * **Example** (Recognize a degraded verdict)
 *
 * ```ts import.meta.vitest name="Recognize a degraded verdict"
 * import { GraftDeepRefreshOutcome } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftDeepRefreshOutcome.is.degraded("degraded")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraftDeepRefreshOutcome = LiteralKit(["ok", "degraded", "failed"]).pipe(
  $I.annoteSchema("GraftDeepRefreshOutcome", {
    description: "Verdict of a finished refresh: clean, usable but below target, or failed.",
  })
);

/**
 * A verdict reported by a finished refresh run.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftDeepRefreshOutcome = typeof GraftDeepRefreshOutcome.Type;

/**
 * Symbol coverage and summary failures reported by a deep build.
 *
 * **Details**
 *
 * `covered` and `total` count symbols, not files. `failedFiles` counts the
 * files whose summary request never completed, which stays zero when the
 * build never printed that line.
 *
 * **Example** (Describe a 98% build)
 *
 * ```ts import.meta.vitest name="Describe a 98% build"
 * import { GraftDeepCoverage } from "@beep/repo-cli/commands/Graft"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * const coverage = GraftDeepCoverage.make({
 *   covered: NonNegativeInt.make(38_520),
 *   total: NonNegativeInt.make(39_115),
 *   failedFiles: NonNegativeInt.make(1),
 * })
 * console.log(coverage.covered) // 38520
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftDeepCoverage extends S.Class<GraftDeepCoverage>($I`GraftDeepCoverage`)(
  { covered: NonNegativeInt, total: NonNegativeInt, failedFiles: NonNegativeInt },
  $I.annote("GraftDeepCoverage", {
    description: "Symbol coverage and failed-summary counts parsed from a deep build's output.",
  })
) {}

// Graft prints its progress with carriage returns, so a coverage line can share
// a physical line with the progress counter that preceded it. Both patterns are
// global because only the last occurrence in a long log describes the finished
// build.
const DEEP_COVERAGE_LINE = /meaning coverage:\s*(\d+)\s*\/\s*(\d+)\s*symbols/gu;
const DEEP_FAILED_FILES_LINE = /(\d+)\s*file\(s\)\s+failed to summarize/gu;

const DeepCoverageCounts = S.Struct({
  covered: S.FiniteFromString,
  total: S.FiniteFromString,
  failedFiles: S.FiniteFromString,
}).pipe(S.decodeTo(GraftDeepCoverage));

const decodeDeepCoverageCounts = S.decodeUnknownResult(DeepCoverageCounts);

const lastDeepMatch = (pattern: RegExp, text: string): O.Option<RegExpMatchArray> =>
  A.last(A.fromIterable(Str.matchAll(pattern)(text)));

/**
 * Reads the symbol coverage a deep build reported in its captured output.
 *
 * **Details**
 *
 * Carriage returns are normalized to newlines before matching, and the last
 * coverage line wins. A missing `file(s) failed to summarize` line means no
 * file failed, not unknown; a missing coverage line yields `O.none()`.
 *
 * **Example** (Read coverage out of build output)
 *
 * ```ts import.meta.vitest name="Read coverage out of build output"
 * import { parseDeepCoverage } from "@beep/repo-cli/commands/Graft"
 * import * as O from "effect/Option"
 * const parsed = parseDeepCoverage("meaning coverage: 38520/39115 symbols (98%).\n")
 * console.log(O.map(parsed, (coverage) => coverage.total)) // { _id: 'Option', _tag: 'Some', value: 39115 }
 * ```
 *
 * @param text - Captured stdout and stderr of `graft build --deep`.
 * @returns The parsed coverage when the build printed a coverage line.
 * @category parsing
 * @since 0.0.0
 */
export const parseDeepCoverage = (text: string): O.Option<GraftDeepCoverage> => {
  const normalized = Str.replaceAll("\r", "\n")(text);
  return pipe(
    lastDeepMatch(DEEP_COVERAGE_LINE, normalized),
    O.flatMap((coverage) =>
      O.all({
        covered: O.fromUndefinedOr(coverage[1]),
        total: O.fromUndefinedOr(coverage[2]),
        failedFiles: O.some(
          pipe(
            lastDeepMatch(DEEP_FAILED_FILES_LINE, normalized),
            O.flatMap((failed) => O.fromUndefinedOr(failed[1])),
            O.getOrElse(() => "0")
          )
        ),
      })
    ),
    O.flatMap((counts) => Result.getSuccess(decodeDeepCoverageCounts(counts)))
  );
};

/**
 * Everything one refresh run needs, already resolved to absolute paths.
 *
 * **Details**
 *
 * An absent `model` leaves `GRAFT_MODEL` to the environment file the systemd
 * unit loads, so the timer can change models without touching the unit.
 *
 * **Example** (Configure a nightly run)
 *
 * ```ts import.meta.vitest name="Configure a nightly run"
 * import { GraftDeepRefreshOptions } from "@beep/repo-cli/commands/Graft"
 * import { PosInt } from "@beep/schema/Int"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * const options = GraftDeepRefreshOptions.make({
 *   owner: "/clones/beep-effect0",
 *   jobs: PosInt.make(16),
 *   minCoverage: UnitInterval.make(0.95),
 *   seed: true,
 *   rebuild: true,
 *   rebuildConcurrency: PosInt.make(2),
 *   stateDir: "/state/beep-graft",
 * })
 * console.log(options.jobs) // 16
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftDeepRefreshOptions extends S.Class<GraftDeepRefreshOptions>($I`GraftDeepRefreshOptions`)(
  {
    owner: S.String,
    model: S.optional(S.String),
    jobs: PosInt,
    minCoverage: UnitInterval,
    seed: S.Boolean,
    rebuild: S.Boolean,
    rebuildConcurrency: PosInt,
    stateDir: S.String,
  },
  $I.annote("GraftDeepRefreshOptions", {
    description: "Resolved inputs of one nightly meaning-tier refresh run.",
  })
) {}

/**
 * Result of the structural rebuild run in one seeded clone.
 *
 * **Details**
 *
 * A non-zero `exitCode` degrades the run instead of failing it: the seeded
 * meaning tier is already in place and the clone's own rebuild can be retried.
 *
 * **Example** (Record a rebuilt clone)
 *
 * ```ts import.meta.vitest name="Record a rebuilt clone"
 * import { GraftDeepSiblingRebuild } from "@beep/repo-cli/commands/Graft"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * const rebuilt = GraftDeepSiblingRebuild.make({
 *   root: "/clones/beep-effect2",
 *   exitCode: 0,
 *   seconds: NonNegativeInt.make(42),
 * })
 * console.log(rebuilt.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftDeepSiblingRebuild extends S.Class<GraftDeepSiblingRebuild>($I`GraftDeepSiblingRebuild`)(
  { root: S.String, exitCode: S.Int, seconds: NonNegativeInt },
  $I.annote("GraftDeepSiblingRebuild", {
    description: "Exit status and wall time of one seeded clone's structural rebuild.",
  })
) {}

/**
 * The single file a human or a later run reads to learn what the last refresh did.
 *
 * **Details**
 *
 * It is rewritten at every phase transition, so an in-flight run is readable:
 * such a status carries a `phase` and no `finishedAt` or `outcome`. `model`
 * records `"(env default)"` when the run left the model to the environment.
 *
 * **Example** (Describe an in-flight run)
 *
 * ```ts import.meta.vitest name="Describe an in-flight run"
 * import { GraftDeepRefreshStatus } from "@beep/repo-cli/commands/Graft"
 * import { PosInt } from "@beep/schema/Int"
 * const status = GraftDeepRefreshStatus.make({
 *   schemaVersion: "beep-graft-deep-refresh/v1",
 *   owner: "/clones/beep-effect0",
 *   model: "(env default)",
 *   jobs: PosInt.make(16),
 *   startedAt: "2026-09-11T02:30:00.000Z",
 *   phase: "build",
 *   rebuilt: [],
 *   log: "/state/beep-graft/runs/20260911T023000Z.log",
 * })
 * console.log(status.phase) // build
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftDeepRefreshStatus extends S.Class<GraftDeepRefreshStatus>($I`GraftDeepRefreshStatus`)(
  {
    schemaVersion: S.Literal("beep-graft-deep-refresh/v1"),
    owner: S.String,
    head: S.optional(S.String),
    model: S.String,
    jobs: PosInt,
    startedAt: S.String,
    finishedAt: S.optional(S.String),
    phase: GraftDeepRefreshPhase,
    outcome: S.optional(GraftDeepRefreshOutcome),
    coverage: S.optional(GraftDeepCoverage),
    seed: S.optional(GraftCacheSyncReport),
    rebuilt: S.Array(GraftDeepSiblingRebuild),
    log: S.String,
    message: S.optional(S.String),
  },
  $I.annote("GraftDeepRefreshStatus", {
    description: "Phase, coverage, seed receipt, and rebuild results of the most recent refresh run.",
  })
) {}

/**
 * Contents of the refresh lock file that fences concurrent runs.
 *
 * **Details**
 *
 * The pid is what makes a lock releasable after a crash: a lock whose holder
 * is gone is replaced rather than obeyed.
 *
 * **Example** (Describe a held lock)
 *
 * ```ts import.meta.vitest name="Describe a held lock"
 * import { GraftDeepLock } from "@beep/repo-cli/commands/Graft"
 * const lock = GraftDeepLock.make({ pid: 4321, startedAt: "2026-09-11T02:30:00.000Z" })
 * console.log(lock.pid) // 4321
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftDeepLock extends S.Class<GraftDeepLock>($I`GraftDeepLock`)(
  { pid: S.Int, startedAt: S.String },
  $I.annote("GraftDeepLock", { description: "Process id and start time of the run holding the refresh lock." })
) {}

/**
 * What the installed refresh units recorded that `graft deep install-timer --refresh` reuses.
 *
 * **Details**
 *
 * The owner is the service's `WorkingDirectory`, the environment file its
 * `EnvironmentFile`, and the calendar the timer's `OnCalendar`; each is absent
 * when the installed unit does not carry the directive.
 *
 * **Example** (Make a recorded timer)
 *
 * ```ts import.meta.vitest name="Make a recorded timer"
 * import { GraftDeepRecordedTimer } from "@beep/repo-cli/commands/Graft"
 * import * as O from "effect/Option"
 * const recorded = GraftDeepRecordedTimer.make({
 *   owner: O.some("/clones/beep-effect0"),
 *   envFile: O.none(),
 *   onCalendar: O.some("*-*-* 02:30:00"),
 * })
 * console.log(O.getOrNull(recorded.onCalendar)) // *-*-* 02:30:00
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraftDeepRecordedTimer extends S.Class<GraftDeepRecordedTimer>($I`GraftDeepRecordedTimer`)(
  {
    owner: S.Option(S.String),
    envFile: S.Option(S.String),
    onCalendar: S.Option(S.String),
  },
  $I.annote("GraftDeepRecordedTimer", {
    description:
      "Owner clone, environment file, and calendar an installed refresh unit runs with, read back for a refresh.",
  })
) {}

/**
 * Inputs for installing the nightly refresh systemd user timer.
 *
 * **Details**
 *
 * Removing the timer takes none of these: an uninstall reads only `HOME`, so
 * no path here can keep a unit from being disabled and deleted.
 * `envFile` is only ever stat-ed by the installer; its contents reach the
 * refresh through systemd's `EnvironmentFile`, never through this process.
 * `bunPath` is the operator's `--bun-path` made absolute or, when none is
 * given, the first shared Bun candidate (the mise shim, then `~/.bun/bin/bun`)
 * this user can execute under the home directory, falling back to the
 * installer's own executable. Every path is a systemd unit path, so the
 * renderer's quoting is enough.
 *
 * **Example** (Describe a nightly schedule)
 *
 * ```ts import.meta.vitest name="Describe a nightly schedule"
 * import { GraftDeepTimerOptions } from "@beep/repo-cli/commands/Graft"
 * const options = GraftDeepTimerOptions.make({
 *   owner: "/clones/beep-effect0",
 *   bunPath: "/usr/bin/bun",
 *   onCalendar: "*-*-* 02:30:00",
 *   envFile: "/home/op/.config/beep-graft/env",
 * })
 * console.log(options.onCalendar) // *-*-* 02:30:00
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftDeepTimerOptions extends S.Class<GraftDeepTimerOptions>($I`GraftDeepTimerOptions`)(
  {
    owner: SystemdUnitPath,
    bunPath: SystemdUnitPath,
    onCalendar: S.String,
    envFile: SystemdUnitPath,
  },
  $I.annote("GraftDeepTimerOptions", {
    description: "Owner clone, Bun executable, calendar expression, and environment file of the refresh timer.",
  })
) {}

/**
 * How a refresh step's output is captured.
 *
 * **Details**
 *
 * A step read for its value takes `stdout` alone: Git writes advisory warnings
 * to stderr, and merging them would make `status --porcelain` look dirty or
 * corrupt a parsed revision. A step whose output only reaches the run log takes
 * `merge`, where a failure explains itself.
 *
 * **Example** (Recognize the parsed-output source)
 *
 * ```ts import.meta.vitest name="Recognize the parsed-output source"
 * import { GraftDeepCaptureSource } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftDeepCaptureSource.is.stdout("stdout")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraftDeepCaptureSource = LiteralKit(["all", "merge", "stdout"]).pipe(
  $I.annoteSchema("GraftDeepCaptureSource", {
    description: "Which subprocess streams a refresh step captures.",
  })
);

/**
 * A capture strategy for one refresh step.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftDeepCaptureSource = typeof GraftDeepCaptureSource.Type;

// A duration the child-process runner accepts verbatim; constraining the field
// to this shape is what keeps an unparseable bound out of a spawned step.
const DurationExpression = S.TemplateLiteral([S.Finite, " ", DurationUnit]);

/**
 * One subprocess a refresh run needs, named by the phase that owns it.
 *
 * **Details**
 *
 * `timeout` is a Duration expression such as `"15 minutes"`. `log` is the run
 * log a spawn failure is attributed to, and is absent for steps that run before
 * a run log exists.
 *
 * **Example** (Describe a bounded probe)
 *
 * ```ts import.meta.vitest name="Describe a bounded probe"
 * import { GraftDeepRunnerStep } from "@beep/repo-cli/commands/Graft"
 * const step = GraftDeepRunnerStep.make({
 *   command: "git",
 *   args: ["status", "--porcelain"],
 *   cwd: "/clones/beep-effect0",
 *   phase: "preflight",
 *   source: "stdout",
 *   timeout: "2 minutes",
 * })
 * console.log(step.source) // stdout
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftDeepRunnerStep extends S.Class<GraftDeepRunnerStep>($I`GraftDeepRunnerStep`)(
  {
    command: S.String,
    args: S.Array(S.String),
    cwd: S.String,
    env: S.optional(S.Record(S.String, S.String)),
    log: S.optional(S.String),
    phase: GraftDeepRefreshPhase,
    source: S.optional(GraftDeepCaptureSource),
    timeout: S.optional(DurationExpression),
  },
  $I.annote("GraftDeepRunnerStep", {
    description: "Command, working directory, environment, and bound of one refresh subprocess.",
  })
) {}
