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
 * ExpireLease vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ExpireLease } from "@beep/documents-domain/aggregates/VaultSync";
 * void ExpireLease;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ExpireLease extends Domain.Command("ExpireLease", {
  target: V.OperationId,
  input: { attempt: S.Int },
  events: [E.OperationLeaseExpired],
}) {}
