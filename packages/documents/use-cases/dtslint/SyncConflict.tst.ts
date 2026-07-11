import { expect } from "tstyche";
import type * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import type * as SyncConflictPublic from "@beep/documents-use-cases/entities/SyncConflict";
import type * as SyncConflictServer from "@beep/documents-use-cases/entities/SyncConflict/server";
import type { Effect } from "effect";

declare const repository: SyncConflictServer.SyncConflictRepositoryShape;
declare const seed: SyncConflictServer.SyncConflictSeed;
declare const listOpen: SyncConflictServer.ListOpenSyncConflictsInput;
declare const markReviewed: SyncConflictServer.MarkSyncConflictReviewedInput;

expect(repository.record(seed)).type.toBe<
  Effect.Effect<DomainSyncConflict.SyncConflict, SyncConflictServer.SyncConflictRepositoryUnavailable>
>();
expect(repository.listOpen(listOpen)).type.toBe<
  Effect.Effect<ReadonlyArray<DomainSyncConflict.SyncConflict>, SyncConflictServer.SyncConflictRepositoryUnavailable>
>();
expect(repository.markReviewed(markReviewed)).type.toBe<
  Effect.Effect<
    DomainSyncConflict.SyncConflict,
    SyncConflictServer.SyncConflictRepositoryNotFound | SyncConflictServer.SyncConflictRepositoryUnavailable
  >
>();

expect<
  SyncConflictServer.SyncConflictRepository["Service"]
>().type.toBe<SyncConflictServer.SyncConflictRepositoryShape>();

expect<"SyncConflictRepository">().type.not.toBeAssignableTo<keyof typeof SyncConflictPublic>();
expect<"SyncConflictSeed">().type.not.toBeAssignableTo<keyof typeof SyncConflictPublic>();
