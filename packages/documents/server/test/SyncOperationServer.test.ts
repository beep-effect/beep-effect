import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
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
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const decodeUnknownSyncOperation = S.decodeUnknownEffect(DomainSyncOperation.SyncOperation);
const workspaceId = WorkspaceIdentity.WorkspaceId.make(2);
const itemOne = Documents.SyncItemId.make(1);
const itemTwo = Documents.SyncItemId.make(2);
const relPath = VaultRelPath.make("matters/client-default/complaint.pdf");
const zeroAttempts = NonNegativeInt.make(0);
const generationOne = NonNegativeInt.make(1);

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

const detachedOperationRow = {
  ...productEntityFixtureInput(DocumentsIdentity.SyncOperationId.entityType, 99),
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
};
const encodeSyncOperationSeed = S.encodeResult(SyncOperationSeed);
const decodeSyncOperationSeed = S.decodeUnknownResult(SyncOperationSeed);
const equivalentSyncOperationSeed = S.toEquivalence(SyncOperationSeed);
const encodeSyncOperation = S.encodeResult(DomainSyncOperation.SyncOperation);
const decodeSyncOperation = S.decodeUnknownResult(DomainSyncOperation.SyncOperation);
const equivalentSyncOperation = S.toEquivalence(DomainSyncOperation.SyncOperation);

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
      pipe(SyncOperationRepositoryConflict.is(error), assertTrue);
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
      const detachedOperation = yield* decodeUnknownSyncOperation(detachedOperationRow);

      const error = yield* Effect.flip(repository.update(detachedOperation));
      pipe(SyncOperationRepositoryNotFound.is(error), assertTrue);
      if (SyncOperationRepositoryNotFound.is(error)) {
        expect(error.syncOperationId).toBe(detachedOperation.id);
      }
    })
  );

  it.layer(Layer.fresh(SyncOperationRepositoryInMemoryLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "resolves the repository through the in-memory layer",
      Effect.fnUntraced(function* () {
        const queued = yield* SyncOperationRepository.pipe(
          Effect.flatMap((repository) => repository.listQueued(queuedInput))
        );

        expect(queued).toEqual([]);
      })
    );
  });

  describe("round-trips schema-derived sync operations and seeds", () => {
    it.prop(
      "DomainSyncOperation.SyncOperation",
      { value: Arbitrary.schema(DomainSyncOperation.SyncOperation) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncOperation(value));
        const decoded = Result.getOrThrow(decodeSyncOperation(encoded));
        assertTrue(equivalentSyncOperation(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
    it.prop(
      "SyncOperationSeed",
      { value: Arbitrary.schema(SyncOperationSeed) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncOperationSeed(value));
        const decoded = Result.getOrThrow(decodeSyncOperationSeed(encoded));
        assertTrue(equivalentSyncOperationSeed(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
  });
});
