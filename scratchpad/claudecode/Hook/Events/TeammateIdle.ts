/**
 * Fires when a teammate in an agent-team context is about to go idle. A
 * handler can prevent idle by exiting 2 with feedback on stderr
 * (`keepWorking`). Does not support a matcher. See
 * https://code.claude.com/docs/en/hooks#teammateidle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import type * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import { type HookDefinition, type HookProcessOutput, stderrExit } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/TeammateIdle");

/**
 * Stdin payload for a TeammateIdle hook, including optional team and
 * teammate names.
 *
 * **Example** (Decode an idle teammate)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.TeammateIdle.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "TeammateIdle",
 *   team_name: "platform",
 *   teammate_name: "reviewer",
 * })
 *
 * console.log(O.getOrUndefined(input.teammate_name)) // "reviewer"
 * ```
 *
 * @see {@link keepWorking} for preventing idle via exit 2.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`TeammateIdleInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("TeammateIdle"),
    team_name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    teammate_name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("TeammateIdleInput", {
    description: "Input for the TeammateIdle hook event.",
  })
) {}

/**
 * JSON response a TeammateIdle handler may return. Preventing idle is
 * not done here; use {@link keepWorking} (`HookProcessOutput`) instead.
 *
 * **Example** (Inspect empty JSON output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.TeammateIdle.Output.make()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link allowIdle} for letting the teammate go idle.
 * @see {@link stopTeammate} for JSON `continue: false`.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`TeammateIdleOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("TeammateIdleOutput", {
    description: "Output returned by a TeammateIdle hook handler.",
  })
) {}

/**
 * Let the teammate go idle. Equivalent to empty `Output.make()`.
 *
 * **Example** (Allow idle)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.TeammateIdle.allowIdle()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link keepWorking} for preventing idle via exit 2.
 * @see {@link stopTeammate} for stopping the teammate with JSON.
 * @category constructors
 * @since 0.0.0
 */
export const allowIdle = (): Output => Output.make();

/**
 * Prevent the teammate from going idle by exiting 2 with stderr
 * feedback.
 *
 * **Gotchas**
 *
 * This is a process-exit protocol (`HookProcessOutput`), not JSON
 * `decision: "block"`. Contrast {@link stopTeammate}, which uses JSON
 * `continue: false`.
 *
 * **Example** (Keep the teammate working)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.TeammateIdle.keepWorking("review the remaining PR comments")
 * console.log(output._tag) // "HookProcessOutput"
 * console.log(output.exitCode) // 2
 * console.log(O.getOrUndefined(output.stderr)) // "review the remaining PR comments"
 * ```
 *
 * @see {@link allowIdle} for letting the teammate go idle.
 * @see {@link stopTeammate} for JSON `continue: false`.
 * @category constructors
 * @since 0.0.0
 */
export const keepWorking = (reason: string): HookProcessOutput => stderrExit(reason);

/**
 * Stop the teammate entirely after this hook runs via JSON
 * `continue: false`.
 *
 * **Example** (Stop the teammate)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.TeammateIdle.stopTeammate("shift is over")
 * console.log(O.getOrUndefined(output.continue)) // false
 * console.log(O.getOrUndefined(output.stopReason)) // "shift is over"
 * ```
 *
 * @see {@link keepWorking} for preventing idle via exit 2 without stopping the teammate.
 * @see {@link allowIdle} for letting the teammate go idle.
 * @category constructors
 * @since 0.0.0
 */
export const stopTeammate = (reason: string): Output =>
  Output.make({ continue: O.some(false), stopReason: O.some(reason) });

/**
 * Build a runnable TeammateIdle hook from a handler effect.
 *
 * **Gotchas**
 *
 * The handler may return JSON {@link Output} or `HookProcessOutput`.
 * Preventing idle requires {@link keepWorking} (exit 2), not JSON
 * `decision: "block"`.
 *
 * **Example** (Define a TeammateIdle hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.TeammateIdle.define({
 *   handler: () => Effect.succeed(Hook.TeammateIdle.allowIdle()),
 * })
 *
 * console.log(hook.event) // "TeammateIdle"
 * ```
 *
 * @see {@link keepWorking} for the process-exit refusal a handler may return.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output | HookProcessOutput, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "TeammateIdle",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
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
