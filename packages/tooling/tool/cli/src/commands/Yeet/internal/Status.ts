/**
 * Local-first Yeet operator status snapshots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { DateTime, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.js";
import { YeetCommandError } from "../Yeet.errors.js";
import { runArtifactPathForContext, runIdForContext } from "./ArtifactPaths.js";
import { PrCloseoutReport } from "./Closeout.js";
import { YeetVerdict } from "./Verdict.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.js";

const $I = $RepoCliId.create("commands/Yeet/internal/Status");
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

/**
 * Status of an optional Yeet artifact read.
 *
 * @example
 * ```ts
 * import { YeetStatusArtifactState } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetStatusArtifactState.is.present("present"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const YeetStatusArtifactState = LiteralKit(["missing", "present", "unreadable"]).pipe(
  $I.annoteSchema("YeetStatusArtifactState", {
    description: "Read status for an optional Yeet operator artifact.",
  })
);

/**
 * Status of an optional Yeet artifact read.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetStatusArtifactState = typeof YeetStatusArtifactState.Type;

/**
 * Local Git worktree counts used by `yeet status`.
 *
 * @example
 * ```ts
 * import { YeetStatusWorktree } from "@beep/repo-cli/test/Yeet"
 *
 * const worktree = YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 })
 * console.log(worktree.clean)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetStatusWorktree extends S.Class<YeetStatusWorktree>($I`YeetStatusWorktree`)(
  {
    clean: S.Boolean,
    staged: S.Finite,
    unstaged: S.Finite,
    untracked: S.Finite,
  },
  $I.annote("YeetStatusWorktree", {
    description: "Local Git worktree counts used by yeet status.",
  })
) {}

/**
 * Summary for a Yeet artifact read by status.
 *
 * @example
 * ```ts
 * import { YeetStatusArtifact } from "@beep/repo-cli/test/Yeet"
 *
 * const artifact = YeetStatusArtifact.make({
 *   detail: "no verdict found",
 *   path: ".beep/yeet/runs/branch/verdict.json",
 *   state: "missing",
 * })
 * console.log(artifact.state)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetStatusArtifact extends S.Class<YeetStatusArtifact>($I`YeetStatusArtifact`)(
  {
    detail: S.String,
    path: S.String,
    state: YeetStatusArtifactState,
    issueCount: S.optionalKey(S.Finite),
    mode: S.optionalKey(S.String),
    outcome: S.optionalKey(S.String),
    repairCommand: S.optionalKey(S.String),
    schemaVersion: S.optionalKey(S.String),
  },
  $I.annote("YeetStatusArtifact", {
    description: "Compact summary for a Yeet artifact read by status.",
  })
) {}

/**
 * Optional remote pull request summary for `yeet status --remote`.
 *
 * @example
 * ```ts
 * import { YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const remote = YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" })
 * console.log(remote.checked)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetStatusRemote extends S.Class<YeetStatusRemote>($I`YeetStatusRemote`)(
  {
    available: S.Boolean,
    checked: S.Boolean,
    detail: S.String,
    checkCount: S.optionalKey(S.Finite),
    failingCheckCount: S.optionalKey(S.Finite),
    isDraft: S.optionalKey(S.Boolean),
    mergeStateStatus: S.optionalKey(S.String),
    mergeable: S.optionalKey(S.String),
    number: S.optionalKey(S.Finite),
    pendingCheckCount: S.optionalKey(S.Finite),
    reviewDecision: S.optionalKey(S.String),
    state: S.optionalKey(S.String),
    url: S.optionalKey(S.String),
  },
  $I.annote("YeetStatusRemote", {
    description: "Optional remote pull request summary for yeet status.",
  })
) {}

/**
 * Machine-readable status snapshot emitted by `yeet status`.
 *
 * @example
 * ```ts
 * import { YeetStatusSnapshot, YeetStatusWorktree, YeetStatusArtifact, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const snapshot = YeetStatusSnapshot.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   closeout: YeetStatusArtifact.make({ detail: "missing", path: "pr-closeout.json", state: "missing" }),
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   head: "HEAD",
 *   nextCommand: "bun run beep yeet verify",
 *   remote: YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" }),
 *   runId: "feature",
 *   schemaVersion: "yeet-status/v1",
 *   statusPath: ".beep/yeet/runs/feature/status.json",
 *   verdict: YeetStatusArtifact.make({ detail: "missing", path: "verdict.json", state: "missing" }),
 *   worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
 * })
 * console.log(snapshot.schemaVersion)
 * ```
 * @category models
 * @since 0.0.0
 */
