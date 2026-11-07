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
 * ReturnItemToPending vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReturnItemToPending } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReturnItemToPending;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReturnItemToPending extends Domain.Command("ReturnItemToPending", {
  target: V.ItemId,
  input: { operationId: V.OperationId },
  events: [E.ItemReturnedToPending],
  rejects: [SyncRuleViolation],
}) {}
