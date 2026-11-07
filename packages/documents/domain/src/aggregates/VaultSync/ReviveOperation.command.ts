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
 * ReviveOperation vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ReviveOperation.make({});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReviveOperation extends Domain.Command("ReviveOperation", {
  target: V.OperationId,
  input: {},
  events: [E.OperationRevived],
  rejects: [SyncRuleViolation],
}) {}
