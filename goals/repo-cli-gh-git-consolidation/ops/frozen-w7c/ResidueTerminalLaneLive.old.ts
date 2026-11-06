/**
 * Frozen pre-W7 git facts for `ops/worktree-differential-w7.ts`, from
 * `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueTerminalLaneLive.ts` at the lane base 8602b24203
 * (the W7 kit head).
 *
 * `gitOutput` is verbatim; `linkedLayout`'s three-path read and `proveTerminalLane`'s branch, head and clean-tree
 * reads are lifted into `layoutFacts` and `laneFacts` with the same argv. A failed read ends the proof, so each fact
 * is `None` on failure here, as `Effect.option` made it in the probe.
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";

const gitOutput = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const capture = yield* runRepoCommandCapture("git", args, cwd);
  return yield* Effect.fromOption(
    O.liftPredicate(capture, (result) => N.Equivalence(result.exitCode, 0) && !result.truncated)
  ).pipe(Effect.map((result) => Str.trim(result.output)));
});

/** The toplevel, git dir and common dir, each through `realPath`; `None` when any read fails. */
export const layoutFacts = (checkout: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const lines = Str.split(
      yield* gitOutput(checkout, [
        "rev-parse",
        "--path-format=absolute",
        "--show-toplevel",
        "--git-dir",
        "--git-common-dir",
      ]),
      "\n"
    );
    const toplevel = yield* fs.realPath(yield* Effect.fromOption(A.get(lines, 0)));
    const gitDir = yield* fs.realPath(yield* Effect.fromOption(A.get(lines, 1)));
    const commonDir = yield* fs.realPath(yield* Effect.fromOption(A.get(lines, 2)));
    return { toplevel, gitDir, commonDir };
  }).pipe(Effect.option);

/** The branch, head and clean-tree facts; each `None` when its read fails. */
export const laneFacts = (checkout: string) =>
  Effect.all({
    branch: gitOutput(checkout, ["symbolic-ref", "--quiet", "--short", "HEAD"]).pipe(Effect.option),
    head: gitOutput(checkout, ["rev-parse", "--verify", "HEAD"]).pipe(Effect.option),
    clean: gitOutput(checkout, [
      "--no-optional-locks",
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]).pipe(Effect.map(Str.isEmpty), Effect.option),
  });
