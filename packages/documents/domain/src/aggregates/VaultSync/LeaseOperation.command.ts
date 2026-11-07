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
 * LeaseOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { LeaseOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void LeaseOperation;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class LeaseOperation extends Domain.Command("LeaseOperation", {
  target: V.OperationId,
  input: {
    holder: S.NonEmptyString,
    leaseMillis: S.Finite,
    parentRemoteId: S.NullOr(V.RemoteItemId),
    itemRemoteId: S.NullOr(V.RemoteItemId),
  },
  events: [E.OperationLeased],
  rejects: [SyncRuleViolation],
}) {}
