/**
 * TeammateIdle hook event.
 *
 * Fires when a teammate in an agent-team context is about to go idle.
 * A handler can prevent idle by exiting 2 with feedback on stderr. Does
 * not support a matcher.
 * See https://code.claude.com/docs/en/hooks#teammateidle.
 *
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
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.TeammateIdle.Input)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * **Example** (Inspect the Output schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.TeammateIdle.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `allowIdle`.
 *
 * **Example** (Use allowIdle)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.TeammateIdle.allowIdle)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const allowIdle = (): Output => Output.make();

/**
 * Prevent the teammate from going idle by exiting 2 with stderr feedback.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.TeammateIdle.keepWorking)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const keepWorking = (reason: string): HookProcessOutput => stderrExit(reason);

/**
 * Stop the teammate entirely after this hook runs.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.TeammateIdle.stopTeammate)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const stopTeammate = (reason: string): Output =>
  Output.make({ continue: O.some(false), stopReason: O.some(reason) });

/**
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.TeammateIdle.define)
 * ```
 *
 * @category constructors
 *
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
