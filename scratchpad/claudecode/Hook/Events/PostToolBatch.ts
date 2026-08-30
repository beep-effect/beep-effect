/**
 * Fires after a full batch of parallel tool calls resolves, before the
 * next model call. A handler can `block` the batch result, inject
 * `addContext`, or `passthrough`. Does not support a matcher. See
 * https://code.claude.com/docs/en/hooks#posttoolbatch.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/PostToolBatch");

/**
 * One completed tool call inside a parallel batch.
 *
 * **Example** (Decode a completed tool call)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const call = S.decodeUnknownSync(Hook.PostToolBatch.ToolCall)({
 *   tool_name: "Read",
 *   tool_input: { file_path: "/repo/README.md" },
 *   tool_response: { content: "# beep" },
 * })
 *
 * console.log(call.tool_name) // "Read"
 * ```
 *
 * @see {@link Input} for the batch that contains these calls.
 * @category schemas
 * @since 0.0.0
 */
export class ToolCall extends S.Class<ToolCall>($I`PostToolBatchToolCall`)(
  {
    tool_name: S.String,
    tool_input: S.Record(S.String, S.Unknown),
    tool_use_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    tool_response: S.Unknown,
  },
  $I.annote("PostToolBatchToolCall", {
    description: "One completed tool call in a Claude Code tool batch.",
  })
) {}

/**
 * Stdin payload for a PostToolBatch hook, listing every completed call
 * in the parallel batch.
 *
 * **Example** (Decode a completed batch)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PostToolBatch.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolBatch",
 *   tool_calls: [
 *     {
 *       tool_name: "Read",
 *       tool_input: { file_path: "/repo/README.md" },
 *       tool_response: { content: "# beep" },
 *     },
 *   ],
 * })
 *
 * console.log(input.tool_calls[0]?.tool_name) // "Read"
 * ```
 *
 * @see {@link ToolCall} for one entry in `tool_calls`.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PostToolBatchInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PostToolBatch"),
    tool_calls: S.Array(ToolCall),
  },
  $I.annote("PostToolBatchInput", {
    description: "Input for the PostToolBatch hook event.",
  })
) {}

/**
 * Event-specific payload that injects `additionalContext` after the
 * batch.
 *
 * **Example** (Inspect additional context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.PostToolBatch.HookSpecificOutput.make({
 *   hookEventName: "PostToolBatch",
 *   additionalContext: O.some("All reads succeeded"),
 * })
 *
 * console.log(O.getOrUndefined(specific.additionalContext)) // "All reads succeeded"
 * ```
 *
 * @see {@link addContext} for the constructor that fills this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`PostToolBatchHookSpecificOutput`)(
  {
    hookEventName: S.Literal("PostToolBatch"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostToolBatchHookSpecificOutput", {
    description: "Additional context emitted after a completed tool batch.",
  })
) {}

/**
 * JSON response a PostToolBatch handler returns. `decision: "block"`
 * rejects the batch; `hookSpecificOutput` injects extra context.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolBatch.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link passthrough} for letting the batch stand.
 * @see {@link block} for rejecting the batch.
 * @see {@link addContext} for injecting extra context.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PostToolBatchOutput`)(
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
  $I.annote("PostToolBatchOutput", {
    description: "Output returned by a PostToolBatch hook handler.",
  })
) {}

/**
 * Let the completed batch stand. Equivalent to empty `Output.make()`.
 *
 * **Example** (Accept the batch)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolBatch.passthrough()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for rejecting the batch.
 * @see {@link addContext} for injecting extra context without blocking.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Reject the completed batch and feed `reason` back to Claude.
 *
 * **Example** (Block a batch)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolBatch.block("parallel writes are not allowed")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "parallel writes are not allowed"
 * ```
 *
 * @see {@link passthrough} for letting the batch stand.
 * @see {@link addContext} for injecting extra context without blocking.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Inject additional context into the transcript without blocking the
 * batch.
 *
 * **Example** (Add batch summary context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolBatch.addContext("All reads succeeded")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "All reads succeeded"
 * ```
 *
 * @see {@link passthrough} for leaving the transcript unchanged.
 * @see {@link block} for rejecting the batch instead.
 * @category constructors
 * @since 0.0.0
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PostToolBatch",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Build a runnable PostToolBatch hook from a handler effect.
 *
 * **Example** (Define a PostToolBatch hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostToolBatch.define({
 *   handler: () => Effect.succeed(Hook.PostToolBatch.passthrough()),
 * })
 *
 * console.log(hook.event) // "PostToolBatch"
 * ```
 *
 * @see {@link passthrough} for the typical handler result.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "PostToolBatch",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Decoded and wire-encoded companion types for {@link ToolCall}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace ToolCall {
  /**
   * Decoded runtime representation of {@link ToolCall}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ToolCall;
  /**
   * Wire-encoded representation of {@link ToolCall}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ToolCall.Encoded;
}

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
