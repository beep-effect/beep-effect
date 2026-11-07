/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * OperationFailures vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { OperationFailures } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void OperationFailures;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class OperationFailures extends Domain.Policy("OperationFailures", {
  from: V.SyncOperationSnapshot,
  on: [V.OperationFailed],
}) {}
