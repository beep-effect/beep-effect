/**
 * Fires when a subagent is spawned. A handler can inject additional
 * context the subagent will see; the spawn itself cannot be blocked.
 * Matcher is on `agent_type`. See
 * https://code.claude.com/docs/en/hooks#subagentstart.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/SubagentStart");

/**
 * Stdin payload for a SubagentStart hook, including `agent_id` and
 * `agent_type`.
 *
 * **Example** (Decode a spawned Explore agent)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.SubagentStart.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SubagentStart",
 *   agent_id: "agent-1",
 *   agent_type: "Explore",
 * })
 *
 * console.log(input.agent_type) // "Explore"
 * ```
 *
 * @see {@link addContext} for injecting context the subagent will see.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`SubagentStartInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("SubagentStart"),
    agent_id: S.String,
    agent_type: S.String,
  },
  $I.annote("SubagentStartInput", {
    description: "Input for the SubagentStart hook event.",
  })
) {}

/**
 * Event-specific payload that injects `additionalContext` into the
 * spawned subagent.
 *
 * **Example** (Inspect additional context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const specific = Hook.SubagentStart.HookSpecificOutput.make({
 *   hookEventName: "SubagentStart",
 *   additionalContext: O.some("Prefer bun test"),
 * })
 *
 * console.log(O.getOrUndefined(specific.additionalContext)) // "Prefer bun test"
 * ```
 *
 * @see {@link addContext} for the constructor that fills this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`SubagentStartHookSpecificOutput`)(
  {
    hookEventName: S.Literal("SubagentStart"),
    additionalContext: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SubagentStartHookSpecificOutput", {
    description: "SubagentStart-specific response returned to Claude Code.",
  })
) {}

/**
 * JSON response a SubagentStart handler returns. Only additional
 * context is honored.
 *
 * **Gotchas**
 *
 * There is no `block` helper. The subagent always starts; stuffing
 * `continue: false` into Output does not cancel spawn.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SubagentStart.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for starting without extra context.
 * @see {@link addContext} for injecting context the subagent will see.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`SubagentStartOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SubagentStartOutput", {
    description: "Output returned by a SubagentStart hook handler.",
  })
) {}

/**
 * Let the subagent start without extra context.
 *
 * **Gotchas**
 *
 * Spawn always proceeds. This is not a cancel.
 *
 * **Example** (Start without extra context)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SubagentStart.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link addContext} for injecting context the subagent will see.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Inject additional context the spawned subagent will see.
 *
 * **Gotchas**
 *
 * Spawn always proceeds; only additional context is honored. Look at
 * SubagentStop if you need to keep a running subagent going.
 *
 * **Example** (Inject a test runner hint)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.SubagentStart.addContext("Prefer bun test")
 * const context = O.flatMap(output.hookSpecificOutput, (specific) => specific.additionalContext)
 * console.log(O.getOrUndefined(context)) // "Prefer bun test"
 * ```
 *
 * @see {@link passthrough} for starting without extra context.
 * @category constructors
 * @since 0.0.0
 */
export const addContext = (additionalContext: string): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "SubagentStart",
        additionalContext: O.some(additionalContext),
      })
    ),
  });

/**
 * Build a runnable SubagentStart hook from a handler effect.
 *
 * **Example** (Define a SubagentStart hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SubagentStart.define({
 *   handler: () => Effect.succeed(Hook.SubagentStart.passthrough()),
 * })
 *
 * console.log(hook.event) // "SubagentStart"
 * ```
 *
 * @see {@link onMatcher} for filtering on `agent_type`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "SubagentStart",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a SubagentStart hook that only handles matching `agent_type`
 * values.
 *
 * **Example** (Inject context for Explore agents)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.SubagentStart.onMatcher({
 *   matcher: "Explore",
 *   handler: () => Effect.succeed(Hook.SubagentStart.addContext("Prefer bun test")),
 * })
 *
 * console.log(hook.event) // "SubagentStart"
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
      select: (input) => input.agent_type,
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
