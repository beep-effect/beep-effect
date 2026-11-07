/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { $DocumentsDomainId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Session } from "./Session.middleware.ts";
import * as E from "./SyncConflict.events.ts";
import { OperationInput } from "./SyncOperation.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/ReviewConflict.command");

import { ItemState } from "./SyncItem.events.ts";
/**
 * ReviewConflict vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.ReviewConflict.make({remoteEventId:"event1",workspaceId:1,destinationId:V.DestinationId.make("documents_sync_destination_avault"),correction:null,healOperationId:V.OperationId.make("documents_sync_operation_a1")});
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
/**
 * Corrective operation queued by a reviewed remote move or rename.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReviewCorrection } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReviewCorrection;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ReviewCorrection extends S.Opaque<ReviewCorrection, { readonly brand: unique symbol }>()(
  S.Struct({ operationId: V.OperationId, input: OperationInput }).pipe(
    $I.annoteSchema("ReviewCorrection", { description: "Corrective move or rename queued by a conflict review." })
  )
) {}
const correctionTypes: Readonly<Record<string, V.OperationType>> = {
  remoteMove: "moveItem",
  remoteRename: "renameItem",
};
const ReviewCorrectionDerivation = Fn({
  input: S.Struct({ record: E.ConflictRecord, item: ItemState }),
  output: S.Option(ReviewCorrection),
}).pipe(
  $I.annoteSchema("ReviewCorrectionDerivation", {
    description: "Derive the corrective re-push of a reviewed conflict from its record and item.",
  })
);
/**
 * Derive the corrective re-push for a reviewed conflict, if one applies.
 *
 * **Details**
 *
 * Reviewing a remote move or rename re-asserts the local path: the item is moved
 * or renamed back on Box. This keeps the legacy engine's I14 behaviour, which
 * queued the correction before closing the review. The correction needs a
 * tracked item that already has a remote id. Its operation id is derived from
 * the conflict id and the operation type, so a retried review reuses it. The
 * generation is one past the item's current generation, matching the slot that
 * `ReturnItemToPending` registers.
 *
 * **Example** (No correction for a remote edit)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * import * as O from "effect/Option";
 * const record = V.ConflictRecord.make({
 *   publicId: V.ConflictId.make("documents_sync_conflict_a1"),
 *   destinationId: V.DestinationId.make("documents_sync_destination_avault"),
 *   workspaceId: 1,
 *   remoteEventId: "event1",
 *   itemId: null,
 *   evidence: "edit",
 *   kind: "remoteEdit",
 *   reviewed: false,
 * });
 * console.log(O.isNone(V.reviewCorrection({ record, item: null }))); // true
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const reviewCorrection = ReviewCorrectionDerivation.implementSync(({ record, item }) => {
  const type = record.kind === undefined ? undefined : correctionTypes[record.kind];
  if (type === undefined || record.itemId === null || item?.remoteId == null) return O.none();
  const operationId = V.OperationId.make(
    `documents_sync_operation_a${bytesToHex(sha256(utf8ToBytes(`${record.publicId}/${type}`)))}`
  );
  const o = item.observation;
  const input = OperationInput.make({
    destinationId: record.destinationId,
    itemId: record.itemId,
    type,
    path: o.path,
    digest: o.digest,
    generation: o.generation + 1,
    parentRequired: o.parentRequired,
    idempotencyKey: operationId,
  });
  return O.some(ReviewCorrection.make({ operationId, input }));
});
