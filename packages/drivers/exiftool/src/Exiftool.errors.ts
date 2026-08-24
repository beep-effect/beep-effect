/**
 * Typed errors raised by the native ExifTool driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ExiftoolId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $ExiftoolId.create("Exiftool.errors");
const ExiftoolDefect = S.Defect({ includeStack: true });
// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
const isExiftoolDefect = S.is(ExiftoolDefect);

/**
 * Non-negative integer process exit status.
 *
 * **Example** (Making a process exit code)
 *
 * ```ts
 * import { ProcessExitCode } from "@beep/exiftool"
 *
 * const code = ProcessExitCode.make(1)
 * console.log(code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ProcessExitCode = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`ProcessExitCodeMinimumCheck`,
    title: "Process Exit Code Minimum",
    description: "Native process exit statuses are non-negative integers.",
    message: "Expected a non-negative process exit code",
  })
).pipe(
  $I.annoteSchema("ProcessExitCode", {
    description: "Non-negative integer process exit status.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative integer process exit status.
 *
 * **Example** (Using ProcessExitCode type)
 *
 * ```ts
 * import { ProcessExitCode } from "@beep/exiftool"
 * import type { ProcessExitCode as ProcessExitCodeValue } from "@beep/exiftool"
 *
 * const code: ProcessExitCodeValue = ProcessExitCode.make(1)
 * console.log(code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type ProcessExitCode = typeof ProcessExitCode.Type;

type ExiftoolErrorContextInput = {
  readonly cause?: unknown;
  readonly command?: string;
  readonly exitCode?: ProcessExitCode;
  readonly stderr?: string;
  readonly stdout?: string;
};

const causeFromUnknown = (cause: unknown): O.Option<typeof ExiftoolDefect.Type> =>
  P.hasInspectableObjectShape(cause) && isExiftoolDefect(cause) ? O.some(cause) : O.none();

const optionsFromInput = (options: ExiftoolErrorContextInput): ExiftoolErrorFromUnknownOptions =>
  // shared driver boundary idiom; no in-family home; future foundation capability candidate.
  // fallow-ignore-next-line code-duplication -- shared driver boundary idiom; no in-family home, future foundation capability candidate
  ExiftoolErrorFromUnknownOptions.make({
    cause: causeFromUnknown(options.cause),
    command: O.fromUndefinedOr(options.command),
    exitCode: O.fromUndefinedOr(options.exitCode),
    stderr: O.fromUndefinedOr(options.stderr),
    stdout: O.fromUndefinedOr(options.stdout),
  });

/**
 * Additional process context captured for an ExifTool failure.
 *
 * **Example** (Building error context)
 *
 * ```ts
 * import { ExiftoolErrorContext } from "@beep/exiftool"
 * import * as O from "effect/Option"
 *
 * const context = ExiftoolErrorContext.make({ command: O.some("exiftool"), exitCode: O.some(1) })
 * console.log(context)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExiftoolErrorContext extends S.Class<ExiftoolErrorContext>($I`ExiftoolErrorContext`)(
  {
    command: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorContext.command", {
        description: "Native executable path or command name involved in the failure, when available.",
      })
    ),
    exitCode: S.OptionFromOptionalKey(ProcessExitCode).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorContext.exitCode", {
        description: "Native process exit status, when the process returned one.",
      })
    ),
    stderr: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorContext.stderr", {
        description: "Captured standard error text, when available.",
      })
    ),
    stdout: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorContext.stdout", {
        description: "Captured standard output text, when available.",
      })
    ),
  },
  $I.annote("ExiftoolErrorContext", {
    description: "Additional process context captured for an ExifTool failure.",
  })
) {}

const existingExiftoolError = (cause: unknown): O.Option<ExiftoolError> =>
  ExiftoolError.is(cause) ? O.some(cause) : O.none();

/**
 * Options used when normalizing unknown ExifTool boundary failures.
 *
 * **Example** (Building from-unknown options)
 *
 * ```ts
 * import { ExiftoolErrorFromUnknownOptions } from "@beep/exiftool"
 * import * as O from "effect/Option"
 *
 * const options = ExiftoolErrorFromUnknownOptions.make({
 *   command: O.some("exiftool"),
 *   exitCode: O.some(1),
 *   stderr: O.some("invalid input")
 * })
 * console.log(options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExiftoolErrorFromUnknownOptions extends S.Class<ExiftoolErrorFromUnknownOptions>(
  $I`ExiftoolErrorFromUnknownOptions`
)(
  {
    cause: S.OptionFromOptionalKey(ExiftoolDefect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorFromUnknownOptions.cause", {
        description: "Inspectable originating defect, when available.",
      })
    ),
    command: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorFromUnknownOptions.command", {
        description: "Native executable path or command name involved in the failure, when available.",
      })
    ),
    exitCode: S.OptionFromOptionalKey(ProcessExitCode).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorFromUnknownOptions.exitCode", {
        description: "Native process exit status, when the process returned one.",
      })
    ),
    stderr: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorFromUnknownOptions.stderr", {
        description: "Captured standard error text, when available.",
      })
    ),
    stdout: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ExiftoolErrorFromUnknownOptions.stdout", {
        description: "Captured standard output text, when available.",
      })
    ),
  },
  $I.annote("ExiftoolErrorFromUnknownOptions", {
    description: "Options used when normalizing unknown ExifTool boundary failures.",
  })
) {}

const ExiftoolErrorFields = {
  command: S.OptionFromOptionalKey(S.String).pipe(
    SchemaUtils.withNoneDefault,
    $I.annoteKey("ExiftoolError.command", {
      description: "Native executable path or command name involved in the failure, when available.",
    })
  ),
  cause: S.OptionFromOptionalKey(ExiftoolDefect).pipe(
    SchemaUtils.withNoneDefault,
    $I.annoteKey("ExiftoolError.cause", {
      description: "Inspectable originating defect, when available.",
    })
  ),
  exitCode: S.OptionFromOptionalKey(ProcessExitCode).pipe(
    SchemaUtils.withNoneDefault,
    $I.annoteKey("ExiftoolError.exitCode", {
      description: "Native process exit status, when the process returned one.",
    })
  ),
  message: S.String.pipe(
    $I.annoteKey("ExiftoolError.message", {
      description: "Human-readable ExifTool driver failure summary.",
    })
  ),
  operation: S.String.pipe(
    $I.annoteKey("ExiftoolError.operation", {
      description: "Driver operation that emitted the failure.",
    })
  ),
  stderr: S.OptionFromOptionalKey(S.String).pipe(
    SchemaUtils.withNoneDefault,
    $I.annoteKey("ExiftoolError.stderr", {
      description: "Captured standard error text, when available.",
    })
  ),
  stdout: S.OptionFromOptionalKey(S.String).pipe(
    SchemaUtils.withNoneDefault,
    $I.annoteKey("ExiftoolError.stdout", {
      description: "Captured standard output text, when available.",
    })
  ),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const ExiftoolErrorEquivalenceFields = {
  command: ExiftoolErrorFields.command,
  exitCode: ExiftoolErrorFields.exitCode,
  message: ExiftoolErrorFields.message,
  operation: ExiftoolErrorFields.operation,
  stderr: ExiftoolErrorFields.stderr,
  stdout: ExiftoolErrorFields.stdout,
} satisfies S.Struct.Fields;
const sameExiftoolErrorFields = S.toEquivalence(S.TaggedStruct("ExiftoolError", ExiftoolErrorEquivalenceFields));
const sameExiftoolError = (self: ExiftoolError, that: ExiftoolError): boolean => sameExiftoolErrorFields(self, that);

/**
 * Technical failure raised by the `@beep/exiftool` driver boundary.
 *
 * **Example** (Creating an ExiftoolError)
 *
 * ```ts
 * import { ExiftoolError } from "@beep/exiftool"
 *
 * const error = ExiftoolError.make({ message: "exiftool failed", operation: "readTags" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExiftoolError extends S.TaggedError<ExiftoolError>($I`ExiftoolError`)(
  "ExiftoolError",
  ExiftoolErrorFields,
  $I.annoteClass<S.declare<ExiftoolError>, readonly [S.TaggedStruct<"ExiftoolError", typeof ExiftoolErrorFields>]>(
    "ExiftoolError",
    {
      description: "Technical ExifTool driver failure scoped to a driver operation.",
      toEquivalence: () => sameExiftoolError,
    }
  )
) {
  static readonly is = S.is(ExiftoolError);

  /**
   * Normalize an unknown process or platform failure into an {@link ExiftoolError}.
   *
   * **Example** (Normalizing unknown failures)
   *
   * ```ts
   * import { ExiftoolError } from "@beep/exiftool"
   *
   * const error = ExiftoolError.fromUnknown("readTags", "exiftool failed", { cause: new Error("boom") })
   * console.log(error)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown: {
    (operation: string, message: string, options: ExiftoolErrorContextInput): ExiftoolError;
    (message: string, options: ExiftoolErrorContextInput): (operation: string) => ExiftoolError;
  } = dual(3, (operation: string, message: string, options: ExiftoolErrorContextInput): ExiftoolError => {
    const context = optionsFromInput(options);
    return O.getOrElse(existingExiftoolError(options.cause), () =>
      ExiftoolError.make({
        ...context,
        message,
        operation,
      })
    );
  });
}
