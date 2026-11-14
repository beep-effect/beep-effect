/**
 * Closed read-only MCP registration over the existing API client.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Ai from "@alchemy.run/domain/Ai";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { VaultSyncApi } from "@beep/documents-use-cases/aggregates/VaultSync";
import { sanitizedToolkit } from "@beep/mcp-kit";
import * as Layer from "effect/Layer";
import { VaultSyncDeliveryClient } from "./VaultSyncApi.ts";

// A fixed projection of the same API, not another Domain.Api. Ai.toToolkit
// receives an explicit get/snapshot/list allowlist for these four View entries.
const readSurface = {
  apiName: VaultSyncApi.apiName,
  serves: [V.VaultSyncStatus, V.OpenConflicts, V.DestinationList, V.OperationQueue],
  group: VaultSyncApi.group,
  clientInProcess: VaultSyncDeliveryClient,
};
const reads = Ai.toToolkit(readSurface, {
  expose: [
    "VaultSyncStatus.get",
    "VaultSyncStatus.snapshot",
    "VaultSyncStatus.list",
    "OpenConflicts.get",
    "OpenConflicts.snapshot",
    "OpenConflicts.list",
    "DestinationList.get",
    "DestinationList.snapshot",
    "DestinationList.list",
    "OperationQueue.get",
    "OperationQueue.snapshot",
    "OperationQueue.list",
  ],
});

/**
 * Twelve read-only View tools, with sanitized registration and the original API schemas.
 *
 * **Example** (Inspect registered tools)
 * ```ts
 * import { VaultSyncReadToolkit } from "@beep/documents-server/aggregates/Sync";
 * console.log(VaultSyncReadToolkit.tools);
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const VaultSyncReadToolkit = reads.toolkit;

/**
 * Transport-free MCP registrations; the host supplies its authenticated MCP transport.
 *
 * **Example** (Inspect registrations)
 * ```ts
 * import { VaultSyncMcpLive } from "@beep/documents-server/aggregates/Sync";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(VaultSyncMcpLive));
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncMcpLive = sanitizedToolkit(VaultSyncReadToolkit).pipe(Layer.provide(reads.layer));
