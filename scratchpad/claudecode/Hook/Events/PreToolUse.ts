/**
 * Fires before Claude Code executes a tool call. A handler can return
 * `allow`, `deny`, `ask`, or `defer` to control whether the tool is run.
 * Matcher is on `tool_name`. See
 * https://code.claude.com/docs/en/hooks#pretooluse.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { HookToolDecodeError } from "../../Errors.ts";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";
import * as Tool from "../Tool.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/PreToolUse");

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Stdin payload for a PreToolUse hook, including `tool_name` and the
 * raw `tool_input` record.
 *
 * **Example** (Decode a pending Bash call)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PreToolUse.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PreToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "ls" },
 * })
 *
 * console.log(input.tool_name) // "Bash"
 * ```
 *
 * @see {@link deny} for blocking this tool call.
 * @see {@link onTool} for decoding a supported tool's input.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PreToolUseInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PreToolUse"),
    tool_name: S.String,
    tool_input: S.Record(S.String, S.Unknown),
    tool_use_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PreToolUseInput", {
    description: "Input for the PreToolUse hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Valid `permissionDecision` values. `defer` suspends a headless tool
 * call for later resumption; {@link passthrough} is the neutral no-op
 * (omit output entirely is equivalent).
 *
 * **Example** (Decode a permission decision)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const decision = S.decodeUnknownSync(Hook.PreToolUse.PermissionDecision)("deny")
 * console.log(decision) // "deny"
 * ```
 *
 * @see {@link allow} for proceeding with the tool call.
 * @see {@link deny} for blocking it.
 * @see {@link defer} for the headless resume protocol.
 * @category schemas
 * @since 0.0.0
 */
export const PermissionDecision = LiteralKit(["allow", "deny", "ask", "defer"]).pipe(
  $I.annoteSchema("PermissionDecision", {
    description: "Permission decision returned by a PreToolUse hook.",
  })
);

/**
 * Decoded value produced by {@link PermissionDecision}.
 *
 * @see {@link PermissionDecision} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type PermissionDecision = typeof PermissionDecision.Type;

/**
 * `hookSpecificOutput` payload for a PreToolUse hook. This is where the
 * permission decision lives.
 *
 * **Example** (Inspect a deny payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.PreToolUse.HookSpecificOutput.make({
 *   hookEventName: "PreToolUse",
 *   permissionDecision: "deny",
 *   permissionDecisionReason: O.some("no network in this session"),
 * })
 *
 * console.log(specific.permissionDecision) // "deny"
 * ```
 *
 * @see {@link deny} for the constructor that fills this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`PreToolUseHookSpecificOutput`)(
  {
    hookEventName: S.Literal("PreToolUse"),
    permissionDecision: PermissionDecision,
    permissionDecisionReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    updatedInput: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PreToolUseHookSpecificOutput", {
    description: "PreToolUse-specific response returned to Claude Code.",
  })
) {}

/**
 * Full PreToolUse hook output, including universal fields. The
 * permission decision lives on `hookSpecificOutput`.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreToolUse.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PreToolUseOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PreToolUseOutput", {
    description: "Output returned by a PreToolUse hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Build an `allow` decision. The tool call proceeds.
 *
 * **Example** (Allow a tool call)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreToolUse.allow("trusted read")
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.permissionDecision) // "allow"
 * ```
 *
 * @see {@link deny} for blocking the tool call.
 * @see {@link allowWithUpdatedInput} for allowing with rewritten input.
 * @see {@link passthrough} for a neutral no-op.
 * @category constructors
 * @since 0.0.0
 */
export const allow = (reason?: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: O.fromNullishOr(reason),
      })
    ),
  });

/**
 * Build a no-op output. The tool proceeds through normal permission
 * flow.
 *
 * **Example** (Skip a permission decision)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreToolUse.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link defer} for the headless resume protocol, which is not a no-op.
 * @see {@link allow} for an explicit allow decision.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a `deny` decision with a required explanation. The tool call is
 * blocked and the reason is fed back to Claude.
 *
 * **Example** (Deny a tool call)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreToolUse.deny("no network in this session")
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.permissionDecision) // "deny"
 * const reason = O.flatMap(output.hookSpecificOutput, (specific) => specific.permissionDecisionReason)
 * console.log(O.getOrUndefined(reason)) // "no network in this session"
 * ```
 *
 * @see {@link allow} for proceeding with the tool call.
 * @see {@link ask} for showing a permission prompt instead.
 * @category constructors
 * @since 0.0.0
 */
export const deny = (reason: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: O.some(reason),
      })
    ),
  });

/**
 * Build an `ask` decision. Claude Code shows the user a permission
 * prompt for the tool call.
 *
 * **Example** (Ask the user)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreToolUse.ask("confirm this write")
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.permissionDecision) // "ask"
 * ```
 *
 * @see {@link deny} for blocking without a prompt.
 * @see {@link allow} for proceeding without a prompt.
 * @category constructors
 * @since 0.0.0
 */
