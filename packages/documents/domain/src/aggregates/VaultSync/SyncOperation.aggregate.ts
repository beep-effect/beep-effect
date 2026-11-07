/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Domain from "@alchemy.run/domain";
import * as DateTime from "effect/DateTime";
import * as Struct from "effect/Struct";
import * as G from "./SyncGenesis.command.ts";
import * as C from "./SyncOperation.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
import type { SyncRule } from "./SyncRuleViolation.rejection.ts";

const refused = (rule: SyncRule) => SyncRuleViolation.make({ rule, evidence: "operation state" });
const retarget = (s: C.OperationState, c: C.OperationInput) =>
  s !== null &&
  s.status === "queued" &&
  s.input.itemId === c.itemId &&
  s.input.destinationId === c.destinationId &&
  s.input.type === c.type &&
  s.input.idempotencyKey === c.idempotencyKey;
/**
 * SyncOperation vault sync contract.
 *
 * **Example** (Address one aggregate stream)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const ref=V.SyncOperation.ref(V.OperationId.make("documents_sync_operation_a1"));
 * console.log(ref.id);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SyncOperation extends Domain.Aggregate("SyncOperation", {
  id: V.OperationId,
  state: C.OperationState,
  initial: null,
  commands: [
    G.ImportOperationGenesis,
    C.QueueOperation,
    C.SquashOperation,
    C.LeaseOperation,
    C.ExpireLease,
    C.CompleteOperation,
    C.FailOperation,
    C.RetryOperation,
    C.SupersedeOperation,
    C.ReviveOperation,
  ],
  decide: {
    ImportOperationGenesis: (s, c) =>
      s === null
        ? [G.OperationGenesisImported.make(Struct.omit(c, ["_tag"]))]
        : SyncRuleViolation.make({ rule: "genesis-requires-empty-stream", evidence: c.importId }),
    QueueOperation: (s, c, { id }) => {
      if (c.input.idempotencyKey !== id) return refused("operation-key");
      if (s === null) return [C.OperationQueued.make(Struct.omit(c, ["_tag"]))];
      if (!retarget(s, c.input)) return refused("not-retargetable");
      return c.input.generation <= s.input.generation ? [] : [C.OperationRetargeted.make(Struct.omit(c, ["_tag"]))];
    },
    SquashOperation: (s, c) =>
      retarget(s, c.input)
        ? s !== null && c.input.generation < s.input.generation
          ? []
          : [C.OperationSquashed.make(Struct.omit(c, ["_tag"]))]
        : refused("not-retargetable"),
    LeaseOperation: (s, c, { now }) => {
      if (s === null || s.status !== "queued") return refused("not-queued");
      if (s.input.parentRequired && c.parentRemoteId === null) return refused("parent-remote-id");
      if (s.input.type !== "ensureFolder" && s.input.type !== "uploadFile" && c.itemRemoteId === null)
        return refused("item-remote-id");
      if (c.leaseMillis <= 0) return refused("lease-duration");
      return [
        C.OperationLeased.make({
          holder: c.holder,
          expiresAt: DateTime.toEpochMillis(now) + c.leaseMillis,
          attempt: s.leaseEpoch + 1,
        }),
      ];
    },
    ExpireLease: (s, c, { now }) =>
      s !== null && s.status === "leased" && s.leaseEpoch === c.attempt && DateTime.toEpochMillis(now) >= s.expiresAt
        ? [C.OperationLeaseExpired.make(Struct.omit(c, ["_tag"]))]
        : [],
    CompleteOperation: (s, c, { now }) =>
      s !== null &&
      s.status === "leased" &&
      s.holder === c.holder &&
      s.leaseEpoch === c.attempt &&
      DateTime.toEpochMillis(now) < s.expiresAt
        ? [C.OperationSucceeded.make(Struct.omit(c, ["_tag"]))]
        : refused("stale-lease"),
    FailOperation: (s, c, { now }) =>
      s === null || s.status !== "leased" || s.holder !== c.holder || s.leaseEpoch !== c.attempt
        ? refused("stale-lease")
        : !c.retryable || s.attempts >= c.maxAttempts
          ? [C.OperationFailed.make({ reason: c.reason })]
          : [
              C.OperationRetryScheduled.make({
                retryAt: DateTime.toEpochMillis(now) + c.backoffMillis,
                attempt: s.leaseEpoch,
              }),
            ],
    RetryOperation: (s, c, { now }) =>
      s !== null && s.status === "retrying" && s.leaseEpoch === c.attempt && DateTime.toEpochMillis(now) >= s.retryAt
        ? [C.OperationRequeued.make({})]
        : [],
    SupersedeOperation: (s, c) =>
      s !== null && s.status !== "succeeded" && s.status !== "superseded"
        ? [C.OperationSuperseded.make(Struct.omit(c, ["_tag"]))]
        : [],
    ReviveOperation: (s) => (s?.status === "failed" ? [C.OperationRevived.make({})] : []),
  },
  evolve: {
    OperationGenesisImported: (_s, e) => e.record,
    OperationQueued: (_, e): C.OperationState =>
      C.OperationRecord.make({
        input: e.input,
        status: "queued",
        attempts: 0,
        leaseEpoch: 0,
        holder: null,
        expiresAt: 0,
        retryAt: 0,
      }),
    OperationRetargeted: (s, e): C.OperationState => (s === null ? s : { ...s, input: e.input }),
    OperationSquashed: (s, e): C.OperationState => (s === null ? s : { ...s, input: e.input }),
    OperationLeased: (s, e): C.OperationState =>
      s === null
        ? s
        : {
            ...s,
            status: "leased",
            holder: e.holder,
            expiresAt: e.expiresAt,
            attempts: s.attempts + 1,
            leaseEpoch: e.attempt,
          },
    OperationLeaseExpired: (s): C.OperationState => (s === null ? s : { ...s, status: "queued", holder: null }),
    OperationSucceeded: (s): C.OperationState => (s === null ? s : { ...s, status: "succeeded", holder: null }),
    OperationRetryScheduled: (s, e): C.OperationState =>
      s === null ? s : { ...s, status: "retrying", holder: null, retryAt: e.retryAt },
    OperationFailed: (s): C.OperationState => (s === null ? s : { ...s, status: "failed", holder: null }),
    OperationSuperseded: (s): C.OperationState => (s === null ? s : { ...s, status: "superseded", holder: null }),
    OperationRevived: (s): C.OperationState => (s === null ? s : { ...s, status: "queued", attempts: 0 }),
    OperationRequeued: (s): C.OperationState => (s === null ? s : { ...s, status: "queued" }),
  },
}) {}
