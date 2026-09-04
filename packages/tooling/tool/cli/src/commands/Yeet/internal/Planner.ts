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
import * as Str from "effect/String";
import { YeetProofTier } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import {
  byRepoPlanStepAscending,
  enforceConservativeResume,
  RepoPlanPhase,
  RepoPlanStep,
  RepoPlanWave,
  RepoRunPlan,
  TurboPlanSnapshot,
} from "../../../internal/repo-run/RepoRun.models.ts";
import { repoProofStepDefinition } from "../../../internal/repo-run/RepoRun.proofs.ts";
import {
  githubCheckChangesetStatusLane,
  githubCheckCheapGateLanes,
  githubCheckFallowLanes,
  githubCheckLanePlan,
  githubCheckPrePushExternalLanes,
  githubCheckQualityLanes,
  githubCheckRepoSanityLanes,
} from "../../Quality/internal/GithubChecks.ts";
import { HEAD_INSTALL_PREFLIGHT_STEP_ID } from "./HeadInstallPreflight.ts";
import type { RepoRunContext, TurboPlanTask } from "../../../internal/repo-run/RepoRun.models.ts";
import type { GithubCheckLaneSpec } from "../../Quality/Quality.schemas.ts";

export { YeetProofTier } from "../../../internal/repo-run/QualityScheduler.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Planner");

/**
 * Default ignored directory for yeet run artifacts.
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_YEET_PACKET_DIR = ".beep/yeet" as const;

/**
 * Stable step id for the merged-tree CI parity battery.
 *
 * @category configuration
 */
