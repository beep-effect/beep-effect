/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * ConflictRegistration vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { ConflictRegistration } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void ConflictRegistration;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class ConflictRegistration extends Domain.Policy("ConflictRegistration", {
  from: V.ConflictEventRegistry,
  on: [V.ConflictEventReserved],
}) {}
