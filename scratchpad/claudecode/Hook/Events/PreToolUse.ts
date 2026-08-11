/**
 * PreToolUse hook event.
 *
 * Fires before Claude Code executes a tool call. A handler can return
 * `allow`, `deny`, `ask`, or `defer` to control whether the tool is run.
 * Supports a regex matcher on `tool_name`. See
 * https://code.claude.com/docs/en/hooks#pretooluse.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
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
 * Decoded PreToolUse hook input received on stdin.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.Input)
 * ```
 *
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
 * Valid `permissionDecision` values. `defer` suspends a headless tool call
 * for later resumption; omit output entirely for a neutral no-op.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.PermissionDecision)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionDecision = LiteralKit(["allow", "deny", "ask", "defer"]).pipe(
  $I.annoteSchema("PermissionDecision", {
    description: "Permission decision returned by a PreToolUse hook.",
  })
);

/**
 * Type-level model for `PermissionDecision`.
 *
 * **Example** (Use PermissionDecision as a type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.PreToolUse.PermissionDecision
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type PermissionDecision = typeof PermissionDecision.Type;

/**
 * `hookSpecificOutput` payload for a PreToolUse hook. This is where the
 * permission decision lives.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.HookSpecificOutput)
 * ```
 *
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
 * Full PreToolUse hook output, including universal fields.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.Output)
 * ```
 *
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
 * **Example** (Build `allow` decision)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.allow)
 * ```
 *
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
 * Build a no-op output. The tool proceeds through normal permission flow.
 *
 * **Example** (Build no-op output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.passthrough)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a `deny` decision with a required explanation. The tool call
 * is blocked and the reason is fed back to Claude.
 *
 * **Example** (Build `deny` decision with a required explanation)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.deny)
 * ```
 *
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
 * **Example** (Build `ask` decision)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.ask)
 * ```
 *
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
 * Use `passthrough()` for a neutral no-op.
 *
 * **Example** (Build `defer` decision)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.defer)
 * ```
 *
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
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.allowWithUpdatedInput)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
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
 * Build a PreToolUse hook that only handles a specific supported tool.
 * Non-matching tool invocations default to `passthrough()`.
 *
 * **Example** (Build PreToolUse hook that only handles a specific supported tool)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type BashHook = Hook.PreToolUse.OnToolConfig<"Bash", never, never>
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export type OnToolConfig<T extends Tool.SupportedToolName, E, R> = {
  readonly toolName: T;
  readonly handler: (input: Tool.DecodedPreToolUse<T>) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onDecodeError?: (error: HookToolDecodeError, input: Input) => Effect.Effect<Output, E, R>;
};

/**
 * Constructor for `onTool`.
 *
 * **Example** (Use onTool)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.onTool)
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
 * **Example** (Build PreToolUse hook that only handles matching `tool_name` values)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.onMatcher)
 * ```
 *
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
 * **Example** (Build PreToolUse hook from a custom typed tool adapter)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PreToolUse.onAdapter)
 * ```
 *
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
