import { expect } from "tstyche";
import type * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import type * as SyncCursorPublic from "@beep/documents-use-cases/entities/SyncCursor";
import type * as SyncCursorServer from "@beep/documents-use-cases/entities/SyncCursor/server";
import type { Effect } from "effect";
import type * as O from "effect/Option";

declare const repository: SyncCursorServer.SyncCursorRepositoryShape;
declare const seed: SyncCursorServer.SyncCursorSeed;
declare const find: SyncCursorServer.FindSyncCursorInput;

expect(repository.find(find)).type.toBe<
  Effect.Effect<O.Option<DomainSyncCursor.SyncCursor>, SyncCursorServer.SyncCursorRepositoryUnavailable>
>();
expect(repository.upsert(seed)).type.toBe<
  Effect.Effect<DomainSyncCursor.SyncCursor, SyncCursorServer.SyncCursorRepositoryUnavailable>
>();

expect<SyncCursorServer.SyncCursorRepository["Service"]>().type.toBe<SyncCursorServer.SyncCursorRepositoryShape>();

expect<"SyncCursorRepository">().type.not.toBeAssignableTo<keyof typeof SyncCursorPublic>();
expect<"SyncCursorSeed">().type.not.toBeAssignableTo<keyof typeof SyncCursorPublic>();
