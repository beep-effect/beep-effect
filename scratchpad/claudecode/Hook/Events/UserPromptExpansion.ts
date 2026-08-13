/**
 * UserPromptExpansion hook event.
 *
 * Fires when a user-typed slash command expands into a prompt before it
 * reaches Claude. Supports a matcher on `command_name`.
 * See https://code.claude.com/docs/en/hooks#userpromptexpansion.
 *
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
 * Schema for `ExpansionType`.
 *
 * **Example** (Inspect the ExpansionType schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.ExpansionType)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const ExpansionType = LiteralKit(["slash_command", "mcp_prompt"]).pipe(
  $I.annoteSchema("ExpansionType", {
    description: "Kind of prompt expansion received by Claude Code.",
  })
);

/**
 * Type-level model for `ExpansionType`.
 *
 * **Example** (Use ExpansionType as a type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.UserPromptExpansion.ExpansionType
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type ExpansionType = typeof ExpansionType.Type;

/**
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.Input)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `HookSpecificOutput`.
 *
 * **Example** (Inspect the HookSpecificOutput schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * **Example** (Inspect the Output schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `allow`.
 *
 * **Example** (Use allow)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.allow)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const allow = (): Output => Output.make();

/**
 * Constructor for `block`.
 *
 * **Example** (Use block)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.block)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Constructor for `addContext`.
 *
 * **Example** (Use addContext)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.addContext)
 * ```
 *
 * @category constructors
 *
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
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.define)
 * ```
 *
 * @category constructors
 *
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
 * Constructor for `onMatcher`.
 *
 * **Example** (Use onMatcher)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.UserPromptExpansion.onMatcher)
 * ```
 *
 * @category constructors
 *
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
