/**
 * FileChanged hook event.
 *
 * Fires when a watched file changes on disk. Observability-only — no
 * decision control. Supports a matcher on the basename of `file_path`
 * (e.g. `.envrc`, `package.json`).
 * See https://code.claude.com/docs/en/hooks#filechanged.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { flow } from "effect";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
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
 * Schema for `FileChangedEvent`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.FileChanged.FileChangedEvent)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const FileChangedEvent = LiteralKit(["change", "add", "unlink"]).pipe(
  $I.annoteSchema("FileChangedEvent", {
    description: "Filesystem change kind reported by Claude Code.",
  })
);

/**
 * Type-level model for `FileChangedEvent`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.FileChanged.FileChangedEvent
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type FileChangedEvent = typeof FileChangedEvent.Type;

/**
 * Schema for `Input`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.FileChanged.Input)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.FileChanged.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `passthrough`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.FileChanged.passthrough)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Constructor for `watchPaths`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.FileChanged.watchPaths)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const watchPaths = (paths: ReadonlyArray<string>): Output => Output.make({ watchPaths: O.some(paths) });

/**
 * Constructor for `define`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.FileChanged.define)
 * ```
 *
 * @category constructors
 *
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
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.FileChanged.onMatcher)
 * ```
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.FileChanged.Input.Encoded
 * ```
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.FileChanged.Output.Encoded
 * ```
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
