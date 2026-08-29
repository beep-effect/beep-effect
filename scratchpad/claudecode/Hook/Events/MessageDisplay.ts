/**
 * MessageDisplay hook event.
 *
 * Fires while assistant message text is displayed. Display-only: the
 * transcript and Claude's context keep the original text. Does not
 * support a matcher.
 * See https://code.claude.com/docs/en/hooks#messagedisplay.
 *
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
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.MessageDisplay.Input)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `HookSpecificOutput`.
 *
 * **Example** (Inspect the HookSpecificOutput schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.MessageDisplay.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * **Example** (Inspect the Output schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.MessageDisplay.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `passthrough`.
 *
 * **Example** (Use passthrough)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.MessageDisplay.passthrough)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Constructor for `display`.
 *
 * **Example** (Use display)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.MessageDisplay.display)
 * ```
 *
 * @category constructors
 *
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
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.MessageDisplay.define)
 * ```
 *
 * @category constructors
 *
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
