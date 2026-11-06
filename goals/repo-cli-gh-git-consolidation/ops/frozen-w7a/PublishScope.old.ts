/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the stash, base-freshness, upstream, existing-commit and restage bodies of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { runIdForContext } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts";
import {
  collectStagedPublishPaths,
  collectUnstagedTrackedPaths,
  collectUntrackedPaths,
  currentCommitSha,
  optionFromNonEmpty,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts";
import {
  overlappingBasePathsForTesting as overlappingBasePaths,
  publishRestagePathsForTesting as publishRestagePaths,
  publishUpstreamMismatchWarningForTesting as publishUpstreamMismatchWarning,
  validatePublishIntentStillSafe,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts";
import {
  YeetBaseFreshness,
  YeetStashState,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { YeetExistingCommitPublishIntent } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts";
import {
  runRepoCommandCapture,
  sortedUniquePaths,
} from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import { oldRunGitOutput, oldRunGitPathList } from "./GitRunners.old.ts";
import type { Git } from "@beep/git/Git";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { YeetStagedPublishIntent } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

export const oldStashUnstagedWorktree = Effect.fn("Yeet.oldStashUnstagedWorktree")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  O.Option<YeetStashState>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Digest.Digest | Git
> {
  const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);
  if (A.isReadonlyArrayEmpty(unstagedPaths) && A.isReadonlyArrayEmpty(untrackedPaths)) {
    return O.none();
  }

  const createdAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const runId = yield* runIdForContext(context);
  const marker = `yeet-staged-only/${runId}/${createdAt}`;
  // --keep-index preserves the reviewed staged index so the parking happens
  // before `git commit`: residue is removed from the worktree first, so a
  // commit hook (e.g. `git add .`) can only ever stage the reviewed files.
  yield* oldRunGitOutput(context.repoRoot, ["stash", "push", "--keep-index", "--include-untracked", "-m", marker]);
  const stashSha = yield* oldRunGitOutput(context.repoRoot, ["rev-parse", "stash@{0}"]).pipe(Effect.map(Str.trim));
  yield* Console.log(
    `[yeet] staged-only: parked ${unstagedPaths.length + untrackedPaths.length} residue path(s) in stash "${marker}"`
  );
  return O.some(YeetStashState.make({ createdAt, marker, stashSha }));
});

export const oldLocateStashRef = Effect.fn("Yeet.oldLocateStashRef")(function* (
  repoRoot: string,
  stash: YeetStashState
): Effect.fn.Return<
  O.Option<string>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const listing = yield* oldRunGitOutput(repoRoot, ["stash", "list", "--format=%H %gd %s"]);
  return pipe(
    Str.split(/\r?\n/u)(listing),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.findFirst((line) => Str.startsWith(stash.stashSha)(line) || Str.includes(stash.marker)(line)),
    O.flatMap((line) => A.get(Str.split(/\s+/u)(line), 1))
  );
});

