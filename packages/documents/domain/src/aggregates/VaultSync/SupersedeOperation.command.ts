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
 * SupersedeOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SupersedeOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void SupersedeOperation;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SupersedeOperation extends Domain.Command("SupersedeOperation", {
  target: V.OperationId,
  input: { reason: S.String },
  events: [E.OperationSuperseded],
  rejects: [SyncRuleViolation],
}) {}
