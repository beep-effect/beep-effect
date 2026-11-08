/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as E from "./SyncItem.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ReturnItemToPending vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ReturnItemToPending.make({operationId:V.OperationId.make("documents_sync_operation_a1")});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReturnItemToPending extends Domain.Command("ReturnItemToPending", {
  target: V.ItemId,
  // A reviewed move or rename overrides the re-push type with its corrective operation.
  input: { operationId: V.OperationId, type: S.optionalKey(V.OperationType) },
  events: [E.ItemReturnedToPending],
  rejects: [SyncRuleViolation],
}) {}
