/**
 * Yeet command orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, guardLiteralArg, isOptionLike } from "@beep/repo-utils";
import { Console, DateTime, Effect, FileSystem, flow, Order, Path, pipe, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { printCommandJson } from "../../../internal/cli/Json.js";
import {
  commandTextForStep,
  executeRepoPlanStepStreaming,
  RepoRunContext,
  RepoStepRunResult,
  resolveLocalRepoBinary,
  runRepoCommandCapture,
  TurboPlanSnapshot,
  TurboPlanTask,
  TurboWorkspacePackage,
} from "../../../internal/repo-run/index.js";
import { YeetCommandError } from "../Yeet.errors.js";
import {
  artifactDirForContext,
  runIdForContext,
  runArtifactPathForContext as runOutputPathForContext,
  runStatePathForContext,
  safeArtifactName,
} from "./ArtifactPaths.js";
import { PrCloseoutOptions, runPrCloseout } from "./Closeout.js";
import { renderPackageQualityPacketMarkdown } from "./PacketRenderer.js";
import {
  buildYeetRunPlanWithMode,
  DEFAULT_YEET_PACKET_DIR,
  emptyTurboPlanSnapshot,
  YEET_FEEDBACK_TASKS,
  YeetProofTier,
  YeetRunMode,
  YeetRunPlanModeOptions,
} from "./Planner.js";
import {
  buildQualityIssueIndex,
  QualityIssue,
  QualityIssueRouting,
  qualityIssuesFromStepResult,
} from "./QualityIssueIndex.js";
import { collectYeetStatus, renderYeetStatusSummary, writeYeetStatusSnapshot } from "./Status.js";
import { buildYeetVerdict, YeetBaseFreshness, YeetExecutedStep, YeetStashState } from "./Verdict.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoPlanStep, RepoRunPlan } from "../../../internal/repo-run/index.js";
import type { PackageQualityReport, QualityIssueIndex } from "./QualityIssueIndex.js";

const $I = $RepoCliId.create("commands/Yeet/internal/Handler");
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

class TurboQueryAffectedReason extends S.Class<TurboQueryAffectedReason>($I`TurboQueryAffectedReason`)(
  {
    __typename: S.String,
  },
  $I.annote("TurboQueryAffectedReason", {
    description: "Turbo affected query reason metadata.",
  })
) {}

class TurboQueryAffectedPackageRef extends S.Class<TurboQueryAffectedPackageRef>($I`TurboQueryAffectedPackageRef`)(
  {
    name: S.String,
  },
  $I.annote("TurboQueryAffectedPackageRef", {
    description: "Package reference nested in a Turbo affected task result.",
  })
) {}

class TurboQueryAffectedTask extends S.Class<TurboQueryAffectedTask>($I`TurboQueryAffectedTask`)(
  {
    fullName: S.String,
    name: S.String,
    package: TurboQueryAffectedPackageRef,
    reason: S.optionalKey(TurboQueryAffectedReason),
  },
  $I.annote("TurboQueryAffectedTask", {
    description: "One task returned by Turbo query affected.",
  })
) {}

class TurboQueryAffectedTaskConnection extends S.Class<TurboQueryAffectedTaskConnection>(
  $I`TurboQueryAffectedTaskConnection`
)(
  {
    items: S.Array(TurboQueryAffectedTask),
    length: S.Finite,
  },
  $I.annote("TurboQueryAffectedTaskConnection", {
    description: "Turbo affected task connection payload.",
  })
) {}

class TurboQueryAffectedData extends S.Class<TurboQueryAffectedData>($I`TurboQueryAffectedData`)(
  {
    affectedTasks: TurboQueryAffectedTaskConnection,
  },
  $I.annote("TurboQueryAffectedData", {
    description: "Data payload returned by Turbo query affected.",
  })
) {}

class TurboQueryAffectedDocument extends S.Class<TurboQueryAffectedDocument>($I`TurboQueryAffectedDocument`)(
  {
    data: TurboQueryAffectedData,
  },
  $I.annote("TurboQueryAffectedDocument", {
    description: "Turbo query affected JSON document.",
  })
) {}

class TurboQueryPackage extends S.Class<TurboQueryPackage>($I`TurboQueryPackage`)(
  {
    name: S.String,
    path: S.String,
  },
  $I.annote("TurboQueryPackage", {
    description: "One workspace package returned by Turbo query ls.",
  })
) {}

class TurboQueryPackageConnection extends S.Class<TurboQueryPackageConnection>($I`TurboQueryPackageConnection`)(
  {
    count: S.Finite,
    items: S.Array(TurboQueryPackage),
  },
  $I.annote("TurboQueryPackageConnection", {
    description: "Turbo package list connection payload.",
  })
) {}

class TurboQueryLsDocument extends S.Class<TurboQueryLsDocument>($I`TurboQueryLsDocument`)(
  {
    packageManager: S.optionalKey(S.String),
    packages: TurboQueryPackageConnection,
  },
  $I.annote("TurboQueryLsDocument", {
    description: "Turbo query ls JSON document.",
  })
) {}

const decodeTurboQueryAffectedDocument = S.decodeUnknownEffect(S.fromJsonString(TurboQueryAffectedDocument));
const decodeTurboQueryLsDocument = S.decodeUnknownEffect(S.fromJsonString(TurboQueryLsDocument));

const shouldCollectAffectedFeedbackTasks = (mode: YeetRunMode): boolean =>
  YeetRunMode.$match(mode, {
    closeout: () => false,
    publish: () => false,
    repair: () => true,
    verify: () => false,
    monitor: () => false,
    status: () => false,
    "pre-push-hook": () => false,
  });

class GhPullRequestView extends S.Class<GhPullRequestView>($I`GhPullRequestView`)(
  {
    headRefName: S.String,
    number: S.Finite,
    state: S.String,
  },
  $I.annote("GhPullRequestView", {
    description: "GitHub pull request metadata used to guard Yeet monitor runs.",
  })
) {}

const decodeGhPullRequestView = S.decodeUnknownEffect(S.fromJsonString(GhPullRequestView));

/**
 * Runtime options accepted by the yeet handler.
 *
 * @example
 * ```ts
 * import { YeetRunOptions } from "@beep/repo-cli/commands/Yeet"
 *
 * const options = YeetRunOptions.make({
 *   allowStaleBase: false,
 *   amend: false,
 *   base: "origin/main",
 *   bots: "greptile,coderabbit,chatgpt",
 *   fast: false,
 *   head: "HEAD",
 *   json: false,
 *   message: "",
 *   mode: "verify",
 *   monitor: false,
 *   noEdit: false,
 *   packetDir: ".beep/yeet",
 *   plan: true,
 *   pr: false,
 *   pushOnly: false,
 *   remote: false,
 *   replyBody: "",
 *   replyThread: "",
 *   requireGreptileIssues: -1,
 *   requireGreptileScore: "",
 *   requireReviewComments: -1,
 *   resolveThreads: "",
 *   retriggerGreptile: false,
 *   reuseVerified: false,
 *   stagedOnly: false,
 *   summary: false,
 *   startPrEarly: false,
 *   tier: "full"
 * })
 * console.log(options.base)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetRunOptions extends S.Class<YeetRunOptions>($I`YeetRunOptions`)(
  {
    allowStaleBase: S.Boolean,
    amend: S.Boolean,
    base: S.String,
    bots: S.String,
    fast: S.Boolean,
    head: S.String,
    json: S.Boolean,
    message: S.String,
    mode: YeetRunMode,
    monitor: S.Boolean,
    noEdit: S.Boolean,
    packetDir: S.String,
    plan: S.Boolean,
    pr: S.Boolean,
    pushOnly: S.Boolean,
    remote: S.Boolean,
    replyBody: S.String,
    replyThread: S.String,
    requireGreptileIssues: S.Finite,
    requireGreptileScore: S.String,
    requireReviewComments: S.Finite,
    resolveThreads: S.String,
    retriggerGreptile: S.Boolean,
    reuseVerified: S.Boolean,
    stagedOnly: S.Boolean,
    summary: S.Boolean,
    startPrEarly: S.Boolean,
    tier: YeetProofTier,
  },
  $I.annote("YeetRunOptions", {
    description: "Runtime options accepted by the yeet handler.",
  })
) {}

class YeetLaneProofState extends S.Class<YeetLaneProofState>($I`YeetLaneProofState`)(
  {
    commandHash: S.String,
    commandText: S.String,
    diffFingerprint: S.String,
    stepId: S.String,
    label: S.String,
    verifiedAt: S.String,
  },
  $I.annote("YeetLaneProofState", {
    description: "One durable per-lane proof record keyed by command and tree fingerprint.",
  })
) {}

class YeetRunState extends S.Class<YeetRunState>($I`YeetRunState`)(
  {
    schemaVersion: S.Literal("yeet-run-state/v1"),
    artifactDir: S.String,
    base: S.String,
    branch: S.String,
    commitSha: S.String,
    diffFingerprint: S.String,
    head: S.String,
    proofCommand: S.String,
    proofTier: YeetProofTier,
    runId: S.String,
    verifiedAt: S.String,
    laneProofs: S.Array(YeetLaneProofState).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<YeetLaneProofState>())),
      S.withDecodingDefault(Effect.succeed(A.empty<YeetLaneProofState>()))
    ),
  },
  $I.annote("YeetRunState", {
    description: "Durable exact-match proof state for Yeet retry and closeout loops.",
  })
) {}

/**
 * Best-effort lock metadata for serializing heavyweight full-proof runs.
 *
 * @category models
 * @since 0.0.0
 */
class YeetProofLockState extends S.Class<YeetProofLockState>($I`YeetProofLockState`)(
  {
    schemaVersion: S.Literal("yeet-proof-lock/v1"),
    branch: S.String,
    command: S.String,
    pid: S.Finite,
    proofTier: YeetProofTier,
    startedAt: S.String,
  },
  $I.annote("YeetProofLockState", {
    description: "Best-effort local lock metadata for heavyweight Yeet proof scheduling.",
  })
) {}

const decodeYeetRunState = S.decodeUnknownEffect(S.fromJsonString(YeetRunState));

