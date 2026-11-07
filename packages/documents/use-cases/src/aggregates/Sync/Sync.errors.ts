/**
 * Vault sync use-case errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DmsProvider } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import { DmsMirrorDisconnectReason } from "./DmsMirror.ts";

const $I = $DocumentsUseCasesId.create("aggregates/Sync/Sync.errors");

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
export class DmsMirrorUnavailable extends S.TaggedError<DmsMirrorUnavailable, { readonly brand: unique symbol }>(
  $I`DmsMirrorUnavailable`
)(
  "DmsMirrorUnavailable",
  {
    // Optional-key so encodings from peers that predate the field still decode
    // (missing key -> none) and older peers never see an unknown key for none.
    disconnectReason: S.OptionFromOptionalKey(DmsMirrorDisconnectReason)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Probe-facing classification of the failure; none when the adapter cannot classify it.",
      }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider whose mirror adapter failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty mirror adapter failure diagnostic.",
    }),
    retryable: S.Boolean.annotateKey({
      description: "Whether retrying the remote operation may succeed.",
    }),
  },
  $I.annoteError<DmsMirrorUnavailable>("DmsMirrorUnavailable", {
    description: "The DMS mirror adapter could not complete a remote operation.",
  })
) {}

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
export class VaultScanFailed extends S.TaggedError<VaultScanFailed, { readonly brand: unique symbol }>(
  $I`VaultScanFailed`
)(
  "VaultScanFailed",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty vault scan failure diagnostic.",
    }),
  },
  $I.annoteError<VaultScanFailed>("VaultScanFailed", {
    description: "Scanning the local workspace vault failed.",
  })
) {}

/**
 * Raised when the projected vault-sync read model cannot be read or decoded.
 *
 * **Example** (Make VaultSyncReadUnavailable error)
 *
 * ```ts
 * import { VaultSyncReadUnavailable } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const error = VaultSyncReadUnavailable.make({ reason: "list open conflicts failed" })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VaultSyncReadUnavailable extends S.TaggedError<
  VaultSyncReadUnavailable,
  { readonly brand: unique symbol }
>($I`VaultSyncReadUnavailable`)(
  "VaultSyncReadUnavailable",
  {
    reason: S.NonEmptyString.annotateKey({ description: "Non-empty read-model failure diagnostic." }),
  },
  $I.annoteError<VaultSyncReadUnavailable>("VaultSyncReadUnavailable", {
    description: "The projected vault-sync read model could not be read or decoded.",
  })
) {}

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
export class VaultSyncActionError extends S.TaggedError<VaultSyncActionError, { readonly brand: unique symbol }>(
  $I`VaultSyncActionError`
)(
  "VaultSyncActionError",
  {
    message: S.String,
  },
  $I.annoteError<VaultSyncActionError>("VaultSyncActionError", {
    description: "Client-safe failure raised when a vault sync action cannot complete.",
  })
) {
  static readonly new = (message: string) => VaultSyncActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}
