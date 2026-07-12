import {
  DmsMirrorFixtureLayer,
  makeDmsMirrorFixture,
  makeVaultSyncEngine,
  VaultSyncConfigLayer,
} from "@beep/documents-server/aggregates/Sync";
import {
  DocumentsSyncDrizzleLive,
  DocumentsSyncEngineLayer,
  DocumentsSyncFixtureLive,
} from "@beep/documents-server/layer";
import { expect } from "tstyche";
import type {
  DmsMirrorFixtureHandle,
  DmsMirrorFixtureHandleShape,
  VaultSyncConfig,
} from "@beep/documents-server/aggregates/Sync";
import type {
  DmsMirror,
  DmsMirrorAvailability,
  DmsMirrorShape,
  VaultSyncEngine,
  VaultSyncEngineShape,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import type { SyncConflictRepository } from "@beep/documents-use-cases/entities/SyncConflict/server";
import type { SyncCursorRepository } from "@beep/documents-use-cases/entities/SyncCursor/server";
import type { SyncItemRepository } from "@beep/documents-use-cases/entities/SyncItem/server";
import type { SyncOperationRepository } from "@beep/documents-use-cases/entities/SyncOperation/server";
import type { PostgresDrizzle } from "@beep/postgres";
import type { Config, Effect, FileSystem, Layer, Path } from "effect";

type EngineRequirements =
  | DmsMirror
  | DmsMirrorAvailability
  | SyncConflictRepository
  | SyncCursorRepository
  | SyncItemRepository
  | SyncOperationRepository
  | VaultSyncConfig
  | FileSystem.FileSystem
  | Path.Path;

expect(makeVaultSyncEngine()).type.toBeAssignableTo<Effect.Effect<VaultSyncEngineShape, never, EngineRequirements>>();
expect(makeDmsMirrorFixture()).type.toBeAssignableTo<
  Effect.Effect<{ readonly handle: DmsMirrorFixtureHandleShape; readonly mirror: DmsMirrorShape }>
>();
expect(DmsMirrorFixtureLayer).type.toBeAssignableTo<
  Layer.Layer<DmsMirror | DmsMirrorAvailability | DmsMirrorFixtureHandle>
>();
expect(DocumentsSyncEngineLayer).type.toBeAssignableTo<Layer.Layer<VaultSyncEngine, never, EngineRequirements>>();
expect(DocumentsSyncDrizzleLive).type.toBeAssignableTo<
  Layer.Layer<
    VaultSyncEngine,
    Config.ConfigError,
    DmsMirror | DmsMirrorAvailability | PostgresDrizzle | FileSystem.FileSystem | Path.Path
  >
>();
expect(DocumentsSyncFixtureLive).type.toBeAssignableTo<
  Layer.Layer<VaultSyncEngine | DmsMirrorFixtureHandle, Config.ConfigError, FileSystem.FileSystem | Path.Path>
>();
expect(DocumentsSyncFixtureLive).type.not.toBeAssignableTo<Layer.Layer<VaultSyncEngine, never, never>>();
expect(VaultSyncConfigLayer).type.toBeAssignableTo<Layer.Layer<VaultSyncConfig, Config.ConfigError>>();
