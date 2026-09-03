/**
 * Tagged errors for the Worktree command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import { O } from "@beep/utils";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { WorktreePreservationStep } from "./Worktree.schemas.ts";
import type { WorktreePreservationStep as WorktreePreservationStepType } from "./Worktree.schemas.ts";

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
 * **Example** (Make worktree command error)
 *
 * ```ts
 * import { WorktreeCommandError } from "@beep/repo-cli/commands/Worktree"
 *
 * const error = WorktreeCommandError.make({ message: "git worktree add failed" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorktreeCommandError extends S.TaggedError<WorktreeCommandError>($I`WorktreeCommandError`)(
  "WorktreeCommandError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    path: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<WorktreeCommandError>("WorktreeCommandError", {
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
        ...O.getSomesStruct({
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
 * **Example** (Create dirty worktree error)
 *
 * ```ts
 * import { WorktreeDirtyError } from "@beep/repo-cli/commands/Worktree"
 *
 * const error = WorktreeDirtyError.new("/tmp/beep-effect-worktrees/feature-x", 3)
 * console.log(error.changeCount)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorktreeDirtyError extends S.TaggedError<WorktreeDirtyError>($I`WorktreeDirtyError`)(
  "WorktreeDirtyError",
  {
    message: S.String,
    path: S.String,
    changeCount: S.Finite,
  },
  $I.annoteError<WorktreeDirtyError>("WorktreeDirtyError", {
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
      message: `Worktree ${path} has ${changeCount} uncommitted change(s); pass --archive to preserve and remove it, or --force to discard it.`,
    });
}

type WorktreePreservationErrorOptions =
  | undefined
  | {
      readonly cause?: unknown;
      readonly path?: string;
    };

/**
 * Archive retirement failure that occurred before worktree removal.
 *
 * **Details**
 *
 * `step` names the preservation boundary that failed. The archive-removal
 * workflow does not invoke `git worktree remove` after this error is raised.
 *
 * **Example** (Identify a failed manifest write)
 *
 * ```ts
 * import { WorktreePreservationError } from "@beep/repo-cli/commands/Worktree"
 *
 * const error = WorktreePreservationError.new("write-manifest", "Could not write manifest.")
 * console.log(error.step) // "write-manifest"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorktreePreservationError extends S.TaggedError<WorktreePreservationError>($I`WorktreePreservationError`)(
  "WorktreePreservationError",
  {
    message: S.String,
    step: WorktreePreservationStep,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<WorktreePreservationError>("WorktreePreservationError", {
    description: "A named worktree-residue preservation step failed before removal began.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;

  /**
   * Construct a preservation error with the step that failed.
   *
   * @param step - Preservation step that failed.
   * @param message - Human-readable failure description.
   * @param options - Optional cause and affected filesystem path.
   * @returns The constructed preservation error.
   * @category constructors
   */
  static readonly new = (
    step: WorktreePreservationStepType,
    message: string,
    options: WorktreePreservationErrorOptions = undefined
  ): WorktreePreservationError =>
    WorktreePreservationError.make({
      step,
      message: `Preservation step ${step} failed: ${message}`,
      ...O.getSomesStruct({
        cause: O.fromUndefinedOr(options?.cause),
        path: O.fromUndefinedOr(options?.path),
      }),
    });
}

/**
 * Creation refused because a worktree directory already exists at the target path.
 *
 * **Example** (Create exists worktree error)
 *
 * ```ts
 * import { WorktreeExistsError } from "@beep/repo-cli/commands/Worktree"
 *
 * const error = WorktreeExistsError.new("/tmp/beep-effect-worktrees/feature-x")
 * console.log(error.path)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorktreeExistsError extends S.TaggedError<WorktreeExistsError>($I`WorktreeExistsError`)(
  "WorktreeExistsError",
  {
    message: S.String,
    path: S.String,
  },
  $I.annoteError<WorktreeExistsError>("WorktreeExistsError", {
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
