/**
 * Elicitation hook event.
 *
 * Fires when an MCP server requests user input via an elicitation flow.
 * A handler can accept (with form field values), decline, or cancel the
 * request without user interaction. Supports a matcher on
 * `mcp_server_name`.
 * See https://code.claude.com/docs/en/hooks#elicitation.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/Elicitation");

/**
 * Schema for `Action`.
 *
 * **Example** (Inspect the Action schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.Action)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const Action = LiteralKit(["accept", "decline", "cancel"]).pipe(
  $I.annoteSchema("Action", {
    description: "Action returned by an Elicitation hook.",
  })
);

/**
 * Type-level model for `Action`.
 *
 * **Example** (Use Action as a type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Elicitation.Action
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
 * **Example** (Inspect the Mode schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.Mode)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const Mode = LiteralKit(["form", "url"]).pipe(
  $I.annoteSchema("Mode", {
    description: "Interaction mode requested by an MCP elicitation.",
  })
);

/**
 * Type-level model for `Mode`.
 *
 * **Example** (Use Mode as a type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Elicitation.Mode
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
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`ElicitationInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("Elicitation"),
    mcp_server_name: S.String,
    message: S.String,
    mode: S.OptionFromOptionalKey(Mode).pipe(SchemaUtils.withNoneDefault),
    url: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    elicitation_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    requested_schema: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ElicitationInput", {
    description: "Input for the Elicitation hook event.",
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
 * console.log(Hook.Elicitation.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`ElicitationHookSpecificOutput`)(
  {
    hookEventName: S.Literal("Elicitation"),
    action: Action,
    content: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ElicitationHookSpecificOutput", {
    description: "Elicitation-specific response returned to Claude Code.",
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
 * console.log(Hook.Elicitation.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`ElicitationOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ElicitationOutput", {
    description: "Output returned by an Elicitation hook handler.",
  })
) {}

/**
 * Constructor for `accept`.
 *
 * **Example** (Use accept)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.accept)
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
        hookEventName: "Elicitation",
        action: "accept",
        content: O.fromNullishOr(content),
      })
    ),
  });

/**
 * Constructor for `decline`.
 *
 * **Example** (Use decline)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.decline)
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
        hookEventName: "Elicitation",
        action: "decline",
      })
    ),
  });

/**
 * Constructor for `cancel`.
 *
 * **Example** (Use cancel)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.cancel)
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
        hookEventName: "Elicitation",
        action: "cancel",
      })
    ),
  });

/**
 * No-op output — Claude Code continues the normal elicitation flow.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.passthrough)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "Elicitation",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build an Elicitation hook that only handles matching `mcp_server_name`
 * values.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Elicitation.onMatcher)
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
