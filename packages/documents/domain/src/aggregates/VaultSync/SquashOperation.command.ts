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
 * SquashOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SquashOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void SquashOperation;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SquashOperation extends Domain.Command("SquashOperation", {
  target: V.OperationId,
  input: { input: E.OperationInput },
  events: [E.OperationSquashed],
  rejects: [SyncRuleViolation],
}) {}