export class YeetStatusSnapshot extends S.Class<YeetStatusSnapshot>($I`YeetStatusSnapshot`)(
  {
    base: S.String,
    branch: S.String,
    closeout: YeetStatusArtifact,
    createdAt: S.String,
    head: S.String,
    nextCommand: S.String,
    remote: YeetStatusRemote,
    runId: S.String,
    schemaVersion: S.Literal("yeet-status/v1"),
    statusPath: S.String,
    verdict: YeetStatusArtifact,
    worktree: YeetStatusWorktree,
  },
  $I.annote("YeetStatusSnapshot", {
    description: "Machine-readable status snapshot emitted by yeet status.",
  })
) {}

class GhStatusPullRequest extends S.Class<GhStatusPullRequest>($I`GhStatusPullRequest`)(
  {
    isDraft: S.Boolean,
    mergeStateStatus: S.NullOr(S.String),
    mergeable: S.NullOr(S.String),
    number: S.Finite,
    reviewDecision: S.NullOr(S.String),
    state: S.String,
    url: S.String,
  },
  $I.annote("GhStatusPullRequest", {
    description: "GitHub pull request payload used by yeet status remote summaries.",
  })
) {}

class GhStatusCheck extends S.Class<GhStatusCheck>($I`GhStatusCheck`)(
  {
    bucket: S.String,
    name: S.String,
    state: S.String,
  },
  $I.annote("GhStatusCheck", {
    description: "GitHub PR check payload used by yeet status remote summaries.",
  })
) {}

const decodeYeetVerdict = S.decodeUnknownEffect(S.fromJsonString(YeetVerdict));
const decodePrCloseoutReport = S.decodeUnknownEffect(S.fromJsonString(PrCloseoutReport));
const decodeGhStatusPullRequest = S.decodeUnknownEffect(S.fromJsonString(GhStatusPullRequest));
const decodeGhStatusChecks = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhStatusCheck)));

const sortedUniquePaths: (paths: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

const pathListFromNulOutput: (output: string) => ReadonlyArray<string> = flow(Str.split("\0"), sortedUniquePaths);

/**
 * Return the status artifact path for a Yeet run context.
 *
 * @example
 * ```ts
 * import { yeetStatusPathForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const example = yeetStatusPathForTesting
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category testing
 * @since 0.0.0
 */
const statusPathForContext = Effect.fn("YeetStatus.statusPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  return yield* runArtifactPathForContext(context, "status.json");
});

