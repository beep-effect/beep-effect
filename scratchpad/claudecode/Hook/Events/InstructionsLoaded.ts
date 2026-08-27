/**
 * Fires when a CLAUDE.md or `.claude/rules/*.md` instruction file is
 * loaded into session context. Observability-only: JSON output is not
 * acted on. Matcher is on `load_reason`. See
 * https://code.claude.com/docs/en/hooks#instructionsloaded.
 *
 * @packageDocumentation
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
 * Instruction-memory scope for the loaded file (`User`, `Project`,
 * `Local`, or `Managed`).
 *
 * **Example** (Decode a memory scope)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const memory = S.decodeUnknownSync(Hook.InstructionsLoaded.MemoryType)("Project")
 * console.log(memory) // "Project"
 * ```
 *
 * @see {@link Input} for the stdin payload that carries this scope.
 * @category schemas
 * @since 0.0.0
 */
export const MemoryType = LiteralKit(["User", "Project", "Local", "Managed"]).pipe(
  $I.annoteSchema("MemoryType", {
    description: "Claude Code instruction-memory scope.",
  })
);

/**
 * Decoded value produced by {@link MemoryType}.
 *
 * @see {@link MemoryType} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryType = typeof MemoryType.Type;

/**
 * Why Claude Code loaded the instruction file.
 *
 * **Example** (Decode a load reason)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(Hook.InstructionsLoaded.LoadReason)("session_start")
 * console.log(reason) // "session_start"
 * ```
 *
 * @see {@link onMatcher} for filtering on this reason.
 * @category schemas
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
 * Decoded value produced by {@link LoadReason}.
 *
 * @see {@link LoadReason} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type LoadReason = typeof LoadReason.Type;

/**
 * Stdin payload for an InstructionsLoaded hook, including the file path,
 * memory scope, and load reason.
 *
 * **Example** (Decode a session-start load)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.InstructionsLoaded.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "InstructionsLoaded",
 *   file_path: "/repo/CLAUDE.md",
 *   memory_type: "Project",
 *   load_reason: "session_start",
 * })
 *
 * console.log(input.load_reason) // "session_start"
 * ```
 *
 * @see {@link LoadReason} for the matcher field on this payload.
 * @category schemas
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
 * JSON response an InstructionsLoaded handler may return. Claude Code
 * ignores it; the file is already in context.
 *
 * **Gotchas**
 *
 * Returning Output does not unload or rewrite the instruction file.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.InstructionsLoaded.Output.make()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link passthrough} for the empty-output constructor.
 * @category schemas
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
 * const output = Hook.InstructionsLoaded.passthrough()
 * console.log(O.isNone(output.continue)) // true
 * ```
 *
 * @see {@link define} for wrapping this result in a handler.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Build a runnable InstructionsLoaded hook from a handler effect.
 *
 * **Gotchas**
 *
 * Claude Code ignores the JSON response.
 *
 * **Example** (Define an InstructionsLoaded hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.InstructionsLoaded.define({
 *   handler: () => Effect.succeed(Hook.InstructionsLoaded.passthrough()),
 * })
 *
 * console.log(hook.event) // "InstructionsLoaded"
 * ```
 *
 * @see {@link onMatcher} for filtering on `load_reason`.
 * @category constructors
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
 * Build an InstructionsLoaded hook that only handles matching
 * `load_reason` values.
 *
 * **Example** (Observe session-start loads)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.InstructionsLoaded.onMatcher({
 *   matcher: "session_start",
 *   handler: () => Effect.succeed(Hook.InstructionsLoaded.passthrough()),
 * })
 *
 * console.log(hook.event) // "InstructionsLoaded"
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
