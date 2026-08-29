/**
 * Typed failures returned by deterministic editor profile resolution.
 *
 * @packageDocumentation \@beep/editor/capability/errors
 * @since 0.0.0
 */

import { $EditorId } from "@beep/identity";
import { A } from "@beep/utils";
import * as S from "effect/Schema";
import { CapabilityId, CommandId, KeyChord, Platform, ProfileId } from "./schemas.ts";

const $I = $EditorId.create("capability/errors");

/**
 * A profile names a capability that the supplied catalog does not contain.
 *
 * **Example** (Create an unknown capability failure)
 *
 * ```ts import.meta.vitest name="Create an unknown capability failure"
 * import { UnknownCapabilityError } from "@beep/editor/capability/errors"
 * import { CapabilityId, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = UnknownCapabilityError.make({
 *   profileId: ProfileId.make("editor.test"), capabilityId: CapabilityId.make("node.missing")
 * })
 * error._tag // => "UnknownCapabilityError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnknownCapabilityError extends S.TaggedError<UnknownCapabilityError>($I`UnknownCapabilityError`)(
  "UnknownCapabilityError",
  {
    profileId: ProfileId.annotateKey({ description: "Profile being resolved." }),
    capabilityId: CapabilityId.annotateKey({ description: "First unknown capability in profile order." }),
  },
  $I.annoteError<UnknownCapabilityError>("UnknownCapabilityError", {
    title: "Unknown capability error",
    description: "A profile references a capability absent from the supplied catalog.",
  })
) {
  override get message(): string {
    return `Profile "${this.profileId}" references unknown capability "${this.capabilityId}".`;
  }
}

/**
 * An enabled capability omits one of its explicit dependencies.
 *
 * **Example** (Create a missing dependency failure)
 *
 * ```ts import.meta.vitest name="Create a missing dependency failure"
 * import { MissingDependencyError } from "@beep/editor/capability/errors"
 * import { CapabilityId, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = MissingDependencyError.make({
 *   profileId: ProfileId.make("editor.test"), capabilityId: CapabilityId.make("authoring.undo"),
 *   dependencyId: CapabilityId.make("extension.history")
 * })
 * error.dependencyId // => "extension.history"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MissingDependencyError extends S.TaggedError<MissingDependencyError>($I`MissingDependencyError`)(
  "MissingDependencyError",
  {
    profileId: ProfileId.annotateKey({ description: "Profile being resolved." }),
    capabilityId: CapabilityId.annotateKey({ description: "Enabled capability with an omitted dependency." }),
    dependencyId: CapabilityId.annotateKey({ description: "Required capability omitted by the profile." }),
  },
  $I.annoteError<MissingDependencyError>("MissingDependencyError", {
    title: "Missing dependency error",
    description: "An enabled capability is missing one of its explicit dependencies.",
  })
) {
  override get message(): string {
    return `Capability "${this.capabilityId}" requires "${this.dependencyId}" in profile "${this.profileId}".`;
  }
}

/**
 * Enabled capability dependencies contain a directed cycle.
 *
 * **Example** (Create a dependency cycle failure)
 *
 * ```ts
 * import { DependencyCycleError } from "@beep/editor/capability/errors"
 * import { CapabilityId, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = DependencyCycleError.make({
 *   profileId: ProfileId.make("editor.test"),
 *   cycle: [CapabilityId.make("node.a"), CapabilityId.make("node.b"), CapabilityId.make("node.a")]
 * })
 * console.log(error.cycle)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DependencyCycleError extends S.TaggedError<DependencyCycleError>($I`DependencyCycleError`)(
  "DependencyCycleError",
  {
    profileId: ProfileId.annotateKey({ description: "Profile being resolved." }),
    cycle: S.NonEmptyArray(CapabilityId).annotateKey({ description: "One deterministic closed dependency walk." }),
  },
  $I.annoteError<DependencyCycleError>("DependencyCycleError", {
    title: "Dependency cycle error",
    description: "The enabled dependency graph contains a directed cycle.",
  })
) {
  override get message(): string {
    return `Profile "${this.profileId}" contains dependency cycle ${A.join(this.cycle, " -> ")}.`;
  }
}

/**
 * Two explicitly enabled capabilities are declared incompatible.
 *
 * **Example** (Create a capability conflict failure)
 *
 * ```ts import.meta.vitest name="Create a capability conflict failure"
 * import { CapabilityConflictError } from "@beep/editor/capability/errors"
 * import { CapabilityId, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = CapabilityConflictError.make({
 *   profileId: ProfileId.make("editor.test"), capabilityId: CapabilityId.make("node.a"),
 *   conflictsWith: CapabilityId.make("node.b")
 * })
 * error.conflictsWith // => "node.b"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CapabilityConflictError extends S.TaggedError<CapabilityConflictError>($I`CapabilityConflictError`)(
  "CapabilityConflictError",
  {
    profileId: ProfileId.annotateKey({ description: "Profile being resolved." }),
    capabilityId: CapabilityId.annotateKey({ description: "First conflicting capability in catalog order." }),
    conflictsWith: CapabilityId.annotateKey({ description: "Enabled capability declared incompatible." }),
  },
  $I.annoteError<CapabilityConflictError>("CapabilityConflictError", {
    title: "Capability conflict error",
    description: "Two explicitly enabled catalog capabilities conflict.",
  })
) {
  override get message(): string {
    return `Capability "${this.capabilityId}" conflicts with "${this.conflictsWith}" in profile "${this.profileId}".`;
  }
}

/**
 * A production profile attempts to enable a development-only capability.
 *
 * **Example** (Create a development-only failure)
 *
 * ```ts import.meta.vitest name="Create a development-only failure"
 * import { DevelopmentOnlyCapabilityError } from "@beep/editor/capability/errors"
 * import { CapabilityId, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = DevelopmentOnlyCapabilityError.make({
 *   profileId: ProfileId.make("editor.production"), capabilityId: CapabilityId.make("debug.raw-state")
 * })
 * error._tag // => "DevelopmentOnlyCapabilityError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DevelopmentOnlyCapabilityError extends S.TaggedError<DevelopmentOnlyCapabilityError>(
  $I`DevelopmentOnlyCapabilityError`
)(
  "DevelopmentOnlyCapabilityError",
  {
    profileId: ProfileId.annotateKey({ description: "Production profile being resolved." }),
    capabilityId: CapabilityId.annotateKey({ description: "Development-only capability requested by the profile." }),
  },
  $I.annoteError<DevelopmentOnlyCapabilityError>("DevelopmentOnlyCapabilityError", {
    title: "Development-only capability error",
    description: "A production profile attempts to enable a development-only capability.",
  })
) {
  override get message(): string {
    return `Production profile "${this.profileId}" cannot enable development-only capability "${this.capabilityId}".`;
  }
}

/**
 * Enabled registration keys cannot form a valid runtime registration plan.
 *
 * **Example** (Create an incompatible transformer failure)
 *
 * ```ts import.meta.vitest name="Create an incompatible transformer failure"
 * import { IncompatibleRegistrationError } from "@beep/editor/capability/errors"
 * import { CapabilityId, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = IncompatibleRegistrationError.make({
 *   profileId: ProfileId.make("editor.test"), capabilityId: CapabilityId.make("transformer.heading"),
 *   registration: "HEADING", reason: "transformer requires interchange.markdown"
 * })
 * error.registration // => "HEADING"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IncompatibleRegistrationError extends S.TaggedError<IncompatibleRegistrationError>(
  $I`IncompatibleRegistrationError`
)(
  "IncompatibleRegistrationError",
  {
    profileId: ProfileId.annotateKey({ description: "Profile being resolved." }),
    capabilityId: CapabilityId.annotateKey({ description: "Capability that owns the incompatible registration." }),
    registration: S.NonEmptyString.annotateKey({ description: "Registration key that cannot be mounted." }),
    reason: S.NonEmptyString.annotateKey({ description: "Stable explanation of the registration invariant." }),
  },
  $I.annoteError<IncompatibleRegistrationError>("IncompatibleRegistrationError", {
    title: "Incompatible registration error",
    description: "Enabled registration keys violate a runtime composition invariant.",
  })
) {
  override get message(): string {
    return `Registration "${this.registration}" for "${this.capabilityId}" is incompatible: ${this.reason}.`;
  }
}

/**
 * A keybinding override targets a command absent from the resolved command set.
 *
 * **Example** (Create an unknown command failure)
 *
 * ```ts import.meta.vitest name="Create an unknown command failure"
 * import { UnknownCommandError } from "@beep/editor/capability/errors"
 * import { CommandId, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = UnknownCommandError.make({
 *   profileId: ProfileId.make("editor.test"), commandId: CommandId.make("format.missing")
 * })
 * error.commandId // => "format.missing"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnknownCommandError extends S.TaggedError<UnknownCommandError>($I`UnknownCommandError`)(
  "UnknownCommandError",
  {
    profileId: ProfileId.annotateKey({ description: "Profile being resolved." }),
    commandId: CommandId.annotateKey({ description: "Override target absent from the enabled command set." }),
  },
  $I.annoteError<UnknownCommandError>("UnknownCommandError", {
    title: "Unknown command error",
    description: "A keybinding override targets a command that is not resolved.",
  })
) {
  override get message(): string {
    return `Profile "${this.profileId}" overrides unresolved command "${this.commandId}".`;
  }
}

/**
 * Multiple resolved commands own the same active platform chord.
 *
 * **Example** (Create a keybinding conflict failure)
 *
 * ```ts
 * import { KeybindingConflictError } from "@beep/editor/capability/errors"
 * import { CommandId, KeyChord, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const error = KeybindingConflictError.make({
 *   profileId: ProfileId.make("editor.test"), platform: "windows-linux",
 *   chord: KeyChord.make({ modifiers: ["control"], key: "b" }),
 *   commandIds: [CommandId.make("format.bold"), CommandId.make("format.italic")]
 * })
 * console.log(error.commandIds)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KeybindingConflictError extends S.TaggedError<KeybindingConflictError>($I`KeybindingConflictError`)(
  "KeybindingConflictError",
  {
    profileId: ProfileId.annotateKey({ description: "Profile being resolved." }),
    platform: Platform.annotateKey({ description: "Platform with the colliding chord." }),
    chord: KeyChord.annotateKey({ description: "Canonical chord owned by multiple commands." }),
    commandIds: S.NonEmptyArray(CommandId).annotateKey({
      description: "Every colliding command identifier in resolved command order.",
    }),
  },
  $I.annoteError<KeybindingConflictError>("KeybindingConflictError", {
    title: "Keybinding conflict error",
    description: "Two or more resolved commands own the same active platform chord.",
  })
) {
  override get message(): string {
    return `Profile "${this.profileId}" assigns one ${this.platform} chord to ${A.join(this.commandIds, ", ")}.`;
  }
}

/**
 * Tagged union of every deterministic profile resolution failure.
 *
 * **Example** (Decode a resolution failure)
 *
 * ```ts import.meta.vitest name="Decode a resolution failure"
 * import { ProfileResolutionError, UnknownCapabilityError } from "@beep/editor/capability/errors"
 * import { CapabilityId, ProfileId } from "@beep/editor/capability/schemas"
 * import * as S from "effect/Schema"
 *
 * const value = UnknownCapabilityError.make({
 *   profileId: ProfileId.make("editor.test"), capabilityId: CapabilityId.make("node.missing")
 * })
 * S.is(ProfileResolutionError)(value) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ProfileResolutionError = S.Union([
  UnknownCapabilityError,
  MissingDependencyError,
  DependencyCycleError,
  CapabilityConflictError,
  DevelopmentOnlyCapabilityError,
  IncompatibleRegistrationError,
  UnknownCommandError,
  KeybindingConflictError,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ProfileResolutionError", {
    title: "Profile resolution error",
    description: "Tagged union of every expected deterministic profile resolution failure.",
  })
);

/**
 * Decoded error union produced by {@link ProfileResolutionError}.
 *
 * @category errors
 * @since 0.0.0
 */
export type ProfileResolutionError = typeof ProfileResolutionError.Type;
