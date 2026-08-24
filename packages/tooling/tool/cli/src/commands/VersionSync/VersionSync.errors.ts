/**
 * Tagged errors for the VersionSync command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { messageWithCause } from "../../internal/cli/CommandErrorFields.ts";

const $I = $RepoCliId.create("commands/VersionSync/VersionSync.errors");

const VersionSyncErrorFields = {
  message: S.String,
  file: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameVersionSyncErrorFields = S.toEquivalence(
  S.TaggedStruct("VersionSyncError", {
    message: VersionSyncErrorFields.message,
    file: VersionSyncErrorFields.file,
  })
);
const sameVersionSyncError = (self: VersionSyncError, that: VersionSyncError): boolean =>
  sameVersionSyncErrorFields(self, that);

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
export class VersionSyncError extends S.TaggedError<VersionSyncError>($I`VersionSyncError`)(
  "VersionSyncError",
  VersionSyncErrorFields,
  $I.annoteClass<
    S.declare<VersionSyncError>,
    readonly [S.TaggedStruct<"VersionSyncError", typeof VersionSyncErrorFields>]
  >("VersionSyncError", {
    title: "Version Sync Error",
    description: "Failed to read, resolve, or update a version pin",
    toEquivalence: () => sameVersionSyncError,
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

const NetworkUnavailableErrorFields = { message: S.String } satisfies S.Struct.Fields;
const sameNetworkUnavailableErrorFields = S.toEquivalence(
  S.TaggedStruct("NetworkUnavailableError", NetworkUnavailableErrorFields)
);
const sameNetworkUnavailableError = (self: NetworkUnavailableError, that: NetworkUnavailableError): boolean =>
  sameNetworkUnavailableErrorFields(self, that);

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
export class NetworkUnavailableError extends S.TaggedError<NetworkUnavailableError>($I`NetworkUnavailableError`)(
  "NetworkUnavailableError",
  NetworkUnavailableErrorFields,
  $I.annoteClass<
    S.declare<NetworkUnavailableError>,
    readonly [S.TaggedStruct<"NetworkUnavailableError", typeof NetworkUnavailableErrorFields>]
  >("NetworkUnavailableError", {
    title: "Network Unavailable",
    description: "Upstream version resolution failed due to network",
    toEquivalence: () => sameNetworkUnavailableError,
  })
) {
  static readonly new = (message: string) => NetworkUnavailableError.make({ message });

  static readonly mapError = Err.mapCauseError<NetworkUnavailableError, [message: string]>((cause, message) =>
    NetworkUnavailableError.new(messageWithCause(message, cause))
  );
}

const VersionSyncDriftErrorFields = {
  message: S.String,
  driftCount: S.Finite,
} satisfies S.Struct.Fields;
const sameVersionSyncDriftErrorFields = S.toEquivalence(
  S.TaggedStruct("VersionSyncDriftError", VersionSyncDriftErrorFields)
);
const sameVersionSyncDriftError = (self: VersionSyncDriftError, that: VersionSyncDriftError): boolean =>
  sameVersionSyncDriftErrorFields(self, that);

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
export class VersionSyncDriftError extends S.TaggedError<VersionSyncDriftError>($I`VersionSyncDriftError`)(
  "VersionSyncDriftError",
  VersionSyncDriftErrorFields,
  $I.annoteClass<
    S.declare<VersionSyncDriftError>,
    readonly [S.TaggedStruct<"VersionSyncDriftError", typeof VersionSyncDriftErrorFields>]
  >("VersionSyncDriftError", {
    title: "Version Sync Drift Error",
    description: "Version drift detected in check mode",
    toEquivalence: () => sameVersionSyncDriftError,
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
