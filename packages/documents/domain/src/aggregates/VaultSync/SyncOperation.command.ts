import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * OperationInput vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationInput } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationInput;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const OperationInput = S.Struct({
  destinationId: V.DestinationId,
  itemId: V.ItemId,
  type: V.OperationType,
  path: V.VaultRelPath,
  digest: S.NullOr(S.String),
  generation: S.Int,
  parentRequired: S.Boolean,
  idempotencyKey: S.NonEmptyString,
});
/** Runtime value accepted by {@link OperationInput}. @category vault-sync @since 0.0.0 */
export type OperationInput = typeof OperationInput.Type;
/**
 * OperationState vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationState } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationState;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export const OperationState = S.NullOr(
  S.Struct({
    input: OperationInput,
    status: V.OperationStatus,
    attempts: S.Int,
    holder: S.NullOr(S.String),
    expiresAt: S.Finite,
    retryAt: S.Finite,
  })
);
/** Runtime value accepted by {@link OperationState}. @category vault-sync @since 0.0.0 */
export type OperationState = typeof OperationState.Type;
/**
 * OperationQueued vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { OperationQueued } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationQueued;
 * ```
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
 * @since 0.0.0
 */
export class OperationRequeued extends Domain.Event("OperationRequeued", {}) {
  static readonly schemaVersion = 1;
}
/**
 * QueueOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { QueueOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void QueueOperation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class QueueOperation extends Domain.Command("QueueOperation", {
  target: V.OperationId,
  input: { input: OperationInput },
  events: [OperationQueued, OperationRetargeted],
  rejects: [SyncRuleViolation],
}) {}
/**
 * SquashOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SquashOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void SquashOperation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class SquashOperation extends Domain.Command("SquashOperation", {
  target: V.OperationId,
  input: { input: OperationInput },
  events: [OperationSquashed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * LeaseOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { LeaseOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void LeaseOperation;
 * ```
 * @category vault-sync
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
  events: [OperationLeased],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ExpireLease vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ExpireLease } from "@beep/documents-domain/aggregates/VaultSync";
 * void ExpireLease;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ExpireLease extends Domain.Command("ExpireLease", {
  target: V.OperationId,
  input: { attempt: S.Int },
  events: [OperationLeaseExpired],
}) {}
/**
 * CompleteOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { CompleteOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void CompleteOperation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class CompleteOperation extends Domain.Command("CompleteOperation", {
  target: V.OperationId,
  input: { holder: S.String, attempt: S.Int },
  events: [OperationSucceeded],
  rejects: [SyncRuleViolation],
}) {}
/**
 * FailOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { FailOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void FailOperation;
 * ```
 * @category vault-sync
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
  events: [OperationRetryScheduled, OperationFailed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * RetryOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RetryOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void RetryOperation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class RetryOperation extends Domain.Command("RetryOperation", {
  target: V.OperationId,
  input: { attempt: S.Int },
  events: [OperationRequeued],
}) {}
/**
 * SupersedeOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SupersedeOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void SupersedeOperation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class SupersedeOperation extends Domain.Command("SupersedeOperation", {
  target: V.OperationId,
  input: { reason: S.String },
  events: [OperationSuperseded],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ReviveOperation vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReviveOperation } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReviveOperation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ReviveOperation extends Domain.Command("ReviveOperation", {
  target: V.OperationId,
  input: {},
  events: [OperationRevived],
  rejects: [SyncRuleViolation],
}) {}