const runGitPaths = Effect.fn("YeetStatus.runGitPaths")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture("git", args, repoRoot).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to run git ${A.join(args, " ")}.`))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      command: `git ${A.join(args, " ")}`,
      exitCode: result.exitCode,
      message: `git ${A.join(args, " ")} failed with exit code ${result.exitCode}.`,
    });
  }
  return pathListFromNulOutput(result.output);
});

const collectWorktreeStatus = Effect.fn("YeetStatus.collectWorktreeStatus")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetStatusWorktree, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const staged = yield* runGitPaths(context.repoRoot, ["diff", "--cached", "--name-only", "-z"]);
  const unstaged = yield* runGitPaths(context.repoRoot, ["diff", "--name-only", "-z"]);
  const untracked = yield* runGitPaths(context.repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const stagedCount = A.length(staged);
  const unstagedCount = A.length(unstaged);
  const untrackedCount = A.length(untracked);
  return YeetStatusWorktree.make({
    clean: stagedCount === 0 && unstagedCount === 0 && untrackedCount === 0,
    staged: stagedCount,
    unstaged: unstagedCount,
    untracked: untrackedCount,
  });
});

const missingArtifact = (path: string, detail: string): YeetStatusArtifact =>
  YeetStatusArtifact.make({ detail, path, state: "missing" });

const unreadableArtifact = (path: string, detail: string): YeetStatusArtifact =>
  YeetStatusArtifact.make({ detail, path, state: "unreadable" });

const firstFailedRepairCommand = (verdict: YeetVerdict): O.Option<string> =>
  pipe(
    verdict.lanes,
    A.findFirst((lane) => lane.status === "failed"),
    O.flatMap((lane) => O.fromUndefinedOr(lane.repairCommand))
  );

const artifactFromVerdict = (path: string, verdict: YeetVerdict): YeetStatusArtifact =>
  YeetStatusArtifact.make({
    detail: `${verdict.mode} ${verdict.outcome}: ${verdict.message}`,
    path,
    state: "present",
    schemaVersion: verdict.schemaVersion,
    mode: verdict.mode,
    outcome: verdict.outcome,
    ...O.getSomesStruct({ repairCommand: firstFailedRepairCommand(verdict) }),
  });

const artifactFromCloseout = (path: string, report: PrCloseoutReport): YeetStatusArtifact =>
  YeetStatusArtifact.make({
    detail: `PR #${report.prNumber}: ${report.issueCount} closeout issue(s), ${report.actionableReviewThreadCount} actionable thread(s)`,
    issueCount: report.issueCount,
    path,
    schemaVersion: report.schemaVersion,
    state: "present",
  });

const readJsonArtifact = Effect.fn("YeetStatus.readJsonArtifact")(function* <Value>(
  path: string,
  missingDetail: string,
  unreadableDetail: string,
  undecodableDetail: string,
  decode: (text: string) => Effect.Effect<Value, S.SchemaError>,
  render: (value: Value) => YeetStatusArtifact
): Effect.fn.Return<YeetStatusArtifact, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* artifactExists(path);
  if (!exists) {
    return missingArtifact(path, missingDetail);
  }
  const text = yield* fs.readFileString(path).pipe(Effect.option);
  if (O.isNone(text)) {
    return unreadableArtifact(path, unreadableDetail);
  }
  return yield* decode(text.value).pipe(
    Effect.map(render),
    Effect.orElseSucceed(() => unreadableArtifact(path, undecodableDetail))
  );
});

const readVerdictArtifact = (path: string): Effect.Effect<YeetStatusArtifact, never, FileSystem.FileSystem> =>
  readJsonArtifact(
    path,
    "no verdict artifact found for this branch",
    "verdict artifact could not be read",
    "verdict artifact could not be decoded",
    decodeYeetVerdict,
    (verdict) => artifactFromVerdict(path, verdict)
  );

const readCloseoutArtifact = (path: string): Effect.Effect<YeetStatusArtifact, never, FileSystem.FileSystem> =>
  readJsonArtifact(
    path,
    "no closeout artifact found for this branch",
    "closeout artifact could not be read",
    "closeout artifact could not be decoded",
    decodePrCloseoutReport,
    (report) => artifactFromCloseout(path, report)
  );

const artifactExists = Effect.fn("YeetStatus.artifactExists")(function* (
  path: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
});

const checkIsFailing = (check: GhStatusCheck): boolean => {
  const bucket = Str.toLowerCase(check.bucket);
  const state = Str.toLowerCase(check.state);
  return (
    A.contains(["fail", "failing", "cancel", "cancelled", "error", "timed_out"], bucket) ||
    A.contains(["failure", "cancelled", "error", "timed_out"], state)
  );
};

const checkIsPending = (check: GhStatusCheck): boolean => {
  const bucket = Str.toLowerCase(check.bucket);
  const state = Str.toLowerCase(check.state);
  return (
    A.contains(["pending", "running", "queued", "waiting"], bucket) ||
    A.contains(["pending", "in_progress", "queued", "waiting"], state)
  );
};

