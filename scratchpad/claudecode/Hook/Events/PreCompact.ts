/**
 * Fires before Claude Code compacts the conversation. A handler can
 * `block` compaction (it does not stop the session). Matcher is on
 * `trigger` (`manual` or `auto`). See
 * https://code.claude.com/docs/en/hooks#precompact.
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

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Events/PreCompact");

/**
 * Whether compaction is about to run because the user asked (`manual`)
 * or because Claude Code decided to (`auto`).
 *
 * **Example** (Decode a compact trigger)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const trigger = S.decodeUnknownSync(Hook.PreCompact.Trigger)("manual")
 * console.log(trigger) // "manual"
 * ```
 *
 * @see {@link onMatcher} for filtering on this trigger.
 * @category schemas
 * @since 0.0.0
 */
export const Trigger = LiteralKit(["manual", "auto"]).pipe(
  $I.annoteSchema("Trigger", {
    description: "Trigger that initiates pre-compaction processing.",
  })
);

/**
 * Decoded value produced by {@link Trigger}.
 *
 * @see {@link Trigger} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Trigger = typeof Trigger.Type;

/**
 * Stdin payload for a PreCompact hook, including `trigger` and optional
 * custom instructions.
 *
 * **Example** (Decode a manual compact)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PreCompact.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PreCompact",
 *   trigger: "manual",
 * })
 *
 * console.log(input.trigger) // "manual"
 * ```
 *
 * @see {@link block} for preventing this compaction.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PreCompactInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PreCompact"),
    trigger: Trigger,
    custom_instructions: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PreCompactInput", {
    description: "Input for the PreCompact hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * JSON response a PreCompact handler returns. `decision: "block"`
 * prevents compaction; empty output lets it proceed.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreCompact.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link passthrough} for letting compaction proceed.
 * @see {@link block} for preventing compaction.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PreCompactOutput`)(
  {
    decision: S.OptionFromOptionalKey(S.Literal("block")).pipe(SchemaUtils.withNoneDefault),
    reason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PreCompactOutput", {
    description: "Output returned by a PreCompact hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Let compaction proceed. Equivalent to empty `Output.make()`.
 *
 * **Example** (Allow compaction)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreCompact.passthrough()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for preventing compaction.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Prevent this compaction. The session continues with the current
 * context; this is not a session stop.
 *
 * **Gotchas**
 *
 * Unlike ConfigChange, this `block` only skips compaction. The turn
 * keeps running.
 *
 * **Example** (Keep the long context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PreCompact.block("keep the long context")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "keep the long context"
 * ```
 *
 * @see {@link passthrough} for letting compaction proceed.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a runnable PreCompact hook from a handler effect.
 *
 * **Example** (Define a PreCompact hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PreCompact.define({
 *   handler: () => Effect.succeed(Hook.PreCompact.passthrough()),
 * })
 *
 * console.log(hook.event) // "PreCompact"
 * ```
 *
 * @see {@link onMatcher} for filtering on `trigger`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "PreCompact",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a PreCompact hook that only handles matching `trigger` values.
 *
 * **Example** (Block automatic compaction)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PreCompact.onMatcher({
 *   matcher: "auto",
 *   handler: () => Effect.succeed(Hook.PreCompact.block("keep the long context")),
 * })
 *
 * console.log(hook.event) // "PreCompact"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
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
      select: (input) => input.trigger,
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
