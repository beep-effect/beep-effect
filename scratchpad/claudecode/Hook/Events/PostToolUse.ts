/**
 * PostToolUse hook event.
 *
 * Fires after a tool call completes successfully. A handler can block the
 * tool result (feeding feedback back to Claude), inject additional context,
 * or replace the tool's response (for MCP tools). Supports a regex matcher
 * on `tool_name`. See https://code.claude.com/docs/en/hooks#posttooluse.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import type { HookToolDecodeError } from "../../Errors.ts";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";
import * as Tool from "../Tool.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/PostToolUse");

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
 * console.log(Hook.PostToolUse.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PostToolUseInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PostToolUse"),
    tool_name: S.String,
    tool_input: S.Record(S.String, S.Unknown),
    tool_response: S.Record(S.String, S.Unknown),
    tool_use_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    duration_ms: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostToolUseInput", {
    description: "Input for the PostToolUse hook event.",
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
 * console.log(Hook.PostToolUse.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`PostToolUseHookSpecificOutput`)(
  {
    hookEventName: S.Literal("PostToolUse"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    updatedToolOutput: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault),
    updatedMCPToolOutput: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostToolUseHookSpecificOutput", {
    description: "PostToolUse-specific response returned to Claude Code.",
  })
) {}

/**
 * Schema for `Output`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PostToolUseOutput`)(
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
  $I.annote("PostToolUseOutput", {
    description: "Output returned by a PostToolUse hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * No-op output — tool result passes through unchanged.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.passthrough)
 * ```
 */
export const passthrough = (): Output => Output.make();

/**
 * Block the tool result and feed the reason back to Claude.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.block)
 * ```
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Inject additional context into the transcript without blocking.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.addContext)
 * ```
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PostToolUse",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Replace the MCP tool's response. Only valid for MCP tool invocations.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.replaceOutput)
 * ```
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const replaceOutput = (updatedToolOutput: unknown, additionalContext?: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PostToolUse",
        additionalContext: O.fromNullishOr(additionalContext),
        updatedToolOutput: O.some(updatedToolOutput),
      })
    ),
  });

/**
 * Constructor for `replaceMcpOutput`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.replaceMcpOutput)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const replaceMcpOutput = (updatedMCPToolOutput: unknown, additionalContext?: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PostToolUse",
        additionalContext: O.fromNullishOr(additionalContext),
        updatedMCPToolOutput: O.some(updatedMCPToolOutput),
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
 * console.log(Hook.PostToolUse.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "PostToolUse",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a PostToolUse hook that only handles a specific supported tool.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type BashHook = Hook.PostToolUse.OnToolConfig<"Bash", never, never>
 * ```
 */
export type OnToolConfig<T extends Tool.SupportedToolName, E, R> = {
  readonly toolName: T;
  readonly handler: (input: Tool.DecodedPostToolUse<T>) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onDecodeError?: (error: HookToolDecodeError, input: Input) => Effect.Effect<Output, E, R>;
};

/**
 * Constructor for `onTool`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.onTool)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const onTool = <const T extends Tool.SupportedToolName, E, R>(
  config: OnToolConfig<T, E, R>
): HookDefinition<Input, Output, E | HookToolDecodeError, R> =>
  define({
    handler: (input) => {
      if (input.tool_name !== config.toolName) {
        return config.onMismatch?.(input) ?? Effect.succeed(passthrough());
      }
      return Effect.matchEffect(Tool.decodePostToolUse(config.toolName, input), {
        onFailure: (error): Effect.Effect<Output, E | HookToolDecodeError, R> =>
          config.onDecodeError?.(error, input) ?? Effect.fail(error),
        onSuccess: config.handler,
      });
    },
  });

/**
 * Build a PostToolUse hook that only handles matching `tool_name` values.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.onMatcher)
 * ```
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
 * Build a PostToolUse hook from a custom typed tool adapter.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PostToolUse.onAdapter)
 * ```
 */
export const onAdapter = <TName extends string, TTool, TResponse, E, R>(config: {
  readonly adapter: Tool.PostToolAdapter<TName, TTool, TResponse>;
  readonly handler: (input: Tool.DecodedPostToolUseWith<TTool, TResponse>) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onDecodeError?: (error: HookToolDecodeError, input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E | HookToolDecodeError, R> =>
  define({
    handler: (input) => {
      if (input.tool_name !== config.adapter.toolName) {
        return config.onMismatch?.(input) ?? Effect.succeed(passthrough());
      }
      return Effect.matchEffect(Tool.decodePostToolUseWith(config.adapter, input), {
        onFailure: (error): Effect.Effect<Output, E | HookToolDecodeError, R> =>
          config.onDecodeError?.(error, input) ?? Effect.fail(error),
        onSuccess: config.handler,
      });
    },
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
 * type Wire = Hook.PostToolUse.Input.Encoded
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
 * type Wire = Hook.PostToolUse.HookSpecificOutput.Encoded
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
 * type Wire = Hook.PostToolUse.Output.Encoded
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
