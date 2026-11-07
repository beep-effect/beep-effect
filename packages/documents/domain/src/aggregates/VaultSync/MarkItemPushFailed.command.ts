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
 * MarkItemPushFailed vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.MarkItemPushFailed.make({terminal:true,generation:1});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class MarkItemPushFailed extends Domain.Command("MarkItemPushFailed", {
  target: V.ItemId,
  input: { terminal: S.Boolean, generation: S.Int },
  events: [E.ItemPushFailed],
  rejects: [SyncRuleViolation],
}) {}
