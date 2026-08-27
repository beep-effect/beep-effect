/**
 * Fires after Claude Code compacts the conversation. Observability-only:
 * there is no decision control. Matcher is on `trigger` (`manual` or
 * `auto`). See https://code.claude.com/docs/en/hooks#postcompact.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/PostCompact");

/**
 * Whether compaction was user-initiated (`manual`) or automatic
 * (`auto`).
 *
 * **Example** (Decode a compact trigger)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const trigger = S.decodeUnknownSync(Hook.PostCompact.Trigger)("auto")
 * console.log(trigger) // "auto"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this trigger.
 * @category schemas
 * @since 0.0.0
 */
export const Trigger = LiteralKit(["manual", "auto"]).pipe(
  $I.annoteSchema("Trigger", {
    description: "Trigger that initiated conversation compaction.",
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
 * Stdin payload for a PostCompact hook, including `trigger` and optional
 * `compact_summary`.
 *
 * **Example** (Decode an automatic compact)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PostCompact.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostCompact",
 *   trigger: "auto",
 * })
 *
 * console.log(input.trigger) // "auto"
 * ```
 *
 * @see {@link onMatcher} for filtering on `trigger`.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PostCompactInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PostCompact"),
    trigger: Trigger,
    compact_summary: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostCompactInput", {
    description: "Input for the PostCompact hook event.",
  })
) {}

/**
 * JSON response a PostCompact handler may return. Claude Code ignores
 * it; compaction has already finished.
 *
 * **Gotchas**
 *
 * There is no decision control. Emitting `continue: false` does not
 * restore the pre-compact context.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PostCompact.Output.make()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PostCompactOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PostCompactOutput", {
    description: "Output returned by a PostCompact hook handler.",
  })
) {}

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
 * const output = Hook.PostCompact.passthrough()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link define} for wrapping this result in a handler.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a runnable PostCompact hook from a handler effect.
 *
 * **Gotchas**
 *
 * Claude Code ignores the JSON response.
 *
 * **Example** (Define a PostCompact hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostCompact.define({
 *   handler: () => Effect.succeed(Hook.PostCompact.passthrough()),
 * })
 *
 * console.log(hook.event) // "PostCompact"
 * ```
 *
 * @see {@link onMatcher} for filtering on `trigger`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "PostCompact",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a PostCompact hook that only handles matching `trigger` values.
 *
 * **Example** (Observe automatic compaction)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PostCompact.onMatcher({
 *   matcher: "auto",
 *   handler: () => Effect.succeed(Hook.PostCompact.passthrough()),
 * })
 *
 * console.log(hook.event) // "PostCompact"
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
