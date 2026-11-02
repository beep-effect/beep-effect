/**
 * Shared changed-file discovery for bounded local quality commands.
 *
 * Every reader runs through `@beep/git`'s `Git` service (repo-cli-gh-git-consolidation W2, SPEC
 * D-10): the dirty-axis probes are `Git.unstagedChanges` / `Git.stagedChanges` /
 * `Git.untrackedFiles` with the G7 `diffFilter`, `noRenames` and `pathspec` options, and the
 * base-range read is `Git.changedFiles`. The kit's typed errors fold back onto the `DomainError`
 * wording the bounded capture produced through {@link adaptGitKitError}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { DomainError } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Order from "effect/Order";
import { formatCommandLine } from "../process/StepExec.ts";
import { adaptGitKitError } from "./GitExec.ts";
import type { GitInvocation } from "@beep/git/GitCommand";
import type { GitCommandErrorAdapter, GitKitError } from "./GitExec.ts";

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);
const normalizedFilePath = (value: string): string => normalizeSlashes(Str.trim(value));

/** The kit's paths in the shape the line capture produced: trimmed, forward slashes, no empties. */
const normalizedFilePaths: (paths: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.map(normalizedFilePath),
  A.filter(Str.isNonEmpty)
);

// The `DomainError` wording of the bounded line capture this module ran before W2: a non-zero
// exit carried the command line, the code and the trimmed output; a spawn failure its cause.
const changedFilesErrorAdapter: GitCommandErrorAdapter<DomainError> = {
  onSpawnFailure: (commandLine) => DomainError.newCause(`${commandLine} failed to run.`),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    DomainError.make({ message: `${commandLine} failed with exit code ${exitCode}: ${Str.trim(output)}` }),
  onTruncated: O.none(),
};

/** The diff flags the dirty-axis and base-range readers accept. */
type ChangedFileFilter = {
  /** `--diff-filter=<letters>`; omitted when every status counts. */
  readonly diffFilter?: string;
  /** `--no-renames`, so a moved file lists as its old and new path. */
  readonly noRenames?: boolean;
  /** Pathspecs appended behind `--`; empty for the whole tree. */
  readonly pathspecs: ReadonlyArray<string>;
};

const diffOptions = (filter: ChangedFileFilter) =>
  O.getSomesStruct({
    diffFilter: O.fromUndefinedOr(filter.diffFilter),
    noRenames: O.fromUndefinedOr(filter.noRenames),
    pathspec: O.liftPredicate(filter.pathspecs, A.isReadonlyArrayNonEmpty),
  });

/**
 * Collect the paths changed across a base range.
 *
 * **Example** (Collect the TypeScript changed since origin/main)
 *
 * ```ts
 * import { collectBaseRangeChangedFiles } from "@beep/repo-cli/test/SharedInternals"
 *
 * const changed = collectBaseRangeChangedFiles("/repo", {
 *   base: "origin/main",
 *   head: "HEAD",
 *   diffFilter: "ACMR",
 *   pathspecs: ["*.ts", "*.tsx"]
 * })
 * console.log(changed)
 * ```
 *
 * **Details**
 *
 * Runs `Git.changedFiles` (`diff --name-only -z <base>...<head>`) with the filter's flags. Paths
 * come back trimmed with forward slashes, as the line capture it replaces returned them; a failure
 * is a `DomainError` carrying the kit's command line and exit code.
 *
 * @param repoRoot - Absolute repository root.
 * @param range - The three-dot range and the diff flags.
 * @returns Normalized repo-relative paths, in git's order.
 * @category utilities
 * @since 0.0.0
 */
export const collectBaseRangeChangedFiles = Effect.fn("ChangedFiles.collectBaseRangeChangedFiles")(function* (
  repoRoot: string,
  range: ChangedFileFilter & { readonly base: string; readonly head: string }
): Effect.fn.Return<ReadonlyArray<string>, DomainError, Git> {
  const git = yield* Git;
  const options = { base: range.base, head: range.head, ...diffOptions(range) };
  return yield* git.changedFiles(repoRoot, options).pipe(
    Effect.mapBoth({
      onFailure: adaptGitKitError(
        GitCommand.changedFiles(range.base, range.head, false, options),
        changedFilesErrorAdapter
      ),
      onSuccess: normalizedFilePaths,
    })
  );
});

