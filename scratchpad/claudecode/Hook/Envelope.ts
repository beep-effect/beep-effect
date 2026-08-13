/**
 * Base envelope fields shared by every Claude Code hook event.
 *
 * `envelopeFields` is the reusable field record each event spreads into
 * its own input schema. `HookEnvelope` is the named `S.Class` that
 * decodes the base shape alone (useful for tooling and tests that only
 * care about the envelope).
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("claudecode/Hook/Envelope");

// ---------------------------------------------------------------------------
// Field record (reusable across event schemas)
// ---------------------------------------------------------------------------

/**
 * Effort levels reported in the common hook envelope.
 *
 * **Example** (Select an effort level)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const level: Hook.EffortLevel = "high"
 * console.log(level) // "high"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EffortLevel = LiteralKit(["low", "medium", "high", "xhigh", "max"]).pipe(
  $I.annoteSchema("EffortLevel", {
    description: "Claude Code effort level attached to a hook invocation.",
  })
);

/**
 * Type-level model for `EffortLevel`.
 *
 * **Example** (Name the effort-level type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.EffortLevel
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type EffortLevel = typeof EffortLevel.Type;

/**
 * Schema for `HookPermissionMode`.
 *
 * **Example** (Decode a permission mode)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const mode = S.decodeUnknownSync(Hook.HookPermissionMode)("plan")
 * console.log(mode) // "plan"
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const HookPermissionMode = LiteralKit([
  "default",
  "plan",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions",
]).pipe(
  $I.annoteSchema("HookPermissionMode", {
    description: "Permission mode reported by a Claude Code hook.",
  })
);

/**
 * Type-level model for `HookPermissionMode`.
 *
 * **Example** (Name the permission-mode type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.HookPermissionMode
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type HookPermissionMode = typeof HookPermissionMode.Type;

/**
 * Schema for `HookEffort`.
 *
 * **Example** (Construct effort metadata)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const effort = Hook.HookEffort.make({ level: "high" })
 * console.log(effort.level) // "high"
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export class HookEffort extends S.Class<HookEffort>($I`HookEffort`)(
  { level: EffortLevel },
  $I.annote("HookEffort", {
    description: "Effort metadata attached to a Claude Code hook invocation.",
  })
) {}

/**
 * Reusable field record shared by every hook input schema.
 *
 * `hook_event_name` remains `S.String` here; individual event schemas
 * override it with their event-specific literal.
 *
 * **Example** (Decode a custom envelope)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * class CustomInput extends S.Class<CustomInput>("CustomInput")({
 *   ...Hook.envelopeFields,
 *   hook_event_name: S.Literal("Custom")
 * }) {}
 *
 * const input = S.decodeUnknownSync(CustomInput)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "Custom"
 * })
 * console.log(input.hook_event_name) // "Custom"
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const envelopeFields = {
  session_id: S.String,
  transcript_path: S.String,
  cwd: S.String,
  hook_event_name: S.String,
  permission_mode: S.OptionFromOptionalKey(HookPermissionMode).pipe(SchemaUtils.withNoneDefault),
  prompt_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  effort: S.OptionFromOptionalKey(HookEffort).pipe(SchemaUtils.withNoneDefault),
  agent_id: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  agent_type: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
} as const;

// ---------------------------------------------------------------------------
// Envelope schema class
// ---------------------------------------------------------------------------

/**
 * The base envelope as a named, decodable class. Every hook event input
 * is a superset of these fields.
 *
 * **Example** (Construct a base envelope)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const envelope = Hook.HookEnvelope.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SessionStart"
 * })
 * console.log(envelope.session_id) // "session-1"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HookEnvelope extends S.Class<HookEnvelope>($I`HookEnvelope`)(
  envelopeFields,
  $I.annote("HookEnvelope", {
    description: "Base fields present in every Claude Code hook event payload.",
  })
) {}

/**
 * Decoded and wire-encoded companion types for {@link HookEffort}.
 *
 * **Example** (Relate the wire type to effort metadata)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.HookEffort.Encoded
 * const effort = Hook.HookEffort.make({ level: "medium" })
 * console.log(effort.level)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookEffort {
  /**
   * Decoded runtime representation of {@link HookEffort}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookEffort;
  /**
   * Wire-encoded representation of {@link HookEffort}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookEffort.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookEnvelope}.
 *
 * **Example** (Relate the wire type to an envelope)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.HookEnvelope.Encoded
 * const envelope = Hook.HookEnvelope.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SessionStart"
 * })
 * console.log(envelope.hook_event_name)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookEnvelope {
  /**
   * Decoded runtime representation of {@link HookEnvelope}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookEnvelope;
  /**
   * Wire-encoded representation of {@link HookEnvelope}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookEnvelope.Encoded;
}
