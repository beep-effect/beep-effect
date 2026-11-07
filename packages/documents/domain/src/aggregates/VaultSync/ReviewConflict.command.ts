/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { Session } from "./Session.middleware.ts";
import * as E from "./SyncConflict.events.ts";
import { OperationInput } from "./SyncOperation.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ReviewConflict vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ReviewConflict.make({remoteEventId:"event1",workspaceId:1,destinationId:V.DestinationId.make("vault"),correction:null,healOperationId:V.OperationId.make("documents_sync_operation_a1")});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReviewConflict extends Domain.Command("ReviewConflict", {
  middleware: [Session],
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