/**
 * Collect unstaged, staged, and untracked files from the dirty worktree.
 *
 * **Example** (Collect dirty TypeScript sources)
 *
 * ```ts
 * import { collectDirtyWorktreeFiles } from "@beep/repo-cli/test/SharedInternals"
 *
 * const dirty = collectDirtyWorktreeFiles("/repo", {
 *   diffFilter: "ACMR",
 *   pathspecs: ["*.ts", "*.tsx"],
 *   onProbeFailure: "ignore"
 * })
 * console.log(dirty)
 * ```
 *
 * **Details**
 *
 * The three probes are `Git.unstagedChanges` against `HEAD`, `Git.stagedChanges` and
 * `Git.untrackedFiles`; `diffFilter` and `noRenames` reach the two diff probes only, `pathspecs`
 * every probe. `onProbeFailure` selects between failing the whole scan (`"fail"`) and degrading a
 * single broken probe to no files (`"ignore"`), which callers that must tolerate a repository
 * without a `HEAD` commit rely on.
 *
 * @param repoRoot - Absolute repository root.
 * @param options - Diff flags, pathspecs and the per-probe failure policy.
 * @returns Repo-relative paths reported by the dirty-worktree probes, in probe order.
 * @category utilities
 * @since 0.0.0
 */
export const collectDirtyWorktreeFiles = Effect.fn("ChangedFiles.collectDirtyWorktreeFiles")(function* (
  repoRoot: string,
  options: ChangedFileFilter & { readonly onProbeFailure: "fail" | "ignore" }
): Effect.fn.Return<ReadonlyArray<string>, DomainError, Git> {
  const git = yield* Git;
  const diff = diffOptions(options);
  const unstaged = { head: "HEAD", ...diff };
  const pathspec = O.getSomesStruct({ pathspec: O.liftPredicate(options.pathspecs, A.isReadonlyArrayNonEmpty) });
  const probes: ReadonlyArray<readonly [GitInvocation, Effect.Effect<ReadonlyArray<string>, GitKitError>]> = [
    [GitCommand.unstagedChanges(false, unstaged), git.unstagedChanges(repoRoot, unstaged)],
    [GitCommand.stagedChanges(false, diff), git.stagedChanges(repoRoot, diff)],
    [GitCommand.untrackedFiles(false, options.pathspecs), git.untrackedFiles(repoRoot, pathspec)],
  ];
  const probed = yield* Effect.forEach(
    probes,
    ([invocation, probe]) =>
      probe.pipe(
        Effect.mapBoth({
          onFailure: flow(
            adaptGitKitError(invocation, changedFilesErrorAdapter),
            DomainError.newCause(
              `Unable to resolve dirty worktree files via "${formatCommandLine("git", invocation.redactedArgs)}".`
            )
          ),
          onSuccess: normalizedFilePaths,
        }),
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
 * import { collectChangedFiles } from "@beep/repo-cli/test/SharedInternals"
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
): Effect.fn.Return<ReadonlyArray<string>, DomainError, Git> {
  const baseChanged = yield* collectBaseRangeChangedFiles(repoRoot, {
    base,
    head,
    noRenames: true,
    pathspecs: A.empty(),
  }).pipe(Effect.mapError(DomainError.newCause(`Unable to resolve changed-file base range ${base}...${head}.`)));
  const workingTreeChanged = yield* collectDirtyWorktreeFiles(repoRoot, {
    noRenames: true,
    pathspecs: A.empty(),
    onProbeFailure: "fail",
  });

  return pipe([...baseChanged, ...workingTreeChanged], A.dedupe, A.sort(Order.String));
});
