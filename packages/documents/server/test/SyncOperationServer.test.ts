import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import * as Documents from "@beep/documents-domain/identity/Documents";
import { VaultRelPath } from "@beep/documents-domain/values/Sync";
import {
  makeInMemorySyncOperationRepository,
  SyncOperationRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncOperation";
import {
  ListQueuedSyncOperationsForItemInput,
  ListQueuedSyncOperationsInput,
  ListSyncOperationsByStatusInput,
  RequeueLeasedSyncOperationsInput,
  SyncOperationRepository,
  SyncOperationRepositoryConflict,
  SyncOperationRepositoryNotFound,
  SyncOperationSeed,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import { NonNegativeInt } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { baseEntityFixtureInput, fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema);
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
const decodeSyncItemId = S.decodeUnknownSync(Documents.SyncItemId);
const itemOne = decodeSyncItemId(1);
const itemTwo = decodeSyncItemId(2);
const relPath = S.decodeSync(VaultRelPath)("matters/client-default/complaint.pdf");
const zeroAttempts = S.decodeSync(NonNegativeInt)(0);
const generationOne = S.decodeSync(NonNegativeInt)(1);

const operationSeed = (idempotencyKey: string, syncItemId: Documents.SyncItemId) =>
  SyncOperationSeed.make({
    attemptCount: zeroAttempts,
    idempotencyKey,
    inputGeneration: generationOne,
    operationType: "uploadFile",
    provider: "box",
    status: "queued",
    syncItemId,
    targetName: "complaint.pdf",
    targetRelPath: relPath,
    workspaceId,
  });

const mirror = { provider: "box", workspaceId } as const;
const queuedInput = ListQueuedSyncOperationsInput.make(mirror);

const detachedOperation = S.decodeUnknownSync(DomainSyncOperation.SyncOperation)({
  ...baseEntityFixtureInput(DomainSyncOperation.SyncOperationId.entityType, 99),
  attemptCount: 0,
  idempotencyKey: "ghost:uploadFile:1",
  inputContentDigest: null,
  inputGeneration: 1,
  lastError: null,
  operationType: "uploadFile",
  provider: "box",
  status: "queued",
  syncItemId: 1,
  targetName: "ghost.pdf",
  targetParentRelPath: null,
  targetRelPath: "matters/client-default/ghost.pdf",
  workspaceId: 2,
});

describe("SyncOperation server repository", () => {
  it.effect(
    "lists queued operations in FIFO enqueue order",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncOperationRepository();
      const first = yield* repository.enqueue(operationSeed("item-1:uploadFile:1", itemOne));
      const second = yield* repository.enqueue(operationSeed("item-1:uploadFile:2", itemOne));

      expect(first.publicId).toBe("documents_sync_operation_a1");

      const queued = yield* repository.listQueued(queuedInput);
      expect(A.map(queued, (operation) => operation.id)).toEqual([first.id, second.id]);
    })
  );

  it.effect(
    "rejects a duplicate idempotency key with a conflict",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncOperationRepository();
      yield* repository.enqueue(operationSeed("item-1:uploadFile:1", itemOne));

      const error = yield* Effect.flip(repository.enqueue(operationSeed("item-1:uploadFile:1", itemOne)));
      expect(SyncOperationRepositoryConflict.is(error)).toBe(true);
      if (SyncOperationRepositoryConflict.is(error)) {
        expect(error.idempotencyKey).toBe("item-1:uploadFile:1");
      }
    })
  );

  it.effect(
    "scopes queued listings to one sync item",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncOperationRepository();
      const forItemOne = yield* repository.enqueue(operationSeed("item-1:uploadFile:1", itemOne));
      yield* repository.enqueue(operationSeed("item-2:uploadFile:1", itemTwo));

      const queued = yield* repository.listQueuedForItem(
        ListQueuedSyncOperationsForItemInput.make({ syncItemId: itemOne, workspaceId })
      );
      expect(A.map(queued, (operation) => operation.id)).toEqual([forItemOne.id]);
    })
  );

  it.effect(
    "requeues leased operations and reports the count",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncOperationRepository();
      const operation = yield* repository.enqueue(operationSeed("item-1:uploadFile:1", itemOne));

      yield* repository.update(DomainSyncOperation.SyncOperation.make({ ...operation, status: "leased" }));
      expect(yield* repository.listQueued(queuedInput)).toEqual([]);

      const leased = yield* repository.listByStatus(
        ListSyncOperationsByStatusInput.make({ ...mirror, status: "leased" })
      );
      expect(A.map(leased, (candidate) => candidate.id)).toEqual([operation.id]);

      const requeued = yield* repository.requeueLeased(RequeueLeasedSyncOperationsInput.make(mirror));
      expect(requeued).toBe(1);

      const queued = yield* repository.listQueued(queuedInput);
      expect(A.map(queued, (candidate) => candidate.id)).toEqual([operation.id]);
    })
  );

  it.effect(
    "fails update for an unknown operation with not-found",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncOperationRepository();

      const error = yield* Effect.flip(repository.update(detachedOperation));
      expect(SyncOperationRepositoryNotFound.is(error)).toBe(true);
      if (SyncOperationRepositoryNotFound.is(error)) {
        expect(error.syncOperationId).toBe(detachedOperation.id);
      }
    })
  );

  it.effect(
    "resolves the repository through the in-memory layer",
    Effect.fnUntraced(function* () {
      const queued = yield* SyncOperationRepository.pipe(
        Effect.flatMap((repository) => repository.listQueued(queuedInput)),
        provideScopedLayer(SyncOperationRepositoryInMemoryLayer)
      );

      expect(queued).toEqual([]);
    })
  );

  it("round-trips schema-derived sync operations and seeds", () => {
    assertSchemaArbitraryRoundTrip(DomainSyncOperation.SyncOperation);
    assertSchemaArbitraryRoundTrip(SyncOperationSeed);
  });
});
