/**
 * Fires when a turn ends due to an API error (rate limit, auth, billing)
 * rather than a normal stop. Observability-only: Claude Code ignores
 * both the JSON output and the process exit code. Matcher is on
 * `error`. See https://code.claude.com/docs/en/hooks#stopfailure.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/StopFailure");

/**
 * Failure category reported when a turn ends abnormally.
 *
 * **Example** (Decode a rate-limit error)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownSync(Hook.StopFailure.ErrorType)("rate_limit")
 * console.log(error) // "rate_limit"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this error.
 * @category schemas
 * @since 0.0.0
 */
export const ErrorType = LiteralKit([
  "rate_limit",
  "overloaded",
  "authentication_failed",
  "oauth_org_not_allowed",
  "billing_error",
  "invalid_request",
  "model_not_found",
  "server_error",
  "max_output_tokens",
  "unknown",
]).pipe(
  $I.annoteSchema("ErrorType", {
    description: "Failure category reported by a StopFailure hook.",
  })
);

/**
 * Decoded value produced by {@link ErrorType}.
 *
 * @see {@link ErrorType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ErrorType = typeof ErrorType.Type;

/**
 * Stdin payload for a StopFailure hook, including the `error` category
 * and optional details.
 *
 * **Example** (Decode a rate-limit stop)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.StopFailure.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "StopFailure",
 *   error: "rate_limit",
 * })
 *
 * console.log(input.error) // "rate_limit"
 * ```
 *
 * @see {@link onMatcher} for filtering on `error`.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`StopFailureInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("StopFailure"),
    error: ErrorType,
    error_details: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    last_assistant_message: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("StopFailureInput", {
    description: "Input for the StopFailure hook event.",
  })
) {}

/**
 * JSON response a StopFailure handler may return. Claude Code ignores
 * both this JSON and the process exit code.
 *
 * **Gotchas**
 *
 * Exiting non-zero or setting `continue: false` does not retry or handle
 * the API failure.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.StopFailure.Output.make()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`StopFailureOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("StopFailureOutput", {
    description: "Output returned by a StopFailure hook handler.",
  })
) {}

/**
 * Empty observability output. Claude Code ignores the JSON body and the
 * process status.
 *
 * **Gotchas**
 *
 * This is not a decision helper.
 *
 * **Example** (Return empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.StopFailure.passthrough()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link define} for wrapping this result in a handler.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a runnable StopFailure hook from a handler effect.
 *
 * **Gotchas**
 *
 * Claude Code ignores both JSON output and the process exit code.
 *
 * **Example** (Define a StopFailure hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.StopFailure.define({
 *   handler: () => Effect.succeed(Hook.StopFailure.passthrough()),
 * })
 *
 * console.log(hook.event) // "StopFailure"
 * ```
 *
 * @see {@link onMatcher} for filtering on `error`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "StopFailure",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a StopFailure hook that only handles matching `error` values.
 *
 * **Example** (Observe rate-limit failures)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.StopFailure.onMatcher({
 *   matcher: "rate_limit",
 *   handler: () => Effect.succeed(Hook.StopFailure.passthrough()),
 * })
 *
 * console.log(hook.event) // "StopFailure"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
 * @category constructors
 * @since 0.0.0
 */
export const onMatcher = <E, R>(config: {
  readonly matcher: string | RegExp;
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> =>
  define({
    handler: Matcher.handleMatcher({
      matcher: config.matcher,
      select: (input) => input.error,
      onMatch: config.handler,
      onMismatch: config.onMismatch ?? (() => Effect.succeed(passthrough())),
    }),
  });

/**
 * Decoded and wire-encoded companion types for {@link Input}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace Input {
  /**
   * Decoded runtime representation of {@link Input}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = Input;
  /**
   * Wire-encoded representation of {@link Input}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Input.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link Output}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace Output {
  /**
   * Decoded runtime representation of {@link Output}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = Output;
  /**
   * Wire-encoded representation of {@link Output}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Output.Encoded;
}
