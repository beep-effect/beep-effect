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
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const level: Hook.EffortLevel.Type = "high"
 * ```
 */
export const EffortLevel = LiteralKit(["low", "medium", "high", "xhigh", "max"]).pipe(
  $I.annoteSchema("EffortLevel", {
    description: "Claude Code effort level attached to a hook invocation.",
  })
);

/**
 * Type-level model for `EffortLevel`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.EffortLevel.Type
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export declare namespace EffortLevel {
  /**
   * Decoded runtime type represented by {@link EffortLevel}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof EffortLevel.Type;
}

/**
 * Schema for `HookPermissionMode`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.HookPermissionMode)
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.HookPermissionMode.Type
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export declare namespace HookPermissionMode {
  /**
   * Decoded runtime type represented by {@link HookPermissionMode}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof HookPermissionMode.Type;
}

/**
 * Schema for `HookEffort`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.HookEffort)
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
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * class CustomInput extends S.Class<CustomInput>("CustomInput")({
 *   ...Hook.envelopeFields,
 *   hook_event_name: S.Literal("Custom")
 * }) {}
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
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.HookEnvelope)
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.HookEffort.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Wire = Hook.HookEnvelope.Encoded
 * ```
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
