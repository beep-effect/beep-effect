/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { OperationInput } from "./SyncOperation.command.ts";
import * as V from "./Values.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/SyncConflict.command");
/**
 * ConflictRecord vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictRecord } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictRecord;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ConflictRecord extends S.Opaque<ConflictRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    publicId: V.ConflictId,
    destinationId: V.DestinationId,
    workspaceId: S.Int,
    remoteEventId: S.NonEmptyString,
    itemId: S.NullOr(V.ItemId),
    evidence: V.RemoteEvidence,
    kind: S.optionalKey(
      S.Literals(["remoteCreate", "remoteEdit", "remoteMove", "remoteRename", "remoteDelete", "remoteUnknown"])
    ),
    remoteId: S.optionalKey(V.RemoteItemId),
    path: S.optionalKey(V.VaultRelPath),
    reviewed: S.Boolean,
  }).pipe($I.annoteSchema("ConflictRecord", { description: "ConflictRecord persisted vault sync value." }))
) {}

/**
 * ConflictRecorded vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictRecorded } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictRecorded;
 * ```
 * @category aggregates
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
 * @category aggregates
 * @since 0.0.0
 */
export class ConflictReviewed extends Domain.Event("ConflictReviewed", { record: ConflictRecord }) {
  static readonly schemaVersion = 1;
}
/**
 * ConflictEventReserved vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ConflictEventReserved } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictEventReserved;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ConflictEventReserved extends Domain.Event("ConflictEventReserved", { record: ConflictRecord }) {
  static readonly schemaVersion = 1;
}

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
export class ConflictReviewRequested extends Domain.Event("ConflictReviewRequested", {
  record: ConflictRecord,
  correction: S.NullOr(S.Struct({ operationId: V.OperationId, input: OperationInput })),
  healOperationId: V.OperationId,
}) {
  static readonly schemaVersion = 1;
}
