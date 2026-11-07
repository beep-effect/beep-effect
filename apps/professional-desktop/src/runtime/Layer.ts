/**
 * App-local live runtime Layer for the desktop chat surface.
 *
 * SPEC (increment 6b-3): assemble the already-built chat pieces into a single
 * runnable Layer the bun sidecar launches. {@link ChatHandlersLive} (the
 * `ChatRpcs` handler group) requires an {@link AgentTurnKernel}, a
 * {@link Thread.ThreadStore}, and a {@link UsageRecordSink}; this module
 * provides all three:
 *
 * - **AgentTurnKernel** — {@link AnthropicTurnKernel} by default, or the
 *   deterministic keyless {@link FixtureTurnKernel} when `CHAT_AGENT=fixture`.
 *   Both are self-contained `Layer<AgentTurnKernel>`.
 * - **ThreadStore** — the Drizzle-backed {@link Thread.ThreadStoreDrizzleLayer}
 *   over the shared PGlite {@link PostgresDrizzle}.
 * - **UsageRecordSink** — the Drizzle-backed {@link UsageRecordSinkDrizzle} over
 *   the same shared {@link PostgresDrizzle}.
 *
 * The ThreadStore and usage sink share one PGlite-backed
 * {@link PgliteDrizzleLive} database (migrations applied on boot); observability
 * is env-gated. The composed {@link RuntimeLive} resolves the handler group's
 * service requirements while preserving typed startup failures for the
 * sidecar entrypoint to report.
 *
 * A {@link RuntimeTest} variant (fixture kernel + in-memory store + in-memory
 * sink, no database, no key) is provided for smoke/dev.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicTurnKernel } from "@beep/agents-server/AnthropicTurnKernel";
import { FixtureTurnKernel } from "@beep/agents-use-cases/proof";
import { AnthropicLanguageModelOptions, AnthropicLive, makeAnthropicLanguageModelLayer } from "@beep/anthropic";
import { Box, BoxCcgConfig, BoxDeveloperTokenConfig } from "@beep/box";
import { DocTextFileProcessingEngine } from "@beep/doc-text";
import {
  ensureLegacyBoxDestination,
  ensureVaultSyncOwnerMembership,
  VaultSyncMembershipLive,
  VaultSyncOwnership,
  VaultSyncRpcOrganization,
  VaultSyncRpcsApiLive,
  VaultSyncSessionLive,
  VaultSyncSidecarChannelLive,
  VaultSyncWorkspaceRoots,
} from "@beep/documents-server/aggregates/Sync";
import {
  BoxMirrorConfigLayer,
  DmsMirrorAvailabilityBoxLayer,
  DmsMirrorBoxLive,
  DocumentsServerLive,
  DocumentsServerLlmLive,
  DocumentsVaultSyncFixtureLive,
  DocumentsVaultSyncLive,
  FILING_DECISION_DEFAULT_MODEL,
  FILING_DECISION_MODEL_ENV,
  FilingDecisionLlmConfigLayer,
  VaultSyncMirrorRootLayer,
} from "@beep/documents-server/layer";
import { VaultSyncActionError, VaultSyncRpcs } from "@beep/documents-use-cases/public";
import {
  EpistemicServerDrizzleLive,
  EpistemicServerDrizzleRpcLive,
  EpistemicServerRpcLive,
} from "@beep/epistemic-server/layer";
import { ContradictionReviewer, ContradictionReviewScope } from "@beep/epistemic-use-cases/server";
import { makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import { OntologyServerLive } from "@beep/ontology-server/layer";
import { makeDrizzleLayer } from "@beep/postgres";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as SharedIdentity from "@beep/shared-domain/identity/Shared";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { SourceText, Thread, Workspace } from "@beep/workspace-server";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { BunServices } from "@effect/platform-bun";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { ChatHandlersLive } from "@/chat/ChatOrchestrator";
import { UsageRecordSinkDrizzle, UsageRecordSinkInMemory } from "@/chat/UsageRecordSink";
import { ContradictionQaSeedLive } from "@/contradiction/ContradictionQaSeed";
import { DocumentIntakeHandlersLive, WorkspaceVaultHandlersLive } from "@/intake/DocumentIntakeOrchestrator";
import { VaultDirectoryPickerHandlersLive } from "@/intake/VaultDirectoryPickerOrchestrator";
import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator";
import { OntologyWorkspaceSeedLive } from "@/ontology/OntologyWorkspaceSeed";
import { migrateOnBoot } from "@/runtime/Migrations";
import { ObservabilityLive } from "@/runtime/Observability";
import { makeBundledPgliteLayer, PgliteDrizzleLive } from "@/runtime/Pglite";
import { DmsMirrorAvailabilityDisconnectedLayer, DmsMirrorDisconnectedLayer } from "@/sync/DmsMirrorDisconnected";
import { VaultSyncDesktopBindingLive } from "@/sync/VaultSyncSession";
import type { AgentTurnKernel } from "@beep/agents-use-cases/public";
import type { ThreadStoreUnavailable } from "@beep/workspace-use-cases/server";
import type * as PlatformError from "effect/PlatformError";

/**
 * The fully-provided `ChatRpcs` handler layer that the sidecar serves. All of
 * the handler group's requirements
 * (`AgentTurnKernel | ThreadStore | UsageRecordSink`) are satisfied here, so the
 * remaining requirement is whatever rpc/http transport the sidecar adds on top.
 *
 * **Example** (Check handlers layer type)
 *
 * ```ts
 * import type { DesktopHandlersLayer } from "@/runtime/Layer"
 * import type { RuntimeLive } from "@/runtime/Layer"
 *
 * type Check = typeof RuntimeLive extends DesktopHandlersLayer ? true : false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const DesktopHandlersBase = Layer.mergeAll(
  ChatHandlersLive,
  WorkspaceVaultHandlersLive,
  DocumentIntakeHandlersLive,
  VaultDirectoryPickerHandlersLive,
  OntologyHandlersLive
);

const ContradictionQaSeedDesktopLive = ContradictionQaSeedLive.pipe(
  Layer.provide(EpistemicServerDrizzleLive),
  Layer.provide(Workspace.WorkspaceVaultStoreDrizzleLayer)
);

const EpistemicServerDesktopLive = Layer.merge(EpistemicServerDrizzleRpcLive, ContradictionQaSeedDesktopLive);

/**
 * Typed startup failures preserved by the desktop runtime.
 *
 * **Example** (Extract startup error tag)
 *
 * ```ts
 * import type { DesktopStartupError } from "@/runtime/Layer"
 *
 * const startupFailureTag = (error: DesktopStartupError) => error._tag
 * console.log(typeof startupFailureTag) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DesktopStartupError = Config.ConfigError | PlatformError.PlatformError | ThreadStoreUnavailable;

/**
 * Fully-provided desktop handler layer with recoverable startup failures.
 *
 * **Example** (Confirm runtime handlers)
 *
 * ```ts
 * import type { DesktopHandlersLayer } from "@/runtime/Layer"
 * import { RuntimeLive } from "@/runtime/Layer"
 *
 * type RuntimeProvidesHandlers = typeof RuntimeLive extends DesktopHandlersLayer ? true : false
 * const runtimeProvidesHandlers: RuntimeProvidesHandlers = true
 * console.log(runtimeProvidesHandlers) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DesktopHandlersLayer = Layer.Layer<
  | Layer.Success<typeof DesktopHandlersBase>
  | Layer.Success<typeof EpistemicServerDesktopLive>
  | Layer.Success<typeof VaultSyncMaintenanceRpcs>,
  DesktopStartupError
>;

/**
 * The `CHAT_AGENT` env flag: `anthropic` (default) selects the live layers,
 * `fixture` selects the deterministic keyless ones.
 *
 * @category layers
 * @since 0.0.0
 */
