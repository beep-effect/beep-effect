/**
 * Stop hook event.
 *
 * Fires when Claude finishes responding and is about to end its turn.
 * A handler can return `block` with a reason to force Claude to continue
 * the conversation instead of stopping. Does not support a matcher.
 * See https://code.claude.com/docs/en/hooks#stop.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import type * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/Stop");
// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Schema for `BackgroundTask`.
 *
 * **Example** (Inspect the BackgroundTask schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Stop.BackgroundTask)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class BackgroundTask extends S.Class<BackgroundTask>($I`BackgroundTask`)(
  {
    id: S.String,
    type: S.String,
    status: S.String,
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    command: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    agent_type: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    server: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    tool: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BackgroundTask", {
    description: "Background task active when a turn stops.",
  })
) {}

/**
 * Schema for `SessionCron`.
 *
 * **Example** (Inspect the SessionCron schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Stop.SessionCron)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class SessionCron extends S.Class<SessionCron>($I`SessionCron`)(
  {
    id: S.String,
    schedule: S.String,
    recurring: S.Boolean,
    prompt: S.String,
  },
  $I.annote("SessionCron", {
    description: "Scheduled prompt active in a Claude Code session.",
  })
) {}

/**
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Stop.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`StopInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("Stop"),
    stop_hook_active: S.Boolean,
    last_assistant_message: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    background_tasks: S.Array(BackgroundTask).pipe(SchemaUtils.withEmptyArrayDefaults<BackgroundTask>()),
    session_crons: S.Array(SessionCron).pipe(SchemaUtils.withEmptyArrayDefaults<SessionCron>()),
  },
  $I.annote("StopInput", {
    description: "Input for the Stop hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Schema for `HookSpecificOutput`.
 *
 * **Example** (Inspect the HookSpecificOutput schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Stop.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`StopHookSpecificOutput`)(
  {
    hookEventName: S.Literal("Stop"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("StopHookSpecificOutput", {
    description: "Stop-specific response returned to Claude Code.",
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
 * console.log(Hook.Stop.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`StopOutput`)(
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
  $I.annote("StopOutput", {
    description: "Output returned by a Stop hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Allow Claude to stop its turn (the default).
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Stop.allowStop)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const allowStop = (): Output => Output.make();

/**
 * Force Claude to continue responding by emitting `decision: "block"`.
 * The `reason` is fed back to Claude as instructions for the continuation.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Stop.block)
 * ```
 *
 * @category constructors
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
 * console.log(Hook.Stop.addContext)
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
        hookEventName: "Stop",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Stop.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "Stop",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Decoded and wire-encoded companion types for {@link BackgroundTask}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace BackgroundTask {
  /**
   * Decoded runtime representation of {@link BackgroundTask}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = BackgroundTask;
  /**
   * Wire-encoded representation of {@link BackgroundTask}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BackgroundTask.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link SessionCron}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace SessionCron {
  /**
   * Decoded runtime representation of {@link SessionCron}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SessionCron;
  /**
   * Wire-encoded representation of {@link SessionCron}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SessionCron.Encoded;
}

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
