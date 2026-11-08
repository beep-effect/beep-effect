/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as E from "./SyncConflict.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * Record a conflict review only after corrective work is durably queued.
 *
 * **Example** (Inspect review acknowledgement)
 * ```ts
 * import { ConfirmConflictReview } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConfirmConflictReview;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ConfirmConflictReview extends Domain.Command("ConfirmConflictReview", {
  target: V.ConflictId,
  input: { remoteEventId: S.String, workspaceId: S.Int, destinationId: V.DestinationId },
  events: [E.ConflictReviewed],
  rejects: [SyncRuleViolation],
}) {}
