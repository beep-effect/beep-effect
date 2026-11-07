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
 * ResolveDestinationRoot vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ResolveDestinationRoot.make({rootId:V.RemoteItemId.make("box1")});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ResolveDestinationRoot extends Domain.Command("ResolveDestinationRoot", {
  target: V.DestinationId,
  input: { rootId: V.RemoteItemId },
  events: [E.RootFolderResolved],
  rejects: [SyncRuleViolation],
}) {}
