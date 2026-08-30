/**
 * Fires when a task is created via `TaskCreate` in an agent-team
 * context. A handler can block creation by exiting 2 with stderr
 * feedback. Does not support a matcher. See
 * https://code.claude.com/docs/en/hooks#taskcreated.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/TaskCreated");

/**
 * Stdin payload for a TaskCreated hook, including the new task id and
 * subject.
 *
 * **Example** (Decode a newly created task)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.TaskCreated.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "TaskCreated",
 *   task_id: "task-1",
 *   task_subject: "Fix the failing test",
 * })
 *
 * console.log(input.task_subject) // "Fix the failing test"
 * ```
 *
 * @see {@link block} for refusing creation via exit 2.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`TaskCreatedInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("TaskCreated"),
    task_id: S.String,
    task_subject: S.String,
    task_description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    teammate_name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    team_name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("TaskCreatedInput", {
    description: "Input for the TaskCreated hook event.",
  })
) {}

/**
 * JSON response a TaskCreated handler may return. Blocking creation is
 * not done here; use {@link block} (`HookProcessOutput`) instead.
 *
 * **Example** (Inspect empty JSON output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.TaskCreated.Output.make()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link allow} for letting creation proceed.
 * @see {@link stopTeammate} for JSON `continue: false`.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`TaskCreatedOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("TaskCreatedOutput", {
    description: "Output returned by a TaskCreated hook handler.",
  })
) {}

/**
 * Let task creation proceed. Equivalent to empty `Output.make()`.
 *
 * **Example** (Allow the new task)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.TaskCreated.allow()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link block} for refusing creation via exit 2.
 * @see {@link stopTeammate} for stopping the teammate with JSON.
 * @category constructors
 * @since 0.0.0
 */
export const allow = (): Output => Output.make();

/**
 * Block the task creation by exiting 2 with stderr feedback.
 *
 * **Gotchas**
 *
 * This is a process-exit protocol (`HookProcessOutput`), not JSON
 * `decision: "block"`. Returning ConfigChange-style JSON will not
 * prevent creation.
 *
 * **Example** (Refuse the new task)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.TaskCreated.block("duplicate of task-1")
 * console.log(output._tag) // "HookProcessOutput"
 * console.log(output.exitCode) // 2
 * console.log(O.getOrUndefined(output.stderr)) // "duplicate of task-1"
 * ```
 *
 * @see {@link allow} for letting creation proceed.
 * @see {@link stopTeammate} for JSON `continue: false`.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): HookProcessOutput => stderrExit(reason);

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
 * const output = Hook.TaskCreated.stopTeammate("no more tasks this session")
 * console.log(O.getOrUndefined(output.continue)) // false
 * console.log(O.getOrUndefined(output.stopReason)) // "no more tasks this session"
 * ```
 *
 * @see {@link block} for refusing creation via exit 2 without stopping the teammate.
 * @see {@link allow} for letting creation proceed.
 * @category constructors
 * @since 0.0.0
 */
export const stopTeammate = (reason: string): Output =>
  Output.make({ continue: O.some(false), stopReason: O.some(reason) });

/**
 * Build a runnable TaskCreated hook from a handler effect.
 *
 * **Gotchas**
 *
 * The handler may return JSON {@link Output} or `HookProcessOutput`.
 * Blocking creation requires {@link block} (exit 2), not JSON
 * `decision: "block"`.
 *
 * **Example** (Define a TaskCreated hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.TaskCreated.define({
 *   handler: () => Effect.succeed(Hook.TaskCreated.allow()),
 * })
 *
 * console.log(hook.event) // "TaskCreated"
 * ```
 *
 * @see {@link block} for the process-exit refusal a handler may return.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output | HookProcessOutput, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "TaskCreated",
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