export const oldRestoreStashedWorktree = Effect.fn("Yeet.oldRestoreStashedWorktree")(function* (
  context: RepoRunContext,
  stash: YeetStashState
): Effect.fn.Return<void, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const failureDetail = yield* Effect.gen(function* () {
    const stashRef = yield* oldLocateStashRef(context.repoRoot, stash);
    if (O.isNone(stashRef)) {
      return `stash not found by sha or marker; inspect "git stash list" for "${stash.marker}"`;
    }
    yield* oldRunGitOutput(context.repoRoot, ["stash", "pop", stashRef.value]);
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

export const oldAssessBaseFreshness = Effect.fn("Yeet.oldAssessBaseFreshness")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  YeetBaseFreshness,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const mergeBase = yield* oldRunGitOutput(context.repoRoot, ["merge-base", context.base, "HEAD"]).pipe(
    Effect.mapBoth({
      onFailure: YeetCommandError.new(
        `yeet publish could not compute a merge-base between ${context.base} and HEAD. Rebase onto the base ref before publishing.`
      ),
      onSuccess: Str.trim,
    })
  );
  const behindCount = yield* oldRunGitOutput(context.repoRoot, [
    "rev-list",
    "--count",
    `${mergeBase}..${context.base}`,
  ]).pipe(Effect.map((output) => Number(Str.trim(output))));
  if (behindCount === 0) {
    return YeetBaseFreshness.make({ behindCount: 0, mergeBase, overlappingPaths: [] });
  }

  const committedPaths = yield* oldRunGitPathList(context.repoRoot, [
    "diff",
    "--name-only",
    "-z",
    `${mergeBase}..HEAD`,
  ]);
  const stagedFreshnessPaths = yield* collectStagedPublishPaths(context.repoRoot);
  const branchPaths = sortedUniquePaths([...committedPaths, ...stagedFreshnessPaths]);
  const basePaths = yield* oldRunGitPathList(context.repoRoot, [
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

export const oldCollectCurrentUpstreamBranch = Effect.fn("Yeet.oldCollectCurrentUpstreamBranch")(function* (
  repoRoot: string
): Effect.fn.Return<
  O.Option<string>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
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

export const oldWarnOnMismatchedPublishUpstream = Effect.fn("Yeet.oldWarnOnMismatchedPublishUpstream")(function* (
  context: RepoRunContext
): Effect.fn.Return<void, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const upstream = yield* oldCollectCurrentUpstreamBranch(context.repoRoot);
  if (O.isNone(upstream)) {
    return;
  }

  const warning = publishUpstreamMismatchWarning(context.branch, upstream.value);
  if (O.isSome(warning)) {
    yield* Console.error(warning.value);
  }
});

export const oldCollectExistingCommitPublishIntent = Effect.fn("Yeet.oldCollectExistingCommitPublishIntent")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  O.Option<YeetExistingCommitPublishIntent>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const remoteRef = `origin/${context.branch}`;
  const remoteRefExists = yield* runRepoCommandCapture(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/remotes/${remoteRef}`],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new(`Failed to inspect publish target ${remoteRef}.`)));
  const comparisonRef = remoteRefExists.exitCode === 0 ? remoteRef : context.base;
  const aheadCount = yield* oldRunGitOutput(context.repoRoot, ["rev-list", "--count", `${comparisonRef}..HEAD`]).pipe(
    Effect.mapBoth({
      onFailure: YeetCommandError.new(`Failed to inspect local commits ahead of ${comparisonRef}.`),
      onSuccess: (output) => Number(Str.trim(output)),
    })
  );
  if (aheadCount === 0) {
    return O.none();
  }

  const [commitSha, paths] = yield* Effect.all([
    currentCommitSha(context),
    oldRunGitPathList(context.repoRoot, ["diff", "--name-only", "-z", `${comparisonRef}..HEAD`]),
  ]);
  return O.some(YeetExistingCommitPublishIntent.make({ commitSha, paths }));
});

export const oldCollectExistingPublishIntentPaths = Effect.fn("Yeet.oldCollectExistingPublishIntentPaths")(function* (
  context: RepoRunContext,
  intent: YeetStagedPublishIntent
): Effect.fn.Return<ReadonlyArray<string>, never, SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path> {
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

export const oldStageReviewedPublishIntent = Effect.fn("Yeet.oldStageReviewedPublishIntent")(function* (
  context: RepoRunContext,
  intent: YeetStagedPublishIntent,
  stagedOnly: boolean
): Effect.fn.Return<
  void,
  YeetCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  yield* validatePublishIntentStillSafe(context, intent, stagedOnly);
  const existingPaths = yield* oldCollectExistingPublishIntentPaths(context, intent);
  // A reviewed path that is on disk but absent from the index was staged as an
  // untrack (`git rm --cached`); `git add` would silently reverse it.
  const indexedPaths = A.isReadonlyArrayEmpty(existingPaths)
    ? existingPaths
    : yield* oldRunGitPathList(context.repoRoot, ["ls-files", "--cached", "-z", "--", ...existingPaths]);
  const restagePaths = publishRestagePaths(intent.paths, indexedPaths);
  if (!A.isReadonlyArrayEmpty(restagePaths)) {
    const ignoredRestagePaths = yield* oldRunGitPathList(context.repoRoot, [
      "ls-files",
      "--cached",
      "--ignored",
      "--exclude-standard",
      "-z",
      "--",
      ...restagePaths,
    ]);
    const regularRestagePaths = pipe(
      restagePaths,
      A.filter((filePath) => !A.contains(ignoredRestagePaths, filePath))
    );
    if (!A.isReadonlyArrayEmpty(regularRestagePaths)) {
      yield* oldRunGitOutput(context.repoRoot, ["add", "--", ...regularRestagePaths]);
    }
    if (!A.isReadonlyArrayEmpty(ignoredRestagePaths)) {
      yield* oldRunGitOutput(context.repoRoot, ["add", "--force", "--", ...ignoredRestagePaths]);
    }
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
