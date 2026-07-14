/**
 * Yeet v1 repository run planner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, Order } from "effect";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  byRepoPlanStepAscending,
  enforceConservativeResume,
  RepoPlanPhase,
  RepoPlanStep,
  RepoRunPlan,
  repoProofStepDefinition,
  TurboPlanSnapshot,
} from "../../../internal/repo-run/index.js";
import { HEAD_INSTALL_PREFLIGHT_STEP_ID } from "./HeadInstallPreflight.js";
import type { RepoRunContext, TurboPlanTask } from "../../../internal/repo-run/index.js";

const $I = $RepoCliId.create("commands/Yeet/internal/Planner");

/**
 * Default ignored directory for yeet run artifacts.
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_YEET_PACKET_DIR = ".beep/yeet" as const;

/**
 * Turbo tasks used by the Yeet feedback phase.
 *
 * @category configuration
 * @since 0.0.0
 */
export const YEET_FEEDBACK_TASKS = ["build", "check", "lint", "test"] as const;

type YeetFeedbackTask = (typeof YEET_FEEDBACK_TASKS)[number];

/**
 * Yeet execution modes.
 *
 * @example
 * ```ts
 * import { YeetRunMode } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetRunMode.is.verify("verify"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const YeetRunMode = LiteralKit([
  "repair",
  "verify",
  "publish",
  "monitor",
  "closeout",
  "status",
  "pre-push-hook",
]).pipe(
  $I.annoteSchema("YeetRunMode", {
    description: "Execution mode selected for a yeet repository run.",
  })
);

/**
 * Yeet execution modes.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetRunMode = typeof YeetRunMode.Type;

/**
 * Yeet local proof tier.
 *
 * @example
 * ```ts
 * import { YeetProofTier } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetProofTier.is["review-fix"]("review-fix"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const YeetProofTier = LiteralKit(["full", "review-fix"]).pipe(
  $I.annoteSchema("YeetProofTier", {
    description: "Local proof tier selected for yeet verify loops.",
  })
);

/**
 * Yeet local proof tier.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetProofTier = typeof YeetProofTier.Type;

/**
 * Options for building a Yeet run plan in a specific mode.
 *
 * @example
 * ```ts
 * import { YeetRunPlanModeOptions } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(
 *   YeetRunPlanModeOptions.make({
 *     amend: false,
 *     fast: false,
 *     mode: "verify",
 *     monitor: false,
 *     noEdit: false,
 *     pushOnly: false,
 *     startPrEarly: false,
 *     tier: "full"
 *   }).mode
 * )
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetRunPlanModeOptions extends S.Class<YeetRunPlanModeOptions>($I`YeetRunPlanModeOptions`)(
  {
    amend: S.Boolean,
    fast: S.Boolean,
    mode: YeetRunMode,
    monitor: S.Boolean,
    noEdit: S.Boolean,
    pushOnly: S.Boolean,
    remote: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    startPrEarly: S.Boolean,
    tier: YeetProofTier,
    pr: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefault(Effect.succeed(false))),
    forceTurbo: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
  },
  $I.annote("YeetRunPlanModeOptions", {
    description: "Options for building a Yeet run plan in a specific mode.",
  })
) {}

const YEET_TURBO_CONCURRENCY = "3" as const;

const sharedFeedbackTurboArgs = [
  `--concurrency=${YEET_TURBO_CONCURRENCY}`,
  "--continue=dependencies-successful",
  "--summarize",
  "--ui=stream",
] as const;

const bunRunStep = (
  context: RepoRunContext,
  id: string,
  label: string,
  phase: RepoPlanStep["phase"],
  script: string,
  args: ReadonlyArray<string>,
  mutability: RepoPlanStep["mutability"],
  scope: RepoPlanStep["scope"],
  task: O.Option<string> = O.none(),
  env: O.Option<Record<string, string | undefined>> = O.none()
): RepoPlanStep =>
  enforceConservativeResume(
    RepoPlanStep.make({
      id,
      label,
      phase,
      command: "bun",
      args: ["run", script, ...args],
      cwd: context.repoRoot,
      scope,
      mutability,
      resume: "never",
      ...(O.isSome(task) ? { task: task.value } : {}),
      ...(O.isSome(env) ? { env: env.value } : {}),
    })
  );

const gitStep = (
  context: RepoRunContext,
  id: string,
  label: string,
  phase: RepoPlanStep["phase"],
  args: ReadonlyArray<string>,
  env: O.Option<Record<string, string | undefined>> = O.none()
): RepoPlanStep =>
  RepoPlanStep.make({
    id,
    label,
    phase,
    command: "git",
    args: [...args],
    cwd: context.repoRoot,
    scope: "git",
    mutability: "publish",
    resume: "never",
    ...(O.isSome(env) ? { env: env.value } : {}),
  });

/**
 * Create an empty Turbo metadata snapshot.
 *
 * @param warnings - Optional graph-health warnings.
 * @returns Empty Turbo snapshot with graph health status.
 * @example
 * ```ts
 * import { emptyTurboPlanSnapshot } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(emptyTurboPlanSnapshot([]).graphHealthStatus)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const emptyTurboPlanSnapshot = (warnings: ReadonlyArray<string>): TurboPlanSnapshot =>
  TurboPlanSnapshot.make({
    graphHealthStatus: A.isReadonlyArrayEmpty(warnings) ? "ok" : "warning",
    graphHealthWarnings: [...warnings],
    tasks: [],
  });

// Deterministic auto-fixers run sequentially (runPhase concurrency:1) so parallel
// inventory writes cannot corrupt each other. Code rewriters (effect-imports) run
// first, then artifact generators (dual-arity inventory, tsconfig), then biome
// formats everything, then docgen regenerates docs last.
// terse-effect/schema-first are intentionally excluded: they can leave manual
// candidates and are enforced advisory in verify, not auto-fixed here.
const repairSteps = (context: RepoRunContext): ReadonlyArray<RepoPlanStep> => [
  bunRunStep(
    context,
    "prepare:01-effect-imports",
    "prepare:laws:effect-imports",
    "prepare",
    "beep",
    ["laws", "effect-imports", "--write"],
    "write",
    "repo"
  ),
  bunRunStep(
    context,
    "prepare:02-dual-arity",
    "prepare:laws:dual-arity",
    "prepare",
    "beep",
    ["laws", "dual-arity", "--write"],
    "write",
    "repo"
  ),
  bunRunStep(context, "prepare:03-config-sync", "prepare:config-sync", "prepare", "config-sync", [], "write", "repo"),
  bunRunStep(context, "prepare:04-lint-fix", "prepare:lint:fix", "prepare", "lint:fix", [], "write", "repo"),
  bunRunStep(context, "prepare:05-docgen", "prepare:docgen", "prepare", "docgen", [], "write", "repo"),
];

const packageNameForFeedbackTask =
  (feedbackTask: string) =>
  (task: TurboPlanTask): O.Option<string> =>
    pipe(
      O.fromUndefinedOr(task.packageName),
      O.filter((packageName) => task.task === feedbackTask && packageName !== "//")
    );

const feedbackFilterArgs = (context: RepoRunContext, feedbackTask: YeetFeedbackTask): ReadonlyArray<string> =>
  pipe(
    context.turbo.tasks,
    A.map(packageNameForFeedbackTask(feedbackTask)),
    A.getSomes,
    A.dedupe,
    A.sort(Order.String),
    A.map((packageName) => `--filter=${packageName}`)
  );

const feedbackRunArgs = (feedbackTask: YeetFeedbackTask, filters: ReadonlyArray<string>): ReadonlyArray<string> =>
  // Repair feedback stays on unit/type lanes; verify/publish use only the full pre-push proof.
  feedbackTask === "test"
    ? ["--unit", "--types", ...filters, ...sharedFeedbackTurboArgs]
    : [...filters, ...sharedFeedbackTurboArgs];

const feedbackStep = (
  context: RepoRunContext,
  id: string,
  label: string,
  script: string,
  task: YeetFeedbackTask
): O.Option<RepoPlanStep> => {
  const filters = feedbackFilterArgs(context, task);
  if (A.isReadonlyArrayEmpty(filters)) {
    return O.none();
  }

  return O.some(
    bunRunStep(
      context,
      id,
      label,
      "feedback",
      script,
      ["--", ...feedbackRunArgs(task, filters)],
      "readonly",
      "repo",
      O.some(task)
    )
  );
};

const feedbackSteps = (context: RepoRunContext): ReadonlyArray<RepoPlanStep> =>
  A.getSomes([
    feedbackStep(context, "feedback:01-build", "feedback:build", "build", "build"),
    feedbackStep(context, "feedback:02-check", "feedback:check", "check", "check"),
    feedbackStep(context, "feedback:03-lint", "feedback:lint", "lint", "lint"),
    feedbackStep(context, "feedback:04-test", "feedback:test", "test", "test"),
  ]);

const fallowAdvisoryFeedbackStep = (context: RepoRunContext): RepoPlanStep =>
  bunRunStep(
    context,
    "advisory:01-fallow-feedback",
    "fallow-advisory-feedback",
    "feedback",
    "beep",
    [
      "yeet",
      "fallow-feedback",
      "--from",
      ".beep/fallow",
      "--emit",
      ".beep/yeet/fallow-quality-issues.json",
      "--advisory",
    ],
    "write",
    "repo"
  );

const proofStep = (context: RepoRunContext, tier: YeetProofTier): RepoPlanStep => {
  const proof = repoProofStepDefinition(tier === "review-fix" ? "review-fix" : "pre-push");
  const proofArgs =
    tier === "review-fix" ? [...proof.args, "--base", context.base, "--head", context.head] : proof.args;
  return bunRunStep(context, proof.id, proof.label, "full", "beep", proofArgs, "readonly", "repo");
};

const commitStep = (
  context: RepoRunContext,
  message: O.Option<string>,
  options: YeetRunPlanModeOptions
): RepoPlanStep =>
  gitStep(
    context,
    "commit:01-git-commit",
    options.amend ? "commit:git:commit:amend" : "commit:git:commit",
    "commit",
    options.amend
      ? options.noEdit
        ? ["commit", "--amend", "--no-edit"]
        : ["commit", "--amend", "-m", O.getOrElse(message, () => "<required-conventional-commit-message>")]
      : ["commit", "-m", O.getOrElse(message, () => "<required-conventional-commit-message>")]
  );

// Keep local pre-push hooks (secret scanning, SAST, policy gates) active on the
// early push: --no-verify would publish unverified content to the remote before
// any hook could block secrets or policy violations.
const earlyPushStep = (context: RepoRunContext): RepoPlanStep =>
  gitStep(context, "publish:01-git-push", "early-publish:git:push", "early-publish", ["push", "-u", "origin", "HEAD"]);

const pushStep = (context: RepoRunContext): RepoPlanStep =>
  gitStep(
    context,
    "publish:01-git-push",
    "publish:git:push",
    "publish",
    ["push", "-u", "origin", "HEAD"],
    O.some({ BEEP_YEET_REUSE_PRE_PUSH_PROOF: "1" })
  );

const headInstallPreflightStep = (context: RepoRunContext, phase: RepoPlanStep["phase"]): RepoPlanStep =>
  RepoPlanStep.make({
    id: HEAD_INSTALL_PREFLIGHT_STEP_ID,
    label: "publish:head-install-preflight",
    phase,
    command: "bun",
    args: ["install", "--frozen-lockfile"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "detached-clean-temp-worktree-of-HEAD",
  });

const prCreateStep = (context: RepoRunContext, phase: RepoPlanStep["phase"] = "publish"): RepoPlanStep =>
  RepoPlanStep.make({
    id: "publish:02-pr-create",
    label: "publish:pr-create",
    phase,
    command: "gh",
    args: ["pr", "create", "--title", "<head-commit-subject>", "--body-file", "<run-artifacts>/pr-body.md"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "publish",
    resume: "never",
  });

const monitorContextStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: "monitor:01-pr-context",
    label: "monitor:pr-context",
    phase: "monitor",
    command: "gh",
    args: ["pr", "view", "--json", "number,headRefName,state"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "current-branch-open-pr",
  });

const monitorChecksStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: "monitor:02-pr-checks-watch",
    label: "monitor:pr-checks:watch",
    phase: "monitor",
    command: "gh",
    args: ["pr", "checks", "--watch"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "all-current-pr-checks",
  });

const monitorSteps = (context: RepoRunContext): ReadonlyArray<RepoPlanStep> => [
  monitorContextStep(context),
  monitorChecksStep(context),
];

const closeoutPrContextStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: "closeout:01-pr-context",
    label: "closeout:pr-context",
    phase: "monitor",
    command: "gh",
    args: ["pr", "view", "--json", "number,headRefName,state,url,headRefOid,isDraft"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "current-branch-open-pr",
  });

const closeoutReviewGateStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: "closeout:02-review-gates",
    label: "closeout:review-gates",
    phase: "monitor",
    command: "gh",
    args: ["api", "graphql", "-f", "query=<yeet-closeout-review-query>"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "review-thread-and-bot-closeout",
  });

const closeoutSteps = (context: RepoRunContext): ReadonlyArray<RepoPlanStep> => [
  closeoutPrContextStep(context),
  closeoutReviewGateStep(context),
];

const statusLocalStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: "status:01-local",
    label: "status:local",
    phase: "monitor",
    command: "git",
    args: ["status", "--short", "--branch"],
    cwd: context.repoRoot,
    scope: "git",
    mutability: "readonly",
    resume: "never",
    verification: "local-branch-and-worktree-status",
  });

const statusRemoteStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: "status:02-remote-pr",
    label: "status:remote-pr",
    phase: "monitor",
    command: "gh",
    args: ["pr", "view", "--json", "number,url,state,mergeable,mergeStateStatus,isDraft,reviewDecision"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "current-branch-pr-status",
  });

const statusRemoteChecksStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: "status:03-remote-checks",
    label: "status:remote-checks",
    phase: "monitor",
    command: "gh",
    args: ["pr", "checks", "--json", "name,state,bucket"],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "current-branch-pr-checks",
  });

const statusSteps = (context: RepoRunContext, options: YeetRunPlanModeOptions): ReadonlyArray<RepoPlanStep> => [
  statusLocalStep(context),
  ...(options.remote ? [statusRemoteStep(context), statusRemoteChecksStep(context)] : []),
];

const publishSteps = (
  context: RepoRunContext,
  message: O.Option<string>,
  options: YeetRunPlanModeOptions
): ReadonlyArray<RepoPlanStep> =>
  options.pushOnly
    ? [
        headInstallPreflightStep(context, "publish"),
        pushStep(context),
        ...(options.pr ? [prCreateStep(context)] : []),
        ...(options.monitor ? monitorSteps(context) : []),
      ]
    : options.startPrEarly
      ? [
          fallowAdvisoryFeedbackStep(context),
          commitStep(context, message, options),
          headInstallPreflightStep(context, "early-publish"),
          earlyPushStep(context),
          ...(options.pr ? [prCreateStep(context, "early-publish")] : []),
          proofStep(context, "full"),
          ...(options.monitor ? monitorSteps(context) : []),
        ]
      : [
          fallowAdvisoryFeedbackStep(context),
          commitStep(context, message, options),
          ...(options.fast && options.monitor ? [] : [proofStep(context, "full")]),
          headInstallPreflightStep(context, "publish"),
          pushStep(context),
          ...(options.pr ? [prCreateStep(context)] : []),
          ...(options.monitor ? monitorSteps(context) : []),
        ];

const stepsForMode = (
  context: RepoRunContext,
  message: O.Option<string>,
  options: YeetRunPlanModeOptions
): ReadonlyArray<RepoPlanStep> =>
  YeetRunMode.$match(options.mode, {
    repair: () => [...repairSteps(context), ...feedbackSteps(context)],
    verify: () => [
      fallowAdvisoryFeedbackStep(context),
      proofStep(context, options.tier),
      ...(options.tier === "full" ? [headInstallPreflightStep(context, "full")] : []),
    ],
    publish: () => publishSteps(context, message, options),
    monitor: () => monitorSteps(context),
    closeout: () => closeoutSteps(context),
    status: () => statusSteps(context, options),
    "pre-push-hook": () => [],
  });

const withTurboForce = (steps: ReadonlyArray<RepoPlanStep>, forceTurbo: boolean): ReadonlyArray<RepoPlanStep> =>
  forceTurbo
    ? A.map(steps, (step) =>
        step.command === "bun" &&
        (step.phase === "feedback" || step.phase === "full") &&
        step.label !== "fallow-advisory-feedback"
          ? RepoPlanStep.make({ ...step, env: { ...step.env, TURBO_FORCE: "true" } })
          : step
      )
    : steps;

/**
 * Build a yeet run plan for a specific mode.
 *
 * @param context - Hydrated run context.
 * @param message - Optional conventional commit message; required by publish execution.
 * @param options - Mode selector used to choose repair, verify, or publish steps.
 * @returns Ordered repository run plan.
 * @example
 * ```ts
 * import {
 *   buildYeetRunPlanWithMode,
 *   RepoRunContext,
 *   TurboPlanSnapshot,
 *   YeetRunPlanModeOptions
 * } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "repo-cli-yeet",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] })
 * })
 * console.log(
 *   buildYeetRunPlanWithMode(
 *     context,
 *     O.none(),
 *     YeetRunPlanModeOptions.make({
 *       amend: false,
 *       fast: false,
 *       mode: "verify",
 *       monitor: false,
 *       noEdit: false,
 *       pushOnly: false,
 *       startPrEarly: false,
 *       tier: "full"
 *     })
 *   ).steps
 * )
 * ```
 * @category workflows
 * @since 0.0.0
 */
