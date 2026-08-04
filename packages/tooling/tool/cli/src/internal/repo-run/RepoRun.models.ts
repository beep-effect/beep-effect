/**
 * Shared repository run planning models for repo-cli orchestration commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Order } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/repo-run/RepoRun.models");

/**
 * Plan phase used by repository run orchestration.
 *
 * @example
 * ```ts
 * import { RepoPlanPhase } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(RepoPlanPhase.is.feedback("feedback"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const RepoPlanPhase = LiteralKit([
  "prepare",
  "feedback",
  "commit",
  "early-publish",
  "full",
  "publish",
  "monitor",
]).pipe(
  $I.annoteSchema("RepoPlanPhase", {
    description: "Named phase in a repository run plan.",
  })
);

/**
 * Plan phase used by repository run orchestration.
 *
 * @category models
 * @since 0.0.0
 */
export type RepoPlanPhase = typeof RepoPlanPhase.Type;

/**
 * Step mutability classification.
 *
 * @example
 * ```ts
 * import { RepoPlanStepMutability } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(RepoPlanStepMutability.is.readonly("readonly"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const RepoPlanStepMutability = LiteralKit(["readonly", "write", "publish"]).pipe(
  $I.annoteSchema("RepoPlanStepMutability", {
    description: "Whether a planned step can mutate repo state or publish changes.",
  })
);

/**
 * Step mutability classification.
 *
 * @category models
 * @since 0.0.0
 */
export type RepoPlanStepMutability = typeof RepoPlanStepMutability.Type;

/**
 * Step scope classification.
 *
 * @example
 * ```ts
 * import { RepoPlanStepScope } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(RepoPlanStepScope.is.package("package"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const RepoPlanStepScope = LiteralKit(["package", "repo", "git"]).pipe(
  $I.annoteSchema("RepoPlanStepScope", {
    description: "Scope for a planned repository run step.",
  })
);

/**
 * Step scope classification.
 *
 * @category models
 * @since 0.0.0
 */
export type RepoPlanStepScope = typeof RepoPlanStepScope.Type;

/**
 * Conservative resume eligibility for a planned step.
 *
 * @example
 * ```ts
 * import { RepoPlanStepResume } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(RepoPlanStepResume.is.never("never"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const RepoPlanStepResume = LiteralKit(["never", "fingerprint-match"]).pipe(
  $I.annoteSchema("RepoPlanStepResume", {
    description: "Whether a step may be skipped from matching fingerprints.",
  })
);

/**
 * Conservative resume eligibility for a planned step.
 *
 * @category models
 * @since 0.0.0
 */
export type RepoPlanStepResume = typeof RepoPlanStepResume.Type;

/**
 * Graph-health signal recorded while hydrating a run context.
 *
 * @example
 * ```ts
 * import { RepoGraphHealthStatus } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(RepoGraphHealthStatus.is.warning("warning"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const RepoGraphHealthStatus = LiteralKit(["ok", "warning", "error"]).pipe(
  $I.annoteSchema("RepoGraphHealthStatus", {
    description: "Trust level for graph metadata collected for a repo run.",
  })
);

/**
 * Graph-health signal recorded while hydrating a run context.
 *
 * @category models
 * @since 0.0.0
 */
export type RepoGraphHealthStatus = typeof RepoGraphHealthStatus.Type;

