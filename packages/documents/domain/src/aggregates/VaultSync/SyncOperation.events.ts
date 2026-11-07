/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as V from "./Values.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/SyncOperation.command");
/**
 * OperationInput vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationInput } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationInput;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationInput extends S.Opaque<OperationInput, { readonly brand: unique symbol }>()(
  S.Struct({
    destinationId: V.DestinationId,
    itemId: V.ItemId,
    type: V.OperationType,
    path: V.VaultRelPath,
    digest: S.NullOr(S.String),
    generation: S.Int,
    parentRequired: S.Boolean,
    idempotencyKey: S.NonEmptyString,
  }).pipe($I.annoteSchema("OperationInput", { description: "OperationInput persisted vault sync value." }))
) {}

/**
 * Persisted non-empty state of the OperationState aggregate.
 *
 * **Example** (Inspect persisted state fields)
 * ```ts
 * import { OperationRecord } from "@beep/documents-domain/aggregates/VaultSync";
 * console.log(OperationRecord.fields);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationRecord extends S.Opaque<OperationRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    input: OperationInput,
    status: V.OperationStatus,
    attempts: S.Int,
    leaseEpoch: S.Int,
    holder: S.NullOr(S.String),
    expiresAt: S.Finite,
    retryAt: S.Finite,
  }).pipe($I.annoteSchema("OperationRecord", { description: "Persisted non-empty vault sync state." }))
) {}
/**
 * OperationState vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationState } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationState;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const OperationState = S.NullOr(OperationRecord).pipe(
  $I.annoteSchema("OperationState", { description: "OperationState persisted vault sync value." })
);
/**
 * Runtime value accepted by {@link OperationState}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type OperationState = typeof OperationState.Type;
/**
 * OperationQueued vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationQueued } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationQueued;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationQueued extends Domain.Event("OperationQueued", { input: OperationInput }) {
  static readonly schemaVersion = 1;
}
/**
 * OperationRetargeted vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationRetargeted } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationRetargeted;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationRetargeted extends Domain.Event("OperationRetargeted", { input: OperationInput }) {
  static readonly schemaVersion = 1;
}
/**
 * OperationSquashed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationSquashed } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationSquashed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationSquashed extends Domain.Event("OperationSquashed", { input: OperationInput }) {
  static readonly schemaVersion = 1;
}
/**
 * OperationLeased vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationLeased } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationLeased;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationLeased extends Domain.Event("OperationLeased", {
  holder: S.NonEmptyString,
  expiresAt: S.Finite,
  attempt: S.Int,
}) {
  static readonly schemaVersion = 1;
}
/**
 * OperationLeaseExpired vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationLeaseExpired } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationLeaseExpired;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationLeaseExpired extends Domain.Event("OperationLeaseExpired", { attempt: S.Int }) {
  static readonly schemaVersion = 1;
}
/**
 * OperationSucceeded vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationSucceeded } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationSucceeded;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationSucceeded extends Domain.Event("OperationSucceeded", { attempt: S.Int }) {
  static readonly schemaVersion = 1;
}
/**
 * OperationRetryScheduled vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationRetryScheduled } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationRetryScheduled;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationRetryScheduled extends Domain.Event("OperationRetryScheduled", {
  retryAt: S.Finite,
  attempt: S.Int,
}) {
  static readonly schemaVersion = 1;
}
/**
 * OperationFailed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationFailed } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationFailed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationFailed extends Domain.Event("OperationFailed", { reason: S.String }) {
  static readonly schemaVersion = 1;
}
/**
 * OperationSuperseded vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationSuperseded } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationSuperseded;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationSuperseded extends Domain.Event("OperationSuperseded", { reason: S.String }) {
  static readonly schemaVersion = 1;
}
/**
 * OperationRevived vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationRevived } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationRevived;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationRevived extends Domain.Event("OperationRevived", {}) {
  static readonly schemaVersion = 1;
}
/**
 * OperationRequeued vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationRequeued } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationRequeued;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationRequeued extends Domain.Event("OperationRequeued", {}) {
  static readonly schemaVersion = 1;
}
