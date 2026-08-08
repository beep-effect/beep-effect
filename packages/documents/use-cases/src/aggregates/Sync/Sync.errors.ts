/**
 * Vault sync use-case errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DmsProvider } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Effect, flow } from "effect";
import * as S from "effect/Schema";

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
export class DmsMirrorUnavailable extends TaggedErrorClass<DmsMirrorUnavailable>($I`DmsMirrorUnavailable`)(
  "DmsMirrorUnavailable",
  {
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
  $I.annote("DmsMirrorUnavailable", {
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
export class VaultScanFailed extends TaggedErrorClass<VaultScanFailed>($I`VaultScanFailed`)(
  "VaultScanFailed",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty vault scan failure diagnostic.",
    }),
  },
  $I.annote("VaultScanFailed", {
    description: "Scanning the local workspace vault failed.",
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
export class VaultSyncActionError extends TaggedErrorClass<VaultSyncActionError>($I`VaultSyncActionError`)(
  "VaultSyncActionError",
  {
    message: S.String,
  },
  $I.annote("VaultSyncActionError", {
    description: "Client-safe failure raised when a vault sync action cannot complete.",
  })
) {
  static readonly new = (message: string) => VaultSyncActionError.make({ message });

  static readonly failEffect = flow(this.new, Effect.fail);
}
