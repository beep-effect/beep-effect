/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as E from "./SyncItem.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * MarkItemPushed vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.MarkItemPushed.make({remoteId:V.RemoteItemId.make("box1"),generation:1,operationId:V.OperationId.make("documents_sync_operation_a1")});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class MarkItemPushed extends Domain.Command("MarkItemPushed", {
  target: V.ItemId,
  input: {
    remoteId: V.RemoteItemId,
    remoteName: S.optionalKey(S.String),
    remoteParentId: V.RemoteItemId.pipe(S.NullOr, S.optionalKey),
    generation: S.Int,
    operationId: V.OperationId,
  },
  events: [E.ItemPushed],
  rejects: [SyncRuleViolation],
}) {}
