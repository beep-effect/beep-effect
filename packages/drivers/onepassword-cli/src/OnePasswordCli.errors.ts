/**
 * Typed errors for the 1Password CLI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OnepasswordCliId } from "@beep/identity";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { P } from "@beep/utils";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { OnePasswordCliDiagnosticText, OnePasswordCliExitCode } from "./OnePasswordCli.models.ts";

const $I = $OnepasswordCliId.create("OnePasswordCli.errors");
const OnePasswordCliDefect = S.Defect({ includeStack: true });
const isOnePasswordCliDefect = S.is(OnePasswordCliDefect);

type OnePasswordCliErrorContextInput = {
  readonly cause?: unknown;
  readonly command?: string;
  readonly exitCode?: OnePasswordCliExitCode;
  readonly stderr?: string;
  readonly stdout?: string;
};

const normalizeCause = (cause: unknown | undefined): O.Option<typeof OnePasswordCliDefect.Type> =>
  O.flatMap(O.fromUndefinedOr(cause), (candidate) =>
    P.hasInspectableObjectShape(candidate) && isOnePasswordCliDefect(candidate) ? O.some(candidate) : O.none()
  );

const diagnosticTextOption = (value: string | undefined): O.Option<OnePasswordCliDiagnosticText> =>
  O.flatMap(O.fromUndefinedOr(value), OnePasswordCliDiagnosticText.decodeOption);

const errorOptionsFromInput = (options: OnePasswordCliErrorContextInput): OnePasswordCliErrorOptions =>
  OnePasswordCliErrorOptions.make({
    cause: normalizeCause(options.cause),
    command: O.fromUndefinedOr(options.command),
    exitCode: O.fromUndefinedOr(options.exitCode),
    stderr: diagnosticTextOption(options.stderr),
    stdout: diagnosticTextOption(options.stdout),
  });

/**
 * Options captured while normalizing unknown 1Password CLI failures.
 *
 * @example
 * ```ts
 * import { OnePasswordCliErrorOptions } from "@beep/onepassword-cli/OnePasswordCli.errors"
 *
 * console.log(OnePasswordCliErrorOptions)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OnePasswordCliErrorOptions extends S.Class<OnePasswordCliErrorOptions>($I`OnePasswordCliErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(OnePasswordCliDefect).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Inspectable originating defect, when available.",
    }),
    command: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Executable command used for the 1Password CLI operation, when available.",
    }),
    exitCode: S.OptionFromOptionalKey(OnePasswordCliExitCode).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "1Password CLI process exit status, when the process returned one.",
    }),
    stderr: S.OptionFromOptionalKey(OnePasswordCliDiagnosticText).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Trim-normalized redacted standard error captured from the 1Password CLI, when available.",
    }),
    stdout: S.OptionFromOptionalKey(OnePasswordCliDiagnosticText).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Trim-normalized redacted standard output captured from the 1Password CLI, when available.",
    }),
  },
  $I.annote("OnePasswordCliErrorOptions", {
    description: "Optional redacted process context for a 1Password CLI failure.",
  })
) {}

/**
 * Technical failure raised by the `@beep/onepassword-cli` driver boundary.
 *
 * @example
 * ```ts
 * import { OnePasswordCliError } from "@beep/onepassword-cli/OnePasswordCli.errors"
 *
 * console.log(OnePasswordCliError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OnePasswordCliError extends TaggedErrorClass<OnePasswordCliError>($I`OnePasswordCliError`)(
  "OnePasswordCliError",
  {
    cause: S.OptionFromOptionalKey(OnePasswordCliDefect).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Inspectable originating defect, when available.",
    }),
    command: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Executable command used for the failed 1Password CLI operation, when available.",
    }),
    exitCode: S.OptionFromOptionalKey(OnePasswordCliExitCode).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "1Password CLI process exit status, when the process returned one.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Redacted human-readable failure summary.",
    }),
    operation: S.NonEmptyString.annotateKey({
      description: "Driver operation that emitted the failure.",
    }),
    stderr: S.OptionFromOptionalKey(OnePasswordCliDiagnosticText).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Trim-normalized redacted standard error captured from the 1Password CLI, when available.",
    }),
    stdout: S.OptionFromOptionalKey(OnePasswordCliDiagnosticText).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Trim-normalized redacted standard output captured from the 1Password CLI, when available.",
    }),
  },
  $I.annote("OnePasswordCliError", {
    description: "Redacted technical failure emitted by the 1Password CLI driver.",
  })
) {
  /**
   * Normalize a process or platform failure into a driver error.
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown: {
    (operation: string, message: string, options: OnePasswordCliErrorContextInput): OnePasswordCliError;
    (message: string, options: OnePasswordCliErrorContextInput): (operation: string) => OnePasswordCliError;
  } = dual(3, (operation: string, message: string, options: OnePasswordCliErrorContextInput): OnePasswordCliError => {
    const { cause, command, exitCode, stderr, stdout } = errorOptionsFromInput(options);
    return OnePasswordCliError.make({
      cause,
      command,
      exitCode,
      message,
      operation,
      stderr,
      stdout,
    });
  });
}