/**
 * Result returned by a yeet execution attempt.
 *
 * @example
 * ```ts
 * import { YeetRunResult } from "@beep/repo-cli/commands/Yeet"
 *
 * const result = YeetRunResult.make({ artifactDir: ".beep/yeet", committed: false, packetPaths: [], pushed: false })
 * console.log(result.artifactDir)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetRunResult extends S.Class<YeetRunResult>($I`YeetRunResult`)(
  {
    artifactDir: S.String,
    committed: S.Boolean,
    pushed: S.Boolean,
    packetPaths: S.Array(S.String),
    indexPath: S.optionalKey(S.String),
  },
  $I.annote("YeetRunResult", {
    description: "Execution result and artifact paths emitted by yeet.",
  })
) {}

class YeetPublishIntent extends S.Class<YeetPublishIntent>($I`YeetPublishIntent`)(
  {
    paths: S.Array(S.String),
  },
  $I.annote("YeetPublishIntent", {
    description: "Reviewed Git index paths that yeet is allowed to publish.",
  })
) {}

const optionFromNonEmpty = (value: string): O.Option<string> => pipe(O.some(Str.trim(value)), O.filter(Str.isNonEmpty));
const commandFailure = (result: RepoStepRunResult, message: string): YeetCommandError =>
  YeetCommandError.make({
    message,
    command: result.commandText,
    exitCode: result.exitCode === 0 ? 1 : result.exitCode,
  });

const zeroGitSha = "0000000000000000000000000000000000000000" as const;

const sortedUniquePaths: (paths: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

const gitPathListFromNulOutput: (output: string) => ReadonlyArray<string> = flow(Str.split("\0"), sortedUniquePaths);

const prePushLocalShasFromStdin = (input: string): ReadonlyArray<string> =>
  pipe(
    Str.split(/\r?\n/u)(input),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.map((line) => Str.split(/\s+/u)(line)[1] ?? ""),
    A.filter((sha) => Str.isNonEmpty(sha) && sha !== zeroGitSha),
    sortedUniquePaths
  );

const prePushShaMismatches = (localShas: ReadonlyArray<string>, expectedCommitSha: string): ReadonlyArray<string> =>
  pipe(
    localShas,
    A.filter((sha) => sha !== expectedCommitSha),
    sortedUniquePaths
  );

const publishPathsOutsideIntent = (
  intendedPaths: ReadonlyArray<string>,
  observedPaths: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    observedPaths,
    A.filter((filePath) => !A.contains(intendedPaths, filePath)),
    sortedUniquePaths
  );

const publishRestagePaths = (
  intendedPaths: ReadonlyArray<string>,
  existingPaths: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    intendedPaths,
    A.filter((filePath) => A.contains(existingPaths, filePath)),
    sortedUniquePaths
  );

const expectedPublishUpstream = (branch: string): string => `origin/${branch}`;

const publishUpstreamMismatchWarning = (branch: string, upstream: string): O.Option<string> =>
  upstream === expectedPublishUpstream(branch)
    ? O.none()
    : O.some(
        `[yeet] warning: branch "${branch}" tracks "${upstream}"; publish will push HEAD to ${expectedPublishUpstream(branch)}.`
      );

const formatPublishPaths: (paths: ReadonlyArray<string>) => string = flow(
  sortedUniquePaths,
  A.map((filePath) => `  - ${filePath}`),
  A.join("\n")
);

const PUBLISH_PATH_EXAMPLE_LIMIT = 10;

const summarizePublishPaths = (paths: ReadonlyArray<string>): string => {
  const unique = sortedUniquePaths(paths);
  const topLevelDirs = pipe(
    unique,
    A.map((filePath) => Str.split("/")(filePath)[0] ?? filePath),
    A.dedupe,
    A.sort(Order.String)
  );
  const examples = formatPublishPaths(A.take(unique, PUBLISH_PATH_EXAMPLE_LIMIT));
  const overflow =
    unique.length > PUBLISH_PATH_EXAMPLE_LIMIT
      ? `\n  - (+${unique.length - PUBLISH_PATH_EXAMPLE_LIMIT} more; full list in the failure packet)`
      : "";
  const entryWord = topLevelDirs.length === 1 ? "entry" : "entries";
  return `${unique.length} path(s) across ${topLevelDirs.length} top-level ${entryWord}: ${A.join(topLevelDirs, ", ")}\n${examples}${overflow}`;
};

const partiallyStagedPaths = (
  stagedPaths: ReadonlyArray<string>,
  unstagedPaths: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    stagedPaths,
    A.filter((filePath) => A.contains(unstagedPaths, filePath)),
    sortedUniquePaths
  );

const overlappingBasePaths = (
  branchPaths: ReadonlyArray<string>,
  basePaths: ReadonlyArray<string>
): ReadonlyArray<string> =>
  pipe(
    branchPaths,
    A.filter((filePath) => A.contains(basePaths, filePath)),
    sortedUniquePaths
  );

const failPublishScopeWithPacket = Effect.fn("Yeet.failPublishScopeWithPacket")(function* (
  context: RepoRunContext,
  scope: {
    readonly message: string;
    readonly paths: ReadonlyArray<string>;
    readonly remediation: string;
    readonly subCategory: string;
  }
): Effect.fn.Return<never, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const summary = `${scope.message}\n${summarizePublishPaths(scope.paths)}\nRemedy: ${scope.remediation}`;
  const issue = QualityIssue.make({
    blocking: true,
    category: "command-failure",
    confidence: "structured",
    evidence: sortedUniquePaths(scope.paths),
    id: `yeet-publish-scope:${scope.subCategory}`,
    message: summary,
    parser: "yeet/publish-scope/v1",
    remediation: scope.remediation,
    routing: [QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: scope.message })],
    severity: "error",
    subCategory: scope.subCategory,
    tool: "yeet",
  });
  const artifacts = yield* writeIssueArtifacts(context, buildQualityIssueIndex([issue]));
  yield* Console.error(`${summary}\nYeet quality packets written to ${artifacts.artifactDir}`);
  for (const packetPath of artifacts.packetPaths) {
    yield* Console.error(`  - ${packetPath}`);
  }
  return yield* YeetCommandError.make({
    message: summary,
    command: "git status --short",
    exitCode: 1,
  });
});

/**
 * Parse NUL-delimited Git path output for Yeet publish-safety tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const gitPathListFromNulOutputForTesting = gitPathListFromNulOutput;

/**
 * Parse Git pre-push stdin and return non-delete local commit SHAs.
 *
 * @category testing
 * @since 0.0.0
 */
export const prePushLocalShasFromStdinForTesting = prePushLocalShasFromStdin;

/**
 * Return pushed SHAs that do not match the reusable Yeet proof commit.
 *
 * @category testing
 * @since 0.0.0
 */
export const prePushShaMismatchesForTesting = prePushShaMismatches;

/**
 * Return observed paths that are not part of the reviewed Yeet publish intent.
 *
 * @category testing
 * @since 0.0.0
 */
export const publishPathsOutsideIntentForTesting = publishPathsOutsideIntent;

/**
 * Return reviewed paths that can be passed to `git add` without failing on
 * reviewed deletions.
 *
 * @category testing
 * @since 0.0.0
 */
export const publishRestagePathsForTesting = publishRestagePaths;

/**
 * Return the warning Yeet prints when publish push target differs from branch
 * upstream tracking.
 *
 * @category testing
 * @since 0.0.0
 */
export const publishUpstreamMismatchWarningForTesting = publishUpstreamMismatchWarning;

/**
 * Summarize refused publish paths as count, top-level entries, and capped
 * examples instead of a full enumeration.
 *
 * @category testing
 * @since 0.0.0
 */
export const summarizePublishPathsForTesting = summarizePublishPaths;

/**
 * Return staged paths that also carry unstaged worktree modifications.
 *
 * @category testing
 * @since 0.0.0
 */
export const partiallyStagedPathsForTesting = partiallyStagedPaths;

/**
 * Return branch-changed paths that were also changed on the base ref since the
 * merge-base.
 *
 * @category testing
 * @since 0.0.0
 */
export const overlappingBasePathsForTesting = overlappingBasePaths;

const renderJson = Effect.fn("Yeet.renderJson")(function* (value: unknown): Effect.fn.Return<string, YeetCommandError> {
  return yield* encodeJson(value).pipe(Effect.mapError(YeetCommandError.new("Failed to encode yeet JSON output.")));
});
const decodeJsonTextOption = S.decodeUnknownOption(S.UnknownFromJsonString);

const runGitOutput = Effect.fn("Yeet.runGitOutput")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const command = `git ${A.join(args, " ")}`;
  const result = yield* runRepoCommandCapture("git", args, repoRoot).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to run ${command}.`))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `${command} failed with exit code ${result.exitCode}.`,
      command,
      exitCode: result.exitCode,
    });
  }
  if (result.truncated) {
    return yield* YeetCommandError.make({
      message: `${command} output exceeded the repo-run capture limit.`,
      command,
      exitCode: 1,
    });
  }

  return result.output;
});

const blockedMonitorBranches: ReadonlyArray<string> = ["main", "master", "HEAD"];
const shouldMonitorChecks = (options: YeetRunOptions): boolean =>
  options.monitor || options.mode === "monitor" || options.mode === "closeout";

const validateMonitorBranch = (context: RepoRunContext): Effect.Effect<void, YeetCommandError> => {
  if (!A.contains(blockedMonitorBranches, context.branch)) {
    return Effect.void;
  }

  return Effect.fail(
    YeetCommandError.make({
      message: `yeet monitor is PR-branch-only; refusing to monitor branch "${context.branch}".`,
      command: "git rev-parse --abbrev-ref HEAD",
      exitCode: 1,
    })
  );
};

const runGhPullRequestView = Effect.fn("Yeet.runGhPullRequestView")(function* (
  context: RepoRunContext
): Effect.fn.Return<GhPullRequestView, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "view", "--json", "number,headRefName,state"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to inspect current branch pull request.")));

  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message:
        "yeet monitor requires an open pull request for the current branch. Run the full local proof fallback with `bun run audit:github pre-push` when no PR is available.",
      command: "gh pr view --json number,headRefName,state",
      exitCode: result.exitCode,
    });
  }

  if (result.truncated) {
    return yield* YeetCommandError.make({
      message: "gh pr view output exceeded the repo-run capture limit.",
      command: "gh pr view --json number,headRefName,state",
      exitCode: 1,
    });
  }

  return yield* decodeGhPullRequestView(result.output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON."))
  );
});

const findOpenPullRequest = Effect.fn("Yeet.findOpenPullRequest")(function* (
  context: RepoRunContext
): Effect.fn.Return<O.Option<GhPullRequestView>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "view", "--json", "number,headRefName,state"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to inspect current branch pull request.")));

  if (result.exitCode !== 0 || result.truncated) {
    return O.none();
  }

  const view = yield* decodeGhPullRequestView(result.output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON."))
  );
  return view.state === "OPEN" && view.headRefName === context.branch ? O.some(view) : O.none();
});

const buildPrBody = Effect.fn("Yeet.buildPrBody")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const mergeBase = yield* runGitOutput(context.repoRoot, ["merge-base", context.base, "HEAD"]).pipe(
    Effect.map(Str.trim),
    Effect.orElseSucceed(() => "")
  );
  const range = Str.isNonEmpty(mergeBase) ? `${mergeBase}..HEAD` : "HEAD";
  const commitLog = yield* runGitOutput(context.repoRoot, ["log", "--reverse", "--pretty=format:## %s%n%n%b", range]);
  const executed = yield* Ref.get(recorder);
  const laneSummary = pipe(
    executed,
    A.map((entry) => `- ${entry.step.label}: ${entry.result.exitCode === 0 ? "passed" : "failed"}`),
    A.join("\n")
  );
  const proofSection = Str.isNonEmpty(laneSummary)
    ? laneSummary
    : "- full local proof still running (start-pr-early); see the verdict artifact for final lane results";
  return `${Str.trim(commitLog)}\n\n## Local proof\n\n${proofSection}\n\nVerdict: .beep/yeet/runs/${runIdForContext(context)}/verdict.json\n`;
});

const recordPrCreateLane = Effect.fn("Yeet.recordPrCreateLane")(function* (
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>,
  output: string
): Effect.fn.Return<void> {
  if (O.isNone(prStep)) {
    return;
  }
  yield* Ref.update(
    recorder,
    A.append(
      YeetExecutedStep.make({
        result: RepoStepRunResult.make({
          stepId: prStep.value.id,
          commandText: "gh pr create",
          exitCode: 0,
          output,
        }),
        step: prStep.value,
      })
    )
  );
});

