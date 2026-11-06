/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the pull request body (`buildPrBody`) and its commit range of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import { Git } from "@beep/git/Git";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import { runIdForContext } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts";
import { oldRunGitOutput } from "./GitRunners.old.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { YeetExecutedStep } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts";
import type { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

export const oldBranchCommitRange = Effect.fn("Yeet.oldBranchCommitRange")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Git> {
  const git = yield* Git;
  const mergeBase = yield* git.mergeBase(context.repoRoot, context.base, "HEAD").pipe(Effect.orElseSucceed(() => ""));
  return Str.isNonEmpty(mergeBase) ? `${mergeBase}..HEAD` : "HEAD";
});

export const oldBuildPrBody = Effect.fn("Yeet.oldBuildPrBody")(function* (
  context: RepoRunContext,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  string,
  YeetCommandError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
  | Git
> {
  const range = yield* oldBranchCommitRange(context);
  // KEEP (W2b): `Git.log` carries each commit's subject but not its body (`%b`).
  const commitLog = yield* oldRunGitOutput(context.repoRoot, [
    "log",
    "--reverse",
    "--pretty=format:## %s%n%n%b",
    range,
  ]);
  const executed = yield* Ref.get(recorder);
  const laneSummary = pipe(
    executed,
    A.map((entry) => `- ${entry.step.label}: ${entry.result.exitCode === 0 ? "passed" : "failed"}`),
    A.join("\n")
  );
  const proofSection = Str.isNonEmpty(laneSummary)
    ? laneSummary
    : "- no local proof lane ran before the push; hosted CI is the authoritative proof";
  const runId = yield* runIdForContext(context);
  return `${Str.trim(commitLog)}\n\n## Local proof\n\n${proofSection}\n\nVerdict: .beep/yeet/runs/${runId}/verdict.json\n`;
});