/**
 * Turbo task metadata captured from dry-runs or summaries.
 *
 * @example
 * ```ts
 * import { TurboPlanTask } from "@beep/repo-cli/internal/repo-run"
 *
 * const task = TurboPlanTask.make({ taskId: "@beep/schema#lint" })
 * console.log(task.taskId)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TurboPlanTask extends S.Class<TurboPlanTask>($I`TurboPlanTask`)(
  {
    taskId: S.String,
    packageName: S.optionalKey(S.String),
    packagePath: S.optionalKey(S.String),
    task: S.optionalKey(S.String),
    hash: S.optionalKey(S.String),
    command: S.optionalKey(S.String),
    cacheStatus: S.optionalKey(S.String),
    logFile: S.optionalKey(S.String),
  },
  $I.annote("TurboPlanTask", {
    description: "One task entry discovered from Turbo planning or run telemetry.",
  })
) {}

/**
 * Workspace package metadata captured from Turbo graph queries.
 *
 * @example
 * ```ts
 * import { TurboWorkspacePackage } from "@beep/repo-cli/internal/repo-run"
 *
 * const pkg = TurboWorkspacePackage.make({ name: "@beep/repo-cli", path: "packages/tooling/tool/cli" })
 * console.log(pkg.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TurboWorkspacePackage extends S.Class<TurboWorkspacePackage>($I`TurboWorkspacePackage`)(
  {
    name: S.String,
    path: S.String,
  },
  $I.annote("TurboWorkspacePackage", {
    description: "One workspace package known to Turbo.",
  })
) {}

/**
 * Turbo snapshot stored in the shared run context.
 *
 * @example
 * ```ts
 * import { TurboPlanSnapshot } from "@beep/repo-cli/internal/repo-run"
 *
 * const snapshot = TurboPlanSnapshot.make({ tasks: [], graphHealthStatus: "ok", graphHealthWarnings: [] })
 * console.log(snapshot.graphHealthStatus)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TurboPlanSnapshot extends S.Class<TurboPlanSnapshot>($I`TurboPlanSnapshot`)(
  {
    graphHealthStatus: RepoGraphHealthStatus,
    graphHealthWarnings: S.Array(S.String),
    turboVersion: S.optionalKey(S.String),
    tasks: S.Array(TurboPlanTask),
    packages: TurboWorkspacePackage.pipe(S.Array, S.optionalKey),
  },
  $I.annote("TurboPlanSnapshot", {
    description: "Turbo planning and graph-health metadata for a repo run.",
  })
) {}

/**
 * Shared run context hydrated before planning.
 *
 * @example
 * ```ts
 * import { RepoRunContext } from "@beep/repo-cli/internal/repo-run"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * console.log(context.base)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RepoRunContext extends S.Class<RepoRunContext>($I`RepoRunContext`)(
  {
    repoRoot: S.String,
    cwd: S.String,
    base: S.String,
    head: S.String,
    branch: S.String,
    packetDir: S.String,
    originalArgv: S.Array(S.String),
    turbo: TurboPlanSnapshot,
  },
  $I.annote("RepoRunContext", {
    description: "Shared in-process state for one repository orchestration run.",
  })
) {}

/**
 * One named wave rendered inside a repository proof plan.
 *
 * **Example** (Render a preflight wave)
 *
 * ```ts
 * import { RepoPlanWave } from "@beep/repo-cli/internal/repo-run"
 *
 * const wave = RepoPlanWave.make({ id: "preflight", laneIds: ["quality:changeset-status"] })
 * console.log(wave.laneIds.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RepoPlanWave extends S.Class<RepoPlanWave>($I`RepoPlanWave`)(
  {
    id: S.String,
    laneIds: S.Array(S.String),
  },
  $I.annote("RepoPlanWave", {
    description: "One named lane wave rendered inside a repository proof plan.",
  })
) {}

/**
 * One subprocess or git operation planned for a repo run.
 *
 * @example
 * ```ts
 * import { RepoPlanStep } from "@beep/repo-cli/internal/repo-run"
 *
 * const step = RepoPlanStep.make({
 *   args: ["run", "build"],
 *   command: "bun",
 *   cwd: "/repo",
 *   id: "feedback:build",
 *   label: "feedback:build",
 *   mutability: "readonly",
 *   phase: "feedback",
 *   resume: "fingerprint-match",
 *   scope: "package"
 * })
 * console.log(step.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RepoPlanStep extends S.Class<RepoPlanStep>($I`RepoPlanStep`)(
  {
    id: S.String,
    label: S.String,
    phase: RepoPlanPhase,
    command: S.String,
    args: S.Array(S.String),
    cwd: S.String,
    scope: RepoPlanStepScope,
    mutability: RepoPlanStepMutability,
    resume: RepoPlanStepResume,
    env: S.optionalKey(S.Record(S.String, S.Union([S.String, S.Undefined]))),
    packageName: S.optionalKey(S.String),
    packagePath: S.optionalKey(S.String),
    task: S.optionalKey(S.String),
    verification: S.optionalKey(S.String),
    waves: RepoPlanWave.pipe(S.Array, S.optionalKey),
  },
  $I.annote("RepoPlanStep", {
    description: "Planned repository command step.",
  })
) {}

/**
 * Repository run plan.
 *
 * @example
 * ```ts
 * import { RepoRunPlan } from "@beep/repo-cli/internal/repo-run"
 *
 * const plan = RepoRunPlan.make({ context: {} as never, steps: [] })
 * console.log(plan.steps.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RepoRunPlan extends S.Class<RepoRunPlan>($I`RepoRunPlan`)(
  {
    context: RepoRunContext,
    steps: S.Array(RepoPlanStep),
  },
  $I.annote("RepoRunPlan", {
    description: "Ordered repository run plan.",
  })
) {}

/**
 * Captured subprocess result for a planned step.
 *
 * @example
 * ```ts
 * import { RepoStepRunResult } from "@beep/repo-cli/internal/repo-run"
 *
 * const result = RepoStepRunResult.make({ commandText: "bun run build", exitCode: 0, stepId: "feedback:build" })
 * console.log(result.exitCode)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RepoStepRunResult extends S.Class<RepoStepRunResult>($I`RepoStepRunResult`)(
  {
    stepId: S.String,
    commandText: S.String,
    exitCode: S.Finite,
    startedAt: S.optionalKey(S.String),
    endedAt: S.optionalKey(S.String),
    elapsedMs: S.optionalKey(S.Finite),
    output: S.optionalKey(S.String),
    rawOutputRef: S.optionalKey(S.String),
    truncated: S.optionalKey(S.Boolean),
  },
  $I.annote("RepoStepRunResult", {
    description: "Captured output and exit code from a repository run step.",
  })
) {}

const phaseOrderValue = (phase: RepoPlanPhase): number =>
  RepoPlanPhase.$match(phase, {
    prepare: () => 0,
    feedback: () => 1,
    commit: () => 2,
    "early-publish": () => 3,
    full: () => 4,
    publish: () => 5,
    monitor: () => 6,
  });

/**
 * Order repository plan steps by phase, then identifier.
 *
 * @category ordering
 * @since 0.0.0
 */
