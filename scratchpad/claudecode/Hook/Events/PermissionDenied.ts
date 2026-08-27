/**
 * Fires when Claude Code's auto-mode classifier has already denied a
 * tool call. A handler can set `retry: true` to tell the model it may
 * try again, typically with different input. Matcher is on `tool_name`.
 * See https://code.claude.com/docs/en/hooks#permissiondenied.
 *
 * @packageDocumentation
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
 * Stdin payload for a PermissionDenied hook. The denial has already
 * happened; `reason` explains why.
 *
 * **Example** (Decode a denied Bash call)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PermissionDenied.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PermissionDenied",
 *   tool_name: "Bash",
 *   tool_input: { command: "rm -rf /" },
 *   reason: "dangerous command",
 * })
 *
 * console.log(input.tool_name) // "Bash"
 * ```
 *
 * @see {@link retry} for asking the model to try again.
 * @category schemas
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
 * Event-specific payload that tells the model whether it may `retry`.
 *
 * **Example** (Inspect a retry instruction)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.PermissionDenied.HookSpecificOutput.make({
 *   hookEventName: "PermissionDenied",
 *   retry: O.some(true),
 * })
 *
 * console.log(O.getOrUndefined(specific.retry)) // true
 * ```
 *
 * @see {@link retry} for the constructor that sets `retry: true`.
 * @category schemas
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
 * JSON response a PermissionDenied handler returns. The denial already
 * happened; only `retry` can ask the model to try again.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionDenied.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link accept} for acknowledging the denial without a retry.
 * @see {@link retry} for asking the model to try again.
 * @category schemas
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
 * Acknowledge the denial without allowing a retry (`retry: false`).
 *
 * **Example** (Stand by the denial)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionDenied.accept()
 * const retryFlag = O.flatMap(output.hookSpecificOutput, (specific) => specific.retry)
 * console.log(O.getOrUndefined(retryFlag)) // false
 * ```
 *
 * @see {@link retry} for asking the model to try again.
 * @see {@link passthrough} for omitting a retry instruction.
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
 * No-op output — the denial stands and the model is not instructed to
 * retry.
 *
 * **Example** (Omit a retry instruction)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionDenied.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link accept} for an explicit `retry: false`.
 * @see {@link retry} for asking the model to try again.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Tell the model it may retry the denied call, typically with adjusted
 * input (`retry: true`).
 *
 * **Example** (Ask the model to retry)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionDenied.retry()
 * const retryFlag = O.flatMap(output.hookSpecificOutput, (specific) => specific.retry)
 * console.log(O.getOrUndefined(retryFlag)) // true
 * ```
 *
 * @see {@link accept} for acknowledging the denial without a retry.
 * @see {@link passthrough} for omitting a retry instruction.
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
 * Build a runnable PermissionDenied hook from a handler effect.
 *
 * **Example** (Define a PermissionDenied hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PermissionDenied.define({
 *   handler: () => Effect.succeed(Hook.PermissionDenied.passthrough()),
 * })
 *
 * console.log(hook.event) // "PermissionDenied"
 * ```
 *
 * @see {@link onMatcher} for filtering on `tool_name`.
 * @category constructors
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
 * Build a PermissionDenied hook that only handles matching `tool_name`
 * values.
 *
 * **Example** (Retry denied Bash calls)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PermissionDenied.onMatcher({
 *   matcher: "Bash",
 *   handler: () => Effect.succeed(Hook.PermissionDenied.retry()),
 * })
 *
 * console.log(hook.event) // "PermissionDenied"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
 * @see {@link retry} for the matched-handler decision used here.
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