const collectRemoteChecks = Effect.fn("YeetStatus.collectRemoteChecks")(function* (
  context: RepoRunContext
): Effect.fn.Return<O.Option<ReadonlyArray<GhStatusCheck>>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "checks", "--json", "name,state,bucket"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to inspect PR checks for yeet status.")));
  if (result.truncated) {
    return O.none();
  }
  return yield* decodeGhStatusChecks(result.output).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none));
});

const skippedRemote = YeetStatusRemote.make({
  available: false,
  checked: false,
  detail: "pass --remote to include live GitHub PR data",
});

const collectRemoteStatus = Effect.fn("YeetStatus.collectRemoteStatus")(function* (
  context: RepoRunContext,
  remote: boolean
): Effect.fn.Return<YeetStatusRemote, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  if (!remote) {
    return skippedRemote;
  }
  const result = yield* runRepoCommandCapture(
    "gh",
    ["pr", "view", "--json", "number,url,state,mergeable,mergeStateStatus,isDraft,reviewDecision"],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to inspect PR for yeet status.")));
  if (result.exitCode !== 0) {
    return YeetStatusRemote.make({
      available: false,
      checked: true,
      detail: "gh pr view found no pull request for the current branch",
    });
  }
  if (result.truncated) {
    return YeetStatusRemote.make({
      available: false,
      checked: true,
      detail: "gh pr view output exceeded the repo-run capture limit",
    });
  }
  const view = yield* decodeGhStatusPullRequest(result.output).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode gh pr view JSON for yeet status."))
  );
  const checks = yield* collectRemoteChecks(context);
  const checkCount = pipe(checks, O.map(A.length));
  const failingCheckCount = pipe(
    checks,
    O.map((values) => A.length(A.filter(values, checkIsFailing)))
  );
  const pendingCheckCount = pipe(
    checks,
    O.map((values) => A.length(A.filter(values, checkIsPending)))
  );
  return YeetStatusRemote.make({
    available: true,
    checked: true,
    detail: `PR #${view.number} ${view.state}`,
    isDraft: view.isDraft,
    number: view.number,
    state: view.state,
    url: view.url,
    ...O.getSomesStruct({
      checkCount,
      failingCheckCount,
      pendingCheckCount,
    }),
    ...O.getSomesStruct({
      mergeStateStatus: O.fromNullishOr(view.mergeStateStatus),
      mergeable: O.fromNullishOr(view.mergeable),
      reviewDecision: O.fromNullishOr(view.reviewDecision),
    }),
  });
});

const nextCommandForStatus = (
  worktree: YeetStatusWorktree,
  verdict: YeetStatusArtifact,
  closeout: YeetStatusArtifact,
  remote: YeetStatusRemote
): string => {
  const repairCommand = O.fromUndefinedOr(verdict.repairCommand);
  if (O.isSome(repairCommand)) {
    return repairCommand.value;
  }
  if (!worktree.clean) {
    return 'stage intended files, then run `bun run beep yeet publish --staged-only --pr --monitor --message "..."`';
  }
  if (remote.checked && !remote.available) {
    return 'run `bun run beep yeet publish --pr --monitor --message "..."` when ready for PR review';
  }
  const closeoutIssueCount = O.fromUndefinedOr(closeout.issueCount);
  if (remote.available && O.isSome(closeoutIssueCount) && closeoutIssueCount.value === 0) {
    return "confirm GitHub mergeability, then merge the PR";
  }
  if (remote.available) {
    return "run `bun run beep yeet closeout --summary --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0`";
  }
  return "run `bun run beep yeet verify` or pass `--remote` for PR status";
};

