/**
 * Schema-first machine-readable run verdict for yeet.
 *
 * Every non-plan yeet run writes one verdict document so agents can read the
 * outcome, per-lane status, and repair commands without scanning logs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { O } from "@beep/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { commandTextForStep, RepoPlanStep, RepoStepRunResult } from "../../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { FlakeQuarantineIncident } from "../../Quality/internal/FlakeQuarantine.ts";
import {
  GITHUB_CHECK_RUN_REPORT_PREFIX,
  GithubCheckFailurePolicy,
  GithubCheckRunReport,
} from "../../Quality/Quality.schemas.ts";
import { knownSubLaneRemediationFromOutput } from "./QualityIssueIndex.ts";
import type { GithubCheckLaneRun } from "../../Quality/Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Verdict");

/**
 * Execution status of one planned yeet lane.
 *
 * @example
 * ```ts
 * import { YeetLaneStatus } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetLaneStatus.Options)
 * ```
 * @category models
 * @since 0.0.0
 */
export const YeetLaneStatus = LiteralKit(["passed", "failed", "skipped", "not-run", "not-run-early-stop"]).pipe(
  $I.annoteSchema("YeetLaneStatus", {
    title: "Yeet Lane Status",
    description: "Execution status of one planned yeet lane.",
  })
);

/**
 * Execution status of one planned yeet lane.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetLaneStatus = typeof YeetLaneStatus.Type;

/**
 * Recorded stash identity for staged-only publish residue.
 *
 * @example
 * ```ts
 * import { YeetStashState } from "@beep/repo-cli/test/Yeet"
 *
 * const stash = YeetStashState.make({
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   marker: "yeet-staged-only/branch/2026-06-11T00:00:00.000Z",
 *   stashSha: "0123456789abcdef",
 * })
 * console.log(stash.marker)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetStashState extends S.Class<YeetStashState>($I`YeetStashState`)(
  {
    createdAt: S.String,
    marker: S.String,
    stashSha: S.String,
  },
  $I.annote("YeetStashState", {
    description: "Recorded stash identity for staged-only publish residue parking and restore.",
  })
) {}

/**
 * Divergence assessment between the publish branch and its refreshed base.
 *
 * @example
 * ```ts
 * import { YeetBaseFreshness } from "@beep/repo-cli/test/Yeet"
 *
 * const freshness = YeetBaseFreshness.make({
 *   behindCount: 0,
 *   mergeBase: "0123456789abcdef",
 *   overlappingPaths: [],
 * })
 * console.log(freshness.behindCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetBaseFreshness extends S.Class<YeetBaseFreshness>($I`YeetBaseFreshness`)(
  {
    behindCount: S.Finite,
    mergeBase: S.String,
    overlappingPaths: S.Array(S.String),
  },
  $I.annote("YeetBaseFreshness", {
    description: "Divergence assessment between the publish branch and its refreshed base ref.",
  })
) {}

/**
 * One planned lane with its execution status and repair command.
 *
 * @example
 * ```ts
 * import { YeetVerdictLane } from "@beep/repo-cli/test/Yeet"
 *
 * const lane = YeetVerdictLane.make({
 *   id: "full:pre-push",
 *   label: "full:pre-push",
 *   phase: "full",
 *   status: "failed",
 * })
 * console.log(lane.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetVerdictLane extends S.Class<YeetVerdictLane>($I`YeetVerdictLane`)(
  {
    id: S.String,
    label: S.String,
    phase: S.String,
    status: YeetLaneStatus,
    durationMs: S.optionalKey(S.Finite),
    exitCode: S.optionalKey(S.Finite),
    repairCommand: S.optionalKey(S.String),
  },
  $I.annote("YeetVerdictLane", {
    description: "One planned yeet lane with its execution status and repair command.",
  })
) {}

/**
 * Terminal outcome for one yeet run.
 *
 * @category models
 * @since 0.0.0
 */
export const YeetOutcome = LiteralKit(["success", "failure"]).pipe(
  $I.annoteSchema("YeetOutcome", {
    description: "Terminal outcome for one yeet run.",
  })
);

/** Failure classification retained when a Yeet attempt terminates unsuccessfully. */
export const YeetFailureKind = LiteralKit(["step-exit", "handler-error"]).pipe(
  $I.annoteSchema("YeetFailureKind", {
    description: "Whether a Yeet attempt failed through a returned step result or the handler error channel.",
  })
);

