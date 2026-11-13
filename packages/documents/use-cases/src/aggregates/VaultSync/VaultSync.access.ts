/**
 * Authorization implementations for the vault model's public read contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/**
 * Apply the live vault authorization policy to every exposed view read.
 *
 * **Example** (Compose public read access with model handlers)
 * ```ts
 * import { VaultSyncReadAccess } from "@beep/documents-use-cases/aggregates/VaultSync";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(VaultSyncReadAccess)); // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncReadAccess = Layer.mergeAll(
  V.DestinationList.toLayer(
    Effect.succeed(
      Effect.fnUntraced(function* (request) {
        yield* V.authorizeVaultSync(`DestinationList.${request.mode}`, { key: request.key });
      })
    )
  ),
  V.OpenConflicts.toLayer(
    Effect.succeed(
      Effect.fnUntraced(function* (request) {
        yield* V.authorizeVaultSync(`OpenConflicts.${request.mode}`, { key: request.key });
      })
    )
  ),
  V.OperationQueue.toLayer(
    Effect.succeed(
      Effect.fnUntraced(function* (request) {
        yield* V.authorizeVaultSync(`OperationQueue.${request.mode}`, { key: request.key });
      })
    )
  ),
  V.VaultSyncStatus.toLayer(
    Effect.succeed(
      Effect.fnUntraced(function* (request) {
        yield* V.authorizeVaultSync(`VaultSyncStatus.${request.mode}`, { key: request.key });
      })
    )
  )
);
