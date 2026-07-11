import {
  makeDrizzleSyncCursorRepository,
  makeInMemorySyncCursorRepository,
  SyncCursorRepositoryDrizzleLayer,
  SyncCursorRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncCursor";
import { expect } from "tstyche";
import type {
  SyncCursorRepository,
  SyncCursorRepositoryShape,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import type { PostgresDrizzle } from "@beep/postgres";
import type { Effect, Layer } from "effect";

expect(makeInMemorySyncCursorRepository()).type.toBeAssignableTo<Effect.Effect<SyncCursorRepositoryShape>>();
expect(makeDrizzleSyncCursorRepository()).type.toBeAssignableTo<
  Effect.Effect<SyncCursorRepositoryShape, never, PostgresDrizzle>
>();
expect(SyncCursorRepositoryInMemoryLayer).type.toBeAssignableTo<Layer.Layer<SyncCursorRepository>>();
expect(SyncCursorRepositoryDrizzleLayer).type.toBeAssignableTo<
  Layer.Layer<SyncCursorRepository, never, PostgresDrizzle>
>();
expect(SyncCursorRepositoryDrizzleLayer).type.not.toBeAssignableTo<Layer.Layer<SyncCursorRepository, never, never>>();
