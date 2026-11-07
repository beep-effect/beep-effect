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
 * **Example** (Inspect contract)
 * ```ts
 * import { ResolveDestinationRoot } from "@beep/documents-domain/aggregates/VaultSync";
 * void ResolveDestinationRoot;
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
