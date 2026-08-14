/**
 * Shared changed-file discovery for bounded local quality commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Effect, Order, pipe } from "effect";
import { runCaptured } from "../process/StepExec.ts";

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);
const normalizedFilePath = (value: string): string => normalizeSlashes(Str.trim(value));
const isNonEmptyLine = (value: string): boolean => Str.isNonEmpty(Str.trim(value));

/**
 * Run a git command and read stdout as normalized repo-relative paths.
 *
 * **Example** (Read the staged file list)
 *
 * ```ts
 * import { runGitLines } from "@beep/repo-cli/internal/repo-run/ChangedFiles"
 *
 * const staged = runGitLines("/repo", ["diff", "--cached", "--name-only"])
 * console.log(staged)
 * ```
 *
 * **Details**
 *
 * Blank lines are dropped and backslashes are rewritten to forward slashes so callers
 * compare paths against repo-relative package prefixes. A non-zero exit code fails with
 * a `DomainError` carrying the trimmed command output.
 *
 * @param repoRoot - Absolute repository root.
 * @param args - Git arguments, excluding the `git` executable itself.
 * @returns Normalized repo-relative paths, one per emitted line.
 * @category utilities
 * @since 0.0.0
 */
export const runGitLines = Effect.fn("ChangedFiles.runGitLines")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
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

const pathspecArgs = A.match({
  onEmpty: A.empty<string>,
  onNonEmpty: (pathspecs: A.NonEmptyReadonlyArray<string>): ReadonlyArray<string> => ["--", ...pathspecs],
});

const dirtyWorktreeProbes = (
  diffArgs: ReadonlyArray<string>,
  pathspecs: ReadonlyArray<string>
): ReadonlyArray<ReadonlyArray<string>> => {
  const pathspec = pathspecArgs(pathspecs);
  return [
    ["diff", "--name-only", ...diffArgs, "HEAD", ...pathspec],
    ["diff", "--cached", "--name-only", ...diffArgs, ...pathspec],
    ["ls-files", "--others", "--exclude-standard", ...pathspec],
  ];
};

/**
 * Collect unstaged, staged, and untracked files from the dirty worktree.
 *
 * **Example** (Collect dirty TypeScript sources)
 *
 * ```ts
 * import { collectDirtyWorktreeFiles } from "@beep/repo-cli/internal/repo-run/ChangedFiles"
 *
 * const dirty = collectDirtyWorktreeFiles("/repo", {
 *   diffArgs: ["--diff-filter=ACMR"],
 *   pathspecs: ["*.ts", "*.tsx"],
 *   onProbeFailure: "ignore"
 * })
 * console.log(dirty)
 * ```
 *
 * **Details**
 *
 * `diffArgs` extends the two `git diff` probes only; `pathspecs` are appended to every
 * probe behind a `--` separator. `onProbeFailure` selects between failing the whole scan
 * (`"fail"`) and degrading a single broken probe to no files (`"ignore"`), which callers
 * that must tolerate a repository without a `HEAD` commit rely on.
 *
 * @param repoRoot - Absolute repository root.
 * @param options - Probe arguments and the per-probe failure policy.
 * @returns Repo-relative paths reported by the dirty-worktree probes, in probe order.
 * @category utilities
 * @since 0.0.0
 */
export const collectDirtyWorktreeFiles = Effect.fn("ChangedFiles.collectDirtyWorktreeFiles")(function* (
  repoRoot: string,
  options: {
    readonly diffArgs: ReadonlyArray<string>;
    readonly pathspecs: ReadonlyArray<string>;
    readonly onProbeFailure: "fail" | "ignore";
  }
) {
  const probed = yield* Effect.forEach(
    dirtyWorktreeProbes(options.diffArgs, options.pathspecs),
    (args) =>
      runGitLines(repoRoot, args).pipe(
        Effect.mapError(DomainError.newCause(`Unable to resolve dirty worktree files via "git ${A.join(args, " ")}".`)),
        Effect.catch((error) =>
          options.onProbeFailure === "ignore" ? Effect.succeed(A.empty<string>()) : Effect.fail(error)
        )
      ),
    { concurrency: "unbounded" }
  );

  return A.flatten(probed);
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
  const baseChanged = yield* runGitLines(repoRoot, ["diff", "--no-renames", "--name-only", `${base}...${head}`]).pipe(
    Effect.mapError(DomainError.newCause(`Unable to resolve changed-file base range ${base}...${head}.`))
  );
  const workingTreeChanged = yield* collectDirtyWorktreeFiles(repoRoot, {
    diffArgs: ["--no-renames"],
    pathspecs: A.empty(),
    onProbeFailure: "fail",
  });

  return pipe([...baseChanged, ...workingTreeChanged], A.dedupe, A.sort(Order.String));
});
