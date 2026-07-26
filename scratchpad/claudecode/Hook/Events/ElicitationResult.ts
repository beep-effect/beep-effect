/**
 * ElicitationResult hook event.
 *
 * Fires after the user responds to an MCP elicitation dialog, before the
 * response is sent back to the MCP server. A handler can accept, decline,
 * or cancel the response — and may override the content. Supports a
 * matcher on `mcp_server_name`.
 * See https://code.claude.com/docs/en/hooks#elicitationresult.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/ElicitationResult");

/**
 * Schema for `Action`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.Action)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const Action = LiteralKit(["accept", "decline", "cancel"]).pipe(
  $I.annoteSchema("Action", {
    description: "Action selected for an MCP elicitation result.",
  })
);

/**
 * Type-level model for `Action`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.ElicitationResult.Action
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type Action = typeof Action.Type;

/**
 * Schema for `Mode`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.Mode)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const Mode = LiteralKit(["form", "url"]).pipe(
  $I.annoteSchema("Mode", {
    description: "Interaction mode used by an MCP elicitation result.",
  })
);

/**
 * Type-level model for `Mode`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.ElicitationResult.Mode
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type Mode = typeof Mode.Type;

/**
 * Schema for `Input`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`ElicitationResultInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("ElicitationResult"),
    mcp_server_name: S.String,
    action: Action,
    mode: S.OptionFromOptionalKey(Mode).pipe(SchemaUtils.withNoneDefault),
    elicitation_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    content: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ElicitationResultInput", {
    description: "Input for the ElicitationResult hook event.",
  })
) {}

/**
 * Schema for `HookSpecificOutput`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`ElicitationResultHookSpecificOutput`)(
  {
    hookEventName: S.Literal("ElicitationResult"),
    action: Action,
    content: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ElicitationResultHookSpecificOutput", {
    description: "Elicitation-result response returned to Claude Code.",
  })
) {}

/**
 * Schema for `Output`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`ElicitationResultOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ElicitationResultOutput", {
    description: "Output returned by an ElicitationResult hook handler.",
  })
) {}

/**
 * Constructor for `accept`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.accept)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const accept = (content?: Readonly<Record<string, unknown>>): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "ElicitationResult",
        action: "accept",
        content: O.fromNullishOr(content),
      })
    ),
  });

/**
 * Constructor for `decline`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.decline)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const decline = (): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "ElicitationResult",
        action: "decline",
      })
    ),
  });

/**
 * Constructor for `cancel`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.cancel)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const cancel = (): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "ElicitationResult",
        action: "cancel",
      })
    ),
  });

/**
 * No-op output — Claude Code continues the normal elicitation-result flow.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.passthrough)
 * ```
 */
export const passthrough = (): Output => Output.make();

/**
 * Constructor for `define`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "ElicitationResult",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build an ElicitationResult hook that only handles matching
 * `mcp_server_name` values.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ElicitationResult.onMatcher)
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
      select: (input) => input.mcp_server_name,
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.ElicitationResult.Input.Encoded
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
 * type Wire = Hook.ElicitationResult.HookSpecificOutput.Encoded
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
 * type Wire = Hook.ElicitationResult.Output.Encoded
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
