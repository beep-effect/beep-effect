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
 * **Example** (Inspect contract)
 * ```ts
 * import { FailOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void FailOperation;
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
    reason: S.String,
  },
  events: [E.OperationRetryScheduled, E.OperationFailed],
  rejects: [SyncRuleViolation],
}) {}
