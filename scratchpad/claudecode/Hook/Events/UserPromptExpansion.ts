/**
 * Fires when a user-typed slash command expands into a prompt before it
 * reaches Claude. A handler can `allow`, `block`, or `addContext`.
 * Matcher is on `command_name`. See
 * https://code.claude.com/docs/en/hooks#userpromptexpansion.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/UserPromptExpansion");

/**
 * Kind of expansion that produced this prompt (`slash_command` or
 * `mcp_prompt`).
 *
 * **Example** (Decode an expansion type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(Hook.UserPromptExpansion.ExpansionType)("slash_command")
 * console.log(kind) // "slash_command"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this kind.
 * @category schemas
 * @since 0.0.0
 */
export const ExpansionType = LiteralKit(["slash_command", "mcp_prompt"]).pipe(
  $I.annoteSchema("ExpansionType", {
    description: "Kind of prompt expansion received by Claude Code.",
  })
);

/**
 * Decoded value produced by {@link ExpansionType}.
 *
 * @see {@link ExpansionType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ExpansionType = typeof ExpansionType.Type;

/**
 * Stdin payload for a UserPromptExpansion hook, including `command_name`
 * and the expanded `prompt`.
 *
 * **Example** (Decode a slash-command expansion)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.UserPromptExpansion.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "UserPromptExpansion",
 *   expansion_type: "slash_command",
 *   command_name: "review",
 *   command_args: "src/index.ts",
 *   command_source: "project",
 *   prompt: "Review src/index.ts",
 * })
 *
 * console.log(input.command_name) // "review"
 * ```
 *
 * @see {@link onMatcher} for filtering on `command_name`.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`UserPromptExpansionInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("UserPromptExpansion"),
    expansion_type: ExpansionType,
    command_name: S.String,
    command_args: S.String,
    command_source: S.String,
    prompt: S.String,
  },
  $I.annote("UserPromptExpansionInput", {
    description: "Input for the UserPromptExpansion hook event.",
  })
) {}

/**
 * Event-specific payload that injects `additionalContext` beside the
 * expanded prompt.
 *
 * **Example** (Inspect additional context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.UserPromptExpansion.HookSpecificOutput.make({
 *   hookEventName: "UserPromptExpansion",
 *   additionalContext: O.some("Follow the repo review checklist"),
 * })
 *
 * console.log(O.getOrUndefined(specific.additionalContext)) // "Follow the repo review checklist"
 * ```
 *
 * @see {@link addContext} for the constructor that fills this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`UserPromptExpansionHookSpecificOutput`)(
  {
    hookEventName: S.Literal("UserPromptExpansion"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("UserPromptExpansionHookSpecificOutput", {
    description: "UserPromptExpansion-specific response returned to Claude Code.",
  })
) {}

/**
 * JSON response a UserPromptExpansion handler returns. `decision:
 * "block"` refuses the expanded prompt.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptExpansion.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link allow} for letting the expanded prompt through.
 * @see {@link block} for refusing it.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`UserPromptExpansionOutput`)(
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
  $I.annote("UserPromptExpansionOutput", {
    description: "Output returned by a UserPromptExpansion handler.",
  })
) {}

/**
 * Let the expanded prompt reach Claude. Equivalent to empty
 * `Output.make()`.
 *
 * **Example** (Allow the expansion)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptExpansion.allow()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for refusing the expanded prompt.
 * @see {@link addContext} for injecting extra context without blocking.
 * @category constructors
 * @since 0.0.0
 */
export const allow = (): Output => Output.make();

/**
 * Refuse the expanded prompt and feed `reason` back to the user.
 *
 * **Example** (Block a slash command)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptExpansion.block("review is disabled in this session")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "review is disabled in this session"
 * ```
 *
 * @see {@link allow} for letting the expanded prompt through.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Allow the expansion and inject additional context Claude will see.
 *
 * **Example** (Add a checklist to a slash command)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.UserPromptExpansion.addContext("Follow the repo review checklist")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Follow the repo review checklist"
 * ```
 *
 * @see {@link allow} for proceeding with no extra context.
 * @see {@link block} for refusing the expansion.
 * @category constructors
 * @since 0.0.0
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "UserPromptExpansion",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Build a runnable UserPromptExpansion hook from a handler effect.
 *
 * **Example** (Define a UserPromptExpansion hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.UserPromptExpansion.define({
 *   handler: () => Effect.succeed(Hook.UserPromptExpansion.allow()),
 * })
 *
 * console.log(hook.event) // "UserPromptExpansion"
 * ```
 *
 * @see {@link onMatcher} for filtering on `command_name`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "UserPromptExpansion",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a UserPromptExpansion hook that only handles matching
 * `command_name` values.
 *
 * **Gotchas**
 *
 * Omitted `onMismatch` succeeds {@link allow}, so a matcher miss lets
 * the expanded prompt through instead of becoming a no-op.
 *
 * **Example** (Block a specific slash command)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.UserPromptExpansion.onMatcher({
 *   matcher: "review",
 *   handler: () => Effect.succeed(Hook.UserPromptExpansion.block("review is disabled")),
 * })
 *
 * console.log(hook.event) // "UserPromptExpansion"
 * ```
 *
 * @see {@link allow} for the default mismatch output.
 * @see {@link block} for the matched-handler decision used here.
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
      select: (input) => input.command_name,
      onMatch: config.handler,
      onMismatch: config.onMismatch ?? (() => Effect.succeed(allow())),
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
