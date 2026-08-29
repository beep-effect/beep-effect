/**
 * StopFailure hook event.
 *
 * Fires when a turn ends due to an API error (rate limit, auth, billing,
 * etc.) rather than a normal stop. Observability-only — the hook's
 * output and exit code are both ignored by Claude Code. Supports a
 * matcher on `error`.
 * See https://code.claude.com/docs/en/hooks#stopfailure.
 *
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
 * Schema for `ErrorType`.
 *
 * **Example** (Inspect the ErrorType schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.StopFailure.ErrorType)
 * ```
 *
 * @category schemas
 *
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
 * Type-level model for `ErrorType`.
 *
 * **Example** (Use ErrorType as a type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.StopFailure.ErrorType
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type ErrorType = typeof ErrorType.Type;

/**
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.StopFailure.Input)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * **Example** (Inspect the Output schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.StopFailure.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `passthrough`.
 *
 * **Example** (Use passthrough)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.StopFailure.passthrough)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.StopFailure.define)
 * ```
 *
 * @category constructors
 *
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
 * **Example** (Build StopFailure hook that only handles matching `error` values)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.StopFailure.onMatcher)
 * ```
 *
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