const ensurePullRequest = Effect.fn("Yeet.ensurePullRequest")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  prStep: O.Option<RepoPlanStep>
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const existing = yield* findOpenPullRequest(context);
  if (O.isSome(existing)) {
    yield* Console.log(
      `[yeet] --pr: open pull request #${existing.value.number} already exists for ${context.branch}; skipping create`
    );
    yield* recordPrCreateLane(recorder, prStep, `skipped: open pull request #${existing.value.number} already exists`);
    return;
  }

  const title = yield* runGitOutput(context.repoRoot, ["log", "-1", "--pretty=%s"]).pipe(Effect.map(Str.trim));
  const bodyPath = yield* runOutputPathForContext(context, "pr-body.md");
  yield* writeTextFile(bodyPath, yield* buildPrBody(context, recorder));
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "create", "--title", title, "--body-file", bodyPath],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to run gh pr create.")));
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `gh pr create failed:\n${result.output}`,
      command: `gh pr create --title <subject> --body-file ${bodyPath}`,
      exitCode: result.exitCode,
    });
  }
  yield* Console.log(`[yeet] --pr: created pull request -> ${Str.trim(result.output)}`);
  yield* recordPrCreateLane(recorder, prStep, Str.trim(result.output));
});

const validateOpenPullRequest = Effect.fn("Yeet.validateOpenPullRequest")(function* (
  context: RepoRunContext
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const pullRequest = yield* runGhPullRequestView(context);

  if (pullRequest.state !== "OPEN") {
    return yield* YeetCommandError.make({
      message: `yeet monitor requires an open pull request; current branch PR #${pullRequest.number} is ${pullRequest.state}.`,
      command: "gh pr view --json number,headRefName,state",
      exitCode: 1,
    });
  }

  if (pullRequest.headRefName !== context.branch) {
    return yield* YeetCommandError.make({
      message: `yeet monitor expected PR head "${context.branch}" but gh reported "${pullRequest.headRefName}".`,
      command: "gh pr view --json number,headRefName,state",
      exitCode: 1,
    });
  }
});

const validateMonitorGuards = Effect.fn("Yeet.validateMonitorGuards")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  if (options.fast && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --fast is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.fast && !options.monitor) {
    return yield* YeetCommandError.make({
      message: "yeet publish --fast requires --monitor so hosted PR checks remain explicit.",
      exitCode: 1,
    });
  }

  if (options.startPrEarly && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --start-pr-early is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.startPrEarly && !options.monitor) {
    return yield* YeetCommandError.make({
      message:
        "yeet publish --start-pr-early requires --monitor so hosted PR checks are watched while local proof runs.",
      exitCode: 1,
    });
  }

  if (
    options.startPrEarly &&
    (options.fast || options.pushOnly || options.reuseVerified || options.amend || options.noEdit)
  ) {
    return yield* YeetCommandError.make({
      message:
        "yeet publish --start-pr-early cannot be combined with --fast, --push-only, --reuse-verified, --amend, or --no-edit.",
      exitCode: 1,
    });
  }

  if (options.mode === "publish" && options.tier !== "full") {
    return yield* YeetCommandError.make({
      message: "yeet publish always uses the full local proof. Use `yeet verify --tier review-fix` for review loops.",
      exitCode: 1,
    });
  }

  if (options.noEdit && !options.amend) {
    return yield* YeetCommandError.make({
      message: "yeet publish --no-edit requires --amend.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --push-only is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && !options.reuseVerified) {
    return yield* YeetCommandError.make({
      message: "yeet publish --push-only requires --reuse-verified.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && (options.amend || options.noEdit || options.fast)) {
    return yield* YeetCommandError.make({
      message: "yeet publish --push-only cannot be combined with --amend, --no-edit, or --fast.",
      exitCode: 1,
    });
  }

  if (options.pushOnly && O.isSome(optionFromNonEmpty(options.message))) {
    return yield* YeetCommandError.make({
      message: "yeet publish --push-only does not accept --message because it never creates a commit.",
      exitCode: 1,
    });
  }

  if (options.pr && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --pr is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.stagedOnly && options.mode !== "publish") {
    return yield* YeetCommandError.make({
      message: "yeet --staged-only is only valid for publish.",
      exitCode: 1,
    });
  }

  if (options.stagedOnly && (options.pushOnly || options.reuseVerified || options.amend)) {
    return yield* YeetCommandError.make({
      message:
        "yeet publish --staged-only cannot be combined with --push-only, --reuse-verified, or --amend; those modes never create a fresh reviewed commit to scope.",
      exitCode: 1,
    });
  }

  if (!shouldMonitorChecks(options)) {
    return;
  }

  yield* validateMonitorBranch(context);
  if (!options.plan && !options.pr) {
    yield* validateOpenPullRequest(context);
  }
});

const originRefPrefix = "origin/" as const;

// Reject any character that git refname rules forbid or that lets a branch be
// reparsed as a fetch option/refspec: control/whitespace, `:` (refspec
// separator), and the `~^?*[\` revision/glob metacharacters. Combined with the
// option-like guard, this keeps a `--base origin/<branch>` value from becoming
// a `git fetch --upload-pack=...`-style argument injection.
const unsafeRefnameChar = /[\s:~^?*[\]\\]/u;

const isSafeOriginBranch = (branch: string): boolean =>
  Str.isNonEmpty(branch) &&
  !isOptionLike(branch) &&
  O.isNone(Str.match(unsafeRefnameChar)(branch)) &&
  !Str.includes("..")(branch) &&
  !Str.startsWith("/")(branch) &&
  !Str.endsWith("/")(branch) &&
  !Str.endsWith(".lock")(branch);

const originBranchFromBase = (base: string): O.Option<string> =>
  pipe(
    O.some(base),
    O.filter(Str.startsWith(originRefPrefix)),
    O.map(Str.replace(originRefPrefix, "")),
    O.filter(Str.isNonEmpty)
  );

/**
 * Extract and validate the `origin/<branch>` ref from a `--base` value.
 *
 * @param base - The raw `--base` value (e.g. `main` or `origin/main`).
 * @returns `Option.some(branch)` for a safe `origin/<branch>` ref, otherwise `Option.none()`.
 * @category testing
 * @since 0.0.0
 */
export const safeOriginBranchFromBaseForTesting = (base: string): O.Option<string> =>
  pipe(originBranchFromBase(base), O.filter(isSafeOriginBranch));

const refreshBaseRef = Effect.fn("Yeet.refreshBaseRef")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const originBranch = originBranchFromBase(base);
  if (O.isSome(originBranch)) {
    if (!isSafeOriginBranch(originBranch.value)) {
      return yield* YeetCommandError.make({
        message: `yeet refuses an unsafe base ref "${base}". Use a plain branch under origin/ such as origin/main.`,
        command: "git fetch origin",
        exitCode: 1,
      });
    }
    // Fail closed against argument injection and pin a fully-qualified refspec so
    // git never reparses the branch as an option (e.g. --upload-pack=...).
    const safeBranch = yield* guardLiteralArg(originBranch.value).pipe(
      Effect.mapError(
        YeetCommandError.new(`yeet refuses an option-like base ref "${base}". Use a plain branch under origin/.`)
      )
    );
    yield* runGitOutput(repoRoot, [
      "fetch",
      "--quiet",
      "--no-tags",
      "origin",
      `refs/heads/${safeBranch}:refs/remotes/origin/${safeBranch}`,
    ]);
    return;
  }

  yield* runGitOutput(repoRoot, ["rev-parse", "--verify", "--end-of-options", base]);
});

const runGitPathList = Effect.fn("Yeet.runGitPathList")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitOutput(repoRoot, args);
  return gitPathListFromNulOutput(output);
});

const collectStagedPublishPaths = Effect.fn("Yeet.collectStagedPublishPaths")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(repoRoot, ["diff", "--cached", "--name-only", "-z"]);
});

const collectUnstagedTrackedPaths = Effect.fn("Yeet.collectUnstagedTrackedPaths")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(repoRoot, ["diff", "--name-only", "-z"]);
});

const collectUntrackedPaths = Effect.fn("Yeet.collectUntrackedPaths")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]);
});

const stashUnstagedWorktree = Effect.fn("Yeet.stashUnstagedWorktree")(function* (
  context: RepoRunContext
): Effect.fn.Return<O.Option<YeetStashState>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);
  if (A.isReadonlyArrayEmpty(unstagedPaths) && A.isReadonlyArrayEmpty(untrackedPaths)) {
    return O.none();
  }

  const createdAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const marker = `yeet-staged-only/${runIdForContext(context)}/${createdAt}`;
  // --keep-index preserves the reviewed staged index so the parking happens
  // before `git commit`: residue is removed from the worktree first, so a
  // commit hook (e.g. `git add .`) can only ever stage the reviewed files.
  yield* runGitOutput(context.repoRoot, ["stash", "push", "--keep-index", "--include-untracked", "-m", marker]);
  const stashSha = yield* runGitOutput(context.repoRoot, ["rev-parse", "stash@{0}"]).pipe(Effect.map(Str.trim));
  yield* Console.log(
    `[yeet] staged-only: parked ${unstagedPaths.length + untrackedPaths.length} residue path(s) in stash "${marker}"`
  );
  return O.some(YeetStashState.make({ createdAt, marker, stashSha }));
});

const locateStashRef = Effect.fn("Yeet.locateStashRef")(function* (
  repoRoot: string,
  stash: YeetStashState
): Effect.fn.Return<O.Option<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const listing = yield* runGitOutput(repoRoot, ["stash", "list", "--format=%H %gd %s"]);
  return pipe(
    Str.split(/\r?\n/u)(listing),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.findFirst((line) => Str.startsWith(stash.stashSha)(line) || Str.includes(stash.marker)(line)),
    O.flatMap((line) => A.get(Str.split(/\s+/u)(line), 1))
  );
});

const restoreStashedWorktree = Effect.fn("Yeet.restoreStashedWorktree")(function* (
  context: RepoRunContext,
  stash: YeetStashState
): Effect.fn.Return<void, never, ChildProcessSpawner.ChildProcessSpawner> {
  const failureDetail = yield* Effect.gen(function* () {
    const stashRef = yield* locateStashRef(context.repoRoot, stash);
    if (O.isNone(stashRef)) {
      return `stash not found by sha or marker; inspect "git stash list" for "${stash.marker}"`;
    }
    yield* runGitOutput(context.repoRoot, ["stash", "pop", stashRef.value]);
    return "";
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed(`stash pop failed (${error.message}); residue is preserved under marker "${stash.marker}"`)
    )
  );

  if (Str.isNonEmpty(failureDetail)) {
    yield* Console.error(`[yeet] warning: staged-only residue was NOT restored: ${failureDetail}`);
    return;
  }
  yield* Console.log("[yeet] staged-only: residue restored from stash");
});

/**
 * Park unstaged and untracked residue in a marked stash for staged-only
 * publish.
 *
 * @category testing
 * @since 0.0.0
 */
export const stashUnstagedWorktreeForTesting = stashUnstagedWorktree;

/**
 * Restore staged-only residue from its recorded stash, preserving the stash on
 * failure.
 *
 * @category testing
 * @since 0.0.0
 */
export const restoreStashedWorktreeForTesting = restoreStashedWorktree;

const assessBaseFreshness = Effect.fn("Yeet.assessBaseFreshness")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetBaseFreshness, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const mergeBase = yield* runGitOutput(context.repoRoot, ["merge-base", context.base, "HEAD"]).pipe(
    Effect.map(Str.trim),
    Effect.mapError(
      YeetCommandError.new(
        `yeet publish could not compute a merge-base between ${context.base} and HEAD. Rebase onto the base ref before publishing.`
      )
    )
  );
  const behindCount = yield* runGitOutput(context.repoRoot, [
    "rev-list",
    "--count",
    `${mergeBase}..${context.base}`,
  ]).pipe(Effect.map((output) => Number(Str.trim(output))));
  if (behindCount === 0) {
    return YeetBaseFreshness.make({ behindCount: 0, mergeBase, overlappingPaths: [] });
  }

  const committedPaths = yield* runGitPathList(context.repoRoot, ["diff", "--name-only", "-z", `${mergeBase}..HEAD`]);
  const stagedFreshnessPaths = yield* collectStagedPublishPaths(context.repoRoot);
  const branchPaths = sortedUniquePaths([...committedPaths, ...stagedFreshnessPaths]);
  const basePaths = yield* runGitPathList(context.repoRoot, [
    "diff",
    "--name-only",
    "-z",
    `${mergeBase}..${context.base}`,
  ]);
  return YeetBaseFreshness.make({
    behindCount,
    mergeBase,
    overlappingPaths: overlappingBasePaths(branchPaths, basePaths),
  });
});

