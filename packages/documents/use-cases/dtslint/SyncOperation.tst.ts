import { expect } from "tstyche";
import type * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import type * as SyncOperationPublic from "@beep/documents-use-cases/entities/SyncOperation";
import type * as SyncOperationServer from "@beep/documents-use-cases/entities/SyncOperation/server";
import type { Effect } from "effect";

declare const repository: SyncOperationServer.SyncOperationRepositoryShape;
declare const seed: SyncOperationServer.SyncOperationSeed;
declare const operation: DomainSyncOperation.SyncOperation;
declare const listQueued: SyncOperationServer.ListQueuedSyncOperationsInput;
declare const listQueuedForItem: SyncOperationServer.ListQueuedSyncOperationsForItemInput;
declare const requeueLeased: SyncOperationServer.RequeueLeasedSyncOperationsInput;
declare const listByStatus: SyncOperationServer.ListSyncOperationsByStatusInput;

expect(repository.enqueue(seed)).type.toBe<
  Effect.Effect<
    DomainSyncOperation.SyncOperation,
    SyncOperationServer.SyncOperationRepositoryConflict | SyncOperationServer.SyncOperationRepositoryUnavailable
  >
>();
expect(repository.update(operation)).type.toBe<
  Effect.Effect<
    DomainSyncOperation.SyncOperation,
    SyncOperationServer.SyncOperationRepositoryNotFound | SyncOperationServer.SyncOperationRepositoryUnavailable
  >
>();
expect(repository.listQueued(listQueued)).type.toBe<
  Effect.Effect<
    ReadonlyArray<DomainSyncOperation.SyncOperation>,
    SyncOperationServer.SyncOperationRepositoryUnavailable
  >
>();
expect(repository.listQueuedForItem(listQueuedForItem)).type.toBe<
  Effect.Effect<
    ReadonlyArray<DomainSyncOperation.SyncOperation>,
    SyncOperationServer.SyncOperationRepositoryUnavailable
  >
>();
expect(repository.requeueLeased(requeueLeased)).type.toBe<
  Effect.Effect<number, SyncOperationServer.SyncOperationRepositoryUnavailable>
>();
expect(repository.listByStatus(listByStatus)).type.toBe<
  Effect.Effect<
    ReadonlyArray<DomainSyncOperation.SyncOperation>,
    SyncOperationServer.SyncOperationRepositoryUnavailable
  >
>();

expect<
  SyncOperationServer.SyncOperationRepository["Service"]
>().type.toBe<SyncOperationServer.SyncOperationRepositoryShape>();

// The public barrel is a documented-empty module: server-only ports never leak.
expect<keyof typeof SyncOperationPublic>().type.toBe<never>();
