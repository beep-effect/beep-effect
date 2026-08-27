/**
 * Fires when a Claude Code configuration file changes during a session
 * (user, project, local, policy, or skills). A handler can return
 * `decision: "block"` to refuse the change, except `policy_settings`
 * which cannot be blocked. Matcher is on `source`. See
 * https://code.claude.com/docs/en/hooks#configchange.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/ConfigChange");

/**
 * Named Claude Code settings scope that changed during the session.
 *
 * **Example** (Decode a settings source)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const source = S.decodeUnknownSync(Hook.ConfigChange.ConfigSource)("user_settings")
 * console.log(source) // "user_settings"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this source.
 * @category schemas
 * @since 0.0.0
 */
export const ConfigSource = LiteralKit([
  "user_settings",
  "project_settings",
  "local_settings",
  "policy_settings",
  "skills",
]).pipe(
  $I.annoteSchema("ConfigSource", {
    description: "Claude Code configuration source that changed during a session.",
  })
);

/**
 * Decoded value produced by {@link ConfigSource}.
 *
 * @see {@link ConfigSource} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type ConfigSource = typeof ConfigSource.Type;

/**
 * Stdin payload for a ConfigChange hook, including the settings `source`
 * and optional `file_path`.
 *
 * **Example** (Decode a user-settings change)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.ConfigChange.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "ConfigChange",
 *   source: "user_settings",
 * })
 *
 * console.log(input.source) // "user_settings"
 * ```
 *
 * @see {@link ConfigSource} for the matcher field on this payload.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`ConfigChangeInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("ConfigChange"),
    source: ConfigSource,
    file_path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ConfigChangeInput", {
    description: "Input for the ConfigChange hook event.",
  })
) {}

/**
 * JSON response a ConfigChange handler returns. `decision: "block"`
 * refuses a non-policy settings change; empty output lets it apply.
 *
 * **Example** (Inspect an empty allow output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ConfigChange.Output.make()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link allow} for the empty-output constructor.
 * @see {@link block} for refusing a non-policy change.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`ConfigChangeOutput`)(
  {
    decision: S.OptionFromOptionalKey(S.Literal("block")).pipe(SchemaUtils.withNoneDefault),
    reason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ConfigChangeOutput", {
    description: "Output returned by a ConfigChange hook handler.",
  })
) {}

/**
 * Let the configuration change take effect. Equivalent to empty
 * `Output.make()`.
 *
 * **Example** (Allow a settings change)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ConfigChange.allow()
 * console.log(O.isNone(output.decision)) // true
 * ```
 *
 * @see {@link block} for refusing a non-policy configuration change.
 * @category constructors
 * @since 0.0.0
 */
export const allow = (): Output => Output.make();

/**
 * Refuse a configuration change and feed `reason` back to Claude Code.
 *
 * **Gotchas**
 *
 * `policy_settings` changes cannot be blocked. Returning this output
 * for `source: "policy_settings"` is ignored and the policy still applies.
 *
 * **Example** (Block user settings)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.ConfigChange.block("user settings are frozen for this session")
 * console.log(O.getOrUndefined(output.decision)) // "block"
 * console.log(O.getOrUndefined(output.reason)) // "user settings are frozen for this session"
 * ```
 *
 * @see {@link allow} for letting the change apply.
 * @category constructors
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Build a runnable ConfigChange hook from a handler effect.
 *
 * **Example** (Define a ConfigChange hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.ConfigChange.define({
 *   handler: () => Effect.succeed(Hook.ConfigChange.allow()),
 * })
 *
 * console.log(hook.event) // "ConfigChange"
 * ```
 *
 * @see {@link onMatcher} for filtering handlers on `source`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "ConfigChange",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a ConfigChange hook that only handles matching `source` values.
 *
 * **Gotchas**
 *
 * Omitted `onMismatch` succeeds {@link allow}, so a matcher miss lets the
 * change apply instead of becoming a no-op. `policy_settings` still cannot
 * be blocked even when the matcher hits.
 *
 * **Example** (Block matching user settings)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.ConfigChange.onMatcher({
 *   matcher: "user_settings",
 *   handler: () => Effect.succeed(Hook.ConfigChange.block("user settings are frozen")),
 * })
 *
 * console.log(hook.event) // "ConfigChange"
 * ```
 *
 * @see {@link allow} for the default mismatch output.
 * @see {@link block} for the matched-handler decision used here.
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
      onMismatch: config.onMismatch ?? (() => Effect.succeed(allow())),
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
