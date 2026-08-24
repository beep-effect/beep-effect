/**
 * Vault sync use-case errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DmsProvider } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

const $I = $DocumentsUseCasesId.create("aggregates/Sync/Sync.errors");

const DmsMirrorUnavailableFields = {
  provider: DmsProvider.annotateKey({
    description: "DMS provider whose mirror adapter failed.",
  }),
  reason: S.NonEmptyString.annotateKey({
    description: "Non-empty mirror adapter failure diagnostic.",
  }),
  retryable: S.Boolean.annotateKey({
    description: "Whether retrying the remote operation may succeed.",
  }),
} satisfies S.Struct.Fields;
const sameDmsMirrorUnavailableFields = S.toEquivalence(
  S.TaggedStruct("DmsMirrorUnavailable", DmsMirrorUnavailableFields)
);
const sameDmsMirrorUnavailable = (self: DmsMirrorUnavailable, that: DmsMirrorUnavailable): boolean =>
  sameDmsMirrorUnavailableFields(self, that);

/**
 * Raised when the DMS mirror adapter cannot complete a remote operation.
 *
 * **Example** (Make DmsMirrorUnavailable error)
 *
 * ```ts
 * import { DmsMirrorUnavailable } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const error = DmsMirrorUnavailable.make({
 *   provider: "box",
 *   reason: "remote rate limit exceeded",
 *   retryable: true
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DmsMirrorUnavailable extends S.TaggedError<DmsMirrorUnavailable>($I`DmsMirrorUnavailable`)(
  "DmsMirrorUnavailable",
  DmsMirrorUnavailableFields,
  $I.annoteClass<
    S.declare<DmsMirrorUnavailable>,
    readonly [S.TaggedStruct<"DmsMirrorUnavailable", typeof DmsMirrorUnavailableFields>]
  >("DmsMirrorUnavailable", {
    description: "The DMS mirror adapter could not complete a remote operation.",
    toEquivalence: () => sameDmsMirrorUnavailable,
  })
) {}

const VaultScanFailedFields = {
  reason: S.NonEmptyString.annotateKey({
    description: "Non-empty vault scan failure diagnostic.",
  }),
} satisfies S.Struct.Fields;
const sameVaultScanFailedFields = S.toEquivalence(S.TaggedStruct("VaultScanFailed", VaultScanFailedFields));
const sameVaultScanFailed = (self: VaultScanFailed, that: VaultScanFailed): boolean =>
  sameVaultScanFailedFields(self, that);

/**
 * Raised when scanning the local workspace vault fails.
 *
 * **Example** (Make VaultScanFailed error)
 *
 * ```ts
 * import { VaultScanFailed } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const error = VaultScanFailed.make({ reason: "vault root is not readable" })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VaultScanFailed extends S.TaggedError<VaultScanFailed>($I`VaultScanFailed`)(
  "VaultScanFailed",
  VaultScanFailedFields,
  $I.annoteClass<
    S.declare<VaultScanFailed>,
    readonly [S.TaggedStruct<"VaultScanFailed", typeof VaultScanFailedFields>]
  >("VaultScanFailed", {
    description: "Scanning the local workspace vault failed.",
    toEquivalence: () => sameVaultScanFailed,
  })
) {}

const VaultSyncActionErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameVaultSyncActionErrorFields = S.toEquivalence(
  S.TaggedStruct("VaultSyncActionError", VaultSyncActionErrorFields)
);
const sameVaultSyncActionError = (self: VaultSyncActionError, that: VaultSyncActionError): boolean =>
  sameVaultSyncActionErrorFields(self, that);

/**
 * Client-safe failure raised when a vault sync action cannot complete.
 *
 * **Example** (Create VaultSyncActionError instance)
 *
 * ```ts
 * import { VaultSyncActionError } from "@beep/documents-use-cases/public"
 *
 * const error = VaultSyncActionError.new("Vault sync is unavailable.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VaultSyncActionError extends S.TaggedError<VaultSyncActionError>($I`VaultSyncActionError`)(
  "VaultSyncActionError",
  VaultSyncActionErrorFields,
  $I.annoteClass<
    S.declare<VaultSyncActionError>,
    readonly [S.TaggedStruct<"VaultSyncActionError", typeof VaultSyncActionErrorFields>]
  >("VaultSyncActionError", {
    description: "Client-safe failure raised when a vault sync action cannot complete.",
    toEquivalence: () => sameVaultSyncActionError,
  })
) {
  static readonly new = (message: string) => VaultSyncActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}
