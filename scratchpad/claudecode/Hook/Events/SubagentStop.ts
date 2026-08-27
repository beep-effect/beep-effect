/**
 * Fires when a subagent finishes responding. Like Stop, returning
 * `block` forces the subagent to continue rather than halt. Matcher is
 * on `agent_type`. See
 * https://code.claude.com/docs/en/hooks#subagentstop.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";
import { BackgroundTask, SessionCron } from "./Stop.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/SubagentStop");
// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Stdin payload for a SubagentStop hook, including the subagent's
 * transcript path and last assistant message.
 *
 * **Example** (Decode a finished Explore agent)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.SubagentStop.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SubagentStop",
 *   stop_hook_active: false,
 *   agent_id: "agent-1",
 *   agent_type: "Explore",
 *   agent_transcript_path: "/tmp/agent-1.jsonl",
 *   last_assistant_message: "Search complete",
 * })
 *
 * console.log(input.agent_type) // "Explore"
 * ```
 *
 * @see {@link block} for forcing the subagent to continue.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`SubagentStopInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("SubagentStop"),
    stop_hook_active: S.Boolean,
    agent_id: S.String,
    agent_type: S.String,
    agent_transcript_path: S.String,
    last_assistant_message: S.String,
    background_tasks: BackgroundTask.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<BackgroundTask>()),
    session_crons: SessionCron.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<SessionCron>()),
  },
  $I.annote("SubagentStopInput", {
    description: "Input for the SubagentStop hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Event-specific payload that injects `additionalContext` while the
 * subagent is stopping or being told to continue.
 *
 * **Example** (Inspect additional context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.SubagentStop.HookSpecificOutput.make({
 *   hookEventName: "SubagentStop",
 *   additionalContext: O.some("Check the failing test first"),
 * })
 *
 * console.log(O.getOrUndefined(specific.additionalContext)) // "Check the failing test first"
 * ```
 *
 * @see {@link addContext} for the constructor that fills this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`SubagentStopHookSpecificOutput`)(
  {
    hookEventName: S.Literal("SubagentStop"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SubagentStopHookSpecificOutput", {
    description: "SubagentStop-specific response returned to Claude Code.",
  })
) {}

/**
 * JSON response a SubagentStop handler returns. `decision: "block"`
 * forces the subagent to continue; empty output lets it stop.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SubagentStop.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link allowStop} for letting the subagent finish.
 * @see {@link block} for forcing continuation.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`SubagentStopOutput`)(
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
  $I.annote("SubagentStopOutput", {
    description: "Output returned by a SubagentStop hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Allow the subagent to stop (the default). Equivalent to empty
 * `Output.make()`.
 *
 * **Example** (Let the subagent finish)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SubagentStop.allowStop()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for forcing the subagent to continue.
 * @category constructors
 * @since 0.0.0
 */
export const allowStop = (): Output => Output.make();

/**
 * Force the subagent to continue by emitting `decision: "block"`. The
 * `reason` is fed back as instructions for the continuation.
 *
 * **Gotchas**
 *
 * This is not a halt. Unlike ConfigChange/PreCompact `block`, Stop-family
 * `block` means "keep going".
 *
 * **Example** (Keep the subagent working)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SubagentStop.block("search the failing test first")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "search the failing test first"
 * ```
 *
 * @see {@link allowStop} for letting the subagent finish.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Inject additional context without forcing continuation.
 *
 * **Example** (Add a reminder as the subagent stops)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SubagentStop.addContext("Check the failing test first")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Check the failing test first"
 * ```
 *
 * @see {@link block} for forcing continuation instead.
 * @see {@link allowStop} for letting the subagent finish.
 * @category constructors
 * @since 0.0.0
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "SubagentStop",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a runnable SubagentStop hook from a handler effect.
 *
 * **Example** (Define a SubagentStop hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SubagentStop.define({
 *   handler: () => Effect.succeed(Hook.SubagentStop.allowStop()),
 * })
 *
 * console.log(hook.event) // "SubagentStop"
 * ```
 *
 * @see {@link onMatcher} for filtering on `agent_type`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "SubagentStop",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a SubagentStop hook that only handles matching `agent_type`
 * values. Non-matching inputs default to `allowStop()`.
 *
 * **Example** (Keep Explore agents working)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SubagentStop.onMatcher({
 *   matcher: "Explore",
 *   handler: () => Effect.succeed(Hook.SubagentStop.block("search the failing test first")),
 * })
 *
 * console.log(hook.event) // "SubagentStop"
 * ```
 *
 * @see {@link allowStop} for the default mismatch output.
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
      select: (input) => input.agent_type,
      onMatch: config.handler,
      onMismatch: config.onMismatch ?? (() => Effect.succeed(allowStop())),
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