const chatAgentMode = Config.Literals(["anthropic", "fixture"], "CHAT_AGENT").pipe(
  Config.withDefault("anthropic" as const)
);

/**
 * Select a layer from {@link chatAgentMode}: `fixture` short-circuits to
 * `onFixture`; otherwise `onLive` is run to assemble the live layer. Config
 * failures (from reading the flag or from `onLive`) become defects via `orDie`,
 * matching the runtime's typed-startup posture.
 *
 * @category layers
 * @since 0.0.0
 */
const selectByChatAgent = <A, E, R>(
  onFixture: Layer.Layer<A, E, R>,
  onLive: Effect.Effect<Layer.Layer<A, E, R>, Config.ConfigError>
): Layer.Layer<A, E, R> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const agent = yield* chatAgentMode;
      return agent === "fixture" ? onFixture : yield* onLive;
    }).pipe(Effect.orDie)
  );

/**
 * Select the assistant-turn kernel from the `CHAT_AGENT` env flag. `anthropic`
 * (default) uses the live {@link AnthropicTurnKernel} (resolves
 * `AI_ANTHROPIC_API_KEY` itself); `fixture` uses the deterministic keyless
 * {@link FixtureTurnKernel}. Both are self-contained `Layer<AgentTurnKernel>`.
 *
 * @category layers
 * @since 0.0.0
 */
