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
 * **Example** (Inspect contract)
 * ```ts
 * import { ConfirmConflict } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConfirmConflict;
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
