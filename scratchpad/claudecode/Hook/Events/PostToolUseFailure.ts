/**
 * Fires after a tool call fails or is interrupted. A handler can attach
 * additional context Claude will see beside the raw error, or `block`
 * further processing. Matcher is on `tool_name`. See
 * https://code.claude.com/docs/en/hooks#posttoolusefailure.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/PostToolUseFailure");

/**
 * Stdin payload for a PostToolUseFailure hook, including the failed
 * `tool_name`, original `tool_input`, and `error` text.
 *
 * **Example** (Decode a failed Bash call)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PostToolUseFailure.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUseFailure",
 *   tool_name: "Bash",
 *   tool_input: { command: "ls /missing" },
 *   error: "No such file or directory",
 * })
 *
 * console.log(input.error) // "No such file or directory"
 * ```
 *
 * @see {@link addContext} for attaching guidance beside this error.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PostToolUseFailureInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PostToolUseFailure"),
    tool_name: S.String,
    tool_input: S.Record(S.String, S.Unknown),
    tool_use_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    error: S.String,
    is_interrupt: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    duration_ms: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostToolUseFailureInput", {
    description: "Input for the PostToolUseFailure hook event.",
  })
) {}

/**
 * Event-specific payload that attaches `additionalContext` beside the
 * raw error.
 *
 * **Example** (Inspect additional context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.PostToolUseFailure.HookSpecificOutput.make({
 *   hookEventName: "PostToolUseFailure",
 *   additionalContext: O.some("Retry with an existing path"),
 * })
 *
 * console.log(O.getOrUndefined(specific.additionalContext)) // "Retry with an existing path"
 * ```
 *
 * @see {@link addContext} for the constructor that fills this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`PostToolUseFailureHookSpecificOutput`)(
  {
    hookEventName: S.Literal("PostToolUseFailure"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostToolUseFailureHookSpecificOutput", {
    description: "PostToolUseFailure-specific response returned to Claude Code.",
  })
) {}

/**
 * JSON response a PostToolUseFailure handler returns. Use
 * `additionalContext` to explain the error or `decision: "block"` to
 * halt further processing.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUseFailure.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link addContext} for the primary use of this event.
 * @see {@link block} for halting further processing.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PostToolUseFailureOutput`)(
  {
    decision: S.OptionFromOptionalKey(S.Literal("block")).pipe(SchemaUtils.withNoneDefault),
    reason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostToolUseFailureOutput", {
    description: "Output returned by a PostToolUseFailure handler.",
  })
) {}

/**
 * Leave the raw error unchanged. Equivalent to empty `Output.make()`.
 *
 * **Example** (Pass the error through)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUseFailure.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link addContext} for attaching guidance beside the error.
 * @see {@link block} for halting further processing.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Attach additional context Claude will see beside the raw tool error.
 *
 * **Example** (Explain a missing path)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUseFailure.addContext("Retry with an existing path")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Retry with an existing path"
 * ```
 *
 * @see {@link passthrough} for leaving the raw error unchanged.
 * @see {@link block} for halting further processing instead.
 * @category constructors
 * @since 0.0.0
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PostToolUseFailure",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Halt further processing of this failed tool call and feed `reason`
 * back to Claude.
 *
 * **Example** (Block after a failure)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUseFailure.block("do not retry this command")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "do not retry this command"
 * ```
 *
 * @see {@link addContext} for explaining the error without blocking.
 * @see {@link passthrough} for leaving the raw error unchanged.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Build a runnable PostToolUseFailure hook from a handler effect.
 *
 * **Example** (Define a PostToolUseFailure hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostToolUseFailure.define({
 *   handler: () => Effect.succeed(Hook.PostToolUseFailure.passthrough()),
 * })
 *
 * console.log(hook.event) // "PostToolUseFailure"
 * ```
 *
 * @see {@link onMatcher} for filtering on `tool_name`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "PostToolUseFailure",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a PostToolUseFailure hook that only handles matching `tool_name`
 * values.
 *
 * **Example** (Annotate failed Bash calls)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostToolUseFailure.onMatcher({
 *   matcher: "Bash",
 *   handler: () => Effect.succeed(Hook.PostToolUseFailure.addContext("Retry with an existing path")),
 * })
 *
 * console.log(hook.event) // "PostToolUseFailure"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
 * @see {@link addContext} for the matched-handler decision used here.
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
