/**
 * Typed failures emitted by the Tailscale CLI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TailscaleId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $TailscaleId.create("Tailscale.errors");
const TailscaleExecutable = LiteralKit(["tailscale"]).annotate(
  $I.annote("TailscaleExecutable", {
    description: "Executable name used to invoke the Tailscale CLI.",
  })
);
const TailscaleSubcommand = LiteralKit(["status", "serve"]).annotate(
  $I.annote("TailscaleSubcommand", {
    description: "Tailscale CLI subcommand executed by this driver.",
  })
);
const NonNegativeInteger = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: "TailscaleNonNegativeInteger",
    title: "Tailscale non-negative integer",
    description: "A non-negative integer used for Tailscale process metadata.",
    message: "Expected a non-negative integer",
  })
).pipe(
  $I.annoteSchema("TailscaleNonNegativeInteger", {
    description: "A non-negative integer used for Tailscale process metadata.",
  })
);
const commandContextFields = {
  executable: TailscaleExecutable.annotateKey({
    description: "Tailscale executable invoked by the driver.",
  }),
  subcommand: TailscaleSubcommand.annotateKey({
    description: "Tailscale subcommand being executed.",
  }),
  argumentCount: NonNegativeInteger.annotateKey({
    description: "Number of arguments passed to the Tailscale executable.",
  }),
} satisfies S.Struct.Fields;

const TailscaleCommandSpawnErrorFields = {
  ...commandContextFields,
  cause: S.Defect({ includeStack: true }).annotateKey({
    description: "Underlying platform failure raised while spawning Tailscale.",
  }),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameTailscaleCommandSpawnErrorFields = S.toEquivalence(
  S.TaggedStruct("TailscaleCommandSpawnError", commandContextFields)
);
const sameTailscaleCommandSpawnError = (self: TailscaleCommandSpawnError, that: TailscaleCommandSpawnError): boolean =>
  sameTailscaleCommandSpawnErrorFields(self, that);

/**
 * Failure to start the Tailscale executable.
 *
 * **Example** (Create command spawn error)
 *
 * ```ts
 * import { TailscaleCommandSpawnError } from "@beep/tailscale/Tailscale.errors"
 *
 * const error = TailscaleCommandSpawnError.make({
 *   executable: "tailscale",
 *   subcommand: "status",
 *   argumentCount: 2,
 *   cause: "not found"
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TailscaleCommandSpawnError extends S.TaggedError<TailscaleCommandSpawnError>(
  $I`TailscaleCommandSpawnError`
)(
  "TailscaleCommandSpawnError",
  TailscaleCommandSpawnErrorFields,
  $I.annoteClass<
    S.declare<TailscaleCommandSpawnError>,
    readonly [S.TaggedStruct<"TailscaleCommandSpawnError", typeof TailscaleCommandSpawnErrorFields>]
  >("TailscaleCommandSpawnError", {
    description: "Failure raised when the operating system cannot spawn the Tailscale CLI.",
    toEquivalence: () => sameTailscaleCommandSpawnError,
  })
) {
  override get message(): string {
    return `Failed to spawn tailscale ${this.subcommand}.`;
  }
}

const TailscaleCommandOutputErrorFields = {
  ...commandContextFields,
  cause: S.Defect({ includeStack: true }).annotateKey({
    description: "Underlying stream failure raised while collecting process output.",
  }),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameTailscaleCommandOutputErrorFields = S.toEquivalence(
  S.TaggedStruct("TailscaleCommandOutputError", commandContextFields)
);
const sameTailscaleCommandOutputError = (
  self: TailscaleCommandOutputError,
  that: TailscaleCommandOutputError
): boolean => sameTailscaleCommandOutputErrorFields(self, that);

/**
 * Failure while collecting output from a running Tailscale process.
 *
 * **Example** (Create command output error)
 *
 * ```ts
 * import { TailscaleCommandOutputError } from "@beep/tailscale/Tailscale.errors"
 *
 * const error = TailscaleCommandOutputError.make({
 *   executable: "tailscale",
 *   subcommand: "status",
 *   argumentCount: 2,
 *   cause: "stream closed"
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TailscaleCommandOutputError extends S.TaggedError<TailscaleCommandOutputError>(
  $I`TailscaleCommandOutputError`
)(
  "TailscaleCommandOutputError",
  TailscaleCommandOutputErrorFields,
  $I.annoteClass<
    S.declare<TailscaleCommandOutputError>,
    readonly [S.TaggedStruct<"TailscaleCommandOutputError", typeof TailscaleCommandOutputErrorFields>]
  >("TailscaleCommandOutputError", {
    description: "Failure raised while collecting output from a running Tailscale process.",
    toEquivalence: () => sameTailscaleCommandOutputError,
  })
) {
  override get message(): string {
    return `Failed to read output from tailscale ${this.subcommand}.`;
  }
}

const TailscaleCommandExitErrorFields = {
  ...commandContextFields,
  exitCode: S.Int.annotateKey({
    description: "Nonzero exit status returned by the Tailscale process.",
  }),
  stdoutLength: S.optionalKey(NonNegativeInteger).annotateKey({
    description: "Captured standard-output length without exposing its contents.",
  }),
  stderrLength: NonNegativeInteger.annotateKey({
    description: "Captured standard-error length without exposing its contents.",
  }),
} satisfies S.Struct.Fields;
const sameTailscaleCommandExitErrorFields = S.toEquivalence(
  S.TaggedStruct("TailscaleCommandExitError", TailscaleCommandExitErrorFields)
);
const sameTailscaleCommandExitError = (self: TailscaleCommandExitError, that: TailscaleCommandExitError): boolean =>
  sameTailscaleCommandExitErrorFields(self, that);

/**
 * Nonzero Tailscale process exit with redacted output lengths.
 *
 * **Example** (Create command exit error)
 *
 * ```ts
 * import { TailscaleCommandExitError } from "@beep/tailscale/Tailscale.errors"
 *
 * const error = TailscaleCommandExitError.make({
 *   executable: "tailscale",
 *   subcommand: "serve",
 *   argumentCount: 4,
 *   exitCode: 1,
 *   stderrLength: 17
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TailscaleCommandExitError extends S.TaggedError<TailscaleCommandExitError>($I`TailscaleCommandExitError`)(
  "TailscaleCommandExitError",
  TailscaleCommandExitErrorFields,
  $I.annoteClass<
    S.declare<TailscaleCommandExitError>,
    readonly [S.TaggedStruct<"TailscaleCommandExitError", typeof TailscaleCommandExitErrorFields>]
  >("TailscaleCommandExitError", {
    description: "Redacted diagnostic for a Tailscale process that exited unsuccessfully.",
    toEquivalence: () => sameTailscaleCommandExitError,
  })
) {
  override get message(): string {
    return `tailscale ${this.subcommand} exited with code ${this.exitCode}.`;
  }
}

const TailscaleCommandTimeoutErrorFields = {
  ...commandContextFields,
  timeoutMs: NonNegativeInteger.annotateKey({
    description: "Timeout duration in milliseconds.",
  }),
  cause: S.Defect({ includeStack: true }).annotateKey({
    description: "Timeout defect emitted by Effect.",
  }),
} satisfies S.Struct.Fields;
const TailscaleCommandTimeoutErrorEquivalenceFields = {
  ...commandContextFields,
  timeoutMs: TailscaleCommandTimeoutErrorFields.timeoutMs,
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameTailscaleCommandTimeoutErrorFields = S.toEquivalence(
  S.TaggedStruct("TailscaleCommandTimeoutError", TailscaleCommandTimeoutErrorEquivalenceFields)
);
const sameTailscaleCommandTimeoutError = (
  self: TailscaleCommandTimeoutError,
  that: TailscaleCommandTimeoutError
): boolean => sameTailscaleCommandTimeoutErrorFields(self, that);

/**
 * Tailscale process timeout with the configured duration in milliseconds.
 *
 * **Example** (Create command timeout error)
 *
 * ```ts
 * import { TailscaleCommandTimeoutError } from "@beep/tailscale/Tailscale.errors"
 *
 * const error = TailscaleCommandTimeoutError.make({
 *   executable: "tailscale",
 *   subcommand: "status",
 *   argumentCount: 2,
 *   timeoutMs: 1500,
 *   cause: "timeout"
 * })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TailscaleCommandTimeoutError extends S.TaggedError<TailscaleCommandTimeoutError>(
  $I`TailscaleCommandTimeoutError`
)(
  "TailscaleCommandTimeoutError",
  TailscaleCommandTimeoutErrorFields,
  $I.annoteClass<
    S.declare<TailscaleCommandTimeoutError>,
    readonly [S.TaggedStruct<"TailscaleCommandTimeoutError", typeof TailscaleCommandTimeoutErrorFields>]
  >("TailscaleCommandTimeoutError", {
    description: "Failure raised when a Tailscale process exceeds its configured timeout.",
    toEquivalence: () => sameTailscaleCommandTimeoutError,
  })
) {
  override get message(): string {
    return `tailscale ${this.subcommand} timed out after ${this.timeoutMs}ms.`;
  }
}

/**
 * Union of failures emitted while executing a Tailscale command.
 *
 * **Example** (Validate command error union)
 *
 * ```ts
 * import { TailscaleCommandError, TailscaleCommandExitError } from "@beep/tailscale/Tailscale.errors"
 * import * as S from "effect/Schema"
 *
 * const error = TailscaleCommandExitError.make({
 *   executable: "tailscale",
 *   subcommand: "status",
 *   argumentCount: 2,
 *   exitCode: 1,
 *   stderrLength: 0
 * })
 * console.log(S.is(TailscaleCommandError)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const TailscaleCommandError = S.Union([
  TailscaleCommandSpawnError,
  TailscaleCommandOutputError,
  TailscaleCommandExitError,
  TailscaleCommandTimeoutError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("TailscaleCommandError", {
    description: "Typed union of Tailscale process execution failures.",
  })
);

/**
 * Runtime type for {@link TailscaleCommandError}.
 *
 * **Example** (Type annotate command error)
 *
 * ```ts
 * import type { TailscaleCommandError } from "@beep/tailscale/Tailscale.errors"
 * import { TailscaleCommandExitError } from "@beep/tailscale/Tailscale.errors"
 *
 * const error: TailscaleCommandError = TailscaleCommandExitError.make({
 *   executable: "tailscale",
 *   subcommand: "status",
 *   argumentCount: 2,
 *   exitCode: 1,
 *   stderrLength: 0
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type TailscaleCommandError = typeof TailscaleCommandError.Type;

const TailscaleStatusParseErrorFields = {
  cause: S.Defect({ includeStack: true }).annotateKey({
    description: "Schema decoding failure retained for structured diagnostics.",
  }),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameTailscaleStatusParseErrorFields = S.toEquivalence(S.TaggedStruct("TailscaleStatusParseError", {}));
const sameTailscaleStatusParseError = (self: TailscaleStatusParseError, that: TailscaleStatusParseError): boolean =>
  sameTailscaleStatusParseErrorFields(self, that);

/**
 * Failure to decode the JSON emitted by `tailscale status`.
 *
 * **Example** (Create status parse error)
 *
 * ```ts
 * import { TailscaleStatusParseError } from "@beep/tailscale/Tailscale.errors"
 *
 * const error = TailscaleStatusParseError.make({ cause: "invalid JSON" })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TailscaleStatusParseError extends S.TaggedError<TailscaleStatusParseError>($I`TailscaleStatusParseError`)(
  "TailscaleStatusParseError",
  TailscaleStatusParseErrorFields,
  $I.annoteClass<
    S.declare<TailscaleStatusParseError>,
    readonly [S.TaggedStruct<"TailscaleStatusParseError", typeof TailscaleStatusParseErrorFields>]
  >("TailscaleStatusParseError", {
    description: "Failure raised when Tailscale status JSON cannot be decoded.",
    toEquivalence: () => sameTailscaleStatusParseError,
  })
) {
  override get message(): string {
    return "Failed to decode tailscale status JSON.";
  }
}