/**
 * Machine-readable verdict for one yeet run.
 *
 * @example
 * ```ts
 * import { YeetVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = YeetVerdict.make({
 *   schemaVersion: "yeet-verdict/v2",
 *   attemptId: "550e8400-e29b-41d4-a716-446655440000",
 *   base: "origin/main",
 *   branch: "feature",
 *   committed: false,
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   startedAt: "2026-06-11T00:00:00.000Z",
 *   endedAt: "2026-06-11T00:00:01.000Z",
 *   elapsedMs: 1000,
 *   head: "HEAD",
 *   lanes: [],
 *   message: "yeet verification proof passed.",
 *   mode: "verify",
 *   outcome: "success",
 *   packetPaths: [],
 *   pushed: false,
 *   runId: "feature",
 * })
 * console.log(verdict.outcome)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetVerdict extends S.Class<YeetVerdict>($I`YeetVerdict`)(
  {
    schemaVersion: S.Literal("yeet-verdict/v2"),
    attemptId: UUID,
    base: S.String,
    branch: S.String,
    committed: S.Boolean,
    createdAt: S.String,
    startedAt: S.String,
    endedAt: S.String,
    elapsedMs: S.Finite,
    failurePolicy: GithubCheckFailurePolicy.pipe(
      S.withConstructorDefault(Effect.succeed(GithubCheckFailurePolicy.Enum["fail-fast"])),
      S.withDecodingDefault(Effect.succeed(GithubCheckFailurePolicy.Enum["fail-fast"]))
    ),
    head: S.String,
    lanes: S.Array(YeetVerdictLane),
    message: S.String,
    mode: S.String,
    outcome: YeetOutcome,
    packetPaths: S.Array(S.String),
    pushed: S.Boolean,
    runId: S.String,
    indexPath: S.optionalKey(S.String),
    baseFreshness: S.optionalKey(YeetBaseFreshness),
    stash: S.optionalKey(YeetStashState),
    flakeQuarantine: FlakeQuarantineIncident.pipe(S.Array, S.optionalKey),
    failedStepId: S.optionalKey(S.String),
    failureKind: YeetFailureKind.pipe(S.optionalKey),
  },
  $I.annote("YeetVerdict", {
    description: "Machine-readable verdict for one yeet run, including per-lane repair commands.",
  })
) {}

/**
 * One executed plan step paired with its run result.
 *
 * @example
 * ```ts
 * import { YeetExecutedStep } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetExecutedStep.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetExecutedStep extends S.Class<YeetExecutedStep>($I`YeetExecutedStep`)(
  {
    durationMs: S.optionalKey(S.Finite),
    result: RepoStepRunResult,
    step: RepoPlanStep,
  },
  $I.annote("YeetExecutedStep", {
    description: "One executed yeet plan step paired with its run result.",
  })
) {}

const laneFromExecuted = (executed: YeetExecutedStep): YeetVerdictLane => {
  const failed = executed.result.exitCode !== 0;
  const repairCommand = failed
    ? O.some(
        pipe(
          knownSubLaneRemediationFromOutput(executed.result.output),
          O.getOrElse(() => commandTextForStep(executed.step))
        )
      )
    : O.none<string>();
  return YeetVerdictLane.make({
    id: executed.step.id,
    label: executed.step.label,
    phase: executed.step.phase,
    status: failed ? "failed" : "passed",
    exitCode: executed.result.exitCode,
    ...O.getSomesStruct({
      durationMs: pipe(
        O.fromUndefinedOr(executed.result.elapsedMs),
        O.orElse(() => O.fromUndefinedOr(executed.durationMs))
      ),
      repairCommand,
    }),
  });
};

const laneFromPlanned = (step: RepoPlanStep): YeetVerdictLane =>
  YeetVerdictLane.make({
    id: step.id,
    label: step.label,
    phase: step.phase,
    status: "not-run",
  });

const githubCheckRunReportJson = JsonStringCodec(GithubCheckRunReport);

const githubCheckRunReportFromOutput = (output: string): O.Option<GithubCheckRunReport> =>
  pipe(
    Str.split("\n")(output),
    A.findLast(Str.startsWith(GITHUB_CHECK_RUN_REPORT_PREFIX)),
    O.flatMap((line) => githubCheckRunReportJson.decodeOption(Str.slice(GITHUB_CHECK_RUN_REPORT_PREFIX.length)(line)))
  );

const laneFromGithubCheckRun = (lane: GithubCheckLaneRun): YeetVerdictLane =>
  YeetVerdictLane.make({
    id: lane.id,
    label: lane.id,
    phase: "full",
    status: lane.status,
  });

/**
 * Run identity, outcome, planned steps, and executed results used to build the run verdict.
 *
 * @category models
 * @since 0.0.0
 */