const TurnKernelLive: Layer.Layer<AgentTurnKernel> = selectByChatAgent(
  FixtureTurnKernel,
  Effect.succeed(AnthropicTurnKernel)
);

/**
 * Select the documents filing layer from the same `CHAT_AGENT` env flag.
 * `anthropic` (default) composes the live LLM FilingDecision (model from
 * `DOCUMENTS_FILING_MODEL`) with doc-text extraction (unpdf PDF text layer +
 * mammoth DOCX) behind the file-processing capability; `fixture` keeps the
 * deterministic keyless heuristic + no-op extraction (D8-S1 fixture mode).
 *
 * @category layers
 * @since 0.0.0
 */
const DocumentsFilingLive = selectByChatAgent(
  DocumentsServerLive,
  Effect.gen(function* () {
    const model = yield* Config.NonEmptyString(FILING_DECISION_MODEL_ENV).pipe(
      Config.withDefault(FILING_DECISION_DEFAULT_MODEL)
    );
    return DocumentsServerLlmLive.pipe(
      Layer.provide(FilingDecisionLlmConfigLayer),
      Layer.provide(makeAnthropicLanguageModelLayer(AnthropicLanguageModelOptions.make({ model }))),
      Layer.provide(AnthropicLive),
      Layer.provide(makeFileProcessingServiceLayer([DocTextFileProcessingEngine]))
    );
  })
);

const SourceTextResolverDrizzleLive = SourceText.WorkspaceSourceTextResolverLayer.pipe(
  Layer.provide(makeFileProcessingServiceLayer([DocTextFileProcessingEngine])),
  Layer.provide(Workspace.WorkspaceVaultStoreDrizzleLayer)
);

const SourceTextResolverInMemoryLive = SourceText.WorkspaceSourceTextResolverLayer.pipe(
  Layer.provide(makeFileProcessingServiceLayer([DocTextFileProcessingEngine])),
  Layer.provide(Workspace.WorkspaceVaultStoreInMemoryLayer)
);

const desktopOrganizationId = SharedIdentity.OrganizationId.make(1);
const desktopReviewer = UserPrincipal.make({
  userId: SharedIdentity.UserId.make(1),
});
const desktopWorkspaceId = WorkspaceIdentity.WorkspaceId.make(1);
const ContradictionRequestContextLive = Layer.merge(
  Layer.succeed(ContradictionReviewer, ContradictionReviewer.of(desktopReviewer)),
  Layer.succeed(
    ContradictionReviewScope,
    ContradictionReviewScope.of({
      orgId: desktopOrganizationId,
      sourceScopeRef: `workspace:${desktopWorkspaceId}`,
    })
  )
);

