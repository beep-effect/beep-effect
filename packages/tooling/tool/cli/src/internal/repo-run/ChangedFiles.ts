/**
 * Shared changed-file discovery for bounded local quality commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Effect, Order, pipe } from "effect";
import * as O from "effect/Option";
import { runCaptured } from "../process/StepExec.ts";

const normalizeSlashes = (value: string): string => Str.replace(/\\\\/g, "/")(value);
const normalizedFilePath = (value: string): string => normalizeSlashes(Str.trim(value));
const isNonEmptyLine = (value: string): boolean => Str.isNonEmpty(Str.trim(value));

const runGitLines = Effect.fn("ChangedFiles.runGitLines")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const result = yield* runCaptured({
    command: "git",
    args,
    cwd: repoRoot,
    source: "stdout",
  });
  if (result.exitCode !== 0) {
    return yield* DomainError.make({
      message: `git ${A.join(args, " ")} failed with exit code ${result.exitCode}: ${Str.trim(result.output)}`,
    });
  }

  return pipe(Str.split(/\r?\n/)(result.output), A.map(normalizedFilePath), A.filter(isNonEmptyLine));
});

/**
 * Collect committed and dirty files for a local base range.
 *
 * **Example** (Collect local quality scope)
 *
 * ```ts
 * import { collectChangedFiles } from "@beep/repo-cli/internal/repo-run/ChangedFiles"
 *
 * const changed = collectChangedFiles("/repo", "origin/main", "HEAD")
 * console.log(changed)
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param base - Git base ref for the three-dot comparison.
 * @param head - Git head ref for the three-dot comparison.
 * @returns Sorted repo-relative paths from the base range and dirty worktree.
 * @category utilities
 * @since 0.0.0
 */
export const collectChangedFiles = Effect.fn("ChangedFiles.collectChangedFiles")(function* (
  repoRoot: string,
  base: string,
  head: string
) {
  const baseChanged = yield* runGitLines(repoRoot, ["diff", "--name-only", `${base}...${head}`]).pipe(
    Effect.mapError(DomainError.newCause(`Unable to resolve changed-file base range ${base}...${head}.`))
  );
  const workingTreeChanged = yield* Effect.forEach(
    [
      ["diff", "--name-only", "HEAD"] as const,
      ["diff", "--cached", "--name-only"] as const,
      ["ls-files", "--others", "--exclude-standard"] as const,
    ],
    (args) => runGitLines(repoRoot, args).pipe(Effect.option, Effect.map(O.getOrElse(A.empty<string>))),
    { concurrency: "unbounded" }
  );

  return pipe([...baseChanged, ...A.flatten(workingTreeChanged)], A.dedupe, A.sort(Order.String));
});
