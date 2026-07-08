/**
 * Publish-scope and staged-only stash safety for Yeet publish.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, DateTime, Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import {
  gitPathListFromNulOutput,
  runRepoCommandCapture,
  sortedUniquePaths,
} from "../../../internal/repo-run/index.js";
import { YeetCommandError } from "../Yeet.errors.js";
import { QualityIssue, QualityIssueRouting, YeetPublishIntent } from "../Yeet.schemas.js";
import { runIdForContext } from "./ArtifactPaths.js";
import {
  collectStagedPublishPaths,
  collectUnstagedTrackedPaths,
  collectUntrackedPaths,
  optionFromNonEmpty,
  runGitOutput,
  runGitPathList,
} from "./GitExec.js";
import { writeIssueArtifacts } from "./IssueArtifacts.js";
import { buildQualityIssueIndex } from "./QualityIssueIndex.js";
import { YeetBaseFreshness, YeetStashState } from "./Verdict.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.js";
import type { YeetRunOptions } from "../Yeet.schemas.js";

const zeroGitSha = "0000000000000000000000000000000000000000" as const;
const protectedPublishBranches: ReadonlyArray<string> = ["main", "master", "HEAD"];

/**
 * Refuse `yeet publish` from protected trunk branches before any publish plan
 * can commit or push.
 *
 * @param context - Hydrated repo context containing the current branch name.
 * @param options - Runtime options used to determine the Yeet mode.
 * @returns Void when publishing is allowed, otherwise a command error.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { defaultYeetRunOptions, RepoRunContext, validatePublishBranch } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "main",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const failure = validatePublishBranch(context, defaultYeetRunOptions()).pipe(Effect.flip)
 * ```
 * @category validation
 * @since 0.0.0
 */
export const validatePublishBranch: {
  (context: RepoRunContext, options: YeetRunOptions): Effect.Effect<void, YeetCommandError>;
  (options: YeetRunOptions): (context: RepoRunContext) => Effect.Effect<void, YeetCommandError>;
} = dual(2, (context: RepoRunContext, options: YeetRunOptions): Effect.Effect<void, YeetCommandError> => {
  if (options.mode !== "publish" || !A.contains(protectedPublishBranches, context.branch)) {
    return Effect.void;
  }

  return Effect.fail(
    YeetCommandError.make({
      message: `yeet publish is PR-branch-only; refusing to publish directly from "${context.branch}". Create a feature branch from ${context.base}, then rerun yeet publish.`,
      command: `git switch -c <feature-branch> ${context.base}`,
      exitCode: 1,
    })
  );
});

/**
 * Expose the protected-branch publish guard for focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const validatePublishBranchForTesting = validatePublishBranch;

/**
 * Parse non-delete local commit SHAs from Git pre-push hook stdin.
 *
 * @param input - Raw pre-push stdin lines in Git's
 * `<local-ref> <local-sha> <remote-ref> <remote-sha>` format.
 * @returns Sorted unique local SHAs, excluding delete pushes.
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { prePushLocalShasFromStdin } from "@beep/repo-cli/test/Yeet"
 *
 * const input = "refs/heads/feature abc123 refs/heads/feature def456\nrefs/heads/delete 0000000000000000000000000000000000000000 refs/heads/delete abc\n"
 *
 * deepStrictEqual(prePushLocalShasFromStdin(input), ["abc123"])
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const prePushLocalShasFromStdin = (input: string): ReadonlyArray<string> =>
  pipe(
    Str.split(/\r?\n/u)(input),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.map((line) => Str.split(/\s+/u)(line)[1] ?? ""),
    A.filter((sha) => Str.isNonEmpty(sha) && sha !== zeroGitSha),
    sortedUniquePaths
  );

/**
 * Return pre-push SHAs that differ from the verified commit SHA.
 *
 * @param localShas - Commit SHAs parsed from pre-push stdin.
 * @param expectedCommitSha - Commit SHA recorded in the reusable Yeet proof.
 * @returns Sorted unique SHAs that would push a commit different from the proof.
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { prePushShaMismatches } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(prePushShaMismatches(["abc123", "def456"], "abc123"), ["def456"])
 * deepStrictEqual(prePushShaMismatches("abc123")(["abc123"]), [])
 * ```
 * @category validation
 * @since 0.0.0
 */