/**
 * Assess how far the publish branch has diverged from its refreshed base ref.
 *
 * @category testing
 * @since 0.0.0
 */
export const assessBaseFreshnessForTesting = assessBaseFreshness;

const enforceBaseFreshness = Effect.fn("Yeet.enforceBaseFreshness")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  YeetBaseFreshness,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const freshness = yield* assessBaseFreshness(context);
  if (freshness.behindCount === 0) {
    return freshness;
  }
  yield* Console.error(
    `[yeet] warning: branch is ${freshness.behindCount} commit(s) behind ${context.base} (merge-base ${pipe(freshness.mergeBase, Str.takeLeft(12))})`
  );
  if (A.isReadonlyArrayEmpty(freshness.overlappingPaths)) {
    return freshness;
  }
  if (options.allowStaleBase) {
    yield* Console.error(
      `[yeet] --allow-stale-base: proceeding despite ${freshness.overlappingPaths.length} path(s) overlapping commits on ${context.base}`
    );
    return freshness;
  }
  return yield* failPublishScopeWithPacket(context, {
    message: `yeet publish refuses a stale base: files changed on this branch were also changed on ${context.base} since the merge-base, so the PR would conflict or silently regress them.`,
    paths: freshness.overlappingPaths,
    remediation: `git fetch origin && git rebase ${context.base}, re-run bun run beep yeet verify, then publish again. Pass --allow-stale-base to proceed anyway.`,
    subCategory: "stale-base",
  });
});

const collectCurrentUpstreamBranch = Effect.fn("Yeet.collectCurrentUpstreamBranch")(function* (
  repoRoot: string
): Effect.fn.Return<O.Option<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture(
    "git",
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to inspect current branch upstream.")));

  if (result.exitCode !== 0) {
    return O.none();
  }

  return optionFromNonEmpty(result.output);
});

const warnOnMismatchedPublishUpstream = Effect.fn("Yeet.warnOnMismatchedPublishUpstream")(function* (
  context: RepoRunContext
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const upstream = yield* collectCurrentUpstreamBranch(context.repoRoot);
  if (O.isNone(upstream)) {
    return;
  }

  const warning = publishUpstreamMismatchWarning(context.branch, upstream.value);
  if (O.isSome(warning)) {
    yield* Console.error(warning.value);
  }
});

const collectPublishIntent = Effect.fn("Yeet.collectPublishIntent")(function* (
  context: RepoRunContext,
  stagedOnly: boolean
): Effect.fn.Return<
  YeetPublishIntent,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const stagedPaths = yield* collectStagedPublishPaths(context.repoRoot);
  const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);

  if (A.isReadonlyArrayEmpty(stagedPaths)) {
    return yield* YeetCommandError.make({
      message: "yeet publish requires reviewed staged changes. Stage the intended files before running yeet.",
      command: "git diff --cached --name-only",
      exitCode: 1,
    });
  }

  if (stagedOnly) {
    const splitPaths = partiallyStagedPaths(stagedPaths, unstagedPaths);
    if (!A.isReadonlyArrayEmpty(splitPaths)) {
      return yield* failPublishScopeWithPacket(context, {
        message:
          "yeet publish --staged-only refuses files that are both staged and modified in the worktree; it cannot split a partially staged file.",
        paths: splitPaths,
        remediation: "Stage the remaining hunks with git add, or stash them manually, then rerun.",
        subCategory: "partially-staged",
      });
    }
    return YeetPublishIntent.make({ paths: stagedPaths });
  }

  if (!A.isReadonlyArrayEmpty(untrackedPaths)) {
    return yield* failPublishScopeWithPacket(context, {
      message:
        "yeet publish refuses untracked files. Stage intended new files or remove ignored-sensitive leftovers before running yeet.",
      paths: untrackedPaths,
      remediation:
        "Stage the intended files, remove leftovers, or rerun with --staged-only to park the residue in a stash automatically.",
      subCategory: "untracked",
    });
  }

  if (!A.isReadonlyArrayEmpty(unstagedPaths)) {
    return yield* failPublishScopeWithPacket(context, {
      message: "yeet publish refuses unstaged tracked changes. Stage the reviewed files before running yeet.",
      paths: unstagedPaths,
      remediation:
        "Stage the reviewed files, or rerun with --staged-only to park the residue in a stash automatically.",
      subCategory: "unstaged",
    });
  }

  return YeetPublishIntent.make({ paths: stagedPaths });
});

const validatePublishIntentStillSafe = Effect.fn("Yeet.validatePublishIntentStillSafe")(function* (
  context: RepoRunContext,
  intent: YeetPublishIntent,
  stagedOnly: boolean
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const stagedPaths = yield* collectStagedPublishPaths(context.repoRoot);
  const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);
  const unexpectedStagedPaths = publishPathsOutsideIntent(intent.paths, stagedPaths);
  const unexpectedUnstagedPaths = publishPathsOutsideIntent(intent.paths, unstagedPaths);

  if (!stagedOnly && !A.isReadonlyArrayEmpty(untrackedPaths)) {
    return yield* failPublishScopeWithPacket(context, {
      message: "yeet publish stopped because new untracked files appeared during quality.",
      paths: untrackedPaths,
      remediation: "Inspect the new files; stage them as reviewed intent or remove them, then rerun.",
      subCategory: "untracked-during-quality",
    });
  }

  if (!A.isReadonlyArrayEmpty(unexpectedStagedPaths)) {
    return yield* failPublishScopeWithPacket(context, {
      message: "yeet publish stopped because new staged paths appeared outside the reviewed intent.",
      paths: unexpectedStagedPaths,
      remediation: "Unstage the unexpected paths or restart publish with the expanded reviewed intent.",
      subCategory: "staged-outside-intent",
    });
  }

  if (!stagedOnly && !A.isReadonlyArrayEmpty(unexpectedUnstagedPaths)) {
    return yield* failPublishScopeWithPacket(context, {
      message: "yeet publish stopped because quality changed paths outside the reviewed intent.",
      paths: unexpectedUnstagedPaths,
      remediation: "Review the quality-written changes; stage them as intent or revert them, then rerun.",
      subCategory: "unstaged-outside-intent",
    });
  }
});

const collectExistingPublishIntentPaths = Effect.fn("Yeet.collectExistingPublishIntentPaths")(function* (
  context: RepoRunContext,
  intent: YeetPublishIntent
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const existingPaths = yield* Effect.forEach(intent.paths, (filePath) =>
    pipe(
      fs.exists(path.join(context.repoRoot, filePath)),
      Effect.orElseSucceed(() => false),
      Effect.map((exists) => (exists ? O.some(filePath) : O.none()))
    )
  );
  return pipe(existingPaths, A.getSomes, sortedUniquePaths);
});

const stageReviewedPublishIntent = Effect.fn("Yeet.stageReviewedPublishIntent")(function* (
  context: RepoRunContext,
  intent: YeetPublishIntent,
  stagedOnly: boolean
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* validatePublishIntentStillSafe(context, intent, stagedOnly);
  const existingPaths = yield* collectExistingPublishIntentPaths(context, intent);
  const restagePaths = publishRestagePaths(intent.paths, existingPaths);
  if (!A.isReadonlyArrayEmpty(restagePaths)) {
    yield* runGitOutput(context.repoRoot, ["add", "--", ...restagePaths]);
  }
  yield* validatePublishIntentStillSafe(context, intent, stagedOnly);

  const stagedPaths = yield* collectStagedPublishPaths(context.repoRoot);
  if (A.isReadonlyArrayEmpty(stagedPaths)) {
    return yield* YeetCommandError.make({
      message: "yeet publish has no staged changes after reviewed staging.",
      command: "git diff --cached --name-only",
      exitCode: 1,
    });
  }
});

const postCommitProofChangedBeforePushMessage =
  "yeet publish stopped because the full proof changed files after the local commit. Regenerate them, then amend or reset the commit that has not yet been pushed before retrying.";

const postCommitProofChangedAfterEarlyPushMessage =
  "yeet publish --start-pr-early stopped because the full proof changed files after the commit was already pushed. Commit a follow-up fix and publish again.";

const validatePostCommitProofDidNotChangeWorktree = Effect.fn("Yeet.validatePostCommitProofDidNotChangeWorktree")(
  function* (
    context: RepoRunContext,
    message = postCommitProofChangedBeforePushMessage
  ): Effect.fn.Return<
    void,
    YeetCommandError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    const stagedPaths = yield* collectStagedPublishPaths(context.repoRoot);
    const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
    const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);
    const changedPaths = sortedUniquePaths([...stagedPaths, ...unstagedPaths, ...untrackedPaths]);

    if (!A.isReadonlyArrayEmpty(changedPaths)) {
      return yield* failPublishScopeWithPacket(context, {
        message,
        paths: changedPaths,
        remediation:
          "Inspect the proof-written files; regenerate or commit them as a follow-up, then retry the publish.",
        subCategory: "proof-changed-worktree",
      });
    }
  }
);

const isEscapedQuote = (output: string, index: number): boolean => {
  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && output[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
};

// Single forward pass that records every balanced top-level `{...}` span.
// Tracking brace depth and string state once is O(n); the previous
// per-closing-brace backward rescan was O(n^2) on output with many unmatched
// `}` characters and let a large untruncated subprocess buffer hang the CLI.
// The brace-depth/string-state machine is intentionally inlined as one linear
// scan; splitting it would break the single-pass O(n) guarantee that bounds the
// CLI hang fix.
// fallow-ignore-next-line complexity
const balancedTopLevelObjectSpans = (output: string): ReadonlyArray<readonly [number, number]> => {
  let spans = A.empty<readonly [number, number]>();
  let depth = 0;
  let openIndex = -1;
  let inString = false;
  const length = Str.length(output);

  for (let cursor = 0; cursor < length; cursor += 1) {
    const char = output[cursor];
    if (char === '"' && !isEscapedQuote(output, cursor)) {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        openIndex = cursor;
      }
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        spans = A.append(spans, [openIndex, cursor + 1] as const);
      }
    }
  }

  return spans;
};

const jsonObjectTextFromMixedOutput = (output: string): O.Option<string> =>
  pipe(
    balancedTopLevelObjectSpans(output),
    A.reverse,
    A.map(([start, end]) => Str.slice(start, end)(output)),
    A.findFirst((candidate) => O.isSome(decodeJsonTextOption(candidate)))
  );

