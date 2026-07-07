/**
 * Tagged errors for the Quality command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Inspectable, Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/Quality.errors");

const messageWithCause = (message: string, cause: unknown): string =>
  `${message}: ${Inspectable.toStringUnknown(cause, 0)}`;

type QualityScriptCommandErrorOptions =
  | undefined
  | {
      readonly command?: undefined | string;
      readonly exitCode?: undefined | number;
    };

/**
 * Failure raised while validating changeset package references.
 *
 * @example
 * ```ts
 * import { ChangesetGraphError } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const error = new ChangesetGraphError({
 *   message: "Changeset graph validation failed."
 * })
 * console.log(error.message)
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export class ChangesetGraphError extends TaggedErrorClass<ChangesetGraphError>($I`ChangesetGraphError`)(
  "ChangesetGraphError",
  {
    message: S.String,
    file: S.optionalKey(S.String),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("ChangesetGraphError", {
    description: "Failure raised while validating changeset package references.",
  })
) {
  /**
   * Construct a changeset graph error from a cause and context.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, file?: string): ChangesetGraphError;
    (message: string, file?: string): (cause: unknown) => ChangesetGraphError;
  } = dual(
    3,
    (cause, message, file): ChangesetGraphError =>
      ChangesetGraphError.make({
        cause,
        message,
        ...O.getSomesStruct({
          file: O.fromUndefinedOr(file),
        }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Typed failure for repo operational commands.
 *
 * @example
 * ```ts
 * import { QualityScriptCommandError } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const error = new QualityScriptCommandError({ message: "failed" })
 * ```
 * @category errors
 * @since 0.0.0
 */
