/**
 * Fires when Claude finishes responding and is about to end its turn. A
 * handler can return `block` with a reason to force Claude to continue
 * instead of stopping. Does not support a matcher. See
 * https://code.claude.com/docs/en/hooks#stop.
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
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/Stop");
// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Background task still running when a turn is about to stop.
 *
 * **Example** (Decode a background task)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const task = S.decodeUnknownSync(Hook.Stop.BackgroundTask)({
 *   id: "task-1",
 *   type: "bash",
 *   status: "running",
 * })
 *
 * console.log(task.id) // "task-1"
 * ```
 *
 * @see {@link Input} for the stop payload that lists these tasks.
 * @category schemas
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
 * Scheduled prompt still armed in the session when a turn is about to
 * stop.
 *
 * **Example** (Decode a session cron)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const cron = S.decodeUnknownSync(Hook.Stop.SessionCron)({
 *   id: "cron-1",
 *   schedule: "0 * * * *",
 *   recurring: true,
 *   prompt: "Check CI",
 * })
 *
 * console.log(cron.schedule) // "0 * * * *"
 * ```
 *
 * @see {@link Input} for the stop payload that lists these crons.
 * @category schemas
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
 * Stdin payload for a Stop hook, including whether a stop hook is
 * already active and any background tasks or session crons.
 *
 * **Example** (Decode a turn-end payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.Stop.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "Stop",
 *   stop_hook_active: false,
 * })
 *
 * console.log(input.stop_hook_active) // false
 * ```
 *
 * @see {@link block} for forcing Claude to continue this turn.
 * @category schemas
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
 * Event-specific payload that injects `additionalContext` at turn end.
 *
 * **Example** (Inspect additional context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.Stop.HookSpecificOutput.make({
 *   hookEventName: "Stop",
 *   additionalContext: O.some("The CI job is still red"),
 * })
 *
 * console.log(O.getOrUndefined(specific.additionalContext)) // "The CI job is still red"
 * ```
 *
 * @see {@link addContext} for the constructor that fills this payload.
 * @category schemas
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
 * JSON response a Stop handler returns. `decision: "block"` forces the
 * turn to continue; empty output lets Claude stop.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Stop.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link allowStop} for letting the turn end.
 * @see {@link block} for forcing continuation.
 * @category schemas
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
 * Allow Claude to stop its turn (the default). Equivalent to empty
 * `Output.make()`.
 *
 * **Example** (Let the turn end)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Stop.allowStop()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for forcing Claude to continue.
 * @see {@link addContext} for injecting context without continuing.
 * @category constructors
 * @since 0.0.0
 */
export const allowStop = (): Output => Output.make();

/**
 * Force Claude to continue responding by emitting `decision: "block"`.
 * The `reason` is fed back to Claude as instructions for the
 * continuation.
 *
 * **Gotchas**
 *
 * This is not a halt. Unlike ConfigChange/PreCompact `block`, Stop
 * `block` means "keep going".
 *
 * **Example** (Keep investigating)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Stop.block("continue investigating X")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "continue investigating X"
 * ```
 *
 * @see {@link allowStop} for letting the turn end.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Inject additional context at turn end without forcing continuation.
 *
 * **Example** (Leave a reminder as the turn ends)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Stop.addContext("The CI job is still red")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "The CI job is still red"
 * ```
 *
 * @see {@link block} for forcing continuation instead.
 * @see {@link allowStop} for ending the turn with no extra context.
 * @category constructors
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
 * Build a runnable Stop hook from a handler effect.
 *
 * **Example** (Define a Stop hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.Stop.define({
 *   handler: () => Effect.succeed(Hook.Stop.allowStop()),
 * })
 *
 * console.log(hook.event) // "Stop"
 * ```
 *
 * @see {@link block} for the continuation decision a handler may return.
 * @category constructors
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
