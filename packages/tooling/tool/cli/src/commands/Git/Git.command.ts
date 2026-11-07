/**
 * Git command group: repository-side Git integration commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { MergeDriverProjectionPath } from "./Git.schemas.ts";

const isProjectionPath = S.is(MergeDriverProjectionPath);

/**
 * The stderr line the regenerate merge driver prints for one conflicted path.
 *
 * **Details**
 *
 * A low-level merge driver runs before Git has installed the complete incoming
 * tree, so repository generators cannot safely resolve a projection at this
 * boundary: they could read stale manifests and certify stale output. The
 * driver therefore always leaves the file conflicted and exits 1; it only
 * distinguishes projections (regenerate after the merge) from paths that must
 * never be routed to it.
 *
 * **Example** (Explain a refused path)
 *
 * ```ts
 * import { regenerateMergeDriverMessage } from "@beep/repo-cli/commands/Git"
 *
 * console.log(regenerateMergeDriverMessage("bun.lock"))
 * // "regenerate merge driver refused non-projection path: bun.lock"
 * ```
 *
 * @param repoPath - Repository-relative path Git passed as `%P`.
 * @returns The diagnostic written to stderr before exiting 1.
 * @category utilities
 * @since 0.0.0
 */
export const regenerateMergeDriverMessage = (repoPath: string): string =>
  isProjectionPath(repoPath)
    ? `regenerate merge driver left ${repoPath} conflicted; regenerate it after Git installs the merged tree`
    : `regenerate merge driver refused non-projection path: ${repoPath}`;

const regenerateCommand = Command.make(
  "regenerate",
  {
    ancestor: Argument.String("ancestor").pipe(Argument.withDescription("Merge ancestor's version (%O)")),
    current: Argument.String("current").pipe(Argument.withDescription("Current branch's version (%A)")),
    other: Argument.String("other").pipe(Argument.withDescription("Other branch's version (%B)")),
    repoPath: Argument.String("path").pipe(Argument.withDescription("Repository-relative path being merged (%P)")),
  },
  Effect.fn(function* ({ repoPath }) {
    const message = regenerateMergeDriverMessage(repoPath);
    yield* Console.error(message);
    return yield* failWithReportedExit(message, 1);
  })
).pipe(
  Command.withDescription(
    "Fail-closed Git merge driver for generator projections: always leaves the path conflicted (exit 1)"
  )
);

const mergeDriverCommand = Command.make("merge-driver", {}, () =>
  Console.log("git merge-driver commands: regenerate")
).pipe(
  Command.withDescription("Git merge drivers configured by beep worktree prepare"),
  Command.withSubcommands([regenerateCommand])
);

/**
 * Git integration command group.
 *
 * **Example** (Inspect the git command)
 *
 * ```ts
 * import { gitCommand } from "@beep/repo-cli/commands/Git"
 *
 * console.log(gitCommand.name) // "git"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const gitCommand = Command.make("git", {}, () => Console.log("git commands: merge-driver")).pipe(
  Command.withDescription("Repository Git integration commands"),
  Command.withSubcommands([mergeDriverCommand])
);
