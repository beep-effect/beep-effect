/**
 * Fires when Claude Code sends a notification (permission prompt, idle
 * prompt, auth success, or elicitation dialog). The hook cannot block or
 * rewrite the notification; common output fields such as `systemMessage`
 * remain available as side effects. Matcher is on `notification_type`.
 * See https://code.claude.com/docs/en/hooks#notification.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/Notification");
// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Notification category Claude Code emitted with this event.
 *
 * **Example** (Decode a notification type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(Hook.Notification.NotificationType)("idle_prompt")
 * console.log(kind) // "idle_prompt"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this type.
 * @category schemas
 * @since 0.0.0
 */
export const NotificationType = LiteralKit([
  "permission_prompt",
  "idle_prompt",
  "auth_success",
  "elicitation_dialog",
  "elicitation_complete",
  "elicitation_response",
]).pipe(
  $I.annoteSchema("NotificationType", {
    description: "Notification category emitted by Claude Code.",
  })
);

/**
 * Decoded value produced by {@link NotificationType}.
 *
 * @see {@link NotificationType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type NotificationType = typeof NotificationType.Type;

/**
 * Stdin payload for a Notification hook, including `message` and
 * `notification_type`.
 *
 * **Example** (Decode an idle prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.Notification.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "Notification",
 *   message: "Claude is waiting for input",
 *   notification_type: "idle_prompt",
 * })
 *
 * console.log(input.notification_type) // "idle_prompt"
 * ```
 *
 * @see {@link NotificationType} for the matcher field on this payload.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`NotificationInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("Notification"),
    message: S.String,
    title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    notification_type: NotificationType,
  },
  $I.annote("NotificationInput", {
    description: "Input for the Notification hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * JSON response a Notification handler may return. It cannot suppress or
 * rewrite the notification itself.
 *
 * **Gotchas**
 *
 * There is no `block` helper. JSON cannot hide the notification; only
 * `systemMessage` / `terminalSequence` side effects apply.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Notification.Output.make()
 * console.log(O.isNone(output.systemMessage)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`NotificationOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("NotificationOutput", {
    description: "Output returned by a Notification hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * No-op output — the notification proceeds unchanged.
 *
 * **Gotchas**
 *
 * Returning this (or any JSON) cannot suppress the notification.
 *
 * **Example** (Acknowledge the notification)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Notification.passthrough()
 * console.log(O.isNone(output.systemMessage)) // true
 * ```
 *
 * @see {@link define} for wrapping this result in a handler.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a runnable Notification hook from a handler effect.
 *
 * **Gotchas**
 *
 * JSON cannot suppress the notification; only `systemMessage` /
 * `terminalSequence` side effects apply.
 *
 * **Example** (Define a Notification hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.Notification.define({
 *   handler: () => Effect.succeed(Hook.Notification.passthrough()),
 * })
 *
 * console.log(hook.event) // "Notification"
 * ```
 *
 * @see {@link onMatcher} for filtering on `notification_type`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "Notification",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a Notification hook that only handles matching
 * `notification_type` values.
 *
 * **Example** (Handle idle prompts)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.Notification.onMatcher({
 *   matcher: "idle_prompt",
 *   handler: () => Effect.succeed(Hook.Notification.passthrough()),
 * })
 *
 * console.log(hook.event) // "Notification"
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
      select: (input) => input.notification_type,
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
