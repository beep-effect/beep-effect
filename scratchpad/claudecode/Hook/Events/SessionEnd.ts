/**
 * Fires when a session terminates (clear, resume, logout, or exit).
 * Observability-only: JSON output is not acted on. Matcher is on
 * `reason`. See https://code.claude.com/docs/en/hooks#sessionend.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Events/SessionEnd");

/**
 * Why the Claude Code session ended.
 *
 * **Example** (Decode an exit reason)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(Hook.SessionEnd.ExitReason)("logout")
 * console.log(reason) // "logout"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this reason.
 * @category schemas
 * @since 0.0.0
 */
export const ExitReason = LiteralKit([
  "clear",
  "resume",
  "logout",
  "prompt_input_exit",
  "bypass_permissions_disabled",
  "other",
]).pipe(
  $I.annoteSchema("ExitReason", {
    description: "Reason a Claude Code session ended.",
  })
);

/**
 * Decoded value produced by {@link ExitReason}.
 *
 * @see {@link ExitReason} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ExitReason = typeof ExitReason.Type;

/**
 * Stdin payload for a SessionEnd hook, including the exit `reason`.
 *
 * **Example** (Decode a logout)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.SessionEnd.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SessionEnd",
 *   reason: "logout",
 * })
 *
 * console.log(input.reason) // "logout"
 * ```
 *
 * @see {@link onMatcher} for filtering on `reason`.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`SessionEndInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("SessionEnd"),
    reason: ExitReason,
  },
  $I.annote("SessionEndInput", {
    description: "Input for the SessionEnd hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * JSON response a SessionEnd handler may return. Claude Code ignores it;
 * the session is already ending.
 *
 * **Gotchas**
 *
 * Setting `continue: false` does not keep the session open.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionEnd.Output.make()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`SessionEndOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SessionEndOutput", {
    description: "Output returned by a SessionEnd hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Empty observability output. Claude Code ignores the JSON body.
 *
 * **Gotchas**
 *
 * This is not a decision helper.
 *
 * **Example** (Return empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionEnd.passthrough()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link define} for wrapping this result in a handler.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a runnable SessionEnd hook from a handler effect.
 *
 * **Gotchas**
 *
 * Claude Code ignores the JSON response.
 *
 * **Example** (Define a SessionEnd hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SessionEnd.define({
 *   handler: () => Effect.succeed(Hook.SessionEnd.passthrough()),
 * })
 *
 * console.log(hook.event) // "SessionEnd"
 * ```
 *
 * @see {@link onMatcher} for filtering on `reason`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "SessionEnd",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a SessionEnd hook that only handles matching `reason` values.
 *
 * **Example** (Observe logout)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SessionEnd.onMatcher({
 *   matcher: "logout",
 *   handler: () => Effect.succeed(Hook.SessionEnd.passthrough()),
 * })
 *
 * console.log(hook.event) // "SessionEnd"
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
      select: (input) => input.reason,
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
