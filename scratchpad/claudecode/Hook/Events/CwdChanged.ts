/**
 * Fires when the working directory changes (for example via `cd`).
 * Observability-only: JSON output cannot steer the session. Persist
 * environment updates through `$CLAUDE_ENV_FILE` instead. Does not
 * support a matcher. See https://code.claude.com/docs/en/hooks#cwdchanged.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/CwdChanged");

const WatchPaths = S.String.pipe(
  S.Array,
  $I.annoteSchema("WatchPaths", {
    description: "Filesystem paths watched by a CwdChanged hook.",
  })
);

/**
 * Stdin payload for a CwdChanged hook, carrying the previous and next
 * working directories.
 *
 * **Example** (Decode a directory change)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.CwdChanged.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo/packages",
 *   hook_event_name: "CwdChanged",
 *   old_cwd: "/repo",
 *   new_cwd: "/repo/packages",
 * })
 *
 * console.log(input.new_cwd) // "/repo/packages"
 * ```
 *
 * @see {@link Output} for the ignored JSON response shape.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`CwdChangedInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("CwdChanged"),
    old_cwd: S.String,
    new_cwd: S.String,
  },
  $I.annote("CwdChangedInput", {
    description: "Input for the CwdChanged hook event.",
  })
) {}

/**
 * JSON response a CwdChanged handler may return. Claude Code does not
 * act on it; use `$CLAUDE_ENV_FILE` for persistence and
 * {@link watchPaths} only to advertise extra filesystem watches.
 *
 * **Gotchas**
 *
 * Setting `continue: false` does not cancel the directory change.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.CwdChanged.Output.make()
 * console.log(O.isNone(output.watchPaths)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @see {@link watchPaths} for advertising extra watch paths.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`CwdChangedOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    watchPaths: S.OptionFromOptionalKey(WatchPaths).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CwdChangedOutput", {
    description: "Output returned by a CwdChanged hook handler.",
  })
) {}

/**
 * Empty observability output. Claude Code ignores the JSON body.
 *
 * **Gotchas**
 *
 * This is not a decision helper. Persist env vars via `$CLAUDE_ENV_FILE`.
 *
 * **Example** (Return empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.CwdChanged.passthrough()
 * console.log(O.isNone(output.watchPaths)) // true
 * ```
 *
 * @see {@link watchPaths} for advertising extra filesystem watches.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Advertise extra filesystem paths for Claude Code to watch. This writes
 * `Output.watchPaths`; it does not persist env vars.
 *
 * **Example** (Watch a cache directory)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.CwdChanged.watchPaths(["/tmp/build-cache"])
 * console.log(O.getOrUndefined(output.watchPaths)) // ["/tmp/build-cache"]
 * ```
 *
 * @see {@link passthrough} for empty observability output.
 * @category constructors
 * @since 0.0.0
 */
export const watchPaths = (paths: ReadonlyArray<string>): Output => Output.make({ watchPaths: O.some(paths) });

/**
 * Build a runnable CwdChanged hook from a handler effect.
 *
 * **Gotchas**
 *
 * Claude Code ignores the JSON response. Use `$CLAUDE_ENV_FILE` for
 * environment persistence.
 *
 * **Example** (Define a CwdChanged hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.CwdChanged.define({
 *   handler: () => Effect.succeed(Hook.CwdChanged.passthrough()),
 * })
 *
 * console.log(hook.event) // "CwdChanged"
 * ```
 *
 * @see {@link passthrough} for the typical handler result.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "CwdChanged",
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
