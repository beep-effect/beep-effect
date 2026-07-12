import {
  makeDrizzleSyncItemRepository,
  makeInMemorySyncItemRepository,
  SyncItemRepositoryDrizzleLayer,
  SyncItemRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncItem";
import { expect } from "tstyche";
import type { SyncItemRepository, SyncItemRepositoryShape } from "@beep/documents-use-cases/entities/SyncItem/server";
import type { PostgresDrizzle } from "@beep/postgres";
import type { Effect, Layer } from "effect";

expect(makeInMemorySyncItemRepository()).type.toBeAssignableTo<Effect.Effect<SyncItemRepositoryShape>>();
expect(makeDrizzleSyncItemRepository()).type.toBeAssignableTo<
  Effect.Effect<SyncItemRepositoryShape, never, PostgresDrizzle>
>();
expect(SyncItemRepositoryInMemoryLayer).type.toBeAssignableTo<Layer.Layer<SyncItemRepository>>();
expect(SyncItemRepositoryDrizzleLayer).type.toBeAssignableTo<Layer.Layer<SyncItemRepository, never, PostgresDrizzle>>();
expect(SyncItemRepositoryDrizzleLayer).type.not.toBeAssignableTo<Layer.Layer<SyncItemRepository, never, never>>();
