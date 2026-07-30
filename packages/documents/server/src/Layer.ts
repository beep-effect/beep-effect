/**
 * Documents server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { VaultSyncEngine } from "@beep/documents-use-cases/aggregates/Sync/server";
import { Layer } from "effect";
import { DocumentsServerLayer, DocumentsServerLlmLayer } from "./aggregates/Document/index.ts";
import { DmsMirrorFixtureLayer, makeVaultSyncEngine, VaultSyncConfigLayer } from "./aggregates/Sync/index.ts";
import {
  SyncConflictRepositoryDrizzleLayer,
  SyncConflictRepositoryInMemoryLayer,
} from "./entities/SyncConflict/index.ts";
import { SyncCursorRepositoryDrizzleLayer, SyncCursorRepositoryInMemoryLayer } from "./entities/SyncCursor/index.ts";
import { SyncItemRepositoryDrizzleLayer, SyncItemRepositoryInMemoryLayer } from "./entities/SyncItem/index.ts";
import {
  SyncOperationRepositoryDrizzleLayer,
  SyncOperationRepositoryInMemoryLayer,
} from "./entities/SyncOperation/index.ts";

/**
 * Document filing configuration layers consumed by application composition.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  FILING_DECISION_DEFAULT_MODEL,
  FILING_DECISION_MODEL_ENV,
  FilingDecisionLlmConfigLayer,
} from "./aggregates/Document/FilingDecisionLlm.config.ts";
/**
 * Box-backed mirror configuration and adapter layers consumed by application
 * composition.
 *
 * @category layers
 * @since 0.0.0
 */
export {
  BoxMirrorConfigLayer,
  DmsMirrorAvailabilityBoxLayer,
  DmsMirrorBoxLive,
} from "./aggregates/Sync/DmsMirrorBox.ts";

/**
 * Live documents server layer.
 *
 * @example
 * ```ts
 * import { DocumentsServerLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsServerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsServerLive = DocumentsServerLayer;

/**
 * Live documents server layer using an app-provided LanguageModel and file-processing service.
 *
 * @example
 * ```ts
 * import { DocumentsServerLlmLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsServerLlmLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsServerLlmLive = DocumentsServerLlmLayer;

/**
 * Vault sync engine layer; requires the four sync repositories, the DMS
 * mirror with its availability probe, the vault sync configuration, and
 * platform filesystem and path services.
 *
 * @example
 * ```ts
 * import { DocumentsSyncEngineLayer } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsSyncEngineLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsSyncEngineLayer = Layer.effect(VaultSyncEngine, makeVaultSyncEngine());

/**
 * Vault sync engine over Drizzle-backed sync repositories and env-backed
 * configuration; still requires `PostgresDrizzle`, the DMS mirror with its
 * availability probe, and platform filesystem and path services.
 *
 * @example
 * ```ts
 * import { DocumentsSyncDrizzleLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsSyncDrizzleLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsSyncDrizzleLive = DocumentsSyncEngineLayer.pipe(
  Layer.provide(
    Layer.mergeAll(
      SyncConflictRepositoryDrizzleLayer,
      SyncCursorRepositoryDrizzleLayer,
      SyncItemRepositoryDrizzleLayer,
      SyncOperationRepositoryDrizzleLayer,
      VaultSyncConfigLayer
    )
  )
);

/**
 * Deterministic vault sync composition over in-memory sync repositories, the
 * DMS mirror fixture, and env-backed configuration; requires only platform
 * filesystem and path services. The fixture handle stays exposed for tests
 * and smoke runs.
 *
 * @example
 * ```ts
 * import { DocumentsSyncFixtureLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsSyncFixtureLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsSyncFixtureLive = DocumentsSyncEngineLayer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      SyncConflictRepositoryInMemoryLayer,
      SyncCursorRepositoryInMemoryLayer,
      SyncItemRepositoryInMemoryLayer,
      SyncOperationRepositoryInMemoryLayer,
      DmsMirrorFixtureLayer,
      VaultSyncConfigLayer
    )
  )
);
