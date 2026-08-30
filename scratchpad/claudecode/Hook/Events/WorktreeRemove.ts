/**
 * Fires when Claude Code is about to remove a git worktree. Cleanup and
 * observability only — JSON output is not acted on. Does not support a
 * matcher. See https://code.claude.com/docs/en/hooks#worktreeremove.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { envelopeFields } from "../Envelope.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/WorktreeRemove");

/**
 * Stdin payload for a WorktreeRemove hook, including the path about to
 * be deleted.
 *
 * **Example** (Decode a worktree removal)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.WorktreeRemove.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "WorktreeRemove",
 *   worktree_path: "/tmp/feature-worktree",
 * })
 *
 * console.log(input.worktree_path) // "/tmp/feature-worktree"
 * ```
 *
 * @see {@link passthrough} for the ignored JSON response.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`WorktreeRemoveInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("WorktreeRemove"),
    worktree_path: S.String,
  },
  $I.annote("WorktreeRemoveInput", {
    description: "Input for the WorktreeRemove hook event.",
  })
) {}

/**
 * JSON response a WorktreeRemove handler may return. Claude Code ignores
 * it; use the handler body for cleanup.
 *
 * **Gotchas**
 *
 * Setting `continue: false` does not keep the worktree.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.WorktreeRemove.Output.make()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`WorktreeRemoveOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("WorktreeRemoveOutput", {
    description: "Output returned by a WorktreeRemove hook handler.",
  })
) {}

/**
 * Empty observability output. Claude Code ignores the JSON body.
 *
 * **Gotchas**
 *
 * This is not a decision helper; the worktree is still removed.
 *
 * **Example** (Return empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.WorktreeRemove.passthrough()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link define} for wrapping this result in a handler.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a runnable WorktreeRemove hook from a handler effect.
 *
 * **Gotchas**
 *
 * Claude Code ignores the JSON response. Perform cleanup in the handler
 * itself.
 *
 * **Example** (Define a WorktreeRemove hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.WorktreeRemove.define({
 *   handler: () => Effect.succeed(Hook.WorktreeRemove.passthrough()),
 * })
 *
 * console.log(hook.event) // "WorktreeRemove"
 * ```
 *
 * @see {@link passthrough} for the typical handler result.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "WorktreeRemove",
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
