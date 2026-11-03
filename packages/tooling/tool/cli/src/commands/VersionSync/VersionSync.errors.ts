/**
 * Tagged errors for the VersionSync command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { messageWithCause } from "@beep/repo-cli-kit/cli/CommandErrorFields";
import { OpaqueDefect } from "@beep/repo-cli-kit/schema/OpaqueDefect";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/VersionSync/VersionSync.errors");

/**
 * Operational error during version sync (file read/write, parse failures).
 *
 * **Example** (Create VersionSyncError instance)
 *
 * ```ts
 * import { VersionSyncError } from "@beep/repo-cli/commands/VersionSync"
 *
 * const error = VersionSyncError.make({ file: "package.json", message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class VersionSyncError extends S.TaggedError<VersionSyncError, { readonly brand: unique symbol }>(
  $I`VersionSyncError`
)(
  "VersionSyncError",
  {
    message: S.String,
    file: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<VersionSyncError>("VersionSyncError", {
    title: "Version Sync Error",
    description: "Failed to read, resolve, or update a version pin",
  })
) {
  /**
   * Construct a version sync error from a cause and file path.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, file: string): VersionSyncError;
    (message: string, file: string): (cause: unknown) => VersionSyncError;
  } = dual(3, (cause: unknown, message: string, file: string) =>
    VersionSyncError.make({
      cause,
      message,
      file,
    })
  );

  static readonly mapError = Err.mapCauseError<VersionSyncError, [message: string, file: string]>(
    (cause, message, file) =>
      VersionSyncError.make({
        cause,
        file,
        message: messageWithCause(message, cause),
      })
  );
}

/**
 * Network unavailable during upstream version resolution.
 *
 * **Example** (Create NetworkUnavailableError instance)
 *
 * ```ts
 * import { NetworkUnavailableError } from "@beep/repo-cli/commands/VersionSync"
 *
 * const error = NetworkUnavailableError.make({ message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class NetworkUnavailableError extends S.TaggedError<NetworkUnavailableError, { readonly brand: unique symbol }>(
  $I`NetworkUnavailableError`
)(
  "NetworkUnavailableError",
  { message: S.String },
  $I.annoteError<NetworkUnavailableError>("NetworkUnavailableError", {
    title: "Network Unavailable",
    description: "Upstream version resolution failed due to network",
  })
) {
  static readonly new = (message: string) => NetworkUnavailableError.make({ message });

  static readonly mapError = Err.mapCauseError<NetworkUnavailableError, [message: string]>((cause, message) =>
    NetworkUnavailableError.new(messageWithCause(message, cause))
  );
}

/**
 * Drift detected in check mode (non-zero exit).
 *
 * **Example** (Create VersionSyncDriftError instance)
 *
 * ```ts
 * import { VersionSyncDriftError } from "@beep/repo-cli/commands/VersionSync"
 *
 * const error = VersionSyncDriftError.make({ driftCount: 2, message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class VersionSyncDriftError extends S.TaggedError<VersionSyncDriftError, { readonly brand: unique symbol }>(
  $I`VersionSyncDriftError`
)(
  "VersionSyncDriftError",
  {
    message: S.String,
    driftCount: S.Finite,
  },
  $I.annoteError<VersionSyncDriftError>("VersionSyncDriftError", {
    title: "Version Sync Drift Error",
    description: "Version drift detected in check mode",
  })
) {
  /**
   * Construct a version sync drift error from the drift count and message.
   *
   * @category constructors
   */
  static readonly new: {
    (driftCount: number, message: string): VersionSyncDriftError;
    (message: string): (driftCount: number) => VersionSyncDriftError;
  } = dual(2, (driftCount: number, message: string) =>
    VersionSyncDriftError.make({
      driftCount,
      message,
    })
  );

  static readonly mapError = Err.mapToError<VersionSyncDriftError, [driftCount: number, message: string]>(
    (driftCount, message) => VersionSyncDriftError.new(driftCount, message)
  );
}
