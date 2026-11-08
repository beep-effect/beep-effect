/**
 * Vault sync status wire model returned by the desktop RPCs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DmsProvider } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DmsMirrorDisconnectReason } from "./DmsMirror.ts";

const $I = $DocumentsUseCasesId.create("aggregates/Sync/VaultSyncEngine");

/**
 * Point-in-time vault sync status read model for one workspace mirror.
 *
 * **Example** (Decode vault sync status)
 *
 * ```ts
 * import { VaultSyncStatus } from "@beep/documents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(VaultSyncStatus)({
 *   conflictItems: 0,
 *   connected: true,
 *   disconnectReason: null,
 *   currentItems: 3,
 *   cursorPosition: "now",
 *   errorItems: 0,
 *   failedOperations: 0,
 *   openConflicts: 0,
 *   pendingItems: 1,
 *   probedAt: null,
 *   provider: "box",
 *   queuedOperations: 1
 * })
 * console.log(status.pendingItems)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class VaultSyncStatus extends S.Opaque<VaultSyncStatus, { readonly brand: unique symbol }>()(
  S.Struct({
    conflictItems: S.Natural.annotateKey({
      description: "Number of tracked items in the conflict reconciliation state.",
    }),
    connected: S.Boolean.annotateKey({
      description: "Whether the DMS mirror adapter can reach the provider.",
    }),
    // The encoded key is optional with a null decoding default: an older
    // sidecar that predates the field must still produce a decodable status
    // (missing key -> none), not an unavailable panel.
    disconnectReason: S.OptionFromNullOr(DmsMirrorDisconnectReason)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Why the provider is disconnected; none while the mirror probe reports connected.",
      }),
    currentItems: S.Natural.annotateKey({
      description: "Number of tracked items in the current reconciliation state.",
    }),
    cursorPosition: S.OptionFromNullOr(S.NonEmptyString)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Opaque remote-event stream position; none before the cursor bootstraps.",
      }),
    errorItems: S.Natural.annotateKey({
      description: "Number of tracked items in the error reconciliation state.",
    }),
    failedOperations: S.Natural.annotateKey({
      description: "Number of outbox operations in the failed status.",
    }),
    openConflicts: S.Natural.annotateKey({
      description: "Number of drift records awaiting review.",
    }),
    pendingItems: S.Natural.annotateKey({
      description: "Number of tracked items in the pending reconciliation state.",
    }),
    // Same older-sidecar tolerance as disconnectReason: a status that predates
    // the field must decode (missing key -> none), not go unavailable.
    probedAt: S.OptionFromNullOr(S.DateTimeUtcFromString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "When the mirror probe last actually asked the provider; none when no probe has contacted it.",
      }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider the status describes.",
    }),
    queuedOperations: S.Natural.annotateKey({
      description: "Number of outbox operations in the queued status.",
    }),
  }).pipe(
    $I.annoteSchema("VaultSyncStatus", {
      description: "Point-in-time vault sync status read model for one workspace mirror.",
    })
  )
) {}
