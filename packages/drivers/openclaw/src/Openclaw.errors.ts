/**
 * Typed failures emitted by the OpenClaw CLI driver.
 *
 * Redaction is a design invariant: errors carry output lengths, never raw
 * output; trimmed capped diagnostics are attached only for operations
 * declared secret-free (version, validate, doctor). Environment contents and
 * full argv never appear in any error.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenclawId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { OpenclawDiagnosticText, OpenclawExitCode } from "./Openclaw.models.ts";

const $I = $OpenclawId.create("Openclaw.errors");
const NonNegativeInteger = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: "OpenclawNonNegativeInteger",
    title: "OpenClaw non-negative integer",
    description: "A non-negative integer used for OpenClaw process metadata.",
    message: "Expected a non-negative integer",
  })
).pipe(
  $I.annoteSchema("OpenclawNonNegativeInteger", {
    description: "A non-negative integer used for OpenClaw process metadata.",
  })
);
const commandContextFields = {
  executable: S.NonEmptyString.annotateKey({
    description: "Executable invoked by the driver (openclaw binary or systemctl).",
  }),
  subcommand: S.NonEmptyString.annotateKey({
    description: "Subcommand being executed when the failure occurred.",
  }),
} satisfies S.Struct.Fields;

const OpenclawCommandSpawnErrorFields = {
  ...commandContextFields,
  argumentCount: NonNegativeInteger.annotateKey({
    description: "Number of arguments passed to the executable.",
  }),
  cause: S.Defect({ includeStack: true }).annotateKey({
    description: "Underlying platform failure raised while spawning the process.",
  }),
} satisfies S.Struct.Fields;
const OpenclawCommandSpawnErrorEquivalenceFields = {
  ...commandContextFields,
  argumentCount: OpenclawCommandSpawnErrorFields.argumentCount,
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameOpenclawCommandSpawnErrorFields = S.toEquivalence(
  S.TaggedStruct("OpenclawCommandSpawnError", OpenclawCommandSpawnErrorEquivalenceFields)
);
const sameOpenclawCommandSpawnError = (self: OpenclawCommandSpawnError, that: OpenclawCommandSpawnError): boolean =>
  sameOpenclawCommandSpawnErrorFields(self, that);

/**
 * Failure to start the OpenClaw executable.
 *
 * **Example** (Create command spawn error)
 *
 * ```ts
 * import { OpenclawCommandSpawnError } from "@beep/openclaw/Openclaw.errors"
 *
 * const error = OpenclawCommandSpawnError.make({
 *   argumentCount: 2,
 *   cause: "not found",
 *   executable: "openclaw",
 *   subcommand: "config validate"
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OpenclawCommandSpawnError extends S.TaggedError<OpenclawCommandSpawnError>($I`OpenclawCommandSpawnError`)(
  "OpenclawCommandSpawnError",
  OpenclawCommandSpawnErrorFields,
  $I.annoteClass<
    S.declare<OpenclawCommandSpawnError>,
    readonly [S.TaggedStruct<"OpenclawCommandSpawnError", typeof OpenclawCommandSpawnErrorFields>]
  >("OpenclawCommandSpawnError", {
    description: "Failure raised when the operating system cannot spawn the OpenClaw executable.",
    toEquivalence: () => sameOpenclawCommandSpawnError,
  })
) {
  override get message(): string {
    return `Failed to spawn ${this.executable} ${this.subcommand}.`;
  }
}

const OpenclawCommandExitErrorFields = {
  ...commandContextFields,
  diagnostics: S.OptionFromOptionalKey(OpenclawDiagnosticText).pipe(SchemaUtils.withNoneDefault).annotateKey({
    description: "Trimmed capped diagnostics, attached only for secret-free operations.",
  }),
  exitCode: OpenclawExitCode.annotateKey({
    description: "Nonzero exit status returned by the process.",
  }),
  stderrLength: NonNegativeInteger.annotateKey({
    description: "Captured standard-error length without exposing its contents.",
  }),
  stdoutLength: NonNegativeInteger.annotateKey({
    description: "Captured standard-output length without exposing its contents.",
  }),
} satisfies S.Struct.Fields;
const sameOpenclawCommandExitErrorFields = S.toEquivalence(
  S.TaggedStruct("OpenclawCommandExitError", OpenclawCommandExitErrorFields)
);
const sameOpenclawCommandExitError = (self: OpenclawCommandExitError, that: OpenclawCommandExitError): boolean =>
  sameOpenclawCommandExitErrorFields(self, that);

/**
 * Nonzero process exit with redacted output lengths.
 *
 * **Details**
 *
 * Lengths are always recorded; trimmed capped diagnostics are attached only
 * for operations declared secret-free (validate, version, doctor). Token-
 * bearing operations such as secrets reload and gateway health carry lengths
 * only.
 *
 * **Example** (Create command exit error)
 *
 * ```ts
 * import { OpenclawCommandExitError } from "@beep/openclaw/Openclaw.errors"
 *
 * const error = OpenclawCommandExitError.make({
 *   executable: "openclaw",
 *   exitCode: 1,
 *   stderrLength: 42,
 *   stdoutLength: 0,
 *   subcommand: "gateway call health"
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OpenclawCommandExitError extends S.TaggedError<OpenclawCommandExitError>($I`OpenclawCommandExitError`)(
  "OpenclawCommandExitError",
  OpenclawCommandExitErrorFields,
  $I.annoteClass<
    S.declare<OpenclawCommandExitError>,
    readonly [S.TaggedStruct<"OpenclawCommandExitError", typeof OpenclawCommandExitErrorFields>]
  >("OpenclawCommandExitError", {
    description: "Redacted diagnostic for an OpenClaw process that exited unsuccessfully.",
    toEquivalence: () => sameOpenclawCommandExitError,
  })
) {
  override get message(): string {
    return `${this.executable} ${this.subcommand} exited with code ${this.exitCode}.`;
  }
}

const OpenclawCommandTimeoutErrorFields = {
  ...commandContextFields,
  timeoutMs: NonNegativeInteger.annotateKey({
    description: "Timeout duration in milliseconds.",
  }),
} satisfies S.Struct.Fields;
const sameOpenclawCommandTimeoutErrorFields = S.toEquivalence(
  S.TaggedStruct("OpenclawCommandTimeoutError", OpenclawCommandTimeoutErrorFields)
);
const sameOpenclawCommandTimeoutError = (
  self: OpenclawCommandTimeoutError,
  that: OpenclawCommandTimeoutError
): boolean => sameOpenclawCommandTimeoutErrorFields(self, that);

/**
 * Process timeout with the configured duration in milliseconds.
 *
 * **Example** (Create command timeout error)
 *
 * ```ts
 * import { OpenclawCommandTimeoutError } from "@beep/openclaw/Openclaw.errors"
 *
 * const error = OpenclawCommandTimeoutError.make({
 *   executable: "openclaw",
 *   subcommand: "config validate",
 *   timeoutMs: 45000
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OpenclawCommandTimeoutError extends S.TaggedError<OpenclawCommandTimeoutError>(
  $I`OpenclawCommandTimeoutError`
)(
  "OpenclawCommandTimeoutError",
  OpenclawCommandTimeoutErrorFields,
  $I.annoteClass<
    S.declare<OpenclawCommandTimeoutError>,
    readonly [S.TaggedStruct<"OpenclawCommandTimeoutError", typeof OpenclawCommandTimeoutErrorFields>]
  >("OpenclawCommandTimeoutError", {
    description: "Failure raised when an OpenClaw process exceeds its configured timeout.",
    toEquivalence: () => sameOpenclawCommandTimeoutError,
  })
) {
  override get message(): string {
    return `${this.executable} ${this.subcommand} timed out after ${this.timeoutMs}ms.`;
  }
}

const OpenclawOutputParseErrorFields = {
  ...commandContextFields,
  cause: S.Defect({ includeStack: true }).annotateKey({
    description: "Schema decoding failure retained for structured diagnostics.",
  }),
  stdoutLength: NonNegativeInteger.annotateKey({
    description: "Captured standard-output length without exposing its contents.",
  }),
} satisfies S.Struct.Fields;
const OpenclawOutputParseErrorEquivalenceFields = {
  ...commandContextFields,
  stdoutLength: OpenclawOutputParseErrorFields.stdoutLength,
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameOpenclawOutputParseErrorFields = S.toEquivalence(
  S.TaggedStruct("OpenclawOutputParseError", OpenclawOutputParseErrorEquivalenceFields)
);
const sameOpenclawOutputParseError = (self: OpenclawOutputParseError, that: OpenclawOutputParseError): boolean =>
  sameOpenclawOutputParseErrorFields(self, that);

/**
 * Failure to decode a process's stdout into its expected model.
 *
 * **Details**
 *
 * Carries the stdout length and the schema issue — never the raw stdout,
 * which may belong to a token-bearing call.
 *
 * **Example** (Create output parse error)
 *
 * ```ts
 * import { OpenclawOutputParseError } from "@beep/openclaw/Openclaw.errors"
 *
 * const error = OpenclawOutputParseError.make({
 *   cause: "invalid JSON",
 *   executable: "openclaw",
 *   stdoutLength: 17,
 *   subcommand: "secrets reload"
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OpenclawOutputParseError extends S.TaggedError<OpenclawOutputParseError>($I`OpenclawOutputParseError`)(
  "OpenclawOutputParseError",
  OpenclawOutputParseErrorFields,
  $I.annoteClass<
    S.declare<OpenclawOutputParseError>,
    readonly [S.TaggedStruct<"OpenclawOutputParseError", typeof OpenclawOutputParseErrorFields>]
  >("OpenclawOutputParseError", {
    description: "Failure raised when OpenClaw process output cannot be decoded.",
    toEquivalence: () => sameOpenclawOutputParseError,
  })
) {
  override get message(): string {
    return `Failed to decode ${this.executable} ${this.subcommand} output.`;
  }
}

/**
 * Union of failures emitted while executing an OpenClaw driver command.
 *
 * **Example** (Check CliError schema membership)
 *
 * ```ts
 * import { OpenclawCliError, OpenclawCommandTimeoutError } from "@beep/openclaw/Openclaw.errors"
 * import * as S from "effect/Schema"
 *
 * const error = OpenclawCommandTimeoutError.make({
 *   executable: "openclaw",
 *   subcommand: "doctor",
 *   timeoutMs: 60000
 * })
 * console.log(S.is(OpenclawCliError)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OpenclawCliError = S.Union([
  OpenclawCommandSpawnError,
  OpenclawCommandExitError,
  OpenclawCommandTimeoutError,
  OpenclawOutputParseError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OpenclawCliError", {
    description: "Typed union of OpenClaw driver command failures.",
  })
);

/**
 * Runtime type for {@link OpenclawCliError}.
 *
 * **Example** (Type annotate CliError value)
 *
 * ```ts
 * import type { OpenclawCliError } from "@beep/openclaw/Openclaw.errors"
 * import { OpenclawCommandTimeoutError } from "@beep/openclaw/Openclaw.errors"
 *
 * const error: OpenclawCliError = OpenclawCommandTimeoutError.make({
 *   executable: "openclaw",
 *   subcommand: "doctor",
 *   timeoutMs: 60000
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type OpenclawCliError = typeof OpenclawCliError.Type;