export class QualityScriptCommandError extends TaggedErrorClass<QualityScriptCommandError>(
  $I`QualityScriptCommandError`
)(
  "QualityScriptCommandError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("QualityScriptCommandError", {
    description: "Failure raised while running a migrated repo operational command.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a quality script command error from a cause and options.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: QualityScriptCommandErrorOptions): QualityScriptCommandError;
    (message: string, opts?: QualityScriptCommandErrorOptions): (cause: unknown) => QualityScriptCommandError;
  } = dual(
    3,
    (cause, message, { command, exitCode } = {}): QualityScriptCommandError =>
      QualityScriptCommandError.make({
        cause,
        message,
        ...O.getSomesStruct({
          command: O.fromUndefinedOr(command),
          exitCode: O.fromUndefinedOr(exitCode),
        }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Error raised when a quality task subprocess exits unsuccessfully.
 *
 * @example
 * ```ts
 * import { QualityTaskFailed } from "@beep/repo-cli/commands/Quality/Tasks"
 * const failure = new QualityTaskFailed({
 *   label: "lint",
 *   command: "bunx turbo run lint",
 *   exitCode: 1
 * })
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export class QualityTaskFailed extends TaggedErrorClass<QualityTaskFailed>($I`QualityTaskFailed`)(
  "QualityTaskFailed",
  {
    label: S.String,
    command: S.String,
    exitCode: S.Finite,
  },
  $I.annote("QualityTaskFailed", {
    description: "A quality subprocess exited with a non-zero status code.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode;

  /**
   * Construct a quality task failure from the subprocess result.
   *
   * @category constructors
   */
  static readonly new: {
    (exitCode: number, label: string, command: string): QualityTaskFailed;
    (label: string, command: string): (exitCode: number) => QualityTaskFailed;
  } = dual(
    3,
    (exitCode: number, label: string, command: string): QualityTaskFailed =>
      QualityTaskFailed.make({ label, command, exitCode })
  );

  static readonly mapError = Err.mapToError<QualityTaskFailed, [exitCode: number, label: string, command: string]>(
    (exitCode, label, command) => QualityTaskFailed.new(exitCode, label, command)
  );
}

/**
 * Error raised when a bounded quality task group completes with failed steps.
 *
 * @example
 * ```ts
 * import { QualityTaskGroupFailed, QualityTaskFailed } from "@beep/repo-cli/commands/Quality/Tasks"
 * const failure = new QualityTaskGroupFailed({
 *   label: "lint:policies",
 *   exitCode: 1,
 *   failures: [
 *     new QualityTaskFailed({
 *       label: "lint:spell",
 *       command: "bunx cspell .",
 *       exitCode: 1
 *     })
 *   ]
 * })
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export class QualityTaskGroupFailed extends TaggedErrorClass<QualityTaskGroupFailed>($I`QualityTaskGroupFailed`)(
  "QualityTaskGroupFailed",
  {
    label: S.String,
    exitCode: S.Finite,
    failures: S.Array(QualityTaskFailed),
  },
  $I.annote("QualityTaskGroupFailed", {
    description: "A bounded quality task group completed with one or more failed subprocesses.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode;

  /**
   * Construct a grouped quality task failure from failed subprocesses.
   *
   * @category constructors
   */
  static readonly new: {
    (failures: ReadonlyArray<QualityTaskFailed>, label: string, exitCode: number): QualityTaskGroupFailed;
    (label: string, exitCode: number): (failures: ReadonlyArray<QualityTaskFailed>) => QualityTaskGroupFailed;
  } = dual(
    3,
    (failures: ReadonlyArray<QualityTaskFailed>, label: string, exitCode: number): QualityTaskGroupFailed =>
      QualityTaskGroupFailed.make({ label, exitCode, failures })
  );

  static readonly mapError = Err.mapToError<
    QualityTaskGroupFailed,
    [failures: ReadonlyArray<QualityTaskFailed>, label: string, exitCode: number]
  >((failures, label, exitCode) => QualityTaskGroupFailed.new(failures, label, exitCode));
}

/**
 * Error raised when a quality task cannot resolve its required configuration.
 *
 * @example
 * ```ts
 * import { QualityTaskConfigurationError } from "@beep/repo-cli/commands/Quality/Tasks"
 * const error = new QualityTaskConfigurationError({
 *   message: "Could not find package.json"
 * })
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export class QualityTaskConfigurationError extends TaggedErrorClass<QualityTaskConfigurationError>(
  $I`QualityTaskConfigurationError`
)(
  "QualityTaskConfigurationError",
  {
    message: S.String,
  },
  $I.annote("QualityTaskConfigurationError", {
    description: "Quality task configuration could not be resolved.",
  })
) {
  static readonly new = (message: string): QualityTaskConfigurationError =>
    QualityTaskConfigurationError.make({ message });

  static readonly mapError = Err.mapCauseError<QualityTaskConfigurationError, [message: string]>((cause, message) =>
    QualityTaskConfigurationError.new(messageWithCause(message, cause))
  );
}

/**
 * Error raised when an unexpected quality task cause reaches the command boundary.
 *
 * @example
 * ```ts
 * import { UnexpectedQualityTaskFailure } from "@beep/repo-cli/commands/Quality/Tasks"
 * const error = new UnexpectedQualityTaskFailure({
 *   message: "Unexpected quality task failure"
 * })
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export class UnexpectedQualityTaskFailure extends TaggedErrorClass<UnexpectedQualityTaskFailure>(
  $I`UnexpectedQualityTaskFailure`
)(
  "UnexpectedQualityTaskFailure",
  {
    message: S.String,
  },
  $I.annote("UnexpectedQualityTaskFailure", {
    description: "Unexpected quality task failure preserved for the process runtime boundary.",
  })
) {
  static readonly new = (message: string): UnexpectedQualityTaskFailure =>
    UnexpectedQualityTaskFailure.make({ message });

  static readonly mapError = Err.mapCauseError<UnexpectedQualityTaskFailure, [message: string]>((cause, message) =>
    UnexpectedQualityTaskFailure.new(messageWithCause(message, cause))
  );
}