export const prePushShaMismatches: {
  (localShas: ReadonlyArray<string>, expectedCommitSha: string): ReadonlyArray<string>;
  (expectedCommitSha: string): (localShas: ReadonlyArray<string>) => ReadonlyArray<string>;
} = dual(
  2,
  (localShas: ReadonlyArray<string>, expectedCommitSha: string): ReadonlyArray<string> =>
    pipe(
      localShas,
      A.filter((sha) => sha !== expectedCommitSha),
      sortedUniquePaths
    )
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

/**
 * Format publish path lists as sorted markdown-style bullets.
 *
 * @param paths - Repo-relative paths to sort and render.
 * @returns One newline-delimited bullet per unique path.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { formatPublishPaths } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(formatPublishPaths(["src/z.ts", "src/a.ts"]), "  - src/a.ts\n  - src/z.ts")
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const formatPublishPaths: (paths: ReadonlyArray<string>) => string = flow(
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

/**
 * Emit a structured publish-scope failure packet and fail the Yeet command.
 *
 * @param context - Repo context that determines where quality packets are
 * written.
 * @param scope - Refused path set plus remediation text for the publish gate.
 * @returns A failing Effect containing the publish-scope Yeet command error.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { failPublishScopeWithPacket, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const failure = failPublishScopeWithPacket(context, {
 *   message: "yeet publish refuses untracked files.",
 *   paths: ["scratch.txt"],
 *   remediation: "Stage or remove the file.",
 *   subCategory: "untracked"
 * }).pipe(Effect.either)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const failPublishScopeWithPacket = Effect.fn("Yeet.failPublishScopeWithPacket")(function* (
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
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { gitPathListFromNulOutputForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(gitPathListFromNulOutputForTesting("src/z.ts\0src/a.ts\0"), ["src/a.ts", "src/z.ts"])
 * ```
 * @category testing
 * @since 0.0.0
 */
export const gitPathListFromNulOutputForTesting = gitPathListFromNulOutput;

/**
 * Parse Git pre-push stdin and return non-delete local commit SHAs.
 *
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { prePushLocalShasFromStdinForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(prePushLocalShasFromStdinForTesting("refs/heads/main abc refs/heads/main def\n"), ["abc"])
 * ```
 * @category testing
 * @since 0.0.0
 */
export const prePushLocalShasFromStdinForTesting = prePushLocalShasFromStdin;

/**
 * Return pushed SHAs that do not match the reusable Yeet proof commit.
 *
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { prePushShaMismatchesForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(prePushShaMismatchesForTesting(["abc", "def"], "abc"), ["def"])
 * ```
 * @category testing
 * @since 0.0.0
 */
export const prePushShaMismatchesForTesting = prePushShaMismatches;

/**
 * Return observed paths that are not part of the reviewed Yeet publish intent.
 *
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { publishPathsOutsideIntentForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(publishPathsOutsideIntentForTesting(["src/a.ts"], ["src/a.ts", "src/b.ts"]), ["src/b.ts"])
 * ```
 * @category testing
 * @since 0.0.0
 */
export const publishPathsOutsideIntentForTesting = publishPathsOutsideIntent;

/**
 * Return reviewed paths that can be passed to `git add` without failing on
 * reviewed deletions.
 *
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { publishRestagePathsForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(publishRestagePathsForTesting(["src/a.ts", "src/deleted.ts"], ["src/a.ts"]), ["src/a.ts"])
 * ```
 * @category testing
 * @since 0.0.0
 */
export const publishRestagePathsForTesting = publishRestagePaths;

/**
 * Return the warning Yeet prints when publish push target differs from branch
 * upstream tracking.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as O from "effect/Option"
 * import { publishUpstreamMismatchWarningForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const warning = publishUpstreamMismatchWarningForTesting("feature", "origin/old-feature")
 *
 * strictEqual(O.isSome(warning), true)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const publishUpstreamMismatchWarningForTesting = publishUpstreamMismatchWarning;

/**
 * Summarize refused publish paths as count, top-level entries, and capped
 * examples instead of a full enumeration.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { summarizePublishPathsForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(
 *   summarizePublishPathsForTesting(["packages/a.ts", "docs/readme.md"]).includes("2 path(s)"),
 *   true
 * )
 * ```
 * @category testing
 * @since 0.0.0
 */
export const summarizePublishPathsForTesting = summarizePublishPaths;

/**
 * Return staged paths that also carry unstaged worktree modifications.
 *
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { partiallyStagedPathsForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(partiallyStagedPathsForTesting(["src/a.ts", "src/b.ts"], ["src/b.ts"]), ["src/b.ts"])
 * ```
 * @category testing
 * @since 0.0.0
 */
export const partiallyStagedPathsForTesting = partiallyStagedPaths;

/**
 * Return branch-changed paths that were also changed on the base ref since the
 * merge-base.
 *
 * @example
 * ```ts
 * import { deepStrictEqual } from "node:assert"
 * import { overlappingBasePathsForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * deepStrictEqual(overlappingBasePathsForTesting(["src/a.ts", "src/b.ts"], ["src/b.ts"]), ["src/b.ts"])
 * ```
 * @category testing
 * @since 0.0.0
 */
export const overlappingBasePathsForTesting = overlappingBasePaths;

/**
 * Park unstaged tracked and untracked residue before a staged-only publish.
 *
 * @param context - Repo context whose worktree is inspected and whose run id
 * is embedded in the stash marker.
 * @returns `Some` stash state when residue was parked, otherwise `None`.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, stashUnstagedWorktree } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const parked = stashUnstagedWorktree(context).pipe(Effect.map((state) => state._tag))
 * ```
 * @category resource-management
 * @since 0.0.0
 */
export const stashUnstagedWorktree = Effect.fn("Yeet.stashUnstagedWorktree")(function* (
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

/**
 * Restore residue previously parked by staged-only publish.
 *
 * @param context - Repo context whose worktree receives the restored stash.
 * @param stash - Recorded stash identity returned by
 * {@link stashUnstagedWorktree}.
 * @returns An Effect that logs restoration failure instead of failing the
 * publish cleanup path.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, restoreStashedWorktree, YeetStashState } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const stash = YeetStashState.make({
 *   createdAt: "2026-07-08T00:00:00.000Z",
 *   marker: "yeet-staged-only/feature/2026-07-08T00:00:00.000Z",
 *   stashSha: "abc123"
 * })
 *
 * const restored = restoreStashedWorktree(context, stash).pipe(Effect.as("restore attempted"))
 * ```
 * @category resource-management
 * @since 0.0.0
 */
export const restoreStashedWorktree = Effect.fn("Yeet.restoreStashedWorktree")(function* (
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, stashUnstagedWorktreeForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const parked = stashUnstagedWorktreeForTesting(context).pipe(Effect.map((state) => state._tag))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const stashUnstagedWorktreeForTesting = stashUnstagedWorktree;

/**
 * Restore staged-only residue from its recorded stash, preserving the stash on
 * failure.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, restoreStashedWorktreeForTesting, YeetStashState } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const stash = YeetStashState.make({
 *   createdAt: "2026-07-08T00:00:00.000Z",
 *   marker: "yeet-staged-only/feature/2026-07-08T00:00:00.000Z",
 *   stashSha: "abc123"
 * })
 *
 * const restored = restoreStashedWorktreeForTesting(context, stash).pipe(Effect.as("restore attempted"))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const restoreStashedWorktreeForTesting = restoreStashedWorktree;

/**
 * Measure how far the publish branch is behind the refreshed base ref.
 *
 * @param context - Repo context containing the base ref and worktree root.
 * @returns Base freshness metadata including overlap paths when the branch is
 * behind.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { assessBaseFreshness, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const behindCount = assessBaseFreshness(context).pipe(Effect.map((freshness) => freshness.behindCount))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const assessBaseFreshness = Effect.fn("Yeet.assessBaseFreshness")(function* (
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { assessBaseFreshnessForTesting, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const overlapCount = assessBaseFreshnessForTesting(context).pipe(
 *   Effect.map((freshness) => freshness.overlappingPaths.length)
 * )
 * ```
 * @category testing
 * @since 0.0.0
 */
export const assessBaseFreshnessForTesting = assessBaseFreshness;

/**
 * Fail publish when a stale base overlaps branch-changed paths.
 *
 * @param context - Repo context containing base and branch identity.
 * @param options - Yeet runtime options controlling the stale-base override.
 * @returns Base freshness metadata when publishing may proceed.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { defaultYeetRunOptions, enforceBaseFreshness, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const freshness = enforceBaseFreshness(context, defaultYeetRunOptions({ allowStaleBase: false })).pipe(
 *   Effect.map((state) => state.behindCount)
 * )
 * ```
 * @category validation
 * @since 0.0.0
 */
export const enforceBaseFreshness = Effect.fn("Yeet.enforceBaseFreshness")(function* (
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

/**
 * Warn when the current branch tracks a different upstream than Yeet will push.
 *
 * @param context - Repo context whose branch and worktree are inspected.
 * @returns An Effect that logs a warning only when the tracked upstream differs
 * from `origin/<branch>`.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, warnOnMismatchedPublishUpstream } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const warning = warnOnMismatchedPublishUpstream(context).pipe(Effect.as("upstream checked"))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const warnOnMismatchedPublishUpstream = Effect.fn("Yeet.warnOnMismatchedPublishUpstream")(function* (
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

/**
 * Collect the reviewed file set Yeet is allowed to publish.
 *
 * @param context - Repo context whose Git index and worktree are inspected.
 * @param stagedOnly - Whether unstaged residue may be parked instead of
 * blocking immediately.
 * @returns Publish intent containing the exact staged paths approved for the
 * commit.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { collectPublishIntent, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const pathCount = collectPublishIntent(context, true).pipe(Effect.map((intent) => intent.paths.length))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const collectPublishIntent = Effect.fn("Yeet.collectPublishIntent")(function* (
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

/**
 * Re-check that the worktree still matches the reviewed publish intent.
 *
 * @param context - Repo context whose current Git state is inspected.
 * @param intent - Reviewed staged paths captured before quality ran.
 * @param stagedOnly - Whether unstaged residue outside the intent is allowed to
 * remain parked.
 * @returns An Effect that completes only when no unexpected publish paths are
 * present.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, validatePublishIntentStillSafe, YeetPublishIntent } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const intent = YeetPublishIntent.make({ paths: ["packages/tooling/tool/cli/src/index.ts"] })
 *
 * const safe = validatePublishIntentStillSafe(context, intent, true).pipe(Effect.as("intent still safe"))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const validatePublishIntentStillSafe = Effect.fn("Yeet.validatePublishIntentStillSafe")(function* (
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

/**
 * Restage existing reviewed paths and confirm no unreviewed path entered the
 * commit.
 *
 * @param context - Repo context whose index is restaged.
 * @param intent - Reviewed publish intent collected before quality ran.
 * @param stagedOnly - Whether staged-only residue handling is active.
 * @returns An Effect that completes after the reviewed intent is staged safely.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, stageReviewedPublishIntent, YeetPublishIntent } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const intent = YeetPublishIntent.make({ paths: ["packages/tooling/tool/cli/src/index.ts"] })
 *
 * const staged = stageReviewedPublishIntent(context, intent, true).pipe(Effect.as("reviewed paths staged"))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const stageReviewedPublishIntent = Effect.fn("Yeet.stageReviewedPublishIntent")(function* (
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

/**
 * Failure message used when local proof changes files after the commit but
 * before push.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { postCommitProofChangedBeforePushMessage } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(postCommitProofChangedBeforePushMessage.includes("before retrying"), true)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const postCommitProofChangedBeforePushMessage =
  "yeet publish stopped because the full proof changed files after the local commit. Regenerate them, then amend or reset the commit that has not yet been pushed before retrying.";

/**
 * Failure message used when start-pr-early proof changes files after the early
 * push.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { postCommitProofChangedAfterEarlyPushMessage } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(postCommitProofChangedAfterEarlyPushMessage.includes("follow-up fix"), true)
 * ```
 * @category constants
 * @since 0.0.0
 */
export const postCommitProofChangedAfterEarlyPushMessage =
  "yeet publish --start-pr-early stopped because the full proof changed files after the commit was already pushed. Commit a follow-up fix and publish again.";

/**
 * Confirm that the post-commit full proof left the worktree unchanged.
 *
 * @param context - Repo context whose Git state is checked after proof.
 * @param message - Failure message used when proof wrote files.
 * @returns An Effect that completes only when no staged, unstaged, or untracked
 * paths remain.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoRunContext, validatePostCommitProofDidNotChangeWorktree } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const unchanged = validatePostCommitProofDidNotChangeWorktree(context).pipe(Effect.as("worktree unchanged"))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const validatePostCommitProofDidNotChangeWorktree = Effect.fn(
  "Yeet.validatePostCommitProofDidNotChangeWorktree"
)(function* (
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
      remediation: "Inspect the proof-written files; regenerate or commit them as a follow-up, then retry the publish.",
      subCategory: "proof-changed-worktree",
    });
  }
});
