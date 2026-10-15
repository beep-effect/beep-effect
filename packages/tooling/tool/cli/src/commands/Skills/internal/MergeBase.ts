/**
 * Reading a tracked file as the merge-base with a base ref holds it, so a
 * pull request cannot vouch for itself (CODEOWNERS owners, the review's old pins).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { SkillsCommandError } from "../Skills.errors.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const git = (repoRoot: string, args: ReadonlyArray<string>) =>
  runCapturedStreams({ command: "git", args, cwd: repoRoot, extendEnv: true }).pipe(
    SkillsCommandError.mapError(`Failed to spawn git ${A.join(args, " ")}.`, repoRoot)
  );

/**
 * Reads `path` at the merge-base of `HEAD` and `baseRef`.
 *
 * **Details**
 *
 * Fails typed when the merge-base cannot be resolved, naming `purpose`.
 * A base that does not carry the file yields `None` beside the merge-base.
 *
 * @internal
 * @param repoRoot - Absolute repository root.
 * @param baseRef - The ref to take the merge-base with, such as `origin/main`.
 * @param path - Repo-relative path of the file to read.
 * @param purpose - What the read is for, named in the failure.
 * @returns The merge-base revision and the file text, when present.
 * @category queries
 * @since 0.0.0
 */
export const readAtMergeBase = Effect.fn("SkillsMergeBase.readAtMergeBase")(function* (
  repoRoot: string,
  baseRef: string,
  path: string,
  purpose: string
): Effect.fn.Return<
  { readonly base: string; readonly text: O.Option<string> },
  SkillsCommandError,
  ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto
> {
  const mergeBase = yield* git(repoRoot, ["merge-base", "HEAD", baseRef]);
  if (mergeBase.exitCode !== 0) {
    return yield* SkillsCommandError.make({
      message: `Cannot resolve the merge-base of HEAD and ${baseRef} for ${purpose}: ${Str.trim(mergeBase.stderr)}`,
      file: repoRoot,
    });
  }
  const base = Str.trim(mergeBase.stdout);
  const shown = yield* git(repoRoot, ["show", `${base}:${path}`]);
  return { base, text: shown.exitCode === 0 ? O.some(shown.stdout) : O.none() };
});
