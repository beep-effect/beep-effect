/**
 * Fires while assistant message text is displayed. Display-only: the
 * transcript and Claude's context keep the original `delta`. Does not
 * support a matcher. See
 * https://code.claude.com/docs/en/hooks#messagedisplay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import type * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/MessageDisplay");

/**
 * Stdin payload for a MessageDisplay hook, including the streamed
 * `delta` and whether this chunk is `final`.
 *
 * **Example** (Decode a display chunk)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.MessageDisplay.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "MessageDisplay",
 *   turn_id: "turn-1",
 *   message_id: "msg-1",
 *   index: 0,
 *   final: false,
 *   delta: "Hello",
 * })
 *
 * console.log(input.delta) // "Hello"
 * ```
 *
 * @see {@link display} for replacing what the TUI shows.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`MessageDisplayInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("MessageDisplay"),
    turn_id: S.String,
    message_id: S.String,
    index: S.Finite,
    final: S.Boolean,
    delta: S.String,
  },
  $I.annote("MessageDisplayInput", {
    description: "Input for the MessageDisplay hook event.",
  })
) {}

/**
 * Event-specific payload that can replace TUI text via `displayContent`.
 *
 * **Example** (Build a display replacement)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.MessageDisplay.HookSpecificOutput.make({
 *   hookEventName: "MessageDisplay",
 *   displayContent: O.some("[redacted]"),
 * })
 *
 * console.log(O.getOrUndefined(specific.displayContent)) // "[redacted]"
 * ```
 *
 * @see {@link display} for the constructor that wraps this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`MessageDisplayHookSpecificOutput`)(
  {
    hookEventName: S.Literal("MessageDisplay"),
    displayContent: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("MessageDisplayHookSpecificOutput", {
    description: "Message-display replacement returned to Claude Code.",
  })
) {}

/**
 * JSON response a MessageDisplay handler returns. Only
 * `hookSpecificOutput.displayContent` changes the TUI.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.MessageDisplay.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for leaving the TUI unchanged.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`MessageDisplayOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("MessageDisplayOutput", {
    description: "Output returned by a MessageDisplay hook handler.",
  })
) {}

/**
 * Leave the streamed text unchanged in the TUI.
 *
 * **Example** (Pass the original delta through)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.MessageDisplay.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link display} for replacing TUI text.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Replace the text shown in the TUI for this chunk.
 *
 * **Gotchas**
 *
 * `displayContent` affects the TUI only. The transcript and Claude's
 * context keep the original `delta`.
 *
 * **Example** (Redact TUI text)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.MessageDisplay.display("[redacted]")
 * const shown = O.flatMap(output.hookSpecificOutput, (specific) => specific.displayContent)
 * console.log(O.getOrUndefined(shown)) // "[redacted]"
 * ```
 *
 * @see {@link passthrough} for leaving the original text on screen.
 * @category constructors
 * @since 0.0.0
 */
export const display = (displayContent: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "MessageDisplay",
        displayContent: O.some(displayContent),
      })
    ),
  });

/**
 * Build a runnable MessageDisplay hook from a handler effect.
 *
 * **Example** (Define a MessageDisplay hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.MessageDisplay.define({
 *   handler: () => Effect.succeed(Hook.MessageDisplay.passthrough()),
 * })
 *
 * console.log(hook.event) // "MessageDisplay"
 * ```
 *
 * @see {@link display} for replacing TUI text from the handler.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "MessageDisplay",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
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