export class BuildYeetVerdictInput extends S.Class<BuildYeetVerdictInput>($I`BuildYeetVerdictInput`)(
  {
    base: S.String,
    attemptId: UUID,
    baseFreshness: S.optional(YeetBaseFreshness),
    branch: S.String,
    createdAt: S.String,
    startedAt: S.String,
    endedAt: S.String,
    elapsedMs: S.Finite,
    executed: S.Array(YeetExecutedStep),
    failurePolicy: GithubCheckFailurePolicy.pipe(
      S.withConstructorDefault(Effect.succeed(GithubCheckFailurePolicy.Enum["fail-fast"]))
    ),
    flakeQuarantine: FlakeQuarantineIncident.pipe(S.Array, S.optional),
    head: S.String,
    indexPath: S.optional(S.String),
    message: S.String,
    mode: S.String,
    outcome: YeetOutcome,
    packetPaths: S.Array(S.String),
    planned: S.Array(RepoPlanStep),
    runId: S.String,
    stash: S.optional(YeetStashState),
    failedStepId: S.optional(S.String),
    failureKind: S.optional(YeetFailureKind),
  },
  $I.annote("BuildYeetVerdictInput", {
    description: "Run identity, outcome, planned steps, and executed results used to build the run verdict.",
  })
) {}

/**
 * Build the run verdict from planned steps and executed results.
 *
 * @param input - Run identity, outcome, planned steps, and executed results.
 * @returns Schema-valid verdict document for the run.
 * @example
 * ```ts
 * import { buildYeetVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = buildYeetVerdict({
 *   attemptId: "550e8400-e29b-41d4-a716-446655440000",
 *   base: "origin/main",
 *   branch: "feature",
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   startedAt: "2026-06-11T00:00:00.000Z",
 *   endedAt: "2026-06-11T00:00:01.000Z",
 *   elapsedMs: 1000,
 *   executed: [],
 *   head: "HEAD",
 *   message: "yeet verification proof passed.",
 *   mode: "verify",
 *   outcome: "success",
 *   packetPaths: [],
 *   planned: [],
 *   runId: "feature",
 * })
 * console.log(verdict.lanes.length)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const buildYeetVerdict = (input: BuildYeetVerdictInput): YeetVerdict => {
  const executedIds = pipe(
    input.executed,
    A.map((entry) => entry.step.id)
  );
  const lanes = pipe(
    input.executed,
    A.map(laneFromExecuted),
    A.appendAll(
      pipe(
        input.executed,
        A.map((entry) => pipe(O.fromUndefinedOr(entry.result.output), O.flatMap(githubCheckRunReportFromOutput))),
        A.getSomes,
        A.flatMap((report) => A.map(report.lanes, laneFromGithubCheckRun))
      )
    ),
    A.appendAll(
      pipe(
        input.planned,
        A.filter((step) => !A.contains(executedIds, step.id)),
        A.map(laneFromPlanned)
      )
    )
  );
  return YeetVerdict.make({
    schemaVersion: "yeet-verdict/v2",
    attemptId: input.attemptId,
    base: input.base,
    branch: input.branch,
    committed: pipe(
      input.executed,
      A.some((entry) => entry.step.phase === "commit" && entry.result.exitCode === 0)
    ),
    createdAt: input.createdAt,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    elapsedMs: input.elapsedMs,
    failurePolicy: input.failurePolicy,
    head: input.head,
    lanes,
    message: input.message,
    mode: input.mode,
    outcome: input.outcome,
    packetPaths: input.packetPaths,
    pushed: pipe(
      input.executed,
      A.some(
        (entry) =>
          (entry.step.phase === "publish" || entry.step.phase === "early-publish") && entry.result.exitCode === 0
      )
    ),
    runId: input.runId,
    ...O.getSomesStruct({
      indexPath: O.fromUndefinedOr(input.indexPath),
      baseFreshness: O.fromUndefinedOr(input.baseFreshness),
      stash: O.fromUndefinedOr(input.stash),
      flakeQuarantine: pipe(O.fromUndefinedOr(input.flakeQuarantine), O.filter(A.isReadonlyArrayNonEmpty)),
      failedStepId: O.fromUndefinedOr(input.failedStepId),
      failureKind: O.fromUndefinedOr(input.failureKind),
    }),
  });
};

/**
 * Build the run verdict from planned steps and executed results.
 *
 * @category testing
 * @since 0.0.0
 */
export const buildYeetVerdictForTesting = buildYeetVerdict;
