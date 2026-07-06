/**
 * Tagged errors for the Worktree command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { O, R } from "@beep/utils";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Worktree/Worktree.errors");

type WorktreeCommandErrorOptions =
  | undefined
  | {
      readonly command?: string;
      readonly exitCode?: number;
      readonly path?: string;
    };

/**
 * Operational failure raised while planning or running a worktree operation.
 *
 * @example
 * ```ts
 * import { WorktreeCommandError } from "@beep/repo-cli/commands/Worktree"
 *
 * const error = WorktreeCommandError.make({ message: "git worktree add failed" })
 * console.log(error.message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class WorktreeCommandError extends TaggedErrorClass<WorktreeCommandError>($I`WorktreeCommandError`)(
  "WorktreeCommandError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    path: S.optionalKey(S.String),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("WorktreeCommandError", {
    description: "Failure raised while planning or executing a git worktree operation.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a worktree command error from a cause and optional command context.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: WorktreeCommandErrorOptions): WorktreeCommandError;
    (message: string, opts?: WorktreeCommandErrorOptions): (cause: unknown) => WorktreeCommandError;
  } = dual(
    3,
    (cause: unknown, message: string, { command, exitCode, path } = {}): WorktreeCommandError =>
      WorktreeCommandError.make({
        cause,
        message,
        ...R.getSomes({
          command: O.fromUndefinedOr(command),
          exitCode: O.fromUndefinedOr(exitCode),
          path: O.fromUndefinedOr(path),
        }),
      })
  );
}

/**
 * Removal refused because the target worktree has uncommitted changes.
 *
 * @example
 * ```ts
 * import { WorktreeDirtyError } from "@beep/repo-cli/commands/Worktree"
 *
 * const error = WorktreeDirtyError.new("/tmp/beep-effect-worktrees/feature-x", 3)
 * console.log(error.changeCount)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class WorktreeDirtyError extends TaggedErrorClass<WorktreeDirtyError>($I`WorktreeDirtyError`)(
  "WorktreeDirtyError",
  {
    message: S.String,
    path: S.String,
    changeCount: S.Finite,
  },
  $I.annote("WorktreeDirtyError", {
    description: "Worktree removal was refused because the target has uncommitted changes.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;

  /**
   * Construct a dirty-worktree error from the target path and pending change count.
   *
   * @param path - Absolute path of the worktree that refused removal.
   * @param changeCount - Number of uncommitted changes detected.
   * @returns The constructed dirty-worktree error.
   * @category constructors
   */
  static readonly new = (path: string, changeCount: number): WorktreeDirtyError =>
    WorktreeDirtyError.make({
      path,
      changeCount,
      message: `Worktree ${path} has ${changeCount} uncommitted change(s); pass --force to remove it anyway.`,
    });
}

/**
 * Creation refused because a worktree directory already exists at the target path.
 *
 * @example
 * ```ts
 * import { WorktreeExistsError } from "@beep/repo-cli/commands/Worktree"
 *
 * const error = WorktreeExistsError.new("/tmp/beep-effect-worktrees/feature-x")
 * console.log(error.path)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class WorktreeExistsError extends TaggedErrorClass<WorktreeExistsError>($I`WorktreeExistsError`)(
  "WorktreeExistsError",
  {
    message: S.String,
    path: S.String,
  },
  $I.annote("WorktreeExistsError", {
    description: "Worktree creation was refused because a directory already exists at the target path.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;

  /**
   * Construct a worktree-exists error from the occupied target path.
   *
   * @param path - Absolute path that already contains a worktree.
   * @returns The constructed worktree-exists error.
   * @category constructors
   */
  static readonly new = (path: string): WorktreeExistsError =>
    WorktreeExistsError.make({
      path,
      message: `A worktree already exists at ${path}.`,
    });
}