export const buildYeetRunPlanWithMode: {
  (context: RepoRunContext, message: O.Option<string>, options: YeetRunPlanModeOptions): RepoRunPlan;
  (message: O.Option<string>, options: YeetRunPlanModeOptions): (context: RepoRunContext) => RepoRunPlan;
} = dual(
  3,
  (context: RepoRunContext, message: O.Option<string>, options: YeetRunPlanModeOptions): RepoRunPlan =>
    RepoRunPlan.make({
      context,
      steps: pipe(
        withTurboForce(stepsForMode(context, message, options), options.forceTurbo),
        A.sort(byRepoPlanStepAscending)
      ),
    })
);

/**
 * Build the publish-mode yeet run plan.
 *
 * @param context - Hydrated run context.
 * @param message - Optional conventional commit message; omitted only for plan mode.
 * @returns Ordered repository run plan.
 * @example
 * ```ts
 * import { buildYeetRunPlan, RepoRunContext, TurboPlanSnapshot } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "repo-cli-yeet",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] })
 * })
 * console.log(buildYeetRunPlan(context, O.some("feat(repo-cli): add yeet")))
 * ```
 * @category workflows
 * @since 0.0.0
 */
export const buildYeetRunPlan: {
  (context: RepoRunContext, message: O.Option<string>): RepoRunPlan;
  (message: O.Option<string>): (context: RepoRunContext) => RepoRunPlan;
} = dual(
  2,
  (context: RepoRunContext, message: O.Option<string>): RepoRunPlan =>
    buildYeetRunPlanWithMode(
      context,
      message,
      YeetRunPlanModeOptions.make({
        amend: false,
        fast: false,
        mode: "publish",
        monitor: false,
        noEdit: false,
        pushOnly: false,
        startPrEarly: false,
        tier: "full",
      })
    )
);

/**
 * Return plan phases in execution order.
 *
 * @param plan - Yeet run plan.
 * @returns Ordered unique phase names.
 * @category utilities
 * @since 0.0.0
 */
export const yeetPlanPhases = (plan: RepoRunPlan): ReadonlyArray<RepoPlanStep["phase"]> =>
  pipe(
    plan.steps,
    A.map((step) => step.phase),
    A.dedupe,
    A.sort(
      Order.mapInput(Order.Number, (phase: RepoPlanStep["phase"]) =>
        RepoPlanPhase.$match(phase, {
          prepare: () => 0,
          feedback: () => 1,
          commit: () => 2,
          "early-publish": () => 3,
          full: () => 4,
          publish: () => 5,
          monitor: () => 6,
        })
      )
    )
  );
