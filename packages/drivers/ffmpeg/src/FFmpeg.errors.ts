/**
 * Typed errors raised by the native FFmpeg driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FfmpegId } from "@beep/identity/packages";
import { Defect, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $FfmpegId.create("FFmpeg.errors");
const FFmpegDefect = Defect({ includeStack: true });
const isFFmpegDefect = S.is(FFmpegDefect);

/**
 * Non-negative integer process exit status.
 *
 * **Example** (Make process exit code)
 *
 * ```ts
 * import { ProcessExitCode } from "@beep/ffmpeg"
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
 * **Example** (Typed ProcessExitCode value)
 *
 * ```ts
 * import { ProcessExitCode } from "@beep/ffmpeg"
 * import type { ProcessExitCode as ProcessExitCodeValue } from "@beep/ffmpeg"
 *
 * const code: ProcessExitCodeValue = ProcessExitCode.make(1)
 * console.log(code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type ProcessExitCode = typeof ProcessExitCode.Type;

type FFmpegErrorContextInput = {
  readonly cause?: unknown;
  readonly command?: string;
  readonly exitCode?: ProcessExitCode;
  readonly stderr?: string;
  readonly stdout?: string;
};

const causeFromUnknown = (cause: unknown): O.Option<typeof FFmpegDefect.Type> =>
  P.hasInspectableObjectShape(cause) && isFFmpegDefect(cause) ? O.some(cause) : O.none();

const optionsFromInput = (options: FFmpegErrorContextInput): FFmpegErrorFromUnknownOptions =>
  FFmpegErrorFromUnknownOptions.make({
    cause: causeFromUnknown(options.cause),
    command: O.fromUndefinedOr(options.command),
    exitCode: O.fromUndefinedOr(options.exitCode),
    stderr: O.fromUndefinedOr(options.stderr),
    stdout: O.fromUndefinedOr(options.stdout),
  });

/**
 * Additional process context captured for an FFmpeg failure.
 *
 * **Example** (Make FFmpeg error context)
 *
 * ```ts
 * import { FFmpegErrorContext } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const context = FFmpegErrorContext.make({ command: O.some("ffmpeg"), exitCode: O.some(1) })
 * console.log(context)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FFmpegErrorContext extends S.Class<FFmpegErrorContext>($I`FFmpegErrorContext`)(
  {
    command: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorContext.command", {
        description: "Native executable path or command name involved in the failure, when available.",
      })
    ),
    exitCode: S.OptionFromOptionalKey(ProcessExitCode).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorContext.exitCode", {
        description: "Native process exit status, when the process returned one.",
      })
    ),
    stderr: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorContext.stderr", {
        description: "Captured standard error text, when available.",
      })
    ),
    stdout: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorContext.stdout", {
        description: "Captured standard output text, when available.",
      })
    ),
  },
  $I.annote("FFmpegErrorContext", {
    description: "Additional process context captured for an FFmpeg failure.",
  })
) {}

const existingFfmpegError = (cause: unknown): O.Option<FFmpegError> =>
  FFmpegError.is(cause) ? O.some(cause) : O.none();

/**
 * Options used when normalizing unknown FFmpeg boundary failures.
 *
 * **Example** (Make fromUnknown options)
 *
 * ```ts
 * import { FFmpegErrorFromUnknownOptions } from "@beep/ffmpeg"
 * import * as O from "effect/Option"
 *
 * const options = FFmpegErrorFromUnknownOptions.make({
 *   command: O.some("ffmpeg"),
 *   exitCode: O.some(1),
 *   stderr: O.some("invalid input")
 * })
 * console.log(options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FFmpegErrorFromUnknownOptions extends S.Class<FFmpegErrorFromUnknownOptions>(
  $I`FFmpegErrorFromUnknownOptions`
)(
  {
    cause: S.OptionFromOptionalKey(FFmpegDefect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorFromUnknownOptions.cause", {
        description: "Inspectable originating defect, when available.",
      })
    ),
    command: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorFromUnknownOptions.command", {
        description: "Native executable path or command name involved in the failure, when available.",
      })
    ),
    exitCode: S.OptionFromOptionalKey(ProcessExitCode).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorFromUnknownOptions.exitCode", {
        description: "Native process exit status, when the process returned one.",
      })
    ),
    stderr: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorFromUnknownOptions.stderr", {
        description: "Captured standard error text, when available.",
      })
    ),
    stdout: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegErrorFromUnknownOptions.stdout", {
        description: "Captured standard output text, when available.",
      })
    ),
  },
  $I.annote("FFmpegErrorFromUnknownOptions", {
    description: "Options used when normalizing unknown FFmpeg boundary failures.",
  })
) {}

/**
 * Technical failure raised by the `@beep/ffmpeg` driver boundary.
 *
 * **Example** (Make FFmpegError instance)
 *
 * ```ts
 * import { FFmpegError } from "@beep/ffmpeg"
 *
 * const error = FFmpegError.make({ message: "ffmpeg failed", operation: "extractFrames" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FFmpegError extends S.TaggedError<FFmpegError>($I`FFmpegError`)(
  "FFmpegError",
  {
    command: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegError.command", {
        description: "Native executable path or command name involved in the failure, when available.",
      })
    ),
    cause: S.OptionFromOptionalKey(FFmpegDefect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegError.cause", {
        description: "Inspectable originating defect, when available.",
      })
    ),
    exitCode: S.OptionFromOptionalKey(ProcessExitCode).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegError.exitCode", {
        description: "Native process exit status, when the process returned one.",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("FFmpegError.message", {
        description: "Human-readable FFmpeg driver failure summary.",
      })
    ),
    operation: S.String.pipe(
      $I.annoteKey("FFmpegError.operation", {
        description: "Driver operation that emitted the failure.",
      })
    ),
    stderr: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegError.stderr", {
        description: "Captured standard error text, when available.",
      })
    ),
    stdout: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("FFmpegError.stdout", {
        description: "Captured standard output text, when available.",
      })
    ),
  },
  $I.annoteError<FFmpegError>("FFmpegError", {
    description: "Technical FFmpeg driver failure scoped to a driver operation.",
  })
) {
  static readonly is = S.is(FFmpegError);

  /**
   * Normalize an unknown process or platform failure into a {@link FFmpegError}.
   *
   * **Example** (Normalize unknown failure)
   *
   * ```ts
   * import { FFmpegError } from "@beep/ffmpeg"
   *
   * const error = FFmpegError.fromUnknown("probeVideo", "ffprobe failed", { cause: new Error("boom") })
   * console.log(error)
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown: {
    (operation: string, message: string, options: FFmpegErrorContextInput): FFmpegError;
    (message: string, options: FFmpegErrorContextInput): (operation: string) => FFmpegError;
  } = dual(3, (operation: string, message: string, options: FFmpegErrorContextInput): FFmpegError => {
    const context = optionsFromInput(options);
    return O.getOrElse(existingFfmpegError(options.cause), () =>
      FFmpegError.make({
        ...context,
        message,
        operation,
      })
    );
  });
}
