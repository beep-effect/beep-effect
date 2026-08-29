import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  ListQueuedSyncOperationsForItemInput,
  ListQueuedSyncOperationsInput,
  ListSyncOperationsByStatusInput,
  RequeueLeasedSyncOperationsInput,
  SyncOperationRepositoryConflict,
  SyncOperationRepositoryNotFound,
  SyncOperationSeed,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { NonNegativeInt } from "@beep/schema";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { SyncOperationRepositoryShape } from "@beep/documents-use-cases/entities/SyncOperation/server";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      return equivalent(decoded, value);
    }),
    fcRuns(10)
  );
};

const workspaceId = S.decodeSync(WorkspaceIdentity.WorkspaceId)(2);
const syncItemId = S.decodeSync(Documents.SyncItemId)(1);
const zero = S.decodeSync(NonNegativeInt)(0);
const decodeSyncOperation = S.decodeUnknownSync(DomainSyncOperation.SyncOperation);
const encodeSyncOperation = S.encodeSync(DomainSyncOperation.SyncOperation);

const uploadSeed = (idempotencyKey: string, targetRelPath: string) =>
  SyncOperationSeed.make({
    attemptCount: zero,
    idempotencyKey,
    inputGeneration: zero,
    operationType: "uploadFile",
    provider: "box",
    status: "queued",
    syncItemId,
    targetName: "complaint.pdf",
    targetRelPath: S.decodeSync(VaultRelPath)(targetRelPath),
    workspaceId,
  });

const syncOperationRow = (seed: SyncOperationSeed, id: number) => ({
  ...productEntityFixtureInput(DocumentsIdentity.SyncOperationId.entityType, id),
  attemptCount: seed.attemptCount,
  idempotencyKey: seed.idempotencyKey,
  inputContentDigest: O.getOrNull(seed.inputContentDigest),
  inputGeneration: seed.inputGeneration,
  lastError: O.getOrNull(seed.lastError),
  operationType: seed.operationType,
  provider: seed.provider,
  status: seed.status,
  syncItemId: seed.syncItemId,
  targetName: seed.targetName,
  targetParentRelPath: O.getOrNull(seed.targetParentRelPath),
  targetRelPath: seed.targetRelPath,
  workspaceId: seed.workspaceId,
});

const withStatus = (
  operation: DomainSyncOperation.SyncOperation,
  status: DomainSyncOperation.SyncOperationStatus
): DomainSyncOperation.SyncOperation => decodeSyncOperation({ ...encodeSyncOperation(operation), status });

const makeRepository = (): SyncOperationRepositoryShape => {
  let operations: ReadonlyArray<DomainSyncOperation.SyncOperation> = A.empty();
  let nextId = 1;

  const matchesMirror =
    (input: { readonly provider: string; readonly workspaceId: number }) =>
    (operation: DomainSyncOperation.SyncOperation) =>
      operation.workspaceId === input.workspaceId && operation.provider === input.provider;

  return {
    enqueue: (seed) =>
      A.some(operations, (operation) => operation.idempotencyKey === seed.idempotencyKey)
        ? Effect.fail(
            SyncOperationRepositoryConflict.make({
              idempotencyKey: seed.idempotencyKey,
              reason: "operation already enqueued for key",
            })
          )
        : Effect.sync(() => {
            const created = decodeSyncOperation(syncOperationRow(seed, nextId));
            nextId = nextId + 1;
            operations = A.append(operations, created);
            return created;
          }),
    update: (operation) =>
      A.some(operations, (existing) => existing.id === operation.id)
        ? Effect.sync(() => {
            operations = A.map(operations, (existing) => (existing.id === operation.id ? operation : existing));
            return operation;
          })
        : Effect.fail(SyncOperationRepositoryNotFound.make({ syncOperationId: operation.id })),
    listQueued: (input) =>
      Effect.sync(() =>
        A.filter(operations, (operation) => matchesMirror(input)(operation) && operation.status === "queued")
      ),
    listQueuedForItem: (input) =>
      Effect.sync(() =>
        A.filter(
          operations,
          (operation) =>
            operation.workspaceId === input.workspaceId &&
            operation.syncItemId === input.syncItemId &&
            operation.status === "queued"
        )
      ),
    requeueLeased: (input) =>
      Effect.sync(() => {
        const leased = A.filter(
          operations,
          (operation) => matchesMirror(input)(operation) && operation.status === "leased"
        );
        operations = A.map(operations, (operation) =>
          matchesMirror(input)(operation) && operation.status === "leased" ? withStatus(operation, "queued") : operation
        );
        return leased.length;
      }),
    listByStatus: (input) =>
      Effect.sync(() =>
        A.filter(operations, (operation) => matchesMirror(input)(operation) && operation.status === input.status)
      ),
  };
};

