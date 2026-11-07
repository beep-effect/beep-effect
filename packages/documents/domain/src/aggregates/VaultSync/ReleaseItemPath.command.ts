/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as E from "./SyncDestination.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ReleaseItemPath vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ReleaseItemPath.make({path:V.VaultRelPath.make("file.txt"),itemId:V.ItemId.make("documents_sync_item_a1")});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReleaseItemPath extends Domain.Command("ReleaseItemPath", {
  target: V.DestinationId,
  input: { path: V.VaultRelPath, itemId: V.ItemId },
  events: [E.ItemPathReleased],
  rejects: [SyncRuleViolation],
}) {}
