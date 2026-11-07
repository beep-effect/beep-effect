import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { OperationInput } from "./SyncOperation.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * ConflictRecord vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictRecord } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictRecord;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const ConflictRecord = S.Struct({
  publicId: V.ConflictId,
  destinationId: V.DestinationId,
  workspaceId: S.Int,
  remoteEventId: S.NonEmptyString,
  itemId: S.NullOr(V.ItemId),
  evidence: S.String.check(S.isMaxLength(8192)),
  reviewed: S.Boolean,
});
/** Runtime value accepted by {@link ConflictRecord}. @category vault-sync @since 0.0.0 */
export type ConflictRecord = typeof ConflictRecord.Type;
/**
 * ConflictRecorded vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictRecorded } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictRecorded;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ConflictRecorded extends Domain.Event("ConflictRecorded", { record: ConflictRecord }) {
  static readonly schemaVersion = 1;
}
/**
 * ConflictReviewed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictReviewed } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictReviewed;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ConflictReviewed extends Domain.Event("ConflictReviewed", { record: ConflictRecord }) {
  static readonly schemaVersion = 1;
}
/**
 * RecordConflict vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RecordConflict } from "@beep/documents-domain/aggregates/VaultSync";
 * void RecordConflict;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class RecordConflict extends Domain.Command("RecordConflict", {
  target: V.DestinationId,
  input: { record: ConflictRecord },
  events: [ConflictRecorded],
  rejects: [SyncRuleViolation],
}) {}
/**
 * Record a conflict review only after corrective work is durably queued.
 *
 * **Example** (Inspect review acknowledgement)
 * ```ts
 * import { ConfirmConflictReview } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConfirmConflictReview;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ConflictReviewRequested extends Domain.Event("ConflictReviewRequested", {
  record: ConflictRecord,
  correction: S.NullOr(S.Struct({ operationId: V.OperationId, input: OperationInput })),
}) {
  static readonly schemaVersion = 1;
}
/**
 * ReviewConflict vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReviewConflict } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReviewConflict;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ReviewConflict extends Domain.Command("ReviewConflict", {
  target: V.DestinationId,
  input: {
    remoteEventId: S.String,
    workspaceId: S.Int,
    correction: S.NullOr(S.Struct({ operationId: V.OperationId, input: OperationInput })),
  },
  events: [ConflictReviewRequested],
  rejects: [SyncRuleViolation],
}) {}
/**
 * Record a conflict review only after corrective work is durably queued.
 *
 * **Example** (Inspect review acknowledgement)
 * ```ts
 * import { ConfirmConflictReview } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConfirmConflictReview;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ConfirmConflictReview extends Domain.Command("ConfirmConflictReview", {
  target: V.DestinationId,
  input: { remoteEventId: S.String, workspaceId: S.Int },
  events: [ConflictReviewed],
  rejects: [SyncRuleViolation],
}) {}