/**
 * Collect a local-first Yeet operator status snapshot.
 *
 * @example
 * ```ts
 * import { collectYeetStatus } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(collectYeetStatus)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const collectYeetStatus = Effect.fn("YeetStatus.collectYeetStatus")(function* (
  context: RepoRunContext,
  remote: boolean
): Effect.fn.Return<
  YeetStatusSnapshot,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const verdictPath = yield* runArtifactPathForContext(context, "verdict.json");
  const closeoutPath = yield* runArtifactPathForContext(context, "pr-closeout.json");
  const statusPath = yield* statusPathForContext(context);
  const [worktree, verdict, closeout, remoteStatus, createdAt] = yield* Effect.all(
    [
      collectWorktreeStatus(context),
      readVerdictArtifact(verdictPath),
      readCloseoutArtifact(closeoutPath),
      collectRemoteStatus(context, remote),
      DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    ],
    { concurrency: "unbounded" }
  );
  return YeetStatusSnapshot.make({
    base: context.base,
    branch: context.branch,
    closeout,
    createdAt,
    head: context.head,
    nextCommand: nextCommandForStatus(worktree, verdict, closeout, remoteStatus),
    remote: remoteStatus,
    runId: runIdForContext(context),
    schemaVersion: "yeet-status/v1",
    statusPath,
    verdict,
    worktree,
  });
});

/**
 * Render a concise human-readable Yeet status block.
 *
 * @param snapshot - Yeet status snapshot to render.
 * @returns A compact text block for operator-facing status output.
 * @example
 * ```ts
 * import { renderYeetStatusSummary, YeetStatusSnapshot, YeetStatusWorktree, YeetStatusArtifact, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const text = renderYeetStatusSummary(YeetStatusSnapshot.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   closeout: YeetStatusArtifact.make({ detail: "missing", path: "pr-closeout.json", state: "missing" }),
 *   createdAt: "2026-06-11T00:00:00.000Z",
 *   head: "HEAD",
 *   nextCommand: "bun run beep yeet verify",
 *   remote: YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" }),
 *   runId: "feature",
 *   schemaVersion: "yeet-status/v1",
 *   statusPath: ".beep/yeet/runs/feature/status.json",
 *   verdict: YeetStatusArtifact.make({ detail: "missing", path: "verdict.json", state: "missing" }),
 *   worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
 * }))
 * console.log(text) // example value
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetStatusSummary = (snapshot: YeetStatusSnapshot): string => {
  const remoteLine = snapshot.remote.checked ? snapshot.remote.detail : "remote not checked";
  const checkLine =
    snapshot.remote.checked && O.isSome(O.fromUndefinedOr(snapshot.remote.checkCount))
      ? `checks: ${snapshot.remote.checkCount} total, ${snapshot.remote.failingCheckCount ?? 0} failing, ${snapshot.remote.pendingCheckCount ?? 0} pending`
      : "checks: not checked";
  return pipe(
    [
      "yeet status",
      `- branch: ${snapshot.branch}`,
      `- base/head: ${snapshot.base}...${snapshot.head}`,
      `- worktree: ${snapshot.worktree.clean ? "clean" : "dirty"} (${snapshot.worktree.staged} staged, ${snapshot.worktree.unstaged} unstaged, ${snapshot.worktree.untracked} untracked)`,
      `- verdict: ${snapshot.verdict.detail}`,
      `- closeout: ${snapshot.closeout.detail}`,
      `- remote: ${remoteLine}`,
      `- ${checkLine}`,
      `- status artifact: ${snapshot.statusPath}`,
      `- next: ${snapshot.nextCommand}`,
    ],
    A.join("\n")
  );
};

/**
 * Write a Yeet status snapshot to its status artifact path.
 *
 * @example
 * ```ts
 * import { writeYeetStatusSnapshot } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(writeYeetStatusSnapshot)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const writeYeetStatusSnapshot = Effect.fn("YeetStatus.writeYeetStatusSnapshot")(function* (
  snapshot: YeetStatusSnapshot
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const json = yield* encodeJson(snapshot).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode yeet status JSON."))
  );
  yield* fs
    .makeDirectory(path.dirname(snapshot.statusPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create yeet status directory for ${snapshot.statusPath}.`)));
  yield* fs
    .writeFileString(snapshot.statusPath, `${json}\n`)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write yeet status artifact ${snapshot.statusPath}.`)));
});

/**
 * Expose the status artifact path helper to focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const yeetStatusPathForTesting = statusPathForContext;

/**
 * Expose next-command selection to focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const yeetStatusNextCommandForTesting = nextCommandForStatus;