describe("SyncOperation repository port", () => {
  it.effect(
    "enqueues operations and lists them FIFO by id",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const first = yield* repository.enqueue(uploadSeed("sync-item-1:uploadFile:1", "matters/a/complaint.pdf"));
      const second = yield* repository.enqueue(uploadSeed("sync-item-1:uploadFile:2", "matters/a/answer.pdf"));

      const queued = yield* repository.listQueued(ListQueuedSyncOperationsInput.make({ provider: "box", workspaceId }));
      expect(A.map(queued, (operation) => operation.id)).toEqual([first.id, second.id]);

      const forItem = yield* repository.listQueuedForItem(
        ListQueuedSyncOperationsForItemInput.make({ syncItemId, workspaceId })
      );
      expect(forItem.length).toBe(2);
    })
  );

  it.effect(
    "rejects duplicate idempotency keys with a conflict",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      yield* repository.enqueue(uploadSeed("sync-item-1:uploadFile:1", "matters/a/complaint.pdf"));
      const error = yield* repository
        .enqueue(uploadSeed("sync-item-1:uploadFile:1", "matters/a/complaint.pdf"))
        .pipe(Effect.flip);

      const conflict = O.liftPredicate(error, SyncOperationRepositoryConflict.is);
      expect(O.map(conflict, (found) => found.idempotencyKey)).toEqual(O.some("sync-item-1:uploadFile:1"));
    })
  );

  it.effect(
    "requeues leased operations on boot recovery and reports the count",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const created = yield* repository.enqueue(uploadSeed("sync-item-1:uploadFile:1", "matters/a/complaint.pdf"));
      yield* repository.update(withStatus(created, "leased"));

      const leasedBefore = yield* repository.listByStatus(
        ListSyncOperationsByStatusInput.make({ provider: "box", status: "leased", workspaceId })
      );
      expect(leasedBefore.length).toBe(1);

      const requeued = yield* repository.requeueLeased(
        RequeueLeasedSyncOperationsInput.make({ provider: "box", workspaceId })
      );
      expect(requeued).toBe(1);

      const queued = yield* repository.listQueued(ListQueuedSyncOperationsInput.make({ provider: "box", workspaceId }));
      expect(A.map(queued, (operation) => operation.id)).toEqual([created.id]);
    })
  );

  it.effect(
    "fails update with not-found for unknown operations",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const unknown = decodeSyncOperation(
        syncOperationRow(uploadSeed("sync-item-1:uploadFile:9", "matters/a/complaint.pdf"), 99)
      );
      const error = yield* repository.update(unknown).pipe(Effect.flip);

      expect(SyncOperationRepositoryNotFound.is(error)).toBe(true);
    })
  );

  it("round-trips schema-derived seeds and listing inputs", () => {
    assertSchemaArbitraryRoundTrip(SyncOperationSeed);
    assertSchemaArbitraryRoundTrip(ListQueuedSyncOperationsInput);
    assertSchemaArbitraryRoundTrip(ListQueuedSyncOperationsForItemInput);
    assertSchemaArbitraryRoundTrip(RequeueLeasedSyncOperationsInput);
    assertSchemaArbitraryRoundTrip(ListSyncOperationsByStatusInput);
  });
});