/**
 * Resolve the Box driver auth layer for the live vault-sync engine. Prefers
 * Client Credentials Grant (`DMS_BOX_CLIENT_ID` + `DMS_BOX_CLIENT_SECRET`
 * plus a `DMS_BOX_ENTERPRISE_ID` or `DMS_BOX_USER_ID` subject): the SDK
 * refreshes CCG tokens itself, so a long-lived sidecar does not decay into
 * 401s the way the static ~60-minute `CLOUD_BOX_TOKEN` developer token does.
 * Falls back to the developer token, and `none` selects the app-local
 * disconnected mirror layers. Only the selected auth mode is logged — never
 * secret values.
 */
const boxAuthLayer = Effect.gen(function* () {
  const ccg = yield* Config.option(
    Config.all({
      clientId: Config.NonEmptyString("DMS_BOX_CLIENT_ID"),
      clientSecret: Config.Redacted("DMS_BOX_CLIENT_SECRET"),
      enterpriseId: Config.option(Config.NonEmptyString("DMS_BOX_ENTERPRISE_ID")),
      userId: Config.option(Config.NonEmptyString("DMS_BOX_USER_ID")),
    })
  );
  if (O.isSome(ccg)) {
    const candidate = ccg.value;
    if (O.isSome(candidate.enterpriseId) || O.isSome(candidate.userId)) {
      yield* Effect.logInfo("Box auth: client credentials grant (self-refreshing)").pipe(
        Effect.annotateLogs({
          "box.auth.mode": "ccg",
          "box.auth.subject": O.isSome(candidate.enterpriseId) ? "enterprise" : "user",
        })
      );
      // makeCcgLayer is Layer.succeed under the hood; its declared BoxError
      // channel never fires, so orDie only aligns the layer types.
      return O.some(Box.makeCcgLayer(BoxCcgConfig.make(candidate)).pipe(Layer.orDie));
    }
    yield* Effect.logWarning(
      "DMS_BOX_CLIENT_ID/DMS_BOX_CLIENT_SECRET are set without DMS_BOX_ENTERPRISE_ID or DMS_BOX_USER_ID; ignoring the CCG config"
    );
  }
  const token = yield* Config.option(Config.Redacted("CLOUD_BOX_TOKEN"));
  if (O.isSome(token)) {
    yield* Effect.logInfo("Box auth: developer token (CLOUD_BOX_TOKEN)").pipe(
      Effect.annotateLogs({ "box.auth.mode": "developer-token" })
    );
    return O.some(Box.makeLayer(BoxDeveloperTokenConfig.make({ token: token.value })));
  }
  return O.none<Layer.Layer<Box>>();
});

// The sidecar hosts one local organization; it owns every workspace's sync destination.
const VaultSyncHostingLive = Layer.mergeAll(
  Layer.succeed(VaultSyncOwnership, {
    orgOf: Effect.fn("DesktopVaultSync.orgOf")(() => Effect.succeed(desktopOrganizationId)),
  }),
  VaultSyncMirrorRootLayer,
  // A pass reads the vault root from the authorized workspace configuration every time it needs it.
  Layer.effect(
    VaultSyncWorkspaceRoots,
    Effect.gen(function* () {
      const store = yield* WorkspaceUseCases.Workspace.WorkspaceVaultStore;
      return VaultSyncWorkspaceRoots.of({
        rootOf: Effect.fn("DesktopVaultSync.rootOf")((workspaceId: number) =>
          store.getVaultConfig(WorkspaceIdentity.WorkspaceId.make(workspaceId)).pipe(
            Effect.map((config) => config.vaultRootPath),
            Effect.catch((error) =>
              Effect.logWarning("vault sync could not read the workspace vault root").pipe(
                Effect.annotateLogs({ workspaceId, reason: error._tag }),
                Effect.as(O.none<string>())
              )
            )
          )
        ),
      });
    })
  )
);

