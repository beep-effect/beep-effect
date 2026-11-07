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
 * **Example** (Inspect contract)
 * ```ts
 * import { MarkItemPushed } from "@beep/documents-domain/aggregates/VaultSync";
 * void MarkItemPushed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class MarkItemPushed extends Domain.Command("MarkItemPushed", {
  target: V.ItemId,
  input: { remoteId: V.RemoteItemId, generation: S.Int },
  events: [E.ItemPushed],
  rejects: [SyncRuleViolation],
}) {}
