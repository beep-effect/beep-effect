/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./SyncOperation.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * QueueOperation vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.QueueOperation.make({input:{destinationId:V.DestinationId.make("vault"),itemId:V.ItemId.make("documents_sync_item_a1"),type:"uploadFile",path:V.VaultRelPath.make("file.txt"),digest:"sha256:a",generation:1,parentRequired:false,idempotencyKey:V.OperationId.make("documents_sync_operation_a1")}});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class QueueOperation extends Domain.Command("QueueOperation", {
  target: V.OperationId,
  input: { input: E.OperationInput },
  events: [E.OperationQueued, E.OperationRetargeted],
  rejects: [SyncRuleViolation],
}) {}
