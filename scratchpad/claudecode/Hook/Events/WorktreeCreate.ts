/**
 * Fires when Claude Code is about to create a git worktree (for example
 * for an isolated subagent). Command hooks print the path on stdout;
 * HTTP hooks return `hookSpecificOutput.worktreePath`. Does not support
 * a matcher. See https://code.claude.com/docs/en/hooks#worktreecreate.
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
import { type HookDefinition, type HookProcessOutput, rawStdout } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/WorktreeCreate");

/**
 * Stdin payload for a WorktreeCreate hook, including the requested
 * worktree `name`.
 *
 * **Example** (Decode a worktree request)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.WorktreeCreate.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "WorktreeCreate",
 *   name: "feature-branch",
 * })
 *
 * console.log(input.name) // "feature-branch"
 * ```
 *
 * @see {@link created} for the command-hook response channel.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`WorktreeCreateInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("WorktreeCreate"),
    name: S.String,
  },
  $I.annote("WorktreeCreateInput", {
    description: "Input for the WorktreeCreate hook event.",
  })
) {}

/**
 * Event-specific JSON payload used by HTTP WorktreeCreate hooks.
 *
 * **Example** (Inspect a JSON path payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const specific = Hook.WorktreeCreate.HookSpecificOutput.make({
 *   hookEventName: "WorktreeCreate",
 *   worktreePath: "/tmp/feature-worktree",
 * })
 *
 * console.log(specific.worktreePath) // "/tmp/feature-worktree"
 * ```
 *
 * @see {@link createdHttp} for the constructor that wraps this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`WorktreeCreateHookSpecificOutput`)(
  {
    hookEventName: S.Literal("WorktreeCreate"),
    worktreePath: S.String,
  },
  $I.annote("WorktreeCreateHookSpecificOutput", {
    description: "WorktreeCreate-specific response returned to Claude Code.",
  })
) {}

/**
 * JSON response used by HTTP WorktreeCreate hooks. Command hooks should
 * return {@link created} (`HookProcessOutput`) instead.
 *
 * **Example** (Inspect empty JSON output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.WorktreeCreate.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link createdHttp} for filling `worktreePath`.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`WorktreeCreateOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("WorktreeCreateOutput", {
    description: "Output returned by a WorktreeCreate hook handler.",
  })
) {}

/**
 * Publish a created worktree path on stdout for command-based hooks.
 *
 * **Gotchas**
 *
 * This returns `HookProcessOutput`, not JSON. Returning it from an HTTP
 * hook will not publish the path; use {@link createdHttp} instead.
 *
 * **Example** (Print the path for a command hook)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.WorktreeCreate.created("/tmp/feature-worktree")
 * console.log(output._tag) // "HookProcessOutput"
 * console.log(output.exitCode) // 0
 * console.log(O.getOrUndefined(output.stdout)) // "/tmp/feature-worktree\n"
 * ```
 *
 * @see {@link createdHttp} for the JSON channel used by HTTP hooks.
 * @category constructors
 * @since 0.0.0
 */
export const created = (worktreePath: string): HookProcessOutput => rawStdout(`${worktreePath}\n`);

/**
 * Publish a created worktree path as JSON for HTTP-based hooks.
 *
 * **Gotchas**
 *
 * Returning this from a command hook will not print the path on stdout;
 * use {@link created} instead.
 *
 * **Example** (Return JSON for an HTTP hook)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.WorktreeCreate.createdHttp("/tmp/feature-worktree")
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.worktreePath) // "/tmp/feature-worktree"
 * ```
 *
 * @see {@link created} for the stdout channel used by command hooks.
 * @category constructors
 * @since 0.0.0
 */
export const createdHttp = (worktreePath: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "WorktreeCreate",
        worktreePath,
      })
    ),
  });

/**
 * Build a runnable WorktreeCreate hook from a handler effect.
 *
 * **Gotchas**
 *
 * The handler may return JSON {@link Output} or `HookProcessOutput`. Use
 * {@link created} for command hooks and {@link createdHttp} for HTTP hooks.
 *
 * **Example** (Define a command WorktreeCreate hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.WorktreeCreate.define({
 *   handler: () => Effect.succeed(Hook.WorktreeCreate.created("/tmp/feature-worktree")),
 * })
 *
 * console.log(hook.event) // "WorktreeCreate"
 * ```
 *
 * @see {@link created} for the command-hook return shape.
 * @see {@link createdHttp} for the HTTP-hook return shape.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output | HookProcessOutput, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "WorktreeCreate",
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
