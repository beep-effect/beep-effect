import {
  makeDrizzleSyncConflictRepository,
  makeInMemorySyncConflictRepository,
  SyncConflictRepositoryDrizzleLayer,
  SyncConflictRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncConflict";
import { expect } from "tstyche";
import type {
  SyncConflictRepository,
  SyncConflictRepositoryShape,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import type { PostgresDrizzle } from "@beep/postgres";
import type { Effect, Layer } from "effect";

expect(makeInMemorySyncConflictRepository()).type.toBeAssignableTo<Effect.Effect<SyncConflictRepositoryShape>>();
expect(makeDrizzleSyncConflictRepository()).type.toBeAssignableTo<
  Effect.Effect<SyncConflictRepositoryShape, never, PostgresDrizzle>
>();
expect(SyncConflictRepositoryInMemoryLayer).type.toBeAssignableTo<Layer.Layer<SyncConflictRepository>>();
expect(SyncConflictRepositoryDrizzleLayer).type.toBeAssignableTo<
  Layer.Layer<SyncConflictRepository, never, PostgresDrizzle>
>();
expect(SyncConflictRepositoryDrizzleLayer).type.not.toBeAssignableTo<
  Layer.Layer<SyncConflictRepository, never, never>
>();
