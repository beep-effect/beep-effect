/**
 * Fires when the user submits a prompt, before Claude processes it. A
 * handler can block the prompt (erasing it from context), inject
 * additional context, or rename the session. Does not support a matcher.
 * See https://code.claude.com/docs/en/hooks#userpromptsubmit.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/UserPromptSubmit");

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Stdin payload for a UserPromptSubmit hook, including the submitted
 * `prompt` text.
 *
 * **Gotchas**
 *
 * Blocking this event erases the prompt from context; the reason is
 * shown to the user instead.
 *
 * **Example** (Decode a submitted prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.UserPromptSubmit.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "UserPromptSubmit",
 *   prompt: "ship it",
 * })
 *
 * console.log(input.prompt) // "ship it"
 * ```
 *
 * @see {@link block} for erasing the prompt from context.
 * @category schemas
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
 * Event-specific payload that injects `additionalContext` or a
 * `sessionTitle`.
 *
 * **Example** (Inspect a session title)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.UserPromptSubmit.HookSpecificOutput.make({
 *   hookEventName: "UserPromptSubmit",
 *   sessionTitle: O.some("CI fix"),
 * })
 *
 * console.log(O.getOrUndefined(specific.sessionTitle)) // "CI fix"
 * ```
 *
 * @see {@link addContext} for injecting context without renaming.
 * @see {@link renameSession} for setting `sessionTitle`.
 * @category schemas
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
 * JSON response a UserPromptSubmit handler returns. `decision: "block"`
 * erases the prompt; `hookSpecificOutput` injects context or a title.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptSubmit.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link allow} for letting the prompt proceed.
 * @see {@link block} for erasing the prompt.
 * @category schemas
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
 * **Example** (Allow the prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptSubmit.allow()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for erasing the prompt from context.
 * @see {@link addContext} for injecting extra context without blocking.
 * @category constructors
 * @since 0.0.0
 */
export const allow = (): Output => Output.make();

/**
 * Block the prompt. It is erased from context and the reason is shown
 * to the user.
 *
 * **Gotchas**
 *
 * `suppressOriginalPrompt` only applies when blocking. It does not
 * affect {@link allow} or {@link addContext}.
 *
 * **Example** (Erase a blocked prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptSubmit.block("secrets are not allowed", {
 *   suppressOriginalPrompt: true,
 * })
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.suppressOriginalPrompt)) // true
 * ```
 *
 * @see {@link allow} for letting the prompt proceed.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- This output constructor has no data operand; its optional flags only configure the new value.
export const block = (reason: string, options?: { readonly suppressOriginalPrompt?: boolean }): Output =>
  Output.make({
    decision: O.some("block"),
    reason: O.some(reason),
    suppressOriginalPrompt: O.fromNullishOr(options?.suppressOriginalPrompt),
  });

/**
 * Allow the prompt and inject additional context Claude will see.
 *
 * **Example** (Inject repo context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptSubmit.addContext("Use bun, not npm")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Use bun, not npm"
 * ```
 *
 * @see {@link renameSession} for also setting a session title.
 * @see {@link allow} for proceeding with no extra context.
 * @category constructors
 * @since 0.0.0
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
 * **Example** (Rename and inject context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptSubmit.renameSession("CI fix", "Focus on the red job")
 * const specific = O.getOrUndefined(output.hookSpecificOutput)
 * console.log(O.getOrUndefined(specific?.sessionTitle ?? O.none())) // "CI fix"
 * console.log(O.getOrUndefined(specific?.additionalContext ?? O.none())) // "Focus on the red job"
 * ```
 *
 * @see {@link addContext} for injecting context without renaming.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- This output constructor has no data operand; the optional context only configures the new value.
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
 * Build a runnable UserPromptSubmit hook from a handler effect.
 *
 * **Example** (Define a UserPromptSubmit hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.UserPromptSubmit.define({
 *   handler: () => Effect.succeed(Hook.UserPromptSubmit.allow()),
 * })
 *
 * console.log(hook.event) // "UserPromptSubmit"
 * ```
 *
 * @see {@link block} for the erase-prompt decision a handler may return.
 * @category constructors
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
