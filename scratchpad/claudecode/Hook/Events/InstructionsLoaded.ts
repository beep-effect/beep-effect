/**
 * InstructionsLoaded hook event.
 *
 * Fires when a CLAUDE.md or .claude/rules/*.md instruction file is loaded
 * into the session context. Observability-only — the hook's output is not
 * acted on. Supports a matcher on `load_reason`.
 * See https://code.claude.com/docs/en/hooks#instructionsloaded.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/InstructionsLoaded");

const GlobPatterns = S.String.pipe(
  S.Array,
  $I.annoteSchema("GlobPatterns", {
    description: "Glob patterns that caused an instruction file to load.",
  })
);

/**
 * Schema for `MemoryType`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.InstructionsLoaded.MemoryType)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const MemoryType = LiteralKit(["User", "Project", "Local", "Managed"]).pipe(
  $I.annoteSchema("MemoryType", {
    description: "Claude Code instruction-memory scope.",
  })
);

/**
 * Type-level model for `MemoryType`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.InstructionsLoaded.MemoryType.Type
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export declare namespace MemoryType {
  /**
   * Decoded runtime type represented by {@link MemoryType}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof MemoryType.Type;
}

/**
 * Schema for `LoadReason`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.InstructionsLoaded.LoadReason)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const LoadReason = LiteralKit([
  "session_start",
  "nested_traversal",
  "path_glob_match",
  "include",
  "compact",
]).pipe(
  $I.annoteSchema("LoadReason", {
    description: "Reason Claude Code loaded an instruction file.",
  })
);

/**
 * Type-level model for `LoadReason`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.InstructionsLoaded.LoadReason.Type
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export declare namespace LoadReason {
  /**
   * Decoded runtime type represented by {@link LoadReason}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof LoadReason.Type;
}

/**
 * Schema for `Input`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.InstructionsLoaded.Input)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`InstructionsLoadedInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("InstructionsLoaded"),
    file_path: S.String,
    memory_type: MemoryType,
    load_reason: LoadReason,
    globs: S.OptionFromOptionalKey(GlobPatterns).pipe(SchemaUtils.withNoneDefault),
    trigger_file_path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    parent_file_path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("InstructionsLoadedInput", {
    description: "Input for the InstructionsLoaded hook event.",
  })
) {}

/**
 * Schema for `Output`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.InstructionsLoaded.Output)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`InstructionsLoadedOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("InstructionsLoadedOutput", {
    description: "Output returned by an InstructionsLoaded hook handler.",
  })
) {}

/**
 * Constructor for `passthrough`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.InstructionsLoaded.passthrough)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Constructor for `define`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.InstructionsLoaded.define)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "InstructionsLoaded",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build an InstructionsLoaded hook that only handles matching `load_reason`
 * values.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.InstructionsLoaded.onMatcher)
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
      select: (input) => input.load_reason,
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
 * type Wire = Hook.InstructionsLoaded.Input.Encoded
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
 * type Wire = Hook.InstructionsLoaded.Output.Encoded
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
