/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the expectation-rewrite collector and its per-file diff of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/ExpectationRewrite.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  EXPECTATION_DIFF_OVERFLOW,
  EXPECTATION_TEST_PATHSPEC,
  findExpectationRewrites,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ExpectationRewrite.ts";
import { ExpectationRewrite } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.schemas.ts";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { readGitRenames } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import { oldRunGitOutputWith, oldRunGitPathList } from "./GitRunners.old.ts";
import type { Git } from "@beep/git/Git";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

const TEST_FILE_PATTERN = /\.(?:test|spec)\.tsx?$/;
const SNAPSHOT_FILE_PATTERN = /^(.*)\/__snapshots__\/(.+)\.snap$/;
const $I = $RepoCliId.create("goals/repo-cli-gh-git-consolidation/ops/frozen-w7a/ExpectationRewrite.old");

export const testFileForPath = (path: string): O.Option<string> =>
  TEST_FILE_PATTERN.test(path)
    ? O.some(path)
    : pipe(
        O.fromNullishOr(SNAPSHOT_FILE_PATTERN.exec(path)),
        O.map((match) => `${match[1]}/${match[2]}`)
      );

class ExpectationDiffOverflow extends S.TaggedError<ExpectationDiffOverflow, { readonly brand: unique symbol }>(
  $I`ExpectationDiffOverflow`
)(
  "ExpectationDiffOverflow",
  { commandLine: S.String },
  $I.annoteError<ExpectationDiffOverflow>("ExpectationDiffOverflow", {
    description: "One test file's unified diff exceeded the repo-run capture bound.",
  })
) {}

export const gitFailure = {
  onSpawnFailure: (commandLine: string) => YeetCommandError.new(`Failed to run ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode }: { readonly commandLine: string; readonly exitCode: number }) =>
    YeetCommandError.make({
      message: `${commandLine} failed with exit code ${exitCode}.`,
      command: commandLine,
      exitCode,
    }),
};

export const listingAdapter: GitCommandErrorAdapter<YeetCommandError> = { ...gitFailure, onTruncated: O.none() };

export const fileDiffAdapter: GitCommandErrorAdapter<YeetCommandError | ExpectationDiffOverflow> = {
  ...gitFailure,
  onTruncated: O.some((commandLine) => ExpectationDiffOverflow.make({ commandLine })),
};

export const renamedFrom = (basePath: string, headPath: string): O.Option<string> =>
  basePath === headPath ? O.none() : O.some(O.getOrElse(testFileForPath(basePath), () => basePath));

export const withBaseFile =
  (baseFile: O.Option<string>) =>
  (rewrite: ExpectationRewrite): ExpectationRewrite =>
    O.match(baseFile, {
      onNone: () => rewrite,
      onSome: (file) => ExpectationRewrite.make({ ...rewrite, baseFile: file }),
    });

export const overflowRewrite = (headPath: string, baseFile: O.Option<string>): ReadonlyArray<ExpectationRewrite> =>
  pipe(
    testFileForPath(headPath),
    O.map((testFile) =>
      withBaseFile(baseFile)(
        ExpectationRewrite.make({
          testFile,
          line: 0,
          removed: EXPECTATION_DIFF_OVERFLOW,
          added: EXPECTATION_DIFF_OVERFLOW,
        })
      )
    ),
    O.toArray
  );

export const oldDiffTestFile = Effect.fn("Yeet.ExpectationRewrite.oldDiffTestFile")(function* (
  repoRoot: string,
  mergeBase: string,
  basePath: string,
  headPath: string
) {
  const baseFile = renamedFrom(basePath, headPath);
  const paths = O.isNone(baseFile) ? [headPath] : [basePath, headPath];
  return yield* oldRunGitOutputWith(
    repoRoot,
    ["diff", "--unified=0", "--no-color", "--find-renames=50%", mergeBase, "HEAD", "--", ...paths],
    fileDiffAdapter
  ).pipe(
    Effect.map((diff) => A.map(findExpectationRewrites(diff), withBaseFile(baseFile))),
    Effect.catchTag("ExpectationDiffOverflow", () => Effect.succeed(overflowRewrite(headPath, baseFile)))
  );
});

export const oldCollectExpectationRewrites = Effect.fn("Yeet.oldCollectExpectationRewrites")(function* (
  repoRoot: string,
  mergeBase: string
): Effect.fn.Return<
  ReadonlyArray<ExpectationRewrite>,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const modified = yield* oldRunGitPathList(repoRoot, [
    "diff",
    "--name-only",
    "-z",
    "--diff-filter=M",
    mergeBase,
    "HEAD",
    "--",
    ...EXPECTATION_TEST_PATHSPEC,
  ]);
  const renamed = yield* readGitRenames(repoRoot, mergeBase, "HEAD", EXPECTATION_TEST_PATHSPEC, listingAdapter, () =>
    YeetCommandError.make({ message: "git diff --name-status returned a malformed rename table.", exitCode: 1 })
  );
  const fromModified = yield* Effect.forEach(modified, (path) => oldDiffTestFile(repoRoot, mergeBase, path, path));
  const fromRenamed = yield* Effect.forEach(renamed, (rename) =>
    oldDiffTestFile(repoRoot, mergeBase, rename.sourcePath, rename.targetPath)
  );
  return A.flatten([...fromModified, ...fromRenamed]);
});
