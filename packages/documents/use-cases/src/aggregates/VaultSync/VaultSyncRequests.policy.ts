/**
 * Durable public-request routing into pass workflows.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as Effect from "effect/Effect";
import { VaultSyncDestinationIdAttribute } from "./VaultSync.instruments.ts";
import { VaultSyncPass } from "./VaultSyncPass.saga.ts";
/**
 * Route public request events once per stable destination/request key.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { VaultSyncRequests } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void VaultSyncRequests;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class VaultSyncRequests extends Domain.Policy("VaultSyncRequests", {
  from: V.SyncDestination,
  on: [V.VaultSyncRequested, V.DestinationProbeRequested],
}) {}
/**
 * Start durable workflows; repeated policy delivery reuses the same workflow key.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { VaultSyncRequestsLive } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void VaultSyncRequestsLive;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const VaultSyncRequestsLive = VaultSyncRequests.toLayer(
  Effect.gen(function* () {
    const pass = yield* VaultSyncPass;
    return Effect.fn("VaultSyncRequests.start")(function* ({ source, event }) {
      yield* Effect.annotateCurrentSpan(VaultSyncDestinationIdAttribute, source.id);
      yield* pass.start(`${source.id}/${event._tag}/${event.requestId}`, {
        destinationId: source.id,
        probeOnly: event._tag === "DestinationProbeRequested",
      });
    });
  })
);