/**
 * Extract the last decodable JSON object from mixed command output for tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const jsonObjectTextFromMixedOutputForTesting = jsonObjectTextFromMixedOutput;

const runTurboQueryJson = Effect.fn("Yeet.runTurboQueryJson")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>,
  label: string
): Effect.fn.Return<
  string,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const turbo = yield* resolveLocalRepoBinary(repoRoot, "turbo");
  const result = yield* runRepoCommandCapture(turbo, args, repoRoot).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to run ${label}.`))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `${label} failed with exit code ${result.exitCode}.`,
      command: `${turbo} ${A.join(args, " ")}`,
      exitCode: result.exitCode,
    });
  }
  if (result.truncated) {
    return yield* YeetCommandError.make({
      message: `${label} output exceeded the repo-run capture limit.`,
      command: `${turbo} ${A.join(args, " ")}`,
      exitCode: 1,
    });
  }

  return yield* pipe(
    jsonObjectTextFromMixedOutput(result.output),
    O.match({
      onNone: () =>
        Effect.fail(
          YeetCommandError.make({
            message: `${label} did not emit a JSON object.`,
            command: `${turbo} ${A.join(args, " ")}`,
            exitCode: 1,
          })
        ),
      onSome: Effect.succeed,
    })
  );
});

const collectTurboVersion = Effect.fn("Yeet.collectTurboVersion")(function* (
  repoRoot: string
): Effect.fn.Return<
  O.Option<string>,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const turbo = yield* resolveLocalRepoBinary(repoRoot, "turbo");
  const result = yield* runRepoCommandCapture(turbo, ["--version"], repoRoot).pipe(Effect.option);
  return pipe(
    result,
    O.filter((output) => output.exitCode === 0),
    O.map((output) => Str.trim(output.output)),
    O.filter(Str.isNonEmpty)
  );
});

const packagePathsByName = (document: TurboQueryLsDocument): Record<string, string> =>
  pipe(
    document.packages.items,
    A.map((pkg) => [pkg.name, pkg.path] as const),
    R.fromEntries
  );

const turboWorkspacePackageFromQueryPackage = (pkg: TurboQueryPackage): TurboWorkspacePackage =>
  TurboWorkspacePackage.make({
    name: pkg.name,
    path: pkg.path,
  });

const turboWorkspacePackagesFromQueryDocument = (
  document: TurboQueryLsDocument
): ReadonlyArray<TurboWorkspacePackage> => pipe(document.packages.items, A.map(turboWorkspacePackageFromQueryPackage));

const turboPlanTaskFromAffectedTask =
  (pathsByName: Record<string, string>) =>
  (task: TurboQueryAffectedTask): TurboPlanTask => {
    const packagePath = R.get(pathsByName, task.package.name);
    return TurboPlanTask.make({
      taskId: task.fullName,
      packageName: task.package.name,
      task: task.name,
      ...(O.isSome(packagePath) ? { packagePath: packagePath.value } : {}),
    });
  };

const turboPlanTasksFromQueryDocuments = (
  affectedDocument: TurboQueryAffectedDocument,
  packageDocument: TurboQueryLsDocument
): ReadonlyArray<TurboPlanTask> => {
  const pathsByName = packagePathsByName(packageDocument);
  return pipe(affectedDocument.data.affectedTasks.items, A.map(turboPlanTaskFromAffectedTask(pathsByName)));
};

const collectAffectedFeedbackTasks = Effect.fn("Yeet.collectAffectedFeedbackTasks")(function* (
  repoRoot: string,
  options: YeetRunOptions,
  packageDocument: TurboQueryLsDocument
): Effect.fn.Return<
  ReadonlyArray<TurboPlanTask>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!shouldCollectAffectedFeedbackTasks(options.mode)) {
    return [];
  }

  const affectedJson = yield* runTurboQueryJson(
    repoRoot,
    ["query", "affected", "--tasks", ...YEET_FEEDBACK_TASKS, "--base", options.base, "--head", options.head],
    "turbo query affected"
  );
  const affectedDocument = yield* decodeTurboQueryAffectedDocument(affectedJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo affected query JSON."))
  );
  return turboPlanTasksFromQueryDocuments(affectedDocument, packageDocument);
});

const decodeTurboPlanTasksFromQueryJson = Effect.fn("Yeet.decodeTurboPlanTasksFromQueryJson")(function* (
  affectedJson: string,
  packageJson: string
): Effect.fn.Return<ReadonlyArray<TurboPlanTask>, YeetCommandError> {
  const affectedDocument = yield* decodeTurboQueryAffectedDocument(affectedJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo affected query JSON."))
  );
  const packageDocument = yield* decodeTurboQueryLsDocument(packageJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo package query JSON."))
  );
  return turboPlanTasksFromQueryDocuments(affectedDocument, packageDocument);
});

/**
 * Decode Turbo query JSON into Yeet Turbo plan task metadata for focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const decodeTurboPlanTasksFromQueryJsonForTesting = decodeTurboPlanTasksFromQueryJson;

const collectTurboPlanSnapshot = Effect.fn("Yeet.collectTurboPlanSnapshot")(function* (
  repoRoot: string,
  options: YeetRunOptions
): Effect.fn.Return<
  TurboPlanSnapshot,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const turboVersion = yield* collectTurboVersion(repoRoot);
  const packageJson = yield* runTurboQueryJson(repoRoot, ["query", "ls", "--output", "json"], "turbo query ls");
  const packageDocument = yield* decodeTurboQueryLsDocument(packageJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo package query JSON."))
  );
  const tasks = yield* collectAffectedFeedbackTasks(repoRoot, options, packageDocument);
  const packages = turboWorkspacePackagesFromQueryDocument(packageDocument);

  return TurboPlanSnapshot.make({
    ...emptyTurboPlanSnapshot([]),
    ...(O.isSome(turboVersion) ? { turboVersion: turboVersion.value } : {}),
    packages,
    tasks,
  });
});

/**
 * Hydrate a shared yeet run context from repository state.
 *
 * @param options - Runtime options.
 * @returns Shared run context.
 * @example
 * ```ts
 * import { defaultYeetRunOptions, hydrateYeetRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = hydrateYeetRunContext(defaultYeetRunOptions({ plan: true }))
 * console.log(context)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const hydrateYeetRunContext = Effect.fn("Yeet.hydrateYeetRunContext")(function* (
  options: YeetRunOptions
): Effect.fn.Return<
  RepoRunContext,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repo root.")));
  const branch = yield* runGitOutput(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]).pipe(Effect.map(Str.trim));
  if (options.mode === "pre-push-hook") {
    return RepoRunContext.make({
      repoRoot,
      cwd: process.cwd(),
      base: options.base,
      head: options.head,
      branch,
      packetDir: options.packetDir,
      originalArgv: [],
      turbo: emptyTurboPlanSnapshot([]),
    });
  }

  if (options.mode === "status") {
    if (options.remote) {
      yield* refreshBaseRef(repoRoot, options.base);
    }
    return RepoRunContext.make({
      repoRoot,
      cwd: process.cwd(),
      base: options.base,
      head: options.head,
      branch,
      packetDir: options.packetDir,
      originalArgv: [],
      turbo: emptyTurboPlanSnapshot([]),
    });
  }

  yield* refreshBaseRef(repoRoot, options.base);
  const turbo = yield* collectTurboPlanSnapshot(repoRoot, options);

  return RepoRunContext.make({
    repoRoot,
    cwd: process.cwd(),
    base: options.base,
    head: options.head,
    branch,
    packetDir: options.packetDir,
    originalArgv: [],
    turbo,
  });
});

const proofLockPathForContext = Effect.fn("Yeet.proofLockPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "quality-lock");
});

const readFingerprintFileBytes = Effect.fn("Yeet.readFingerprintFileBytes")(function* (
  filePath: string
): Effect.fn.Return<Uint8Array, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFile(filePath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read Yeet fingerprint artifact ${filePath}.`)));
});

const collectGitDiffBytes = Effect.fn("Yeet.collectGitDiffBytes")(function* (
  context: RepoRunContext,
  args: ReadonlyArray<string>,
  fileName: string
): Effect.fn.Return<
  Uint8Array,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  const requestedPath = yield* runOutputPathForContext(context, `fingerprint-${process.pid}-${fileName}.patch`);
  yield* fs
    .makeDirectory(path.dirname(requestedPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create Yeet fingerprint directory for ${requestedPath}.`)));

  // Fail closed if the fingerprint target (or a symlink at that path) resolves
  // outside the Yeet artifact tree, so `git diff --output` cannot be redirected
  // through a symlink to clobber a file outside the run directory.
  const diffPath = yield* resolvePathWithinRoot({ root: artifactDir, candidate: requestedPath }).pipe(
    Effect.mapError(YeetCommandError.new(`Refused unsafe Yeet fingerprint artifact path ${requestedPath}.`))
  );

  return yield* Effect.gen(function* () {
    yield* runGitOutput(context.repoRoot, ["diff", "--binary", `--output=${diffPath}`, ...args]);
    return yield* readFingerprintFileBytes(diffPath);
  }).pipe(Effect.ensuring(fs.remove(diffPath).pipe(Effect.ignore)));
});

const collectDiffFingerprint = Effect.fn("Yeet.collectDiffFingerprint")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  string,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const status = yield* runGitOutput(context.repoRoot, ["status", "--short"]);
  const unstagedDiff = yield* collectGitDiffBytes(context, ["HEAD"], "worktree");
  const stagedDiff = yield* collectGitDiffBytes(context, ["--cached"], "index");
  return createHash("sha256")
    .update(status)
    .update("\0")
    .update(unstagedDiff)
    .update("\0")
    .update(stagedDiff)
    .digest("hex");
});

/**
 * Collect the reusable-proof fingerprint for the current Git worktree.
 *
 * @category testing
 * @since 0.0.0
 */
export const collectDiffFingerprintForTesting = collectDiffFingerprint;

const currentCommitSha = (context: RepoRunContext) =>
  runGitOutput(context.repoRoot, ["rev-parse", "HEAD"]).pipe(Effect.map(Str.trim));

const proofCommandForSteps: (steps: ReadonlyArray<RepoPlanStep>) => string = flow(
  A.map(commandTextForStep),
  A.join(" && ")
);

const hashText = (text: string): string => createHash("sha256").update(text).digest("hex");

const laneProofStateForStep = (step: RepoPlanStep, diffFingerprint: string, verifiedAt: string): YeetLaneProofState => {
  const commandText = commandTextForStep(step);
  return YeetLaneProofState.make({
    commandHash: hashText(commandText),
    commandText,
    diffFingerprint,
    label: step.label,
    stepId: step.id,
    verifiedAt,
  });
};

/**
 * Proof-lock state schema exposed for lock-disposition tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const YeetProofLockStateForTesting = YeetProofLockState;

const decodeProofLockState = S.decodeUnknownEffect(S.fromJsonString(YeetProofLockState));

const isPidAlive = (pid: number): Effect.Effect<boolean> =>
  Effect.sync(() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  });

const proofLockDisposition = (
  state: O.Option<YeetProofLockState>,
  ownerAlive: boolean
): "replace-stale" | "refuse-active" | "refuse-unreadable" =>
  O.isNone(state) ? "refuse-unreadable" : ownerAlive ? "refuse-active" : "replace-stale";

/**
 * Decide whether an existing proof lock is stale, active, or unreadable.
 *
 * @category testing
 * @since 0.0.0
 */
export const proofLockDispositionForTesting = proofLockDisposition;

// Atomic exclusive create: succeeds only when this process is the one that
// created the lock. `flag: "wx"` maps to O_CREAT | O_EXCL so two concurrent
// proofs cannot both observe the lock as absent and enter the critical section.
const tryClaimProofLockExclusive = Effect.fn("Yeet.tryClaimProofLockExclusive")(function* (
  lockPath: string,
  lockText: string
): Effect.fn.Return<boolean, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.writeFileString(lockPath, lockText, { flag: "wx" }).pipe(
    Effect.as(true),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "AlreadyExists"
        ? Effect.succeed(false)
        : Effect.fail(YeetCommandError.new(`Failed to atomically create Yeet proof lock at ${lockPath}.`)(error))
    )
  );
});