export const CI_PARITY_STEP_ID = "full:02-ci-parity" as const;

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
 * **Example** (Plan a Yeet run)
 *
 * ```ts
 * import { YeetRunMode } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetRunMode.is.verify("verify"))
 * ```
 *
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
 * Options for building a Yeet run plan in a specific mode.
 *
 * **Example** (Plan a Yeet run)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRunPlanModeOptions extends S.Class<YeetRunPlanModeOptions>($I`YeetRunPlanModeOptions`)(
  {
    amend: S.Boolean,
    collectAll: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    ciParity: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
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
 * **Example** (Plan a Yeet run)
 *
 * ```ts
 * import { emptyTurboPlanSnapshot } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(emptyTurboPlanSnapshot([]).graphHealthStatus)
 * ```
 *
 * @param warnings - Optional graph-health warnings.
 * @returns Empty Turbo snapshot with graph health status.
 * @category constructors
 * @since 0.0.0
 */
export const emptyTurboPlanSnapshot = (warnings: ReadonlyArray<string>): TurboPlanSnapshot =>
  TurboPlanSnapshot.make({
    graphHealthStatus: A.isReadonlyArrayEmpty(warnings) ? "ok" : "warning",
    graphHealthWarnings: [...warnings],
    tasks: [],
  });

// Deterministic auto-fixers run sequentially (runPhase concurrency:1). Code
// rewriters run first, then config generation. The collected cheap tier runs
// before formatting, docgen, or affected feedback can consume heavyweight work.
// terse-effect applies only safe rewrites here; its manual candidates stay
// advisory during verification. Schema-first remains excluded from repair.
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
    "prepare:02-terse-effect",
    "prepare:laws:terse-effect",
    "prepare",
    "beep",
    ["laws", "terse-effect", "--write"],
    "write",
    "repo"
  ),
  bunRunStep(context, "prepare:03-config-sync", "prepare:config-sync", "prepare", "config-sync", [], "write", "repo"),
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
  // Repair feedback stays on the unit lane; verify/publish use only the full pre-push proof.
  feedbackTask === "test"
    ? ["--unit", ...filters, ...sharedFeedbackTurboArgs]
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
    O.some(
      bunRunStep(
        context,
        "feedback:00-heavy:01-lint-fix",
        "feedback:lint:fix",
        "feedback",
        "lint:fix",
        [],
        "write",
        "repo"
      )
    ),
    O.some(
      bunRunStep(context, "feedback:00-heavy:02-docgen", "feedback:docgen", "feedback", "docgen", [], "write", "repo")
    ),
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

const proofDefinitionForTier = (tier: YeetProofTier) =>
  YeetProofTier.$match(tier, {
    full: () => repoProofStepDefinition("pre-push"),
    "cheap-gates": () => repoProofStepDefinition("cheap-gates"),
    "review-fix": () => repoProofStepDefinition("review-fix"),
  });

const proofArgsForTier = (
  context: RepoRunContext,
  tier: YeetProofTier,
  collectAll: boolean,
  args: ReadonlyArray<string>
): ReadonlyArray<string> =>
  YeetProofTier.$match(tier, {
    full: () => [...args, ...(collectAll ? ["--collect-all"] : [])],
    "cheap-gates": () => args,
    "review-fix": () => [...args, "--base", context.base, "--head", context.head],
  });

const changesetStatusLanesForProof = (context: RepoRunContext): ReadonlyArray<GithubCheckLaneSpec> =>
  context.branch === "main" ? [] : [githubCheckChangesetStatusLane(context.repoRoot)];

const proofLanesForTier = (context: RepoRunContext, tier: YeetProofTier): ReadonlyArray<GithubCheckLaneSpec> =>
  YeetProofTier.$match(tier, {
    full: () => [
      ...changesetStatusLanesForProof(context),
      ...githubCheckRepoSanityLanes(context.repoRoot),
      ...githubCheckQualityLanes(context.repoRoot),
      ...githubCheckFallowLanes(context.repoRoot),
      ...githubCheckPrePushExternalLanes(context.repoRoot),
    ],
    "cheap-gates": () => [...changesetStatusLanesForProof(context), ...githubCheckCheapGateLanes(context.repoRoot)],
    "review-fix": A.empty<GithubCheckLaneSpec>,
  });

const proofStep = (context: RepoRunContext, tier: YeetProofTier, collectAll: boolean): RepoPlanStep => {
  const proof = proofDefinitionForTier(tier);
  const proofArgs = proofArgsForTier(context, tier, collectAll, proof.args);
  const step = bunRunStep(context, proof.id, proof.label, "full", "beep", proofArgs, "readonly", "repo");
  const lanes = proofLanesForTier(context, tier);
  return RepoPlanStep.make({
    ...step,
    env: {
      ...(step.env ?? {}),
      // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
      BEEP_YEET_LANE_PROOF_MODE: Bun.env.BEEP_YEET_LANE_PROOF_MODE ?? "active",
      BEEP_YEET_PROOF_BASE: context.base,
    },
    waves: A.map(githubCheckLanePlan.githubCheckLaneWaves(lanes), (wave) =>
      RepoPlanWave.make({ id: wave.wave, laneIds: A.map(wave.lanes, (lane) => lane.id) })
    ),
  });
};

const fullProofSteps = (context: RepoRunContext, collectAll: boolean): ReadonlyArray<RepoPlanStep> => [
  proofStep(context, "cheap-gates", true),
  proofStep(context, "full", collectAll),
];

const ciParityStep = (context: RepoRunContext): RepoPlanStep =>
  RepoPlanStep.make({
    id: CI_PARITY_STEP_ID,
    label: "full:ci-parity",
    phase: "full",
    command: "bun",
    args: ["run", "beep", "ci", "local", "--affected", "--base", context.base],
    cwd: context.repoRoot,
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    verification: "installed-merge-preview-pr-posture",
    env: {
      AUTH_SECRET: undefined,
      BEEP_TEST_DATABASE_DRIVER: undefined,
      BEEP_TEST_DATABASE_URL: undefined,
      BETTER_AUTH_SECRET: undefined,
      BETTER_AUTH_URL: undefined,
      CI: "true",
      DATABASE_URL: undefined,
      DATABASE_URL_UNPOOLED: undefined,
      EMAIL_RESEND_API_KEY: undefined,
      GITHUB_ACTIONS: "true",
      LIVEBLOCKS_SECRET_KEY: undefined,
      SECURITY_TRUSTED_ORIGINS: undefined,
      TURBO_API: undefined,
      TURBO_CACHE: "local:rw",
      TURBO_LOG_ORDER: "stream",
      TURBO_TEAM: undefined,
      TURBO_TOKEN: undefined,
    },
  });

const repairCheapGateStep = (context: RepoRunContext): RepoPlanStep => {
  const step = proofStep(context, "cheap-gates", true);
  return RepoPlanStep.make({
    ...step,
    id: "feedback:00-cheap-gates",
    label: "feedback:cheap-gates",
    phase: "feedback",
  });
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

/**
 * Stable plan-step identifier for the branch push, shared by both publish paths.
 *
 * **Details**
 *
 * The early-publish and ordinary publish phases both carry `publish` work, so
 * this id — not the phase — is what proves the branch actually reached the
 * remote.
 *
 * **Example** (Recognize the push step)
 *
 * ```ts
 * import { GIT_PUSH_STEP_ID } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GIT_PUSH_STEP_ID) // "publish:01-git-push"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GIT_PUSH_STEP_ID = "publish:01-git-push" as const;

const publishPushRefspec = (): string => {
  // Machine-local dead-owner recovery uses this narrow override to update the
  // original PR branch from a detached fixer worktree.
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  const configured = Bun.env.BEEP_YEET_PUSH_REFSPEC;
  return configured !== undefined && Str.startsWith("HEAD:refs/heads/")(configured) ? configured : "HEAD";
};

// Keep local pre-push hooks (secret scanning, SAST, policy gates) active on the
// early push: --no-verify would publish unverified content to the remote before
// any hook could block secrets or policy violations.
const earlyPushStep = (context: RepoRunContext): RepoPlanStep =>
  gitStep(context, GIT_PUSH_STEP_ID, "early-publish:git:push", "early-publish", [
    "push",
    "-u",
    "origin",
    publishPushRefspec(),
  ]);

const pushStep = (context: RepoRunContext): RepoPlanStep =>
  gitStep(
    context,
    GIT_PUSH_STEP_ID,
    "publish:git:push",
    "publish",
    ["push", "-u", "origin", publishPushRefspec()],
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
    // `--fail-fast` makes the watch exit on the first failed check instead of
    // holding a T0 red until the last pending lane ends — this repo's tails
    // run 20-30 minutes, so without it the monitor's "exits on the first red"
    // contract was prose, not behavior (ship-velocity A1, research/c2 §1).
    args: ["pr", "checks", "--watch", "--fail-fast"],
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
          ...fullProofSteps(context, options.collectAll),
          ciParityStep(context),
          ...(options.monitor ? monitorSteps(context) : []),
        ]
      : [
          fallowAdvisoryFeedbackStep(context),
          commitStep(context, message, options),
          ...(options.fast && options.monitor
            ? []
            : [...fullProofSteps(context, options.collectAll), ciParityStep(context)]),
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
    repair: () => [...repairSteps(context), repairCheapGateStep(context), ...feedbackSteps(context)],
    verify: () => [
      fallowAdvisoryFeedbackStep(context),
      ...(options.ciParity
        ? [ciParityStep(context)]
        : options.tier === "full"
          ? fullProofSteps(context, options.collectAll)
          : [proofStep(context, options.tier, options.collectAll)]),
      ...(!options.ciParity && options.tier === "full" ? [headInstallPreflightStep(context, "prepare")] : []),
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
 * **Example** (Plan a Yeet run)
 *
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
 *
 * @param context - Hydrated run context.
 * @param message - Optional conventional commit message; required by publish execution.
 * @param options - Mode selector used to choose repair, verify, or publish steps.
 * @returns Ordered repository run plan.
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
 * **Example** (Plan a Yeet run)
 *
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
 *
 * @param context - Hydrated run context.
 * @param message - Optional conventional commit message; omitted only for plan mode.
 * @returns Ordered repository run plan.
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
