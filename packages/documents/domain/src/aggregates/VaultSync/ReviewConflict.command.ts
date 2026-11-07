/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as E from "./SyncConflict.events.ts";
import { OperationInput } from "./SyncOperation.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ReviewConflict vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReviewConflict } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReviewConflict;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReviewConflict extends Domain.Command("ReviewConflict", {
  target: V.ConflictId,
  input: {
    remoteEventId: S.String,
    workspaceId: S.Int,
    destinationId: V.DestinationId,
    correction: S.NullOr(S.Struct({ operationId: V.OperationId, input: OperationInput })),
    healOperationId: V.OperationId,
  },
  events: [E.ConflictReviewRequested],
  rejects: [SyncRuleViolation],
}) {}