const acquireFullProofLock = Effect.fn("Yeet.acquireFullProofLock")(function* (
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = yield* proofLockPathForContext(context);
  yield* fs
    .makeDirectory(path.dirname(lockPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create Yeet proof lock directory for ${lockPath}.`)));
  const lockState = YeetProofLockState.make({
    schemaVersion: "yeet-proof-lock/v1",
    branch: context.branch,
    command: proofCommandForSteps(proofSteps),
    pid: process.pid,
    proofTier: "full",
    startedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
  });
  const lockText = `${yield* renderJson(lockState)}\n`;

  if (yield* tryClaimProofLockExclusive(lockPath, lockText)) {
    return lockPath;
  }

  const existingText = yield* fs.readFileString(lockPath).pipe(Effect.orElseSucceed(() => ""));
  const existingState = yield* decodeProofLockState(existingText).pipe(
    Effect.map(O.some),
    Effect.orElseSucceed(O.none<YeetProofLockState>)
  );
  const ownerAlive = yield* pipe(
    existingState,
    O.match({
      onNone: () => Effect.succeed(false),
      onSome: (state) => isPidAlive(state.pid),
    })
  );

  if (proofLockDisposition(existingState, ownerAlive) === "replace-stale" && O.isSome(existingState)) {
    yield* Console.error(
      `[yeet] removing stale full-proof lock (pid ${existingState.value.pid} is not running, started ${existingState.value.startedAt})`
    );
    yield* fs.remove(lockPath).pipe(Effect.ignore);
    // Re-claim atomically; if another contender won the race after we removed
    // the stale lock, fail closed rather than overwrite an active lock.
    if (yield* tryClaimProofLockExclusive(lockPath, lockText)) {
      return lockPath;
    }
  }

  const ownerDetail = pipe(
    existingState,
    O.match({
      onNone: () => "",
      onSome: (state) => ` Owner pid ${state.pid} started ${state.startedAt}.`,
    })
  );
  return yield* YeetCommandError.make({
    message: `Another Yeet full proof appears active at ${lockPath}.${ownerDetail}\n${existingText}\nRun review-fix lanes or remove the stale lock after confirming no full proof is running.`,
    command: "bun run beep yeet verify",
    exitCode: 1,
  });
});

const releaseProofLock = Effect.fn("releaseProofLock")(function* (lockPath: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(lockPath).pipe(Effect.ignore);
});

const runProofPhase = Effect.fn("Yeet.runProofPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  tier: YeetProofTier,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  ReadonlyArray<RepoStepRunResult>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (tier !== "full") {
    return yield* runPhase(context, steps, recorder);
  }

  return yield* Effect.acquireUseRelease(
    acquireFullProofLock(context, steps),
    () => runPhase(context, steps, recorder),
    releaseProofLock
  );
});

const writeVerifiedState = Effect.fn("Yeet.writeVerifiedState")(function* (
  context: RepoRunContext,
  tier: YeetProofTier,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const artifactDir = yield* artifactDirForContext(context);
  const statePath = yield* runStatePathForContext(context);
  const diffFingerprint = yield* collectDiffFingerprint(context);
  const verifiedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const state = YeetRunState.make({
    schemaVersion: "yeet-run-state/v1",
    artifactDir,
    base: context.base,
    branch: context.branch,
    commitSha: yield* currentCommitSha(context),
    diffFingerprint,
    head: context.head,
    laneProofs: A.map(proofSteps, (step) => laneProofStateForStep(step, diffFingerprint, verifiedAt)),
    proofCommand: proofCommandForSteps(proofSteps),
    proofTier: tier,
    runId: runIdForContext(context),
    verifiedAt,
  });
  yield* writeTextFile(statePath, `${yield* renderJson(state)}\n`);
});

const legacyRunStatePathForContext = Effect.fn("Yeet.legacyRunStatePathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "runs", safeArtifactName(context.branch), "state.json");
});

const verifiedStateArtifactForPath =
  (path: string) =>
  (text: string): Readonly<{ readonly path: string; readonly text: string }> => ({ path, text });

const loadVerifiedState = Effect.fn("Yeet.loadVerifiedState")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetRunState, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const statePath = yield* runStatePathForContext(context);
  const legacyStatePath = yield* legacyRunStatePathForContext(context);
  const readState = (path: string) =>
    fs
      .readFileString(path)
      .pipe(
        Effect.map(verifiedStateArtifactForPath(path)),
        Effect.map(O.some),
        Effect.orElseSucceed(O.none<{ readonly path: string; readonly text: string }>)
      );
  const primary = yield* readState(statePath);
  const selected = O.isSome(primary) ? primary : yield* readState(legacyStatePath);
  if (O.isNone(selected)) {
    const fallbackDetail = legacyStatePath === statePath ? "" : ` or legacy path ${legacyStatePath}`;
    return yield* YeetCommandError.make({
      message: `No reusable Yeet proof state found at ${statePath}${fallbackDetail}.`,
      exitCode: 1,
    });
  }
  return yield* decodeYeetRunState(selected.value.text).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode reusable Yeet proof state at ${selected.value.path}.`))
  );
});

/**
 * Expose proof-state loading for upgrade compatibility tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const loadVerifiedStateForTesting = loadVerifiedState;

const assertReusableVerifiedState = Effect.fn("Yeet.assertReusableVerifiedState")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const state = yield* loadVerifiedState(context);
  const expectedCommitSha = yield* currentCommitSha(context);
  const expectedFingerprint = yield* collectDiffFingerprint(context);
  const mismatch = [
    ...(state.branch === context.branch ? [] : [`branch ${state.branch} != ${context.branch}`]),
    ...(state.base === context.base ? [] : [`base ${state.base} != ${context.base}`]),
    ...(state.head === context.head ? [] : [`head ${state.head} != ${context.head}`]),
    ...(state.commitSha === expectedCommitSha ? [] : [`commit ${state.commitSha} != ${expectedCommitSha}`]),
    ...(state.diffFingerprint === expectedFingerprint ? [] : ["diff fingerprint changed"]),
    ...(state.proofTier === "full" ? [] : [`proof tier ${state.proofTier} is not full`]),
  ];

  if (A.isReadonlyArrayEmpty(mismatch)) {
    yield* Console.log(`[yeet] reusing full proof state from ${state.verifiedAt}`);
    return;
  }

  return yield* YeetCommandError.make({
    message: `yeet publish --reuse-verified found stale proof state:\n${A.join(
      A.map(mismatch, (line) => `  - ${line}`),
      "\n"
    )}\nRun \`bun run beep yeet verify\` against the exact current worktree before retrying.`,
    exitCode: 1,
  });
});

const rawOutputPathForStep = Effect.fn("Yeet.rawOutputPathForStep")(function* (
  context: RepoRunContext,
  step: RepoPlanStep
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "logs", `${safeArtifactName(step.id)}.log`);
});

const executeStepWithArtifacts = Effect.fn("Yeet.executeStepWithArtifacts")(function* (
  context: RepoRunContext,
  step: RepoPlanStep
): Effect.fn.Return<
  RepoStepRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const rawOutputPath = yield* rawOutputPathForStep(context, step);
  return yield* executeRepoPlanStepStreaming(step, O.some(rawOutputPath)).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to execute ${step.label}.`))
  );
});

const writeTextFile = Effect.fn("Yeet.writeTextFile")(function* (
  filePath: string,
  content: string
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(filePath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create directory for "${filePath}".`)));
  yield* fs
    .writeFileString(filePath, content)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write "${filePath}".`)));
});

const writeIssueArtifacts = Effect.fn("Yeet.writeIssueArtifacts")(function* (
  context: RepoRunContext,
  index: QualityIssueIndex
): Effect.fn.Return<YeetRunResult, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  const indexPath = path.join(artifactDir, "quality-issue-index.json");
  yield* writeTextFile(indexPath, `${yield* renderJson(index)}\n`);

  const writePackagePacket = Effect.fnUntraced(function* (
    report: PackageQualityReport
  ): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
    const markdown = yield* pipe(
      renderPackageQualityPacketMarkdown(report),
      Result.match({
        onFailure: (error) => Effect.fail(YeetCommandError.make({ message: error.message })),
        onSuccess: Effect.succeed,
      })
    );
    const packetPath = path.join(artifactDir, "packets", `${safeArtifactName(report.packageName)}.md`);
    yield* writeTextFile(packetPath, markdown);
    return packetPath;
  });

  const packetPaths = yield* Effect.forEach(index.packages, writePackagePacket);

  return YeetRunResult.make({
    artifactDir,
    committed: false,
    pushed: false,
    packetPaths,
    indexPath,
  });
});

const issuesFromResults = (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  results: ReadonlyArray<RepoStepRunResult>
): ReadonlyArray<QualityIssue> =>
  pipe(
    results,
    A.flatMap((result) =>
      pipe(
        A.findFirst(steps, (step) => step.id === result.stepId),
        O.map((step) => qualityIssuesFromStepResult(context, step, result)),
        O.getOrElse(A.empty<QualityIssue>)
      )
    )
  );

const publishResult = Effect.fn("Yeet.publishResult")(function* (
  context: RepoRunContext,
  committed: boolean
): Effect.fn.Return<YeetRunResult, never, Path.Path> {
  const artifactDir = yield* artifactDirForContext(context);
  return YeetRunResult.make({
    artifactDir,
    committed,
    pushed: true,
    packetPaths: [],
  });
});

const commitMessagePathForContext = Effect.fn("Yeet.commitMessagePathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "commit-message.txt");
});

const emptyPlanResult = Effect.fn("Yeet.emptyPlanResult")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetRunResult, never, Path.Path> {
  const artifactDir = yield* artifactDirForContext(context);
  return YeetRunResult.make({
    artifactDir,
    committed: false,
    pushed: false,
    packetPaths: [],
  });
});

const validateRequiredMessage = (options: YeetRunOptions): Effect.Effect<O.Option<string>, YeetCommandError> => {
  const message = optionFromNonEmpty(options.message);
  if (
    options.plan ||
    options.mode !== "publish" ||
    O.isSome(message) ||
    (options.amend && options.noEdit) ||
    options.pushOnly
  ) {
    return Effect.succeed(message);
  }
  return Effect.fail(
    YeetCommandError.make({
      message: "yeet publish requires --message with a conventional commit message unless --plan is used.",
      exitCode: 1,
    })
  );
};

const validateCommitMessage = Effect.fn("Yeet.validateCommitMessage")(function* (
  context: RepoRunContext,
  message: string
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const commitlint = yield* resolveLocalRepoBinary(context.repoRoot, "commitlint");
  const messagePath = yield* commitMessagePathForContext(context);
  yield* writeTextFile(messagePath, `${message}\n`);
  const result = yield* runRepoCommandCapture(commitlint, ["--edit", messagePath], context.repoRoot).pipe(
    Effect.mapError(YeetCommandError.new("Failed to run commitlint."))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `commit message failed commitlint:\n${result.output}`,
      command: `${commitlint} --edit ${messagePath}`,
      exitCode: result.exitCode,
    });
  }
});

const runPhase = Effect.fn("Yeet.runPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  ReadonlyArray<RepoStepRunResult>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.forEach(
    steps,
    (step) =>
      executeStepWithArtifacts(context, step).pipe(
        Effect.tap((result) => Ref.update(recorder, A.append(YeetExecutedStep.make({ result, step }))))
      ),
    { concurrency: 1 }
  );
});

const failWithIssueArtifacts = Effect.fn("Yeet.failWithIssueArtifacts")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  results: ReadonlyArray<RepoStepRunResult>,
  message: string
): Effect.fn.Return<never, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const index = buildQualityIssueIndex(issuesFromResults(context, steps, results));
  const artifacts = yield* writeIssueArtifacts(context, index);
  yield* Console.error(`${message}\nYeet quality packets written to ${artifacts.artifactDir}`);
  for (const packetPath of artifacts.packetPaths) {
    yield* Console.error(`  - ${packetPath}`);
  }
  const firstFailure = A.findFirst(results, (result) => result.exitCode !== 0);
  return yield* pipe(
    firstFailure,
    O.map((result) => commandFailure(result, message)),
    O.getOrElse(() => YeetCommandError.make({ message }))
  );
});

const runVerifyMode = Effect.fn("Yeet.runVerifyMode")(function* (
  context: RepoRunContext,
  fullSteps: ReadonlyArray<RepoPlanStep>,
  tier: YeetProofTier,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const verifyResults = yield* runProofPhase(context, fullSteps, tier, recorder);
  if (A.some(verifyResults, (result) => result.exitCode !== 0)) {
    return yield* failWithIssueArtifacts(context, fullSteps, verifyResults, "yeet verification proof failed.");
  }
  yield* writeVerifiedState(context, tier, fullSteps);
  return yield* emptyPlanResult(context);
});

const runRequiredPhase = Effect.fn("Yeet.runRequiredPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  failureMessage: string
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const results = yield* runPhase(context, steps, recorder);
  if (A.some(results, (result) => result.exitCode !== 0)) {
    return yield* failWithIssueArtifacts(context, steps, results, failureMessage);
  }
});

const shouldSkipCommitForReusablePublish = Effect.fn("Yeet.shouldSkipCommitForReusablePublish")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  boolean,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!options.reuseVerified || (!options.pushOnly && (!options.amend || !options.noEdit))) {
    return false;
  }

  const stagedPaths = yield* collectStagedPublishPaths(context.repoRoot);
  if (!A.isReadonlyArrayEmpty(stagedPaths)) {
    if (options.pushOnly) {
      return yield* failPublishScopeWithPacket(context, {
        message:
          "yeet publish --push-only --reuse-verified refuses staged changes. Commit or unstage these files before pushing an already-verified commit.",
        paths: stagedPaths,
        remediation: "Commit the staged files through a normal publish, or unstage them, then retry --push-only.",
        subCategory: "reuse-staged",
      });
    }
    return false;
  }

  const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);
  const changedPaths = sortedUniquePaths([...unstagedPaths, ...untrackedPaths]);
  if (!A.isReadonlyArrayEmpty(changedPaths)) {
    return yield* failPublishScopeWithPacket(context, {
      message: options.pushOnly
        ? "yeet publish --push-only --reuse-verified found uncommitted changes."
        : "yeet publish --reuse-verified found uncommitted changes but no staged amend intent.",
      paths: changedPaths,
      remediation:
        "Commit, stash, or remove the uncommitted changes so the worktree exactly matches the verified commit, then retry.",
      subCategory: "reuse-dirty",
    });
  }

  return true;
});

/**
 * Decide whether a reusable publish should skip the commit phase.
 *
 * @category testing
 * @since 0.0.0
 */
