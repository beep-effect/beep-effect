/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as E from "./SyncOperation.events.ts";
import * as V from "./Values.ts";
/**
 * RetryOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RetryOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void RetryOperation;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RetryOperation extends Domain.Command("RetryOperation", {
  target: V.OperationId,
  input: { attempt: S.Int },
  events: [E.OperationRequeued],
}) {}
