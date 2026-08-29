/**
 * ConfigChange hook event.
 *
 * Fires when a Claude Code configuration file changes during a session
 * (user/project/local settings, policy settings, or skills). A handler
 * can return `decision: "block"` to prevent the config change from taking
 * effect — except `policy_settings` changes, which cannot be blocked.
 * Supports a matcher on `source`.
 * See https://code.claude.com/docs/en/hooks#configchange.
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

const $I = $ScratchpadId.create("claudecode/Hook/Events/ConfigChange");

/**
 * Schema for `ConfigSource`.
 *
 * **Example** (Inspect the ConfigSource schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ConfigChange.ConfigSource)
 * ```
 *
 * @category schemas
 *
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
 * Type-level model for `ConfigSource`.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConfigSource = typeof ConfigSource.Type;

/**
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ConfigChange.Input)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * **Example** (Inspect the Output schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ConfigChange.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `allow`.
 *
 * **Example** (Use allow)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ConfigChange.allow)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const allow = (): Output => Output.make();

/**
 * Constructor for `block`.
 *
 * **Example** (Use block)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ConfigChange.block)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const block = (reason: string): Output => Output.make({ decision: O.some("block"), reason: O.some(reason) });

/**
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ConfigChange.define)
 * ```
 *
 * @category constructors
 *
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
 * **Example** (Build ConfigChange hook that only handles matching `source` values)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.ConfigChange.onMatcher)
 * ```
 *
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
