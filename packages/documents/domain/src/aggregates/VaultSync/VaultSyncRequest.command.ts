/**
 * Public sync-pass and probe requests.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { Session } from "./Session.middleware.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import { DestinationId } from "./Values.ts";
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
export class VaultSyncRequested extends Domain.Event("VaultSyncRequested", { requestId: S.NonEmptyString }) {
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
  requestId: S.NonEmptyString,
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
  input: { requestId: S.NonEmptyString },
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
  input: { requestId: S.NonEmptyString },
  events: [DestinationProbeRequested],
  rejects: [SyncRuleViolation],
  middleware: [Session],
}) {}
