/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the gate-input path collector (`collectYeetGateInputPaths`) of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/GateStaleness.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import {
  collectStagedPublishPaths,
  collectUnstagedTrackedPaths,
  collectUntrackedPaths,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts";
import { sortedUniquePaths } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import { oldRunGitPathList } from "./GitRunners.old.ts";
import type { Git } from "@beep/git/Git";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

export const oldCollectYeetGateInputPaths = Effect.fn("Yeet.oldCollectYeetGateInputPaths")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  ReadonlyArray<string>,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Git
> {
  const committed = yield* oldRunGitPathList(context.repoRoot, [
    "diff",
    "--name-only",
    "-z",
    `${context.base}...${context.head}`,
  ]).pipe(Effect.orElseSucceed(A.empty<string>));
  const staged = yield* collectStagedPublishPaths(context.repoRoot).pipe(Effect.orElseSucceed(A.empty<string>));
  const unstaged = yield* collectUnstagedTrackedPaths(context.repoRoot).pipe(Effect.orElseSucceed(A.empty<string>));
  const untracked = yield* collectUntrackedPaths(context.repoRoot).pipe(Effect.orElseSucceed(A.empty<string>));
  return sortedUniquePaths([...committed, ...staged, ...unstaged, ...untracked]);
});
