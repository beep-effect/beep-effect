/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./SyncConflict.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ConfirmConflict vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ConfirmConflict.make({record:{publicId:V.ConflictId.make("documents_sync_conflict_a1"),destinationId:V.DestinationId.make("vault"),workspaceId:1,remoteEventId:"event1",itemId:V.ItemId.make("documents_sync_item_a1"),evidence:"remote rename",reviewed:false}});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ConfirmConflict extends Domain.Command("ConfirmConflict", {
  target: V.ConflictId,
  input: { record: E.ConflictRecord },
  events: [E.ConflictRecorded],
  rejects: [SyncRuleViolation],
}) {}