/**
 * Select the documents vault-sync Model host. Every branch runs the same
 * alchemy Model as the only writer of the four sync tables (genesis and
 * admission run once at startup over the sidecar's PGlite store); only the DMS
 * mirror differs. `CHAT_AGENT=fixture` uses the deterministic fixture mirror;
 * otherwise the Box mirror runs when Box credentials are configured —
 * {@link boxAuthLayer} prefers the self-refreshing Client Credentials Grant
 * over the static `CLOUD_BOX_TOKEN` developer token — or the app-local
 * disconnected mirror layers (typed `DmsMirrorUnavailable` + probe
 * `connected: false`) when neither is set. The mirror availability probe stays
 * in the output for the RPC status reads.
 *
 * @category layers
 * @since 0.0.0
 */
const VaultSyncModelLive = selectByChatAgent(
  DocumentsVaultSyncFixtureLive,
  Effect.gen(function* () {
    const box = yield* boxAuthLayer;
    return O.match(box, {
      onNone: () =>
        DocumentsVaultSyncLive.pipe(
          Layer.provideMerge(Layer.mergeAll(DmsMirrorDisconnectedLayer, DmsMirrorAvailabilityDisconnectedLayer))
        ),
      onSome: (boxDriver) =>
        DocumentsVaultSyncLive.pipe(
          // The availability probe resolves the mirror root itself, so it needs
          // the Box driver and mirror config just like the mirror layer.
          Layer.provideMerge(
            Layer.mergeAll(DmsMirrorBoxLive, DmsMirrorAvailabilityBoxLayer.pipe(Layer.provide(BoxMirrorConfigLayer)))
          ),
          Layer.provide(boxDriver)
        ),
    });
  })
);

// The desktop's signed-in owner and its workspace destination, seeded once and idempotently.
const VaultSyncBootstrap = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* ensureVaultSyncOwnerMembership(desktopReviewer.userId, desktopOrganizationId);
    yield* ensureLegacyBoxDestination(desktopWorkspaceId);
  }).pipe(Effect.withSpan("DesktopVaultSync.bootstrap"))
);

const hostOver = <E, R>(model: Layer.Layer<Layer.Success<typeof VaultSyncModelLive>, E, R>) =>
  VaultSyncBootstrap.pipe(Layer.provideMerge(model), Layer.provideMerge(VaultSyncHostingLive));

