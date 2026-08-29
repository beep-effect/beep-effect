/**
 * PermissionDenied hook event.
 *
 * Fires when Claude Code's auto-mode classifier denies a tool call. The
 * denial has already happened; a handler can set `retry: true` to tell
 * the model it may try again (possibly with different input). Supports
 * a matcher on `tool_name`.
 * See https://code.claude.com/docs/en/hooks#permissiondenied.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/PermissionDenied");

/**
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionDenied.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PermissionDeniedInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PermissionDenied"),
    tool_name: S.String,
    tool_input: S.Record(S.String, S.Unknown),
    tool_use_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    reason: S.String,
  },
  $I.annote("PermissionDeniedInput", {
    description: "Input for the PermissionDenied hook event.",
  })
) {}

/**
 * Schema for `HookSpecificOutput`.
 *
 * **Example** (Inspect the HookSpecificOutput schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionDenied.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`PermissionDeniedHookSpecificOutput`)(
  {
    hookEventName: S.Literal("PermissionDenied"),
    retry: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionDeniedHookSpecificOutput", {
    description: "Retry instruction returned by a PermissionDenied hook.",
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
 * console.log(Hook.PermissionDenied.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PermissionDeniedOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionDeniedOutput", {
    description: "Output returned by a PermissionDenied hook handler.",
  })
) {}

/**
 * Acknowledge the denial without allowing a retry.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionDenied.accept)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const accept = (): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PermissionDenied",
        retry: O.some(false),
      })
    ),
  });

/**
 * No-op output — the denial stands and the model is not instructed to retry.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionDenied.passthrough)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Tell the model it may retry the denied call, typically with adjusted
 * input.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionDenied.retry)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const retry = (): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PermissionDenied",
        retry: O.some(true),
      })
    ),
  });

/**
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionDenied.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "PermissionDenied",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a PermissionDenied hook that only handles matching `tool_name` values.
 *
 * **Example** (Build PermissionDenied hook that only handles matching `tool_name` values)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionDenied.onMatcher)
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
      select: (input) => input.tool_name,
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
 * Decoded and wire-encoded companion types for {@link HookSpecificOutput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace HookSpecificOutput {
  /**
   * Decoded runtime representation of {@link HookSpecificOutput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookSpecificOutput;
  /**
   * Wire-encoded representation of {@link HookSpecificOutput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookSpecificOutput.Encoded;
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
