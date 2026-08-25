/**
 * Tagged errors for the SyncDataToTs command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { messageWithCause } from "../../internal/cli/CommandErrorFields.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/SyncDataToTs.errors");

/**
 * Operational error during source fetch, parsing, projection, or file writes.
 *
 * **Example** (Make sync data error)
 *
 * ```ts
 * import { SyncDataToTsError } from "@beep/repo-cli/commands/SyncDataToTs"
 *
 * const error = SyncDataToTsError.make({ message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class SyncDataToTsError extends S.TaggedError<SyncDataToTsError>($I`SyncDataToTsError`)(
  "SyncDataToTsError",
  {
    message: S.String,
    targetId: S.optionalKey(S.String),
    file: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<SyncDataToTsError>("SyncDataToTsError", {
    title: "Sync Data To TypeScript Error",
    description: "Failed to fetch, decode, normalize, render, or write synced data.",
  })
) {
  /**
   * Construct a sync-data error from a cause and optional target context.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, targetId?: string, file?: string): SyncDataToTsError;
    (message: string, targetId?: string, file?: string): (cause: unknown) => SyncDataToTsError;
  } = dual(
    4,
    (cause, message, targetId, file): SyncDataToTsError =>
      SyncDataToTsError.make({
        message,
        targetId,
        file,
        cause,
      })
  );

  static readonly mapError = Err.mapCauseError<SyncDataToTsError, [message: string, targetId?: string, file?: string]>(
    (cause, message, targetId, file) =>
      SyncDataToTsError.make({
        message: messageWithCause(message, cause),
        cause,
        ...O.getSomesStruct({
          targetId: O.fromUndefinedOr(targetId),
          file: O.fromUndefinedOr(file),
        }),
      })
  );
}

/**
 * Drift detected in check mode.
 *
 * **Example** (Make sync drift error)
 *
 * ```ts
 * import { SyncDataToTsDriftError } from "@beep/repo-cli/commands/SyncDataToTs"
 *
 * const error = SyncDataToTsDriftError.make({ driftCount: 2, message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class SyncDataToTsDriftError extends S.TaggedError<SyncDataToTsDriftError>($I`SyncDataToTsDriftError`)(
  "SyncDataToTsDriftError",
  {
    message: S.String,
    driftCount: S.Finite,
  },
  $I.annoteError<SyncDataToTsDriftError>("SyncDataToTsDriftError", {
    title: "Sync Data To TypeScript Drift Error",
    description: "Generated data drift was detected while running in check mode.",
  })
) {
  /**
   * Construct a sync-data drift error from the drift count and message.
   *
   * @category constructors
   */
  static readonly new: {
    (driftCount: number, message: string): SyncDataToTsDriftError;
    (message: string): (driftCount: number) => SyncDataToTsDriftError;
  } = dual(
    2,
    (driftCount: number, message: string): SyncDataToTsDriftError =>
      SyncDataToTsDriftError.make({
        driftCount,
        message,
      })
  );

  static readonly mapError = Err.mapToError<SyncDataToTsDriftError, [driftCount: number, message: string]>(
    (driftCount, message) => SyncDataToTsDriftError.new(driftCount, message)
  );
}
