/**
 * Public sync-pass and probe requests.
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file unused-class-member -- the @beep/alchemy-postgres driver reads the static `schemaVersion` reflectively to version stored events (D12). Owner: @beep/documents-domain. Exit: delete when alchemy ships a kernel event-version slot and the driver stops reading the static.
import * as Domain from "@alchemy.run/domain";
import { Session } from "./Session.middleware.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import { DestinationId, RequestToken } from "./Values.ts";
/**
 * Durable request to run an explicitly identified destination workflow.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { VaultSyncRequested } from "@beep/documents-domain/aggregates/VaultSync";
 * void VaultSyncRequested;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class VaultSyncRequested extends Domain.Event("VaultSyncRequested", { requestId: RequestToken }) {
  static readonly schemaVersion = 1;
}
/**
 * Durable request to run an explicitly identified destination workflow.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationProbeRequested } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationProbeRequested;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationProbeRequested extends Domain.Event("DestinationProbeRequested", {
  requestId: RequestToken,
}) {
  static readonly schemaVersion = 1;
}
/**
 * Initiate destination work through the authorized API, retaining a stable request identity.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RequestVaultSync } from "@beep/documents-domain/aggregates/VaultSync";
 * void RequestVaultSync;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RequestVaultSync extends Domain.Command("RequestVaultSync", {
  target: DestinationId,
  input: { requestId: RequestToken },
  events: [VaultSyncRequested],
  rejects: [SyncRuleViolation],
  middleware: [Session],
}) {}
/**
 * Initiate destination work through the authorized API, retaining a stable request identity.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ProbeDestination } from "@beep/documents-domain/aggregates/VaultSync";
 * void ProbeDestination;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ProbeDestination extends Domain.Command("ProbeDestination", {
  target: DestinationId,
  input: { requestId: RequestToken },
  events: [DestinationProbeRequested],
  rejects: [SyncRuleViolation],
  middleware: [Session],
}) {}
