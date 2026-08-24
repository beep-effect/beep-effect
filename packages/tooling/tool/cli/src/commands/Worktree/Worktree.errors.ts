/**
 * Tagged errors for the Worktree command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { O } from "@beep/utils";
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

const WorktreeCommandErrorFields = {
  message: S.String,
  command: S.optionalKey(S.String),
  exitCode: S.optionalKey(S.Finite),
  path: S.optionalKey(S.String),
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameWorktreeCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("WorktreeCommandError", {
    message: WorktreeCommandErrorFields.message,
    command: WorktreeCommandErrorFields.command,
    exitCode: WorktreeCommandErrorFields.exitCode,
    path: WorktreeCommandErrorFields.path,
  })
);
const sameWorktreeCommandError = (self: WorktreeCommandError, that: WorktreeCommandError): boolean =>
  sameWorktreeCommandErrorFields(self, that);

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
  WorktreeCommandErrorFields,
  $I.annoteClass<
    S.declare<WorktreeCommandError>,
    readonly [S.TaggedStruct<"WorktreeCommandError", typeof WorktreeCommandErrorFields>]
  >("WorktreeCommandError", {
    description: "Failure raised while planning or executing a git worktree operation.",
    toEquivalence: () => sameWorktreeCommandError,
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

const WorktreeDirtyErrorFields = {
  message: S.String,
  path: S.String,
  changeCount: S.Finite,
} satisfies S.Struct.Fields;
const sameWorktreeDirtyErrorFields = S.toEquivalence(S.TaggedStruct("WorktreeDirtyError", WorktreeDirtyErrorFields));
const sameWorktreeDirtyError = (self: WorktreeDirtyError, that: WorktreeDirtyError): boolean =>
  sameWorktreeDirtyErrorFields(self, that);

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
  WorktreeDirtyErrorFields,
  $I.annoteClass<
    S.declare<WorktreeDirtyError>,
    readonly [S.TaggedStruct<"WorktreeDirtyError", typeof WorktreeDirtyErrorFields>]
  >("WorktreeDirtyError", {
    description: "Worktree removal was refused because the target has uncommitted changes.",
    toEquivalence: () => sameWorktreeDirtyError,
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

const WorktreeExistsErrorFields = {
  message: S.String,
  path: S.String,
} satisfies S.Struct.Fields;
const sameWorktreeExistsErrorFields = S.toEquivalence(S.TaggedStruct("WorktreeExistsError", WorktreeExistsErrorFields));
const sameWorktreeExistsError = (self: WorktreeExistsError, that: WorktreeExistsError): boolean =>
  sameWorktreeExistsErrorFields(self, that);

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
  WorktreeExistsErrorFields,
  $I.annoteClass<
    S.declare<WorktreeExistsError>,
    readonly [S.TaggedStruct<"WorktreeExistsError", typeof WorktreeExistsErrorFields>]
  >("WorktreeExistsError", {
    description: "Worktree creation was refused because a directory already exists at the target path.",
    toEquivalence: () => sameWorktreeExistsError,
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
