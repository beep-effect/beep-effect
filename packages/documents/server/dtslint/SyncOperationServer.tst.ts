import {
  makeDrizzleSyncOperationRepository,
  makeInMemorySyncOperationRepository,
  SyncOperationRepositoryDrizzleLayer,
  SyncOperationRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncOperation";
import { expect } from "tstyche";
import type {
  SyncOperationRepository,
  SyncOperationRepositoryShape,
} from "@beep/documents-use-cases/entities/SyncOperation/server";
import type { PostgresDrizzle } from "@beep/postgres";
import type { Effect, Layer } from "effect";

expect(makeInMemorySyncOperationRepository()).type.toBeAssignableTo<Effect.Effect<SyncOperationRepositoryShape>>();
expect(makeDrizzleSyncOperationRepository()).type.toBeAssignableTo<
  Effect.Effect<SyncOperationRepositoryShape, never, PostgresDrizzle>
>();
expect(SyncOperationRepositoryInMemoryLayer).type.toBeAssignableTo<Layer.Layer<SyncOperationRepository>>();
expect(SyncOperationRepositoryDrizzleLayer).type.toBeAssignableTo<
  Layer.Layer<SyncOperationRepository, never, PostgresDrizzle>
>();
expect(SyncOperationRepositoryDrizzleLayer).type.not.toBeAssignableTo<
  Layer.Layer<SyncOperationRepository, never, never>
>();
