/**
 * Typed failure payloads for provider CLI home-layout mechanics.
 *
 * Error taxonomy ported from t3code (MIT, Copyright 2026 T3 Tools Inc.)
 * `apps/server/src/provider/Drivers/CodexHomeLayout.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiProviderCliId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $AiProviderCliId.create("AiProviderCliHome.errors");
const AiProviderCliHomeFsOperationBase = LiteralKit([
  "readLink",
  "makeDirectory",
  "readDirectory",
  "remove",
  "symlink",
]);

/**
 * Filesystem operation names performed by shadow-home maintenance.
 *
 * **Example** (Decode symlink operation name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliHomeFsOperation } from "@beep/ai-provider-cli"
 *
 * const operation = S.decodeUnknownSync(AiProviderCliHomeFsOperation)("symlink")
 *
 * console.log(operation) // "symlink"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliHomeFsOperation = AiProviderCliHomeFsOperationBase.pipe(
  $I.annoteSchema("AiProviderCliHomeFsOperation", {
    description: "Filesystem operation names performed during provider CLI home maintenance.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliHomeFsOperationBase)
);

/**
 * Type for a shadow-home filesystem operation name.
 *
 * **Example** (Annotate readLink operation type)
 *
 * ```ts
 * import type { AiProviderCliHomeFsOperation } from "@beep/ai-provider-cli"
 *
 * const operation: AiProviderCliHomeFsOperation = "readLink"
 *
 * console.log(operation) // "readLink"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliHomeFsOperation = typeof AiProviderCliHomeFsOperation.Type;

const AiProviderCliHomeFileSystemErrorFields = {
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
    .pipe(SchemaUtils.withNoneDefault)
    .annotateKey({
      description: "Underlying platform failure, when one was captured.",
    }),
  effectiveHomePath: S.NonEmptyString.annotateKey({
    description: "Shadow home directory path the operation maintained.",
  }),
  entryName: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
    description: "Home entry name involved in the failed operation, when applicable.",
  }),
  operation: AiProviderCliHomeFsOperation.annotateKey({
    description: "Filesystem operation that failed.",
  }),
  path: S.NonEmptyString.annotateKey({
    description: "Filesystem path the operation acted on.",
  }),
  sharedHomePath: S.NonEmptyString.annotateKey({
    description: "Shared home directory path backing the layout.",
  }),
  targetPath: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
    description: "Symlink target path, when the operation involved one.",
  }),
} satisfies S.Struct.Fields;
const AiProviderCliHomeFileSystemErrorEquivalenceFields = {
  effectiveHomePath: AiProviderCliHomeFileSystemErrorFields.effectiveHomePath,
  entryName: AiProviderCliHomeFileSystemErrorFields.entryName,
  operation: AiProviderCliHomeFileSystemErrorFields.operation,
  path: AiProviderCliHomeFileSystemErrorFields.path,
  sharedHomePath: AiProviderCliHomeFileSystemErrorFields.sharedHomePath,
  targetPath: AiProviderCliHomeFileSystemErrorFields.targetPath,
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameAiProviderCliHomeFileSystemErrorFields = S.toEquivalence(
  S.TaggedStruct("AiProviderCliHomeFileSystemError", AiProviderCliHomeFileSystemErrorEquivalenceFields)
);
const sameAiProviderCliHomeFileSystemError = (
  self: AiProviderCliHomeFileSystemError,
  that: AiProviderCliHomeFileSystemError
): boolean => sameAiProviderCliHomeFileSystemErrorFields(self, that);

/**
 * Filesystem failure raised while maintaining a provider CLI home layout.
 *
 * **Example** (Construct filesystem error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AiProviderCliHomeFileSystemError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliHomeFileSystemError.make({
 *   effectiveHomePath: "/tmp/shadow-codex",
 *   entryName: O.some("sessions"),
 *   operation: "symlink",
 *   path: "/tmp/shadow-codex/sessions",
 *   sharedHomePath: "/home/dev/.codex",
 *   targetPath: O.some("/home/dev/.codex/sessions")
 * })
 *
 * console.log(error.operation) // "symlink"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiProviderCliHomeFileSystemError extends S.TaggedError<AiProviderCliHomeFileSystemError>(
  $I`AiProviderCliHomeFileSystemError`
)(
  "AiProviderCliHomeFileSystemError",
  AiProviderCliHomeFileSystemErrorFields,
  $I.annoteClass<
    S.declare<AiProviderCliHomeFileSystemError>,
    readonly [S.TaggedStruct<"AiProviderCliHomeFileSystemError", typeof AiProviderCliHomeFileSystemErrorFields>]
  >("AiProviderCliHomeFileSystemError", {
    description: "Filesystem failure raised while maintaining a provider CLI home layout.",
    toEquivalence: () => sameAiProviderCliHomeFileSystemError,
  })
) {
  override get message() {
    const target = O.match(this.targetPath, {
      onNone: () => "",
      onSome: (targetPath) => ` to '${targetPath}'`,
    });
    return `Provider CLI home filesystem operation '${this.operation}' failed for '${this.path}'${target}.`;
  }
}

const AiProviderCliHomePathConflictErrorFields = {
  effectiveHomePath: S.NonEmptyString.annotateKey({
    description: "Shadow home directory path that conflicted.",
  }),
  sharedHomePath: S.NonEmptyString.annotateKey({
    description: "Shared home directory path that conflicted.",
  }),
} satisfies S.Struct.Fields;
const sameAiProviderCliHomePathConflictErrorFields = S.toEquivalence(
  S.TaggedStruct("AiProviderCliHomePathConflictError", AiProviderCliHomePathConflictErrorFields)
);
const sameAiProviderCliHomePathConflictError = (
  self: AiProviderCliHomePathConflictError,
  that: AiProviderCliHomePathConflictError
): boolean => sameAiProviderCliHomePathConflictErrorFields(self, that);

/**
 * Failure raised when the shadow home path equals the shared home path.
 *
 * **Example** (Construct path conflict error)
 *
 * ```ts
 * import { AiProviderCliHomePathConflictError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliHomePathConflictError.make({
 *   effectiveHomePath: "/home/dev/.codex",
 *   sharedHomePath: "/home/dev/.codex"
 * })
 *
 * console.log(error._tag) // "AiProviderCliHomePathConflictError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiProviderCliHomePathConflictError extends S.TaggedError<AiProviderCliHomePathConflictError>(
  $I`AiProviderCliHomePathConflictError`
)(
  "AiProviderCliHomePathConflictError",
  AiProviderCliHomePathConflictErrorFields,
  $I.annoteClass<
    S.declare<AiProviderCliHomePathConflictError>,
    readonly [S.TaggedStruct<"AiProviderCliHomePathConflictError", typeof AiProviderCliHomePathConflictErrorFields>]
  >("AiProviderCliHomePathConflictError", {
    description: "Failure raised when a shadow home path equals the shared home path.",
    toEquivalence: () => sameAiProviderCliHomePathConflictError,
  })
) {
  override get message() {
    return `Provider CLI shadow home path '${this.effectiveHomePath}' must be different from the shared home path '${this.sharedHomePath}'.`;
  }
}

const AiProviderCliHomeEntryConflictErrorFields = {
  effectiveHomePath: S.NonEmptyString.annotateKey({
    description: "Shadow home directory path being maintained.",
  }),
  entryName: S.NonEmptyString.annotateKey({
    description: "Home entry name that could not be linked.",
  }),
  linkPath: S.NonEmptyString.annotateKey({
    description: "Shadow-home path where the symlink should live.",
  }),
  sharedHomePath: S.NonEmptyString.annotateKey({
    description: "Shared home directory path backing the layout.",
  }),
  targetPath: S.NonEmptyString.annotateKey({
    description: "Shared-home path the symlink should point at.",
  }),
} satisfies S.Struct.Fields;
const sameAiProviderCliHomeEntryConflictErrorFields = S.toEquivalence(
  S.TaggedStruct("AiProviderCliHomeEntryConflictError", AiProviderCliHomeEntryConflictErrorFields)
);
const sameAiProviderCliHomeEntryConflictError = (
  self: AiProviderCliHomeEntryConflictError,
  that: AiProviderCliHomeEntryConflictError
): boolean => sameAiProviderCliHomeEntryConflictErrorFields(self, that);

/**
 * Failure raised when a non-symlink entry blocks a required shadow-home link.
 *
 * **Example** (Construct entry conflict error)
 *
 * ```ts
 * import { AiProviderCliHomeEntryConflictError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliHomeEntryConflictError.make({
 *   effectiveHomePath: "/tmp/shadow-codex",
 *   entryName: "sessions",
 *   linkPath: "/tmp/shadow-codex/sessions",
 *   sharedHomePath: "/home/dev/.codex",
 *   targetPath: "/home/dev/.codex/sessions"
 * })
 *
 * console.log(error.entryName) // "sessions"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiProviderCliHomeEntryConflictError extends S.TaggedError<AiProviderCliHomeEntryConflictError>(
  $I`AiProviderCliHomeEntryConflictError`
)(
  "AiProviderCliHomeEntryConflictError",
  AiProviderCliHomeEntryConflictErrorFields,
  $I.annoteClass<
    S.declare<AiProviderCliHomeEntryConflictError>,
    readonly [S.TaggedStruct<"AiProviderCliHomeEntryConflictError", typeof AiProviderCliHomeEntryConflictErrorFields>]
  >("AiProviderCliHomeEntryConflictError", {
    description: "Failure raised when a non-symlink entry blocks a required shadow-home link.",
    toEquivalence: () => sameAiProviderCliHomeEntryConflictError,
  })
) {
  override get message() {
    return `Cannot create provider CLI shadow home entry '${this.entryName}' because '${this.linkPath}' already exists and is not a symlink.`;
  }
}

const AiProviderCliHomePrivateEntrySymlinkErrorFields = {
  effectiveHomePath: S.NonEmptyString.annotateKey({
    description: "Shadow home directory path being maintained.",
  }),
  entryName: S.NonEmptyString.annotateKey({
    description: "Private home entry name that resolved to a symlink.",
  }),
  path: S.NonEmptyString.annotateKey({
    description: "Shadow-home path of the offending symlink.",
  }),
  sharedHomePath: S.NonEmptyString.annotateKey({
    description: "Shared home directory path backing the layout.",
  }),
} satisfies S.Struct.Fields;
const sameAiProviderCliHomePrivateEntrySymlinkErrorFields = S.toEquivalence(
  S.TaggedStruct("AiProviderCliHomePrivateEntrySymlinkError", AiProviderCliHomePrivateEntrySymlinkErrorFields)
);
const sameAiProviderCliHomePrivateEntrySymlinkError = (
  self: AiProviderCliHomePrivateEntrySymlinkError,
  that: AiProviderCliHomePrivateEntrySymlinkError
): boolean => sameAiProviderCliHomePrivateEntrySymlinkErrorFields(self, that);

/**
 * Failure raised when a private credential entry resolves to a symlink.
 *
 * **Example** (Construct private symlink error)
 *
 * ```ts
 * import { AiProviderCliHomePrivateEntrySymlinkError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliHomePrivateEntrySymlinkError.make({
 *   effectiveHomePath: "/tmp/shadow-codex",
 *   entryName: "auth.json",
 *   path: "/tmp/shadow-codex/auth.json",
 *   sharedHomePath: "/home/dev/.codex"
 * })
 *
 * console.log(error.entryName) // "auth.json"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiProviderCliHomePrivateEntrySymlinkError extends S.TaggedError<AiProviderCliHomePrivateEntrySymlinkError>(
  $I`AiProviderCliHomePrivateEntrySymlinkError`
)(
  "AiProviderCliHomePrivateEntrySymlinkError",
  AiProviderCliHomePrivateEntrySymlinkErrorFields,
  $I.annoteClass<
    S.declare<AiProviderCliHomePrivateEntrySymlinkError>,
    readonly [
      S.TaggedStruct<
        "AiProviderCliHomePrivateEntrySymlinkError",
        typeof AiProviderCliHomePrivateEntrySymlinkErrorFields
      >,
    ]
  >("AiProviderCliHomePrivateEntrySymlinkError", {
    description: "Failure raised when a private credential entry resolves to a symlink.",
    toEquivalence: () => sameAiProviderCliHomePrivateEntrySymlinkError,
  })
) {
  override get message() {
    return `Provider CLI shadow home private entry '${this.entryName}' at '${this.path}' must be a real file, not a symlink.`;
  }
}

/**
 * Union of all provider CLI home-layout failures.
 *
 * **Example** (Check membership in error union)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliHomeError, AiProviderCliHomePathConflictError } from "@beep/ai-provider-cli"
 *
 * const error = AiProviderCliHomePathConflictError.make({
 *   effectiveHomePath: "/home/dev/.codex",
 *   sharedHomePath: "/home/dev/.codex"
 * })
 *
 * console.log(S.is(AiProviderCliHomeError)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AiProviderCliHomeError = S.Union([
  AiProviderCliHomeFileSystemError,
  AiProviderCliHomePathConflictError,
  AiProviderCliHomeEntryConflictError,
  AiProviderCliHomePrivateEntrySymlinkError,
]).pipe(
  $I.annoteSchema("AiProviderCliHomeError", {
    description: "Union of all provider CLI home-layout failures.",
  })
);

/**
 * Type for any provider CLI home-layout failure.
 *
 * **Example** (Type annotate home error)
 *
 * ```ts
 * import type { AiProviderCliHomeError } from "@beep/ai-provider-cli"
 * import { AiProviderCliHomePathConflictError } from "@beep/ai-provider-cli"
 *
 * const error: AiProviderCliHomeError = AiProviderCliHomePathConflictError.make({
 *   effectiveHomePath: "/home/dev/.codex",
 *   sharedHomePath: "/home/dev/.codex"
 * })
 *
 * console.log(error._tag) // "AiProviderCliHomePathConflictError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type AiProviderCliHomeError = typeof AiProviderCliHomeError.Type;