export const shouldSkipCommitForReusablePublishForTesting = shouldSkipCommitForReusablePublish;

const runPublishMode = Effect.fn("Yeet.runPublishMode")(function* (
  plan: RepoRunPlan,
  message: O.Option<string>,
  options: YeetRunOptions,
  commitSteps: ReadonlyArray<RepoPlanStep>,
  fullSteps: ReadonlyArray<RepoPlanStep>,
  earlyPublishSteps: ReadonlyArray<RepoPlanStep>,
  publishSteps: ReadonlyArray<RepoPlanStep>,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const skipCommit = yield* shouldSkipCommitForReusablePublish(plan.context, options);
  if (options.reuseVerified) {
    yield* assertReusableVerifiedState(plan.context);
  }

  const freshness = yield* enforceBaseFreshness(plan.context, options);
  yield* Ref.update(extras, (state) => ({ ...state, baseFreshness: O.some(freshness) }));

  let stash: O.Option<YeetStashState> = O.none();
  if (skipCommit) {
    yield* Console.log("[yeet] skipped commit; exact reusable proof state matches the current clean commit");
  } else {
    const publishIntent = yield* collectPublishIntent(plan.context, options.stagedOnly);
    if (O.isSome(message)) {
      yield* validateCommitMessage(plan.context, message.value);
    }
    yield* stageReviewedPublishIntent(plan.context, publishIntent, options.stagedOnly);

    // Park unstaged/untracked residue (keeping the reviewed index) BEFORE the
    // commit, so a commit hook that broadly stages files cannot capture residue
    // outside the reviewed intent into the published commit.
    if (options.stagedOnly) {
      stash = yield* stashUnstagedWorktree(plan.context);
      yield* Ref.update(extras, (state) => ({ ...state, stash }));
    }

    const commitResults = yield* runPhase(plan.context, commitSteps, recorder);
    if (A.some(commitResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, commitSteps, commitResults, "yeet commit phase failed.");
    }
  }

  const runPostCommitPhases = Effect.gen(function* () {
    if (options.startPrEarly) {
      yield* Console.log(
        "[yeet] start-pr-early: pushing before local proof; full proof and hosted monitor remain required"
      );
      yield* warnOnMismatchedPublishUpstream(plan.context);
      const earlyPushSteps = A.filter(earlyPublishSteps, (step) => step.id !== "publish:02-pr-create");
      const earlyPublishResults = yield* runPhase(plan.context, earlyPushSteps, recorder);
      if (A.some(earlyPublishResults, (result) => result.exitCode !== 0)) {
        return yield* failWithIssueArtifacts(
          plan.context,
          earlyPushSteps,
          earlyPublishResults,
          "yeet start-pr-early push phase failed."
        );
      }

      if (options.pr) {
        yield* ensurePullRequest(
          plan.context,
          recorder,
          A.findFirst(plan.steps, (step) => step.id === "publish:02-pr-create")
        );
      }

      const fullResults = yield* runProofPhase(plan.context, fullSteps, "full", recorder);
      if (A.some(fullResults, (result) => result.exitCode !== 0)) {
        return yield* failWithIssueArtifacts(
          plan.context,
          fullSteps,
          fullResults,
          "yeet publish --start-pr-early proof failed after pushing the commit. Fix the issue in a follow-up commit and publish again."
        );
      }
      yield* writeVerifiedState(plan.context, "full", fullSteps);
      yield* validatePostCommitProofDidNotChangeWorktree(plan.context, postCommitProofChangedAfterEarlyPushMessage);

      return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, options, skipCommit);
    }

    if (!options.reuseVerified) {
      const fullResults = yield* runProofPhase(plan.context, fullSteps, "full", recorder);
      if (A.some(fullResults, (result) => result.exitCode !== 0)) {
        return yield* failWithIssueArtifacts(
          plan.context,
          fullSteps,
          fullResults,
          "yeet publish proof failed after creating the local commit. Fix the issue, then amend or reset the commit that has not yet been pushed before retrying."
        );
      }
      yield* writeVerifiedState(plan.context, "full", fullSteps);
    } else {
      yield* Console.log("[yeet] skipped local full proof after exact reusable proof-state match");
    }
    yield* validatePostCommitProofDidNotChangeWorktree(plan.context);

    yield* warnOnMismatchedPublishUpstream(plan.context);
    const pushSteps = A.filter(publishSteps, (step) => step.id !== "publish:02-pr-create");
    const publishResults = yield* runPhase(plan.context, pushSteps, recorder);
    if (A.some(publishResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, pushSteps, publishResults, "yeet publish phase failed.");
    }

    if (options.pr) {
      yield* ensurePullRequest(
        plan.context,
        recorder,
        A.findFirst(plan.steps, (step) => step.id === "publish:02-pr-create")
      );
    }

    return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, options, skipCommit);
  });

  return yield* pipe(
    stash,
    O.match({
      onNone: () => runPostCommitPhases,
      onSome: (state) => runPostCommitPhases.pipe(Effect.ensuring(restoreStashedWorktree(plan.context, state))),
    })
  );
});

const readPrePushHookStdin = Effect.fn("Yeet.readPrePushHookStdin")(function* (): Effect.fn.Return<
  string,
  YeetCommandError
> {
  if (process.stdin.isTTY) {
    return "";
  }

  return yield* Effect.tryPromise({
    try: () => Bun.stdin.text(),
    catch: (cause) =>
      YeetCommandError.make({
        message: `Failed to read git pre-push stdin: ${cause instanceof Error ? cause.message : String(cause)}`,
        exitCode: 1,
      }),
  });
});

const runPrePushHookMode = Effect.fn("Yeet.runPrePushHookMode")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const currentSha = yield* currentCommitSha(context);
  const stdinText = yield* readPrePushHookStdin();
  const pushedLocalShas = prePushLocalShasFromStdin(stdinText);
  const localShas = A.isReadonlyArrayEmpty(pushedLocalShas) ? [currentSha] : pushedLocalShas;
  const mismatchedShas = prePushShaMismatches(localShas, currentSha);

  if (!A.isReadonlyArrayEmpty(mismatchedShas)) {
    return yield* YeetCommandError.make({
      message: `yeet pre-push-hook cannot reuse proof for pushed SHA(s) outside current HEAD:\n${formatPublishPaths(
        mismatchedShas
      )}`,
      command: "git push",
      exitCode: 1,
    });
  }

  yield* assertReusableVerifiedState(context);
  yield* Console.log(`[yeet] pre-push hook reused full proof for ${Str.slice(0, 12)(currentSha)}`);
  return yield* emptyPlanResult(context);
});

const runMonitorMode = Effect.fn("Yeet.runMonitorMode")(function* (
  context: RepoRunContext,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runMonitorPhase(context, monitorSteps, recorder, "yeet monitor failed.");
  if (options.summary) {
    yield* printOperatorStatusSummary(context, true);
  }
  return yield* emptyPlanResult(context);
});

const printOperatorStatusSummary = Effect.fn("Yeet.printOperatorStatusSummary")(function* (
  context: RepoRunContext,
  remote: boolean
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const snapshot = yield* collectYeetStatus(context, remote);
  yield* writeYeetStatusSnapshot(snapshot);
  yield* Console.log(renderYeetStatusSummary(snapshot));
});

const runMonitorPhase = Effect.fn("Yeet.runMonitorPhase")(function* (
  context: RepoRunContext,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  failureMessage: string
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runRequiredPhase(context, monitorSteps, recorder, failureMessage);
});

const runPublishMonitorAndResult = Effect.fn("Yeet.runPublishMonitorAndResult")(function* (
  context: RepoRunContext,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  options: YeetRunOptions,
  skipCommit: boolean
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runMonitorPhase(context, monitorSteps, recorder, "yeet publish monitor phase failed.");
  if (options.summary && !A.isReadonlyArrayEmpty(monitorSteps)) {
    yield* printOperatorStatusSummary(context, true);
  }
  return yield* publishResult(context, !skipCommit);
});

const runStatusMode = Effect.fn("Yeet.runStatusMode")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const snapshot = yield* collectYeetStatus(context, options.remote);
  yield* writeYeetStatusSnapshot(snapshot);
  if (options.json) {
    yield* printCommandJson(snapshot).pipe(Effect.mapError(YeetCommandError.new("Failed to print yeet status JSON.")));
  } else {
    yield* Console.log(renderYeetStatusSummary(snapshot));
  }
  return yield* emptyPlanResult(context);
});

