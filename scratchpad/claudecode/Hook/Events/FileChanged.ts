/**
 * Fires when a watched file changes on disk. Observability-only: JSON
 * output cannot steer the session. Matcher is applied to the basename of
 * `file_path` (for example `.envrc` or `package.json`), not the full
 * path. See https://code.claude.com/docs/en/hooks#filechanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect, flow } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/FileChanged");

const fileBasename = flow(Str.replaceAll("\\", "/"), Str.split("/"), A.lastNonEmpty);
const WatchPaths = S.String.pipe(
  S.Array,
  $I.annoteSchema("WatchPaths", {
    description: "Filesystem paths watched by a FileChanged hook.",
  })
);

/**
 * Filesystem change kind Claude Code reports (`change`, `add`, or
 * `unlink`).
 *
 * **Example** (Decode a change kind)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(Hook.FileChanged.FileChangedEvent)("change")
 * console.log(event) // "change"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this kind.
 * @category schemas
 * @since 0.0.0
 */
export const FileChangedEvent = LiteralKit(["change", "add", "unlink"]).pipe(
  $I.annoteSchema("FileChangedEvent", {
    description: "Filesystem change kind reported by Claude Code.",
  })
);

/**
 * Decoded value produced by {@link FileChangedEvent}.
 *
 * @see {@link FileChangedEvent} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type FileChangedEvent = typeof FileChangedEvent.Type;

/**
 * Stdin payload for a FileChanged hook, including the changed path and
 * change kind.
 *
 * **Example** (Decode a package.json change)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.FileChanged.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "FileChanged",
 *   file_path: "/repo/package.json",
 *   event: "change",
 * })
 *
 * console.log(input.file_path) // "/repo/package.json"
 * ```
 *
 * @see {@link onMatcher} for basename matching against `file_path`.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`FileChangedInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("FileChanged"),
    file_path: S.String,
    event: FileChangedEvent,
  },
  $I.annote("FileChangedInput", {
    description: "Input for the FileChanged hook event.",
  })
) {}

/**
 * JSON response a FileChanged handler may return. Claude Code does not
 * act on it; {@link watchPaths} only advertises extra filesystem watches.
 *
 * **Gotchas**
 *
 * Setting `continue: false` does not undo the file change.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.FileChanged.Output.make()
 * console.log(O.isNone(output.watchPaths)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`FileChangedOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    watchPaths: S.OptionFromOptionalKey(WatchPaths).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FileChangedOutput", {
    description: "Output returned by a FileChanged hook handler.",
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
 * const output = Hook.FileChanged.passthrough()
 * console.log(O.isNone(output.watchPaths)) // true
 * ```
 *
 * @see {@link watchPaths} for advertising extra filesystem watches.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Advertise extra filesystem paths for Claude Code to watch.
 *
 * **Example** (Watch a lockfile)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.FileChanged.watchPaths(["/repo/bun.lock"])
 * console.log(O.getOrUndefined(output.watchPaths)) // ["/repo/bun.lock"]
 * ```
 *
 * @see {@link passthrough} for empty observability output.
 * @category constructors
 * @since 0.0.0
 */
export const watchPaths = (paths: ReadonlyArray<string>): Output => Output.make({ watchPaths: O.some(paths) });

/**
 * Build a runnable FileChanged hook from a handler effect.
 *
 * **Gotchas**
 *
 * Claude Code ignores the JSON response.
 *
 * **Example** (Define a FileChanged hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.FileChanged.define({
 *   handler: () => Effect.succeed(Hook.FileChanged.passthrough()),
 * })
 *
 * console.log(hook.event) // "FileChanged"
 * ```
 *
 * @see {@link onMatcher} for filtering on the file basename.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "FileChanged",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a FileChanged hook that only handles matching basenames from
 * `file_path`.
 *
 * **Gotchas**
 *
 * The matcher is applied to the basename only. Patterns such as
 * `src/foo.ts` or a full path never match; use `package.json` or
 * `.envrc`.
 *
 * **Example** (Match package.json by basename)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.FileChanged.onMatcher({
 *   matcher: "package.json",
 *   handler: () => Effect.succeed(Hook.FileChanged.watchPaths(["/repo/bun.lock"])),
 * })
 *
 * console.log(hook.event) // "FileChanged"
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
    handler: (input) =>
      Matcher.matchFileName(config.matcher)(fileBasename(input.file_path))
        ? config.handler(input)
        : (config.onMismatch ?? (() => Effect.succeed(passthrough())))(input),
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
