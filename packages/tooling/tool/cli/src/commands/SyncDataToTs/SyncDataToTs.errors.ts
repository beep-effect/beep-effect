/**
 * Tagged errors for the SyncDataToTs command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Inspectable } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/SyncDataToTs/SyncDataToTs.errors");

const causeMessage = (cause: unknown): string => {
  if (P.isError(cause)) {
    return cause.message;
  }
  if (P.hasProperty(cause, "message") && P.isString(cause.message)) {
    return cause.message;
  }
  return Inspectable.toStringUnknown(cause, 0);
};

/**
 * Operational error during source fetch, parsing, projection, or file writes.
 *
 * @example
 * ```ts
 * import { SyncDataToTsError } from "@beep/repo-cli/commands/SyncDataToTs"
 *
 * const error = SyncDataToTsError.make({ message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export class SyncDataToTsError extends TaggedErrorClass<SyncDataToTsError>($I`SyncDataToTsError`)(
  "SyncDataToTsError",
  {
    message: S.String,
    targetId: S.optionalKey(S.String),
    file: S.optionalKey(S.String),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("SyncDataToTsError", {
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
        message: `${message}: ${causeMessage(cause)}`,
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
 * @example
 * ```ts
 * import { SyncDataToTsDriftError } from "@beep/repo-cli/commands/SyncDataToTs"
 *
 * const error = SyncDataToTsDriftError.make({ driftCount: 2, message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export class SyncDataToTsDriftError extends TaggedErrorClass<SyncDataToTsDriftError>($I`SyncDataToTsDriftError`)(
  "SyncDataToTsDriftError",
  {
    message: S.String,
    driftCount: S.Finite,
  },
  $I.annote("SyncDataToTsDriftError", {
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
