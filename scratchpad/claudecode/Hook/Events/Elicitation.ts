/**
 * Fires when an MCP server requests user input via elicitation. A
 * handler can `accept` (with form field values), `decline`, or `cancel`
 * without showing the user a dialog. Matcher is on `mcp_server_name`.
 * See https://code.claude.com/docs/en/hooks#elicitation.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/Elicitation");

/**
 * Response action a handler may send back to the MCP elicitation
 * (`accept`, `decline`, or `cancel`).
 *
 * **Example** (Decode an elicitation action)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const action = S.decodeUnknownSync(Hook.Elicitation.Action)("accept")
 * console.log(action) // "accept"
 * ```
 *
 * @see {@link accept} for the constructor that emits this action with content.
 * @category schemas
 * @since 0.0.0
 */
export const Action = LiteralKit(["accept", "decline", "cancel"]).pipe(
  $I.annoteSchema("Action", {
    description: "Action returned by an Elicitation hook.",
  })
);

/**
 * Decoded value produced by {@link Action}.
 *
 * @see {@link Action} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Action = typeof Action.Type;

/**
 * Interaction mode the MCP server requested (`form` or `url`).
 *
 * **Example** (Decode an elicitation mode)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const mode = S.decodeUnknownSync(Hook.Elicitation.Mode)("form")
 * console.log(mode) // "form"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this mode.
 * @category schemas
 * @since 0.0.0
 */
export const Mode = LiteralKit(["form", "url"]).pipe(
  $I.annoteSchema("Mode", {
    description: "Interaction mode requested by an MCP elicitation.",
  })
);

/**
 * Decoded value produced by {@link Mode}.
 *
 * @see {@link Mode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Mode = typeof Mode.Type;

/**
 * Stdin payload for an Elicitation hook, including the MCP server name,
 * prompt message, and optional requested schema.
 *
 * **Example** (Decode an MCP elicitation)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.Elicitation.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "Elicitation",
 *   mcp_server_name: "docs-mcp",
 *   message: "Which project?",
 * })
 *
 * console.log(input.mcp_server_name) // "docs-mcp"
 * ```
 *
 * @see {@link onMatcher} for filtering on `mcp_server_name`.
 * @category schemas
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
 * Event-specific payload that carries the `action` and optional form
 * `content`.
 *
 * **Example** (Inspect an accept payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.Elicitation.HookSpecificOutput.make({
 *   hookEventName: "Elicitation",
 *   action: "accept",
 *   content: O.some({ project: "beep" }),
 * })
 *
 * console.log(specific.action) // "accept"
 * ```
 *
 * @see {@link accept} for the constructor that fills this payload.
 * @category schemas
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
 * JSON response an Elicitation handler returns. `hookSpecificOutput`
 * holds the accept/decline/cancel decision.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Elicitation.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for leaving the user-facing dialog in place.
 * @category schemas
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
 * Accept the elicitation without showing the user, optionally supplying
 * form `content` that MCP treats as the user's answers.
 *
 * **Details**
 *
 * `content` is required for a useful form accept. Omitting it accepts
 * with empty fields.
 *
 * **Example** (Accept with field values)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Elicitation.accept({ project: "beep" })
 * const specific = O.getOrUndefined(output.hookSpecificOutput)
 * console.log(specific?.action) // "accept"
 * console.log(O.getOrUndefined(specific?.content ?? O.none())) // { project: "beep" }
 * ```
 *
 * @see {@link decline} for refusing the request.
 * @see {@link cancel} for aborting the elicitation flow.
 * @see {@link passthrough} for showing the user the dialog instead.
 * @category constructors
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
 * Decline the elicitation without user interaction.
 *
 * **Example** (Decline the request)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Elicitation.decline()
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.action) // "decline"
 * ```
 *
 * @see {@link accept} for answering with form values.
 * @see {@link cancel} for aborting the elicitation flow.
 * @category constructors
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
 * Cancel the elicitation without user interaction.
 *
 * **Example** (Cancel the request)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Elicitation.cancel()
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.action) // "cancel"
 * ```
 *
 * @see {@link accept} for answering with form values.
 * @see {@link decline} for refusing the request.
 * @category constructors
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
 * No-op output — Claude Code continues the normal elicitation flow and
 * shows the user the dialog.
 *
 * **Example** (Leave the dialog to the user)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Elicitation.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link accept} for answering without showing the dialog.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a runnable Elicitation hook from a handler effect.
 *
 * **Example** (Define an Elicitation hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.Elicitation.define({
 *   handler: () => Effect.succeed(Hook.Elicitation.passthrough()),
 * })
 *
 * console.log(hook.event) // "Elicitation"
 * ```
 *
 * @see {@link onMatcher} for filtering on `mcp_server_name`.
 * @category constructors
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
 * **Example** (Auto-accept a trusted MCP server)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.Elicitation.onMatcher({
 *   matcher: "docs-mcp",
 *   handler: () => Effect.succeed(Hook.Elicitation.accept({ project: "beep" })),
 * })
 *
 * console.log(hook.event) // "Elicitation"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
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
