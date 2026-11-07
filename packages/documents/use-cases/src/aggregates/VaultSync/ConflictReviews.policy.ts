/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
/**
 * ConflictReviews vault sync orchestration.
 *
 * **Example** (Inspect declaration)
 * ```ts
 * import { ConflictReviews } from "@beep/documents-use-cases/aggregates/VaultSync";
 * void ConflictReviews;
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export class ConflictReviews extends Domain.Policy("ConflictReviews", {
  from: V.SyncConflict,
  on: [V.ConflictReviewRequested],
}) {}
