import { expect } from "tstyche";
import type * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import type * as SyncItemPublic from "@beep/documents-use-cases/entities/SyncItem";
import type * as SyncItemServer from "@beep/documents-use-cases/entities/SyncItem/server";
import type { Effect } from "effect";
import type * as O from "effect/Option";

declare const repository: SyncItemServer.SyncItemRepositoryShape;
declare const seed: SyncItemServer.SyncItemSeed;
declare const item: DomainSyncItem.SyncItem;
declare const byPath: SyncItemServer.FindSyncItemByPathInput;
declare const byRemoteId: SyncItemServer.FindSyncItemByRemoteIdInput;
declare const byWorkspace: SyncItemServer.ListSyncItemsByWorkspaceInput;

expect(repository.create(seed)).type.toBe<
  Effect.Effect<
    DomainSyncItem.SyncItem,
    SyncItemServer.SyncItemRepositoryConflict | SyncItemServer.SyncItemRepositoryUnavailable
  >
>();
expect(repository.update(item)).type.toBe<
  Effect.Effect<
    DomainSyncItem.SyncItem,
    SyncItemServer.SyncItemRepositoryNotFound | SyncItemServer.SyncItemRepositoryUnavailable
  >
>();
expect(repository.findByPath(byPath)).type.toBe<
  Effect.Effect<O.Option<DomainSyncItem.SyncItem>, SyncItemServer.SyncItemRepositoryUnavailable>
>();
expect(repository.findByRemoteId(byRemoteId)).type.toBe<
  Effect.Effect<O.Option<DomainSyncItem.SyncItem>, SyncItemServer.SyncItemRepositoryUnavailable>
>();
expect(repository.listByWorkspace(byWorkspace)).type.toBe<
  Effect.Effect<ReadonlyArray<DomainSyncItem.SyncItem>, SyncItemServer.SyncItemRepositoryUnavailable>
>();

expect<SyncItemServer.SyncItemRepository["Service"]>().type.toBe<SyncItemServer.SyncItemRepositoryShape>();

expect<"SyncItemRepository">().type.not.toBeAssignableTo<keyof typeof SyncItemPublic>();
expect<"SyncItemSeed">().type.not.toBeAssignableTo<keyof typeof SyncItemPublic>();
