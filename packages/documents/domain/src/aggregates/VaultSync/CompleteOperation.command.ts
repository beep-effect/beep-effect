/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as E from "./SyncOperation.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * CompleteOperation vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.CompleteOperation.make({holder:"worker",attempt:1});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class CompleteOperation extends Domain.Command("CompleteOperation", {
  target: V.OperationId,
  input: { holder: S.String, attempt: S.Int },
  events: [E.OperationSucceeded],
  rejects: [SyncRuleViolation],
}) {}
