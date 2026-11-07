/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * OperationDeadlines vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { OperationDeadlines } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void OperationDeadlines;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class OperationDeadlines extends Domain.Policy("OperationDeadlines", {
  from: V.SyncOperation,
  on: [V.OperationLeased, V.OperationRetryScheduled],
}) {}