/**
 * The hosted vault-sync Model on the sidecar PGlite, with the bootstrap applied.
 *
 * **Details**
 *
 * The RPC handlers and the HTTP, `/vault-sync/rpc` and MCP transport share
 * this one value, so layer memoization hosts a single Model per sidecar.
 *
 * **Example** (Verify the host layer)
 *
 * ```ts
 * import { VaultSyncDesktopHostLive } from "@/runtime/Layer"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(VaultSyncDesktopHostLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncDesktopHostLive = hostOver(VaultSyncModelLive);

const VaultSyncMaintenanceRpcs = VaultSyncRpcs.toLayer(
  Effect.succeed(
    VaultSyncRpcs.of({
      GetVaultSyncStatus: () => VaultSyncActionError.failEffect("Vault sync is in maintenance."),
      ListVaultSyncConflicts: () => VaultSyncActionError.failEffect("Vault sync is in maintenance."),
      MarkVaultSyncConflictReviewed: () => VaultSyncActionError.failEffect("Vault sync is in maintenance."),
      TriggerVaultSync: () => VaultSyncActionError.failEffect("Vault sync is in maintenance."),
      WatchVaultSyncStatus: () => Stream.fail(VaultSyncActionError.make({ message: "Vault sync is in maintenance." })),
    })
  )
);

// The four desktop RPCs, served through the vault-sync Api with the legacy wire unchanged.
// A refused admission leaves the store with no writer; the panel then reports maintenance.
const vaultSyncRpcsOver = <E, R>(host: Layer.Layer<Layer.Success<typeof VaultSyncDesktopHostLive>, E, R>) =>
  VaultSyncRpcsApiLive.pipe(
    Layer.provide(
      VaultSyncSessionLive.pipe(
        Layer.provideMerge(VaultSyncSidecarChannelLive),
        Layer.provideMerge(Layer.mergeAll(VaultSyncDesktopBindingLive, VaultSyncMembershipLive)),
        Layer.provideMerge(host)
      )
    ),
    Layer.provide(Layer.succeed(VaultSyncRpcOrganization, { orgId: desktopOrganizationId })),
    Layer.catchCause((cause) =>
      Layer.effectDiscard(
        Effect.logError("vault sync is unavailable; serving maintenance RPCs").pipe(
          Effect.annotateLogs({ cause: Cause.pretty(cause) })
        )
      ).pipe(Layer.provideMerge(VaultSyncMaintenanceRpcs))
    )
  );

// The fixture runtime has no shared database, so vault sync gets a migrated in-memory PGlite of its own.
const SyncDatabaseInMemory = makeDrizzleLayer().pipe(
  Layer.tap((context) => Effect.provide(migrateOnBoot, context)),
  Layer.provideMerge(makeBundledPgliteLayer()),
  Layer.orDie
);

const VaultSyncRpcsLive = vaultSyncRpcsOver(VaultSyncDesktopHostLive);
const VaultSyncTestHost = DocumentsVaultSyncFixtureLive.pipe(hostOver, Layer.provideMerge(SyncDatabaseInMemory));
// The same layer value is memoized, so the handlers and the host share one in-memory store.
const VaultSyncRpcsTest = vaultSyncRpcsOver(VaultSyncTestHost).pipe(Layer.provide(SyncDatabaseInMemory));

const DesktopHandlersLive = Layer.mergeAll(DesktopHandlersBase, EpistemicServerDesktopLive, VaultSyncRpcsLive);
const DesktopHandlersTest = Layer.mergeAll(DesktopHandlersBase, EpistemicServerRpcLive, VaultSyncRpcsTest);

/**
 * App-local live runtime Layer for chat and ontology sidecar handlers.
 *
 * **Example** (Verify live layer)
 *
 * ```ts
 * import { RuntimeLive } from "@/runtime/Layer"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(RuntimeLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RuntimeLive: DesktopHandlersLayer = DesktopHandlersLive.pipe(
  Layer.provide([
    TurnKernelLive,
    Thread.ThreadStoreDrizzleLayer,
    Workspace.WorkspaceVaultStoreDrizzleLayer,
    SourceTextResolverDrizzleLive,
    ContradictionRequestContextLive,
    UsageRecordSinkDrizzle,
    DocumentsFilingLive,
    // The workbench pre-fills a starter document path; seeding materializes it
    // so a fresh workspace opens something instead of failing on Open. Keep the
    // server services available to the handlers while also providing them to
    // the seed's scoped startup effect.
    Layer.merge(OntologyServerLive, OntologyWorkspaceSeedLive.pipe(Layer.provide(OntologyServerLive))),
  ]),
  Layer.provide(PgliteDrizzleLive),
  Layer.provide(BunCrypto.layer),
  Layer.provideMerge(BunServices.layer),
  Layer.provideMerge(ObservabilityLive)
);

/**
 * App-local fixture runtime Layer for smoke/dev chat and ontology handlers.
 *
 * **Example** (Verify test layer)
 *
 * ```ts
 * import { RuntimeTest } from "@/runtime/Layer"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(RuntimeTest)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RuntimeTest: DesktopHandlersLayer = DesktopHandlersTest.pipe(
  Layer.provide([
    FixtureTurnKernel,
    Thread.ThreadStoreInMemoryLayer,
    Workspace.WorkspaceVaultStoreInMemoryLayer,
    SourceTextResolverInMemoryLive,
    ContradictionRequestContextLive,
    UsageRecordSinkInMemory,
    DocumentsServerLive,
    OntologyServerLive,
  ]),
  Layer.provide(BunCrypto.layer),
  Layer.provideMerge(BunServices.layer)
);