export const ask = (reason?: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: O.fromNullishOr(reason),
      })
    ),
  });

/**
 * Build a `defer` decision. In headless mode, Claude Code exits with
 * `stop_reason: "tool_deferred"` so an outer process can resume later.
 *
 * **Gotchas**
 *
 * `defer` is not a no-op. Interactive sessions may treat it like deny or
 * ask. Use {@link passthrough} for a neutral skip.
 *
 * **Example** (Defer a headless tool call)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreToolUse.defer("wait for operator approval")
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.permissionDecision) // "defer"
 * ```
 *
 * @see {@link passthrough} for a neutral no-op.
 * @category constructors
 * @since 0.0.0
 */
export const defer = (reason?: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PreToolUse",
        permissionDecision: "defer",
        permissionDecisionReason: O.fromNullishOr(reason),
      })
    ),
  });

/**
 * Build an `allow` decision that replaces the tool input with a
 * modified version.
 *
 * **Example** (Rewrite Bash input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreToolUse.allowWithUpdatedInput({ command: "ls -la" }, "normalized flags")
 * const updated = O.flatMap(output.hookSpecificOutput, (specific) => specific.updatedInput)
 * console.log(O.getOrUndefined(updated)) // { command: "ls -la" }
 * ```
 *
 * @see {@link allow} for allowing without rewriting input.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- This output constructor has no data operand; the optional reason only configures the new value.
export const allowWithUpdatedInput = (updatedInput: Readonly<Record<string, unknown>>, reason?: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: O.fromNullishOr(reason),
        updatedInput: O.some(updatedInput),
      })
    ),
  });

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a runnable PreToolUse hook from a handler effect.
 *
 * **Example** (Inspect the hook definition)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PreToolUse.define({
 *   handler: () => Effect.succeed(Hook.PreToolUse.passthrough())
 * })
 *
 * console.log(hook.event) // "PreToolUse"
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
  event: "PreToolUse",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Configuration for {@link onTool}: a supported tool name plus a handler
 * that receives the decoded tool payload.
 *
 * @see {@link onTool} for the constructor that consumes this config.
 * @category type-level
 * @since 0.0.0
 */
export type OnToolConfig<T extends Tool.SupportedToolName, E, R> = {
  readonly toolName: T;
  readonly handler: (input: Tool.DecodedPreToolUse<T>) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onDecodeError?: (error: HookToolDecodeError, input: Input) => Effect.Effect<Output, E, R>;
};

/**
 * Build a PreToolUse hook that only handles a specific supported tool.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * **Gotchas**
 *
 * Omitted `onDecodeError` fails closed with `HookToolDecodeError`.
 * Omitted `onMismatch` passthroughs.
 *
 * **Example** (Deny Bash)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PreToolUse.onTool({
 *   toolName: "Bash",
 *   handler: () => Effect.succeed(Hook.PreToolUse.deny("no bash in this session")),
 * })
 *
 * console.log(hook.event) // "PreToolUse"
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
      return Effect.matchEffect(Tool.decodePreToolUse(config.toolName, input), {
        onFailure: (error): Effect.Effect<Output, E | HookToolDecodeError, R> =>
          config.onDecodeError?.(error, input) ?? Effect.fail(error),
        onSuccess: config.handler,
      });
    },
  });

/**
 * Build a PreToolUse hook that only handles matching `tool_name` values.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * **Example** (Deny matching writes)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PreToolUse.onMatcher({
 *   matcher: "Write",
 *   handler: () => Effect.succeed(Hook.PreToolUse.deny("writes are frozen")),
 * })
 *
 * console.log(hook.event) // "PreToolUse"
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
 * Build a PreToolUse hook from a custom typed tool adapter.
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
 * const hook = Hook.PreToolUse.onAdapter({
 *   adapter: Hook.Tool.BashAdapter,
 *   handler: () => Effect.succeed(Hook.PreToolUse.passthrough()),
 * })
 *
 * console.log(hook.event) // "PreToolUse"
 * ```
 *
 * @see {@link onTool} for the built-in supported-tool entry.
 * @see {@link passthrough} for the default mismatch output.
 * @category constructors
 * @since 0.0.0
 */
export const onAdapter = <TName extends string, TTool, E, R>(config: {
  readonly adapter: Tool.PreToolAdapter<TName, TTool>;
  readonly handler: (input: Tool.DecodedPreToolUseWith<TTool>) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onDecodeError?: (error: HookToolDecodeError, input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E | HookToolDecodeError, R> =>
  define({
    handler: (input) => {
      if (input.tool_name !== config.adapter.toolName) {
        return config.onMismatch?.(input) ?? Effect.succeed(passthrough());
      }
      return Effect.matchEffect(Tool.decodePreToolUseWith(config.adapter, input), {
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
