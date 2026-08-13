/**
 * UserPromptSubmit hook event.
 *
 * Fires when the user submits a prompt, before Claude processes it. A
 * handler can block the prompt entirely (erasing it from context),
 * inject additional context, or rename the session. Does not support
 * a matcher. See https://code.claude.com/docs/en/hooks#userpromptsubmit.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/UserPromptSubmit");

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Schema for `Input`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`UserPromptSubmitInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("UserPromptSubmit"),
    prompt: S.String,
  },
  $I.annote("UserPromptSubmitInput", {
    description: "Input for the UserPromptSubmit hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Schema for `HookSpecificOutput`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`UserPromptSubmitHookSpecificOutput`)(
  {
    hookEventName: S.Literal("UserPromptSubmit"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sessionTitle: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("UserPromptSubmitHookSpecificOutput", {
    description: "UserPromptSubmit-specific response returned to Claude Code.",
  })
) {}

/**
 * Schema for `Output`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`UserPromptSubmitOutput`)(
  {
    decision: S.OptionFromOptionalKey(S.Literal("block")).pipe(SchemaUtils.withNoneDefault),
    reason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOriginalPrompt: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("UserPromptSubmitOutput", {
    description: "Output returned by a UserPromptSubmit hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Allow the prompt to proceed without modification.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.allow)
 * ```
 */
export const allow = (): Output => Output.make();

/**
 * Block the prompt. It is erased from context and the reason is shown
 * to the user.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.block)
 * ```
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const block = (reason: string, options?: { readonly suppressOriginalPrompt?: boolean }): Output =>
  Output.make({
    decision: O.some("block"),
    reason: O.some(reason),
    suppressOriginalPrompt: O.fromNullishOr(options?.suppressOriginalPrompt),
  });

/**
 * Allow the prompt and inject additional context Claude will see.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.addContext)
 * ```
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "UserPromptSubmit",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Rename the session title. Often paired with `addContext`.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.renameSession)
 * ```
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const renameSession = (sessionTitle: string, additionalContext?: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "UserPromptSubmit",
        additionalContext: O.fromNullishOr(additionalContext),
        sessionTitle: O.some(sessionTitle),
      })
    ),
  });

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Constructor for `define`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptSubmit.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "UserPromptSubmit",
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.UserPromptSubmit.Input.Encoded
 * ```
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.UserPromptSubmit.HookSpecificOutput.Encoded
 * ```
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.UserPromptSubmit.Output.Encoded
 * ```
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
