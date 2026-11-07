/**
 * Documents server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { AlchemyPostgres, AlchemyPostgresConfig, ProvenanceMapping } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  VaultSyncPassModel,
  VaultSyncPolicies,
  VaultSyncRequestsLive,
} from "@beep/documents-use-cases/aggregates/VaultSync";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { DocumentsServerLayer, DocumentsServerLlmLayer } from "./aggregates/Document/index.ts";
import {
  BOX_MIRROR_DEFAULT_ROOT_NAME,
  BOX_MIRROR_ROOT_NAME_ENV,
  BoxMirrorEvidence,
  BoxMirrorLive,
  DmsMirrorFixtureLayer,
  ensureSyncCutover,
  LegacySyncAuditLive,
  LegacySyncProjections,
  LegacySyncReadModelLive,
  SyncAdmissionOptions,
  VaultSyncMirrorRoot,
  VaultSyncPassLive,
  VaultSyncRootFromWorkspaceLive,
} from "./aggregates/Sync/index.ts";

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
 * **Example** (Import DocumentsServerLive layer)
 *
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
 * **Example** (Import DocumentsServerLlmLive layer)
 *
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
 * Box mirror root name from `DOCUMENTS_SYNC_BOX_MIRROR_ROOT`, defaulting to `beep-vault`.
 *
 * **Example** (Import VaultSyncMirrorRootLayer)
 *
 * ```ts
 * import { VaultSyncMirrorRootLayer } from "@beep/documents-server/layer"
 *
 * console.log(VaultSyncMirrorRootLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncMirrorRootLayer = Layer.effect(
  VaultSyncMirrorRoot,
  Config.NonEmptyString(BOX_MIRROR_ROOT_NAME_ENV).pipe(
    Config.withDefault(BOX_MIRROR_DEFAULT_ROOT_NAME),
    Effect.map((name) => VaultSyncMirrorRoot.of({ name }))
  )
);

// The provider cannot yet prove an interrupted upload's outcome, so absent evidence holds it.
const NoBoxMirrorEvidence = Layer.succeed(BoxMirrorEvidence, {
  lookup: Effect.fn("BoxMirrorEvidence.none")(() => Effect.succeedNone),
});

// Genesis sends carry their import principal in this request context; the driver stamps it on events.
const platformConfig = AlchemyPostgresConfig.make({
  provenance: O.some(
    ProvenanceMapping.make({
      contextKey: V.GenesisProvenance.key,
      principalField: "principal",
      sourceKindField: "source",
    })
  ),
});

const ModelHost = VaultSyncPassModel.layer(
  Layer.mergeAll(VaultSyncPolicies, VaultSyncRequestsLive, VaultSyncPassLive, LegacySyncProjections)
).pipe(
  Layer.provide(BoxMirrorLive),
  Layer.provide(Layer.mergeAll(LegacySyncAuditLive, NoBoxMirrorEvidence, VaultSyncRootFromWorkspaceLive)),
  Layer.provide(AlchemyPostgres.layer(platformConfig)),
  // A store whose event tables cannot be created is not a recoverable sync state.
  Layer.orDie
);

// Genesis and admission run once, after the host is built and before any consumer gets the Model.
const Admission = Layer.effectDiscard(
  Effect.gen(function* () {
    const root = yield* VaultSyncMirrorRoot;
    yield* ensureSyncCutover(SyncAdmissionOptions.make({ mirrorRootName: root.name }));
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.logError("vault sync admission refused; the Model is not served").pipe(
        Effect.annotateLogs({ cause: Cause.pretty(cause) })
      )
    ),
    Effect.withSpan("DocumentsVaultSync.admission")
  )
);

/**
 * The vault-sync Model as the only writer of the four legacy sync tables.
 *
 * **Details**
 *
 * Hosts `VaultSyncPassModel` with its policies, the durable pass saga, the
 * BoxMirror adapter and the SQL projections on `AlchemyPostgres.layer()`, and
 * provides the Model's aggregates and Views plus `LegacySyncReadModel`. The
 * layer finishes building only after genesis and admission succeed (a no-op
 * on an admitted store); a refusal fails the layer with its typed error so
 * the host can serve vault sync in maintenance instead. Requires the DMS
 * mirror with its availability probe, `SqlClient`, `PostgresDrizzle`,
 * `VaultSyncOwnership`, `VaultSyncMirrorRoot`, `VaultSyncWorkspaceRoots`, and
 * platform filesystem and path.
 *
 * **Example** (Import DocumentsVaultSyncLive)
 *
 * ```ts
 * import { DocumentsVaultSyncLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsVaultSyncLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsVaultSyncLive = Layer.mergeAll(Admission, LegacySyncReadModelLive).pipe(
  Layer.provideMerge(ModelHost),
  Layer.provide(LegacySyncAuditLive)
);

/**
 * {@link DocumentsVaultSyncLive} over the deterministic DMS mirror fixture; the
 * fixture handle stays exposed for tests and smoke runs.
 *
 * **Example** (Import DocumentsVaultSyncFixtureLive)
 *
 * ```ts
 * import { DocumentsVaultSyncFixtureLive } from "@beep/documents-server/layer"
 *
 * console.log(DocumentsVaultSyncFixtureLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsVaultSyncFixtureLive = DocumentsVaultSyncLive.pipe(Layer.provideMerge(DmsMirrorFixtureLayer));
