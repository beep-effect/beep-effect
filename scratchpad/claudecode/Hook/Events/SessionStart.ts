/**
 * SessionStart hook event.
 *
 * Fires when a Claude Code session begins, resumes, is cleared, or
 * compacts. Does not carry `permission_mode`. The primary use-case is
 * injecting repo-specific context via `addContext`. Supports a matcher
 * on `source`. See https://code.claude.com/docs/en/hooks#sessionstart.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Events/SessionStart");

const WatchPaths = S.String.pipe(
  S.Array,
  $I.annoteSchema("WatchPaths", {
    description: "Filesystem paths watched after a session starts.",
  })
);

/**
 * Schema for `Source`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.Source)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const Source = LiteralKit(["startup", "resume", "clear", "compact"]).pipe(
  $I.annoteSchema("Source", {
    description: "Source that initiated a Claude Code session.",
  })
);

/**
 * Type-level model for `Source`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.SessionStart.Source
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type Source = typeof Source.Type;

/**
 * Schema for `Input`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`SessionStartInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("SessionStart"),
    source: Source,
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    agent_type: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    session_title: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SessionStartInput", {
    description: "Input for the SessionStart hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Schema for `HookSpecificOutput`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`SessionStartHookSpecificOutput`)(
  {
    hookEventName: S.Literal("SessionStart"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    initialUserMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sessionTitle: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    watchPaths: S.OptionFromOptionalKey(WatchPaths).pipe(SchemaUtils.withNoneDefault),
    reloadSkills: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SessionStartHookSpecificOutput", {
    description: "SessionStart-specific response returned to Claude Code.",
  })
) {}

/**
 * Schema for `Output`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`SessionStartOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SessionStartOutput", {
    description: "Output returned by a SessionStart hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Constructor for `passthrough`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.passthrough)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Inject additional context at the start of the session. Claude will
 * see this as a system message. The canonical use-case for SessionStart.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.addContext)
 * ```
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "SessionStart",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Constructor for `startWithMessage`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.startWithMessage)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const startWithMessage = (initialUserMessage: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "SessionStart",
        initialUserMessage: O.some(initialUserMessage),
      })
    ),
  });

/**
 * Constructor for `renameSession`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.renameSession)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const renameSession = (sessionTitle: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "SessionStart",
        sessionTitle: O.some(sessionTitle),
      })
    ),
  });

/**
 * Constructor for `watchPaths`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.watchPaths)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const watchPaths = (paths: ReadonlyArray<string>, options?: { readonly reloadSkills?: boolean }): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "SessionStart",
        watchPaths: O.some(paths),
        reloadSkills: O.fromNullishOr(options?.reloadSkills),
      })
    ),
  });

/**
 * Constructor for `reloadSkills`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.reloadSkills)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const reloadSkills = (): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "SessionStart",
        reloadSkills: O.some(true),
      })
    ),
  });

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Constructor for `define`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "SessionStart",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a SessionStart hook that only handles matching `source` values.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.SessionStart.onMatcher)
 * ```
 */
export const onMatcher = <E, R>(config: {
  readonly matcher: string | RegExp;
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> =>
  define({
    handler: Matcher.handleMatcher({
      matcher: config.matcher,
      select: (input) => input.source,
      onMatch: config.handler,
      onMismatch: config.onMismatch ?? (() => Effect.succeed(passthrough())),
    }),
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
 * type Wire = Hook.SessionStart.Input.Encoded
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
 * Decoded and wire-encoded companion types for {@link HookSpecificOutput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.SessionStart.HookSpecificOutput.Encoded
 * ```
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.SessionStart.Output.Encoded
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
