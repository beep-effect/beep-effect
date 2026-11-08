/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./SyncItem.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ObserveItem vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ObserveItem.make({observation:{destinationId:V.DestinationId.make("documents_sync_destination_avault"),workspaceId:1,path:V.VaultRelPath.make("file.txt"),kind:"file",digest:"sha256:a",generation:1,operationId:V.OperationId.make("documents_sync_operation_a1"),type:"uploadFile",parentRequired:false}});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ObserveItem extends Domain.Command("ObserveItem", {
  target: V.ItemId,
  input: { observation: E.ItemObservation },
  events: [E.ItemTracked, E.ItemEdited, E.ItemMoved, E.ItemKindReplaced],
  rejects: [SyncRuleViolation],
}) {}
