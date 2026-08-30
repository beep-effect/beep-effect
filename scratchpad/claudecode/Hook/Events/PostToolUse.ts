/**
 * Fires after a tool call completes successfully. A handler can block
 * the tool result, inject additional context, or replace the tool or MCP
 * response. Matcher is on `tool_name`. See
 * https://code.claude.com/docs/en/hooks#posttooluse.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
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
 * Stdin payload for a PostToolUse hook, including `tool_name`, original
 * `tool_input`, and the completed `tool_response`.
 *
 * **Example** (Decode a completed Read)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PostToolUse.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Read",
 *   tool_input: { file_path: "/repo/README.md" },
 *   tool_response: { content: "# beep" },
 * })
 *
 * console.log(input.tool_name) // "Read"
 * ```
 *
 * @see {@link replaceOutput} for rewriting a non-MCP tool response.
 * @category schemas
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
 * Event-specific payload that can inject context or replace tool /
 * MCP output.
 *
 * **Example** (Inspect replaced tool output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.PostToolUse.HookSpecificOutput.make({
 *   hookEventName: "PostToolUse",
 *   updatedToolOutput: O.some({ content: "[redacted]" }),
 * })
 *
 * console.log(O.getOrUndefined(specific.updatedToolOutput)) // { content: "[redacted]" }
 * ```
 *
 * @see {@link replaceOutput} for writing `updatedToolOutput`.
 * @see {@link replaceMcpOutput} for writing `updatedMCPToolOutput`.
 * @category schemas
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
 * JSON response a PostToolUse handler returns. `decision: "block"`
 * rejects the tool result; replacement fields live on
 * `hookSpecificOutput`.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUse.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link passthrough} for leaving the tool result unchanged.
 * @see {@link block} for rejecting the tool result.
 * @category schemas
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
 * **Example** (Pass the tool result through)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUse.passthrough()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for rejecting the tool result.
 * @see {@link addContext} for injecting context without blocking.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Block the tool result and feed the reason back to Claude.
 *
 * **Example** (Reject a tool result)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUse.block("output contained secrets")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "output contained secrets"
 * ```
 *
 * @see {@link passthrough} for leaving the tool result unchanged.
 * @see {@link replaceOutput} for rewriting the result instead of blocking.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Inject additional context into the transcript without blocking.
 *
 * **Example** (Add a reminder beside the result)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUse.addContext("Prefer bun test next")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Prefer bun test next"
 * ```
 *
 * @see {@link replaceOutput} for rewriting the tool response.
 * @see {@link passthrough} for leaving the transcript unchanged.
 * @category constructors
 * @since 0.0.0
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
 * Replace a non-MCP tool's response by writing `updatedToolOutput`.
 *
 * **Gotchas**
 *
 * Claude Code ignores this field for MCP tools. Use
 * {@link replaceMcpOutput} (`updatedMCPToolOutput`) for MCP invocations.
 *
 * **Example** (Redact a Read result)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUse.replaceOutput({ content: "[redacted]" })
 * const replaced = O.flatMap(output.hookSpecificOutput, (specific) => specific.updatedToolOutput)
 * console.log(O.getOrUndefined(replaced)) // { content: "[redacted]" }
 * ```
 *
 * @see {@link replaceMcpOutput} for MCP-only `updatedMCPToolOutput`.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- This output constructor has no data operand; the optional context only configures the new value.
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
 * Replace an MCP tool's response by writing `updatedMCPToolOutput`.
 *
 * **Gotchas**
 *
 * Only valid for MCP tool invocations. Non-MCP tools honor
 * {@link replaceOutput} (`updatedToolOutput`) instead.
 *
 * **Example** (Replace MCP output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostToolUse.replaceMcpOutput({ text: "sanitized" })
 * const replaced = O.flatMap(output.hookSpecificOutput, (specific) => specific.updatedMCPToolOutput)
 * console.log(O.getOrUndefined(replaced)) // { text: "sanitized" }
 * ```
 *
 * @see {@link replaceOutput} for non-MCP `updatedToolOutput`.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- This output constructor has no data operand; the optional context only configures the new value.
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
 * Build a runnable PostToolUse hook from a handler effect.
 *
 * **Example** (Define a PostToolUse hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostToolUse.define({
 *   handler: () => Effect.succeed(Hook.PostToolUse.passthrough()),
 * })
 *
 * console.log(hook.event) // "PostToolUse"
 * ```
 *
 * @see {@link onTool} for handling a single supported tool.
 * @see {@link onMatcher} for filtering on `tool_name`.
 * @category constructors
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
 * Configuration for {@link onTool}: a supported tool name plus a handler
 * that receives the decoded tool payload and response.
 *
 * @see {@link onTool} for the constructor that consumes this config.
 * @category type-level
 * @since 0.0.0
 */
export type OnToolConfig<T extends Tool.SupportedToolName, E, R> = {
  readonly toolName: T;
  readonly handler: (input: Tool.DecodedPostToolUse<T>) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onDecodeError?: (error: HookToolDecodeError, input: Input) => Effect.Effect<Output, E, R>;
};

/**
 * Build a PostToolUse hook that only handles a specific supported tool.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * **Gotchas**
 *
 * Omitted `onDecodeError` fails closed with `HookToolDecodeError`.
 * Omitted `onMismatch` passthroughs.
 *
 * **Example** (Redact Bash output)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostToolUse.onTool({
 *   toolName: "Bash",
 *   handler: () => Effect.succeed(Hook.PostToolUse.replaceOutput({ stdout: "[redacted]" })),
 * })
 *
 * console.log(hook.event) // "PostToolUse"
 * ```
 *
 * @see {@link OnToolConfig} for the config shape.
 * @see {@link onAdapter} for a custom typed adapter.
 * @see {@link passthrough} for the default mismatch output.
 * @category constructors
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
 * **Example** (Annotate Write results)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostToolUse.onMatcher({
 *   matcher: "Write",
 *   handler: () => Effect.succeed(Hook.PostToolUse.addContext("Run bun test next")),
 * })
 *
 * console.log(hook.event) // "PostToolUse"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
 * @see {@link onTool} for typed decoding of a supported tool.
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
 * Build a PostToolUse hook from a custom typed tool adapter.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * **Gotchas**
 *
 * Omitted `onDecodeError` fails closed with `HookToolDecodeError`.
 * Omitted `onMismatch` passthroughs.
 *
 * **Example** (Handle Bash through its adapter)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostToolUse.onAdapter({
 *   adapter: Hook.Tool.BashAdapter,
 *   handler: () => Effect.succeed(Hook.PostToolUse.passthrough()),
 * })
 *
 * console.log(hook.event) // "PostToolUse"
 * ```
 *
 * @see {@link onTool} for the built-in supported-tool entry.
 * @see {@link passthrough} for the default mismatch output.
 * @category constructors
 * @since 0.0.0
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
