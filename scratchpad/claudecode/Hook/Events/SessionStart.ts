/**
 * Fires when a Claude Code session begins, resumes, is cleared, or
 * compacts. Does not carry `permission_mode`. The primary use-case is
 * injecting repo-specific context via `addContext`. Matcher is on
 * `source`. See https://code.claude.com/docs/en/hooks#sessionstart.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
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
 * Why this session started (`startup`, `resume`, `clear`, or
 * `compact`).
 *
 * **Example** (Decode a session source)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const source = S.decodeUnknownSync(Hook.SessionStart.Source)("startup")
 * console.log(source) // "startup"
 * ```
 *
 * @see {@link onMatcher} for filtering on this source.
 * @category schemas
 * @since 0.0.0
 */
export const Source = LiteralKit(["startup", "resume", "clear", "compact"]).pipe(
  $I.annoteSchema("Source", {
    description: "Source that initiated a Claude Code session.",
  })
);

/**
 * Decoded value produced by {@link Source}.
 *
 * @see {@link Source} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Source = typeof Source.Type;

/**
 * Stdin payload for a SessionStart hook, including `source` and
 * optional session title.
 *
 * **Gotchas**
 *
 * This event omits `permission_mode`. Other envelope events may carry
 * it; reading `input.permission_mode` here is always `none`.
 *
 * **Example** (Decode a startup payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.SessionStart.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SessionStart",
 *   source: "startup",
 * })
 *
 * console.log(input.source) // "startup"
 * ```
 *
 * @see {@link addContext} for the canonical SessionStart response.
 * @category schemas
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
 * Event-specific payload that can inject context, seed an initial user
 * message, rename the session, watch paths, or reload skills.
 *
 * **Example** (Inspect injected context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.SessionStart.HookSpecificOutput.make({
 *   hookEventName: "SessionStart",
 *   additionalContext: O.some("Use bun, not npm"),
 * })
 *
 * console.log(O.getOrUndefined(specific.additionalContext)) // "Use bun, not npm"
 * ```
 *
 * @see {@link addContext} for the constructor that fills this payload.
 * @category schemas
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
 * JSON response a SessionStart handler returns. Session-start effects
 * live on `hookSpecificOutput`.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionStart.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for starting with no extra effects.
 * @see {@link addContext} for the canonical SessionStart response.
 * @category schemas
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
 * Start the session with no extra effects. Equivalent to empty
 * `Output.make()`.
 *
 * **Example** (Skip extra session-start effects)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionStart.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link addContext} for injecting repo context.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Inject additional context at the start of the session. Claude will
 * see this as a system message. The canonical use-case for SessionStart.
 *
 * **Example** (Inject a package-manager hint)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionStart.addContext("Use bun, not npm")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Use bun, not npm"
 * ```
 *
 * @see {@link startWithMessage} for seeding an initial user message.
 * @see {@link reloadSkills} for forcing a skills reload.
 * @category constructors
 * @since 0.0.0
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
 * Seed the session with an initial user message.
 *
 * **Example** (Start with a kickoff prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionStart.startWithMessage("Summarize yesterday's CI failures")
 * const message = O.flatMap(output.hookSpecificOutput, (specific) => specific.initialUserMessage)
 * console.log(O.getOrUndefined(message)) // "Summarize yesterday's CI failures"
 * ```
 *
 * @see {@link addContext} for injecting system context instead.
 * @category constructors
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
 * Set the session title at start.
 *
 * **Example** (Name the session)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionStart.renameSession("CI fix")
 * const title = O.flatMap(output.hookSpecificOutput, (specific) => specific.sessionTitle)
 * console.log(O.getOrUndefined(title)) // "CI fix"
 * ```
 *
 * @see {@link addContext} for injecting context without renaming.
 * @category constructors
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
 * Advertise extra filesystem paths to watch after the session starts.
 *
 * **Example** (Watch a lockfile and reload skills)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionStart.watchPaths(["/repo/bun.lock"], { reloadSkills: true })
 * const specific = O.getOrUndefined(output.hookSpecificOutput)
 * console.log(O.getOrUndefined(specific?.watchPaths ?? O.none())) // ["/repo/bun.lock"]
 * console.log(O.getOrUndefined(specific?.reloadSkills ?? O.none())) // true
 * ```
 *
 * @see {@link reloadSkills} for reloading skills without extra watches.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- This output constructor has no data operand; its optional flags only configure the new value.
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
 * Ask Claude Code to reload skills at session start.
 *
 * **Example** (Reload skills)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SessionStart.reloadSkills()
 * const reload = O.flatMap(output.hookSpecificOutput, (specific) => specific.reloadSkills)
 * console.log(O.getOrUndefined(reload)) // true
 * ```
 *
 * @see {@link watchPaths} for also advertising filesystem watches.
 * @see {@link addContext} for injecting repo context.
 * @category constructors
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
 * Build a runnable SessionStart hook from a handler effect.
 *
 * **Example** (Define a SessionStart hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SessionStart.define({
 *   handler: () => Effect.succeed(Hook.SessionStart.addContext("Use bun, not npm")),
 * })
 *
 * console.log(hook.event) // "SessionStart"
 * ```
 *
 * @see {@link onMatcher} for filtering on `source`.
 * @category constructors
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
 * **Example** (Inject context on startup)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SessionStart.onMatcher({
 *   matcher: "startup",
 *   handler: () => Effect.succeed(Hook.SessionStart.addContext("Use bun, not npm")),
 * })
 *
 * console.log(hook.event) // "SessionStart"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
 * @see {@link addContext} for the matched-handler result used here.
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
