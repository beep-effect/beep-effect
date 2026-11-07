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
 * RecordConflict vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RecordConflict } from "@beep/documents-domain/aggregates/VaultSync";
 * void RecordConflict;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RecordConflict extends Domain.Command("RecordConflict", {
  target: V.DestinationId,
  input: { record: E.ConflictRecord },
  events: [E.ConflictEventReserved],
  rejects: [SyncRuleViolation],
}) {}