const runCloseoutMode = Effect.fn("Yeet.runCloseoutMode")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const report = yield* runPrCloseout(
    context,
    PrCloseoutOptions.make({
      bots: options.bots,
      requireGreptileIssues: options.requireGreptileIssues,
      requireGreptileScore: options.requireGreptileScore,
      requireReviewComments: options.requireReviewComments,
      retriggerGreptile: options.retriggerGreptile,
      replyBody: options.replyBody,
      replyThread: options.replyThread,
      resolveThreads: options.resolveThreads,
    })
  );
  const reportPath = yield* runOutputPathForContext(context, "pr-closeout.json");
  yield* writeTextFile(reportPath, `${yield* renderJson(report)}\n`);
  yield* Console.log(`[yeet] PR closeout report written to ${reportPath}`);
  if (options.summary) {
    yield* printOperatorStatusSummary(context, true);
  }

  if (A.isReadonlyArrayEmpty(report.issues)) {
    return yield* emptyPlanResult(context);
  }

  const index = buildQualityIssueIndex(report.issues);
  const artifacts = yield* writeIssueArtifacts(context, index);
  yield* Console.error(
    `yeet PR closeout failed with ${report.issueCount} issue(s).\nYeet quality packets written to ${artifacts.artifactDir}`
  );
  for (const packetPath of artifacts.packetPaths) {
    yield* Console.error(`  - ${packetPath}`);
  }
  return yield* YeetCommandError.make({
    message: `yeet PR closeout failed with ${report.issueCount} issue(s).`,
    command: "bun run beep yeet closeout",
    exitCode: 1,
  });
});

type YeetVerdictExtras = {
  readonly baseFreshness: O.Option<YeetBaseFreshness>;
  readonly stash: O.Option<YeetStashState>;
};

const writeRunVerdict = Effect.fn("Yeet.writeRunVerdict")(function* (
  plan: RepoRunPlan,
  options: YeetRunOptions,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>,
  outcome: "success" | "failure",
  message: string,
  artifacts: O.Option<YeetRunResult>
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const executed = yield* Ref.get(recorder);
  const extraState = yield* Ref.get(extras);
  const createdAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const artifactDir = yield* artifactDirForContext(plan.context);
  const fallbackIndexPath = path.join(artifactDir, "quality-issue-index.json");
  const indexPath = yield* pipe(
    artifacts,
    O.flatMap((result) => O.fromUndefinedOr(result.indexPath)),
    O.match({
      onNone: () =>
        fs.exists(fallbackIndexPath).pipe(
          Effect.orElseSucceed(() => false),
          Effect.map((exists) => (exists ? O.some(fallbackIndexPath) : O.none<string>()))
        ),
      onSome: (value) => Effect.succeed(O.some(value)),
    })
  );

  const verdict = buildYeetVerdict({
    base: plan.context.base,
    baseFreshness: O.getOrUndefined(extraState.baseFreshness),
    branch: plan.context.branch,
    createdAt,
    executed,
    head: plan.context.head,
    indexPath: O.getOrUndefined(indexPath),
    message,
    mode: options.mode,
    outcome,
    packetPaths: pipe(
      artifacts,
      O.map((result) => result.packetPaths),
      O.getOrElse(A.empty<string>)
    ),
    planned: plan.steps,
    runId: runIdForContext(plan.context),
    stash: O.getOrUndefined(extraState.stash),
  });
  const verdictPath = yield* runOutputPathForContext(plan.context, "verdict.json");
  yield* writeTextFile(verdictPath, `${yield* renderJson(verdict)}\n`);
  yield* Console.log(`[yeet] verdict written to ${verdictPath}`);
});

const runPlanExecution = Effect.fn("Yeet.runPlanExecution")(function* (
  plan: RepoRunPlan,
  options: YeetRunOptions,
  message: O.Option<string>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const prepareSteps = A.filter(plan.steps, (step) => step.phase === "prepare");
  const feedbackSteps = A.filter(plan.steps, (step) => step.phase === "feedback");
  const commitSteps = A.filter(plan.steps, (step) => step.phase === "commit");
  const earlyPublishSteps = A.filter(plan.steps, (step) => step.phase === "early-publish");
  const fullSteps = A.filter(plan.steps, (step) => step.phase === "full");
  const publishSteps = A.filter(plan.steps, (step) => step.phase === "publish");
  const monitorSteps = A.filter(plan.steps, (step) => step.phase === "monitor");

  const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
  const extras = yield* Ref.make<YeetVerdictExtras>({ baseFreshness: O.none(), stash: O.none() });

  const execution = Effect.gen(function* () {
    const prepareResults = yield* runPhase(plan.context, prepareSteps, recorder);
    if (A.some(prepareResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, prepareSteps, prepareResults, "yeet prepare phase failed.");
    }

    const feedbackResults = yield* runPhase(plan.context, feedbackSteps, recorder);
    if (A.some(feedbackResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, feedbackSteps, feedbackResults, "yeet feedback phase failed.");
    }

    return yield* YeetRunMode.$match(options.mode, {
      repair: () => emptyPlanResult(plan.context),
      verify: () => runVerifyMode(plan.context, fullSteps, options.tier, recorder),
      publish: () =>
        runPublishMode(
          plan,
          message,
          options,
          commitSteps,
          fullSteps,
          earlyPublishSteps,
          publishSteps,
          monitorSteps,
          recorder,
          extras
        ),
      monitor: () => runMonitorMode(plan.context, monitorSteps, recorder, options),
      closeout: () => runCloseoutMode(plan.context, options),
      status: () => runStatusMode(plan.context, options),
      "pre-push-hook": () => runPrePushHookMode(plan.context),
    });
  });

  return yield* execution.pipe(
    Effect.tapError((error) =>
      options.mode === "status"
        ? Effect.void
        : writeRunVerdict(plan, options, recorder, extras, "failure", error.message, O.none()).pipe(Effect.ignore)
    ),
    Effect.tap((result) =>
      options.mode === "status"
        ? Effect.void
        : writeRunVerdict(
            plan,
            options,
            recorder,
            extras,
            "success",
            `yeet ${options.mode} succeeded.`,
            O.some(result)
          ).pipe(Effect.ignore)
    )
  );
});

const renderPlan = Effect.fn("Yeet.renderPlan")(function* (
  plan: RepoRunPlan,
  json: boolean
): Effect.fn.Return<void, YeetCommandError> {
  if (json) {
    yield* printCommandJson(plan).pipe(Effect.mapError(YeetCommandError.new("Failed to print yeet plan JSON.")));
    return;
  }
  yield* Console.log("yeet plan");
  yield* Console.log(`- branch: ${plan.context.branch}`);
  yield* Console.log(`- base/head: ${plan.context.base}...${plan.context.head}`);
  yield* Console.log(`- artifacts: ${plan.context.packetDir}`);
  for (const step of plan.steps) {
    yield* Console.log(`- ${step.phase}: ${step.label} -> ${step.command} ${A.join(step.args, " ")}`);
  }
});

const lockfileChangedSinceBase = Effect.fn("Yeet.lockfileChangedSinceBase")(function* (
  context: RepoRunContext
): Effect.fn.Return<boolean, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const changed = yield* runGitPathList(context.repoRoot, [
    "diff",
    "--name-only",
    "-z",
    `${context.base}...${context.head}`,
    "--",
    "bun.lock",
  ]).pipe(Effect.orElseSucceed(A.empty<string>));
  return !A.isReadonlyArrayEmpty(changed);
});

/**
 * Run yeet with the provided options.
 *
 * @param options - Yeet runtime options.
 * @returns Yeet run result when execution succeeds.
 * @example
 * ```ts
 * import { defaultYeetRunOptions, runYeet } from "@beep/repo-cli/test/Yeet"
 *
 * const result = runYeet(defaultYeetRunOptions({ plan: true }))
 * console.log(result)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runYeet = Effect.fn("Yeet.runYeet")(function* (
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const message = yield* validateRequiredMessage(options);
  const context = yield* hydrateYeetRunContext(options);
  yield* validateMonitorGuards(context, options);
  const forceTurbo =
    options.mode === "repair" || options.mode === "verify" || options.mode === "publish"
      ? yield* lockfileChangedSinceBase(context)
      : false;
  if (forceTurbo) {
    yield* Console.log(
      `[yeet] bun.lock changed since ${context.base}; forcing dependency-sensitive lanes (TURBO_FORCE=true)`
    );
  }
  const plan = buildYeetRunPlanWithMode(
    context,
    message,
    YeetRunPlanModeOptions.make({
      amend: options.amend,
      fast: options.fast,
      forceTurbo,
      mode: options.mode,
      monitor: options.monitor,
      noEdit: options.noEdit,
      pr: options.pr,
      pushOnly: options.pushOnly,
      remote: options.remote,
      startPrEarly: options.startPrEarly,
      tier: options.tier,
    })
  );
  if (options.plan) {
    yield* renderPlan(plan, options.json);
    return yield* emptyPlanResult(context);
  }

  return yield* runPlanExecution(plan, options, message);
});

/**
 * Test-only inputs for building a Yeet run plan without reading repository state.
 *
 * @category testing
 * @since 0.0.0
 */
export class BuildYeetRunPlanTestOptions extends S.Class<BuildYeetRunPlanTestOptions>($I`BuildYeetRunPlanTestOptions`)(
  {
    amend: S.optionalKey(S.Boolean),
    context: RepoRunContext,
    fast: S.optionalKey(S.Boolean),
    forceTurbo: S.optionalKey(S.Boolean),
    message: S.Option(S.String),
    mode: S.optionalKey(YeetRunMode),
    monitor: S.optionalKey(S.Boolean),
    noEdit: S.optionalKey(S.Boolean),
    pr: S.optionalKey(S.Boolean),
    pushOnly: S.optionalKey(S.Boolean),
    remote: S.optionalKey(S.Boolean),
    startPrEarly: S.optionalKey(S.Boolean),
    tier: S.optionalKey(YeetProofTier),
  },
  $I.annote("BuildYeetRunPlanTestOptions", {
    description: "Hydrated test context, optional message, and optional mode for building a Yeet run plan.",
  })
) {}

/**
 * Build a plan for tests without reading repository state.
 *
 * @param options - Hydrated test context, optional message, and optional mode.
 * @returns Ordered Yeet run plan.
 * @category testing
 * @since 0.0.0
 */
export const buildYeetRunPlanForTesting = (options: BuildYeetRunPlanTestOptions): RepoRunPlan =>
  buildYeetRunPlanWithMode(
    options.context,
    options.message,
    YeetRunPlanModeOptions.make({
      amend: options.amend ?? false,
      fast: options.fast ?? false,
      forceTurbo: options.forceTurbo ?? false,
      mode: options.mode ?? "publish",
      monitor: options.monitor ?? false,
      noEdit: options.noEdit ?? false,
      pr: options.pr ?? false,
      pushOnly: options.pushOnly ?? false,
      remote: options.remote ?? false,
      startPrEarly: options.startPrEarly ?? false,
      tier: options.tier ?? "full",
    })
  );

/**
 * Construct baseline yeet options for focused tests.
 *
 * @param overrides - Partial option values to replace the defaults.
 * @returns Runtime options with repo-standard defaults applied.
 * @category testing
 * @since 0.0.0
 */
export const defaultYeetRunOptions = (overrides: Partial<YeetRunOptions> = {}): YeetRunOptions =>
  YeetRunOptions.make({
    allowStaleBase: false,
    amend: false,
    base: "origin/main",
    bots: "greptile",
    fast: false,
    head: "HEAD",
    json: false,
    message: "",
    mode: "publish",
    monitor: false,
    noEdit: false,
    packetDir: DEFAULT_YEET_PACKET_DIR,
    plan: false,
    pr: false,
    pushOnly: false,
    remote: false,
    replyBody: "",
    replyThread: "",
    requireGreptileIssues: -1,
    requireGreptileScore: "",
    requireReviewComments: -1,
    resolveThreads: "",
    retriggerGreptile: false,
    reuseVerified: false,
    stagedOnly: false,
    summary: false,
    startPrEarly: false,
    tier: "full",
    ...overrides,
  });