export const byRepoPlanStepAscending: Order.Order<RepoPlanStep> = Order.combine(
  Order.mapInput(Order.Number, (step: RepoPlanStep) => phaseOrderValue(step.phase)),
  Order.mapInput(Order.String, (step: RepoPlanStep) => step.id)
);

const shellSafeArgPattern = /^[A-Za-z0-9_@%+=:,./-]+$/u;

const quoteCommandArg = (arg: string): string => {
  if (Str.isEmpty(arg)) {
    return "''";
  }
  if (shellSafeArgPattern.test(arg)) {
    return arg;
  }
  return `'${Str.replace(/'/gu, "'\\''")(arg)}'`;
};

/**
 * Render a planned step as a shell-like command string.
 *
 * @param step - Planned repository step.
 * @returns Command text with argv parts quoted when shell-sensitive.
 * @example
 * ```ts
 * import { commandTextForStep, RepoPlanStep } from "@beep/repo-cli/internal/repo-run"
 *
 * const step = RepoPlanStep.make({
 *   args: ["run", "build"],
 *   command: "bun",
 *   cwd: "/repo",
 *   id: "build",
 *   label: "build",
 *   mutability: "readonly",
 *   phase: "feedback",
 *   resume: "never",
 *   scope: "repo"
 * })
 * console.log(commandTextForStep(step))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const commandTextForStep = (step: RepoPlanStep): string =>
  pipe([step.command, ...step.args], A.map(quoteCommandArg), A.join(" "));

/**
 * Determine whether a planned step may use conservative resume metadata.
 *
 * @param step - Planned repository step.
 * @returns Whether the step is read-only, package-scoped feedback.
 * @example
 * ```ts
 * import { isConservativeResumeCandidate, RepoPlanStep } from "@beep/repo-cli/internal/repo-run"
 *
 * const step = RepoPlanStep.make({
 *   args: ["run", "check"],
 *   command: "bun",
 *   cwd: "/repo",
 *   id: "feedback:check",
 *   label: "feedback:check",
 *   mutability: "readonly",
 *   phase: "feedback",
 *   resume: "fingerprint-match",
 *   scope: "package"
 * })
 * console.log(isConservativeResumeCandidate(step))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isConservativeResumeCandidate = (step: RepoPlanStep): boolean =>
  step.phase === "feedback" && step.scope === "package" && step.mutability === "readonly";

/**
 * Ensure a step's resume field follows v1 safety rules.
 *
 * @param step - Planned repository step.
 * @returns Step with unsafe resume requests downgraded to never.
 * @category constructors
 * @since 0.0.0
 */
export const enforceConservativeResume = (step: RepoPlanStep): RepoPlanStep =>
  isConservativeResumeCandidate(step)
    ? step
    : RepoPlanStep.make({
        ...step,
        resume: "never",
      });

/**
 * Lookup Turbo metadata for a planned step, if available.
 *
 * @param context - Repository run context.
 * @param step - Planned step.
 * @returns Matching Turbo task metadata when present.
 * @category utilities
 * @since 0.0.0
 */
export const turboTaskForStep: {
  (context: RepoRunContext, step: RepoPlanStep): O.Option<TurboPlanTask>;
  (step: RepoPlanStep): (context: RepoRunContext) => O.Option<TurboPlanTask>;
} = dual(
  2,
  (context: RepoRunContext, step: RepoPlanStep): O.Option<TurboPlanTask> =>
    O.orElse(
      O.fromUndefinedOr(step.task).pipe(
        O.flatMap((task) =>
          A.findFirst(context.turbo.tasks, (turboTask) => turboTask.task === task || turboTask.taskId === task)
        )
      ),
      () => A.findFirst(context.turbo.tasks, (turboTask) => turboTask.taskId === step.id)
    )
);
