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
 * FailOperation vault sync contract.
 *
 * **Example** (Build a command for dispatch)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const command=V.FailOperation.make({holder:"worker",attempt:1,retryable:true,maxAttempts:3,backoffMillis:1000,reason:"uploadFile"});
 * console.log(command._tag);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class FailOperation extends Domain.Command("FailOperation", {
  target: V.OperationId,
  input: {
    holder: S.String,
    attempt: S.Int,
    retryable: S.Boolean,
    maxAttempts: S.Int,
    backoffMillis: S.Finite,
    reason: V.MirrorOperation,
  },
  events: [E.OperationRetryScheduled, E.OperationFailed],
  rejects: [SyncRuleViolation],
}) {}
