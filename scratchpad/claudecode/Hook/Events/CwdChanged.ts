/**
 * CwdChanged hook event.
 *
 * Fires when the working directory changes (e.g. via a `cd` command).
 * Observability-only — no decision control. One common use-case is
 * persisting environment variables via `$CLAUDE_ENV_FILE`, which Claude
 * Code also exposes to SessionStart, Setup, and FileChanged hooks. Does
 * not support a matcher.
 * See https://code.claude.com/docs/en/hooks#cwdchanged.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/CwdChanged");

const WatchPaths = S.String.pipe(
  S.Array,
  $I.annoteSchema("WatchPaths", {
    description: "Filesystem paths watched by a CwdChanged hook.",
  })
);

/**
 * Schema for `Input`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.CwdChanged.Input)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.CwdChanged.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `passthrough`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.CwdChanged.passthrough)
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
 * console.log(Hook.CwdChanged.watchPaths)
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
 * console.log(Hook.CwdChanged.define)
 * ```
 *
 * @category constructors
 *
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.CwdChanged.Input.Encoded
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
 * type Wire = Hook.CwdChanged.Output.Encoded
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
