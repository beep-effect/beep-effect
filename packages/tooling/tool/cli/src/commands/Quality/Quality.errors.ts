/**
 * Tagged errors for the Quality command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { commandErrorFields, messageWithCause } from "../../internal/cli/CommandErrorFields.ts";

const $I = $RepoCliId.create("commands/Quality/Quality.errors");

type QualityScriptCommandErrorOptions =
  | undefined
  | {
      readonly command?: undefined | string;
      readonly exitCode?: undefined | number;
    };

const ChangesetGraphErrorFields = {
  message: S.String,
  file: S.optionalKey(S.String),
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameChangesetGraphErrorFields = S.toEquivalence(
  S.TaggedStruct("ChangesetGraphError", {
    message: ChangesetGraphErrorFields.message,
    file: ChangesetGraphErrorFields.file,
  })
);
const sameChangesetGraphError = (self: ChangesetGraphError, that: ChangesetGraphError): boolean =>
  sameChangesetGraphErrorFields(self, that);

/**
 * Failure raised while validating changeset package references.
 *
 * **Example** (Raise a changeset graph error)
 *
 * ```ts
 * import { ChangesetGraphError } from "@beep/repo-cli/commands/Quality/ChangesetGraph"
 *
 * const error = new ChangesetGraphError({
 *   message: "Changeset graph validation failed."
 * })
 * console.log(error.message)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class ChangesetGraphError extends S.TaggedError<ChangesetGraphError>($I`ChangesetGraphError`)(
  "ChangesetGraphError",
  ChangesetGraphErrorFields,
  $I.annoteClass<
    S.declare<ChangesetGraphError>,
    readonly [S.TaggedStruct<"ChangesetGraphError", typeof ChangesetGraphErrorFields>]
  >("ChangesetGraphError", {
    description: "Failure raised while validating changeset package references.",
    toEquivalence: () => sameChangesetGraphError,
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

const ChangesetStatusErrorFields = {
  message: S.String,
  file: S.optionalKey(S.String),
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameChangesetStatusErrorFields = S.toEquivalence(
  S.TaggedStruct("ChangesetStatusError", {
    message: ChangesetStatusErrorFields.message,
    file: ChangesetStatusErrorFields.file,
  })
);
const sameChangesetStatusError = (self: ChangesetStatusError, that: ChangesetStatusError): boolean =>
  sameChangesetStatusErrorFields(self, that);

/**
 * Failure raised while running the path-aware changeset status wrapper.
 *
 * **Example** (Raise a changeset status error)
 *
 * ```ts
 * import { ChangesetStatusError } from "@beep/repo-cli/commands/Quality/ChangesetStatus"
 *
 * const error = new ChangesetStatusError({
 *   message: "Changeset status validation failed."
 * })
 * console.log(error.message)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class ChangesetStatusError extends S.TaggedError<ChangesetStatusError>($I`ChangesetStatusError`)(
  "ChangesetStatusError",
  ChangesetStatusErrorFields,
  $I.annoteClass<
    S.declare<ChangesetStatusError>,
    readonly [S.TaggedStruct<"ChangesetStatusError", typeof ChangesetStatusErrorFields>]
  >("ChangesetStatusError", {
    description: "Failure raised while running the path-aware changeset status wrapper.",
    toEquivalence: () => sameChangesetStatusError,
  })
) {
  /**
   * Construct a changeset status error from a cause and context.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, file?: string): ChangesetStatusError;
    (message: string, file?: string): (cause: unknown) => ChangesetStatusError;
  } = dual(
    3,
    (cause, message, file): ChangesetStatusError =>
      ChangesetStatusError.make({
        cause,
        message,
        ...O.getSomesStruct({
          file: O.fromUndefinedOr(file),
        }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}

// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameQualityScriptCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("QualityScriptCommandError", {
    message: commandErrorFields.message,
    command: commandErrorFields.command,
    exitCode: commandErrorFields.exitCode,
  })
);
const sameQualityScriptCommandError = (self: QualityScriptCommandError, that: QualityScriptCommandError): boolean =>
  sameQualityScriptCommandErrorFields(self, that);

/**
 * Typed failure for repo operational commands.
 *
 * **Example** (Raise a quality script command error)
 *
 * ```ts
 * import { QualityScriptCommandError } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const error = new QualityScriptCommandError({ message: "failed" })
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class QualityScriptCommandError extends S.TaggedError<QualityScriptCommandError>($I`QualityScriptCommandError`)(
  "QualityScriptCommandError",
  commandErrorFields,
  $I.annoteClass<
    S.declare<QualityScriptCommandError>,
    readonly [S.TaggedStruct<"QualityScriptCommandError", typeof commandErrorFields>]
  >("QualityScriptCommandError", {
    description: "Failure raised while running a migrated repo operational command.",
    toEquivalence: () => sameQualityScriptCommandError,
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

const QualityTaskFailedFields = {
  label: S.String,
  command: S.String,
  exitCode: S.Finite,
} satisfies S.Struct.Fields;
const sameQualityTaskFailedFields = S.toEquivalence(S.TaggedStruct("QualityTaskFailed", QualityTaskFailedFields));
const sameQualityTaskFailed = (self: QualityTaskFailed, that: QualityTaskFailed): boolean =>
  sameQualityTaskFailedFields(self, that);

/**
 * Error raised when a quality task subprocess exits unsuccessfully.
 *
 * **Example** (Raise a quality task failed)
 *
 * ```ts
 * import { QualityTaskFailed } from "@beep/repo-cli/commands/Quality/Tasks"
 * const failure = new QualityTaskFailed({
 *   label: "lint",
 *   command: "bunx turbo run lint",
 *   exitCode: 1
 * })
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class QualityTaskFailed extends S.TaggedError<QualityTaskFailed>($I`QualityTaskFailed`)(
  "QualityTaskFailed",
  QualityTaskFailedFields,
  $I.annoteClass<
    S.declare<QualityTaskFailed>,
    readonly [S.TaggedStruct<"QualityTaskFailed", typeof QualityTaskFailedFields>]
  >("QualityTaskFailed", {
    description: "A quality subprocess exited with a non-zero status code.",
    toEquivalence: () => sameQualityTaskFailed,
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

const QualityTaskGroupFailedFields = {
  label: S.String,
  exitCode: S.Finite,
  failures: S.Array(QualityTaskFailed),
} satisfies S.Struct.Fields;
const sameQualityTaskGroupFailedFields = S.toEquivalence(
  S.TaggedStruct("QualityTaskGroupFailed", QualityTaskGroupFailedFields)
);
const sameQualityTaskGroupFailed = (self: QualityTaskGroupFailed, that: QualityTaskGroupFailed): boolean =>
  sameQualityTaskGroupFailedFields(self, that);

/**
 * Error raised when a bounded quality task group completes with failed steps.
 *
 * **Example** (Raise a quality task group failed)
 *
 * ```ts
 * import { QualityTaskGroupFailed, QualityTaskFailed } from "@beep/repo-cli/commands/Quality/Tasks"
 * const failure = new QualityTaskGroupFailed({
 *   label: "lint:policies",
 *   exitCode: 1,
 *   failures: [
 *     new QualityTaskFailed({
 *       label: "lint:typos",
 *       command: "bunx typos",
 *       exitCode: 1
 *     })
 *   ]
 * })
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class QualityTaskGroupFailed extends S.TaggedError<QualityTaskGroupFailed>($I`QualityTaskGroupFailed`)(
  "QualityTaskGroupFailed",
  QualityTaskGroupFailedFields,
  $I.annoteClass<
    S.declare<QualityTaskGroupFailed>,
    readonly [S.TaggedStruct<"QualityTaskGroupFailed", typeof QualityTaskGroupFailedFields>]
  >("QualityTaskGroupFailed", {
    description: "A bounded quality task group completed with one or more failed subprocesses.",
    toEquivalence: () => sameQualityTaskGroupFailed,
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

const QualityTaskConfigurationErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameQualityTaskConfigurationErrorFields = S.toEquivalence(
  S.TaggedStruct("QualityTaskConfigurationError", QualityTaskConfigurationErrorFields)
);
const sameQualityTaskConfigurationError = (
  self: QualityTaskConfigurationError,
  that: QualityTaskConfigurationError
): boolean => sameQualityTaskConfigurationErrorFields(self, that);

/**
 * Error raised when a quality task cannot resolve its required configuration.
 *
 * **Example** (Raise a quality task configuration error)
 *
 * ```ts
 * import { QualityTaskConfigurationError } from "@beep/repo-cli/commands/Quality/Tasks"
 * const error = new QualityTaskConfigurationError({
 *   message: "Could not find package.json"
 * })
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class QualityTaskConfigurationError extends S.TaggedError<QualityTaskConfigurationError>(
  $I`QualityTaskConfigurationError`
)(
  "QualityTaskConfigurationError",
  QualityTaskConfigurationErrorFields,
  $I.annoteClass<
    S.declare<QualityTaskConfigurationError>,
    readonly [S.TaggedStruct<"QualityTaskConfigurationError", typeof QualityTaskConfigurationErrorFields>]
  >("QualityTaskConfigurationError", {
    description: "Quality task configuration could not be resolved.",
    toEquivalence: () => sameQualityTaskConfigurationError,
  })
) {
  static readonly new = (message: string): QualityTaskConfigurationError =>
    QualityTaskConfigurationError.make({ message });

  static readonly mapError = Err.mapCauseError<QualityTaskConfigurationError, [message: string]>((cause, message) =>
    QualityTaskConfigurationError.new(messageWithCause(message, cause))
  );
}

const UnexpectedQualityTaskFailureFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameUnexpectedQualityTaskFailureFields = S.toEquivalence(
  S.TaggedStruct("UnexpectedQualityTaskFailure", UnexpectedQualityTaskFailureFields)
);
const sameUnexpectedQualityTaskFailure = (
  self: UnexpectedQualityTaskFailure,
  that: UnexpectedQualityTaskFailure
): boolean => sameUnexpectedQualityTaskFailureFields(self, that);

/**
 * Error raised when an unexpected quality task cause reaches the command boundary.
 *
 * **Example** (Raise an unexpected quality task failure)
 *
 * ```ts
 * import { UnexpectedQualityTaskFailure } from "@beep/repo-cli/commands/Quality/Tasks"
 * const error = new UnexpectedQualityTaskFailure({
 *   message: "Unexpected quality task failure"
 * })
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class UnexpectedQualityTaskFailure extends S.TaggedError<UnexpectedQualityTaskFailure>(
  $I`UnexpectedQualityTaskFailure`
)(
  "UnexpectedQualityTaskFailure",
  UnexpectedQualityTaskFailureFields,
  $I.annoteClass<
    S.declare<UnexpectedQualityTaskFailure>,
    readonly [S.TaggedStruct<"UnexpectedQualityTaskFailure", typeof UnexpectedQualityTaskFailureFields>]
  >("UnexpectedQualityTaskFailure", {
    description: "Unexpected quality task failure preserved for the process runtime boundary.",
    toEquivalence: () => sameUnexpectedQualityTaskFailure,
  })
) {
  static readonly new = (message: string): UnexpectedQualityTaskFailure =>
    UnexpectedQualityTaskFailure.make({ message });

  static readonly mapError = Err.mapCauseError<UnexpectedQualityTaskFailure, [message: string]>((cause, message) =>
    UnexpectedQualityTaskFailure.new(messageWithCause(message, cause))
  );
}
