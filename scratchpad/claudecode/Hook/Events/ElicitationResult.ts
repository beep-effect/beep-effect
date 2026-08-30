/**
 * Fires after the user responds to an MCP elicitation dialog, before the
 * response is sent back to the MCP server. A handler can accept, decline,
 * or cancel — and may override the collected content. Matcher is on
 * `mcp_server_name`. See
 * https://code.claude.com/docs/en/hooks#elicitationresult.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/ElicitationResult");

/**
 * Override action applied to an already-collected user response
 * (`accept`, `decline`, or `cancel`).
 *
 * **Example** (Decode a result action)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const action = S.decodeUnknownSync(Hook.ElicitationResult.Action)("accept")
 * console.log(action) // "accept"
 * ```
 *
 * @see {@link accept} for overriding the collected content.
 * @category schemas
 * @since 0.0.0
 */
export const Action = LiteralKit(["accept", "decline", "cancel"]).pipe(
  $I.annoteSchema("Action", {
    description: "Action selected for an MCP elicitation result.",
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
 * Interaction mode used for the completed elicitation (`form` or `url`).
 *
 * **Example** (Decode a result mode)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const mode = S.decodeUnknownSync(Hook.ElicitationResult.Mode)("form")
 * console.log(mode) // "form"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this mode.
 * @category schemas
 * @since 0.0.0
 */
export const Mode = LiteralKit(["form", "url"]).pipe(
  $I.annoteSchema("Mode", {
    description: "Interaction mode used by an MCP elicitation result.",
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
 * Stdin payload for an ElicitationResult hook, including the user's
 * original `action` and optional `content`.
 *
 * **Example** (Decode a collected user response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.ElicitationResult.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "ElicitationResult",
 *   mcp_server_name: "docs-mcp",
 *   action: "accept",
 *   content: { project: "beep" },
 * })
 *
 * console.log(input.action) // "accept"
 * ```
 *
 * @see {@link Elicitation.Input} for the original prompt, before the user answers.
 * @category schemas
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
 * Event-specific payload that overrides the user's collected response.
 *
 * **Example** (Inspect an override payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.ElicitationResult.HookSpecificOutput.make({
 *   hookEventName: "ElicitationResult",
 *   action: "accept",
 *   content: O.some({ project: "beep-effect" }),
 * })
 *
 * console.log(specific.action) // "accept"
 * ```
 *
 * @see {@link accept} for the constructor that fills this payload.
 * @category schemas
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
 * JSON response an ElicitationResult handler returns. `hookSpecificOutput`
 * overrides the already-collected user response.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ElicitationResult.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for sending the user's original response unchanged.
 * @category schemas
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
 * Forward an accept, optionally replacing the user's collected `content`.
 *
 * **Example** (Override collected fields)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ElicitationResult.accept({ project: "beep-effect" })
 * const specific = O.getOrUndefined(output.hookSpecificOutput)
 * console.log(specific?.action) // "accept"
 * console.log(O.getOrUndefined(specific?.content ?? O.none())) // { project: "beep-effect" }
 * ```
 *
 * @see {@link decline} for converting the collected response into a decline.
 * @see {@link cancel} for aborting after the user already answered.
 * @see {@link passthrough} for sending the original response unchanged.
 * @category constructors
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
 * Replace the user's collected accept with a decline.
 *
 * **Example** (Override into a decline)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ElicitationResult.decline()
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.action) // "decline"
 * ```
 *
 * @see {@link accept} for forwarding or rewriting accepted content.
 * @see {@link cancel} for aborting after the user already answered.
 * @category constructors
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
 * Replace the user's collected response with a cancel.
 *
 * **Example** (Override into a cancel)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ElicitationResult.cancel()
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.action) // "cancel"
 * ```
 *
 * @see {@link accept} for forwarding or rewriting accepted content.
 * @see {@link decline} for converting the collected response into a decline.
 * @category constructors
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
 * No-op output — Claude Code sends the user's original elicitation
 * response to the MCP server unchanged.
 *
 * **Example** (Keep the user's answer)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ElicitationResult.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link accept} for overriding the collected content.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a runnable ElicitationResult hook from a handler effect.
 *
 * **Example** (Define an ElicitationResult hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.ElicitationResult.define({
 *   handler: () => Effect.succeed(Hook.ElicitationResult.passthrough()),
 * })
 *
 * console.log(hook.event) // "ElicitationResult"
 * ```
 *
 * @see {@link onMatcher} for filtering on `mcp_server_name`.
 * @category constructors
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
 * **Example** (Rewrite a trusted MCP server's result)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.ElicitationResult.onMatcher({
 *   matcher: "docs-mcp",
 *   handler: () => Effect.succeed(Hook.ElicitationResult.accept({ project: "beep-effect" })),
 * })
 *
 * console.log(hook.event) // "ElicitationResult"
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
