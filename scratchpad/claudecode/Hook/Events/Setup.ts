/**
 * Fires for explicit setup runs (`--init-only`, `-p --init`, or
 * `-p --maintenance`). A handler can inject context via `addContext`.
 * Matcher is on `trigger` (`init` or `maintenance`). See
 * https://code.claude.com/docs/en/hooks#setup.
 *
 * @packageDocumentation
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/Setup");

/**
 * Why this setup run started (`init` or `maintenance`).
 *
 * **Example** (Decode a setup trigger)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const trigger = S.decodeUnknownSync(Hook.Setup.Trigger)("maintenance")
 * console.log(trigger) // "maintenance"
 * ```
 *
 * @see {@link onMatcher} for filtering on this trigger.
 * @category schemas
 * @since 0.0.0
 */
export const Trigger = LiteralKit(["init", "maintenance"]).pipe(
  $I.annoteSchema("Trigger", {
    description: "Trigger that initiated a Setup hook.",
  })
);

/**
 * Decoded value produced by {@link Trigger}.
 *
 * @see {@link Trigger} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type Trigger = typeof Trigger.Type;

/**
 * Stdin payload for a Setup hook, including whether this is `init` or
 * `maintenance`.
 *
 * **Example** (Decode a maintenance run)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.Setup.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "Setup",
 *   trigger: "maintenance",
 * })
 *
 * console.log(input.trigger) // "maintenance"
 * ```
 *
 * @see {@link addContext} for injecting repo context during setup.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`SetupInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("Setup"),
    trigger: Trigger,
  },
  $I.annote("SetupInput", {
    description: "Input for the Setup hook event.",
  })
) {}

/**
 * Event-specific payload that injects `additionalContext` during setup.
 *
 * **Example** (Inspect additional context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.Setup.HookSpecificOutput.make({
 *   hookEventName: "Setup",
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
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`SetupHookSpecificOutput`)(
  {
    hookEventName: S.Literal("Setup"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SetupHookSpecificOutput", {
    description: "Setup-specific response returned to Claude Code.",
  })
) {}

/**
 * JSON response a Setup handler returns. `hookSpecificOutput` is the
 * channel for injected context.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Setup.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for skipping extra context.
 * @see {@link addContext} for injecting repo context.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`SetupOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SetupOutput", {
    description: "Output returned by a Setup hook handler.",
  })
) {}

/**
 * Skip extra context. Equivalent to empty `Output.make()`.
 *
 * **Example** (Skip extra context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Setup.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link addContext} for injecting repo context.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Inject additional context Claude will see during this setup run.
 *
 * **Example** (Inject a package-manager hint)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.Setup.addContext("Use bun, not npm")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Use bun, not npm"
 * ```
 *
 * @see {@link passthrough} for skipping extra context.
 * @category constructors
 * @since 0.0.0
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "Setup",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Build a runnable Setup hook from a handler effect.
 *
 * **Example** (Define a Setup hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.Setup.define({
 *   handler: () => Effect.succeed(Hook.Setup.passthrough()),
 * })
 *
 * console.log(hook.event) // "Setup"
 * ```
 *
 * @see {@link onMatcher} for filtering on `trigger`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "Setup",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a Setup hook that only handles matching `trigger` values.
 *
 * **Example** (Inject context on maintenance)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.Setup.onMatcher({
 *   matcher: "maintenance",
 *   handler: () => Effect.succeed(Hook.Setup.addContext("Use bun, not npm")),
 * })
 *
 * console.log(hook.event) // "Setup"
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
      select: (input) => input.trigger,
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
