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
import { Box, BoxDeveloperTokenConfig } from "@beep/box";
import { DocTextFileProcessingEngine } from "@beep/doc-text";
import {
  FILING_DECISION_DEFAULT_MODEL,
  FILING_DECISION_MODEL_ENV,
  FilingDecisionLlmConfigLayer,
} from "@beep/documents-server/aggregates/Document";
import {
  BoxMirrorConfigLayer,
  DmsMirrorAvailabilityBoxLayer,
  DmsMirrorBoxLive,
} from "@beep/documents-server/aggregates/Sync";
import {
  DocumentsServerLive,
  DocumentsServerLlmLive,
  DocumentsSyncDrizzleLive,
  DocumentsSyncFixtureLive,
} from "@beep/documents-server/layer";
import { makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import { OntologyServerLive } from "@beep/ontology-server/layer";
import { Thread, Workspace } from "@beep/workspace-server";
import { BunServices } from "@effect/platform-bun";
import { Config, Effect, Layer } from "effect";
import * as O from "effect/Option";
import { ChatHandlersLive } from "@/chat/ChatOrchestrator";
import { UsageRecordSinkDrizzle, UsageRecordSinkInMemory } from "@/chat/UsageRecordSink";
import { DocumentIntakeHandlersLive, WorkspaceVaultHandlersLive } from "@/intake/DocumentIntakeOrchestrator";
import { VaultDirectoryPickerHandlersLive } from "@/intake/VaultDirectoryPickerOrchestrator";
import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator";
import { ObservabilityLive } from "@/runtime/Observability";
import { PgliteDrizzleLive } from "@/runtime/Pglite";
import { DmsMirrorAvailabilityDisconnectedLayer, DmsMirrorDisconnectedLayer } from "@/sync/DmsMirrorDisconnected";
import { VaultSyncHandlersLive } from "@/sync/VaultSyncOrchestrator";
import type { AgentTurnKernel } from "@beep/agents-use-cases/public";
import type { ThreadStoreUnavailable } from "@beep/workspace-use-cases/aggregates/Thread/server";
import type * as PlatformError from "effect/PlatformError";

/**
 * The fully-provided `ChatRpcs` handler layer that the sidecar serves. All of
 * the handler group's requirements
 * (`AgentTurnKernel | ThreadStore | UsageRecordSink`) are satisfied here, so the
 * remaining requirement is whatever rpc/http transport the sidecar adds on top.
 *
 * @example
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
const DesktopHandlersLive = Layer.mergeAll(
  ChatHandlersLive,
  WorkspaceVaultHandlersLive,
  DocumentIntakeHandlersLive,
  VaultDirectoryPickerHandlersLive,
  VaultSyncHandlersLive,
  OntologyHandlersLive
);

/**
 * Typed startup failures preserved by the desktop runtime.
 *
 * @example
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
 * @example
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
export type DesktopHandlersLayer = Layer.Layer<Layer.Success<typeof DesktopHandlersLive>, DesktopStartupError>;

/**
 * The `CHAT_AGENT` env flag: `anthropic` (default) selects the live layers,
 * `fixture` selects the deterministic keyless ones.
 *
 * @category layers
 * @since 0.0.0
 */
const chatAgentMode = Config.literals(["anthropic", "fixture"], "CHAT_AGENT").pipe(
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
    const model = yield* Config.nonEmptyString(FILING_DECISION_MODEL_ENV).pipe(
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

/**
 * Select the documents vault-sync engine layer. `CHAT_AGENT=fixture` keeps the
 * fully deterministic keyless engine (in-memory repos + fixture mirror);
 * otherwise the Drizzle-backed engine runs against the Box mirror when
 * `CLOUD_BOX_TOKEN` is configured, or against the app-local disconnected
 * mirror layers (typed `DmsMirrorUnavailable` + probe `connected: false`)
 * when it is not — the honest not-connected state while the Box test tenant
 * is not provisioned.
 *
 * @category layers
 * @since 0.0.0
 */
const DocumentsSyncLive = selectByChatAgent(
  DocumentsSyncFixtureLive,
  Effect.gen(function* () {
    const token = yield* Config.option(Config.redacted("CLOUD_BOX_TOKEN"));
    return O.match(token, {
      onNone: () =>
        DocumentsSyncDrizzleLive.pipe(
          Layer.provide([DmsMirrorDisconnectedLayer, DmsMirrorAvailabilityDisconnectedLayer])
        ),
      onSome: (boxToken) =>
        DocumentsSyncDrizzleLive.pipe(
          // The availability probe resolves the mirror root itself, so it needs
          // the Box driver and mirror config just like the mirror layer.
          Layer.provide([DmsMirrorBoxLive, DmsMirrorAvailabilityBoxLayer.pipe(Layer.provide(BoxMirrorConfigLayer))]),
          Layer.provide(Box.makeLayer(BoxDeveloperTokenConfig.make({ token: boxToken })))
        ),
    });
  })
);

/**
 * App-local live runtime Layer for chat and ontology sidecar handlers.
 *
 * @example
 * ```ts
 * import { RuntimeLive } from "@/runtime/Layer"
 *
 * console.log(RuntimeLive)
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
    UsageRecordSinkDrizzle,
    DocumentsFilingLive,
    DocumentsSyncLive,
    OntologyServerLive,
  ]),
  Layer.provide(PgliteDrizzleLive),
  Layer.provideMerge(BunServices.layer),
  Layer.provideMerge(ObservabilityLive)
);

/**
 * App-local fixture runtime Layer for smoke/dev chat and ontology handlers.
 *
 * @example
 * ```ts
 * import { RuntimeTest } from "@/runtime/Layer"
 *
 * console.log(RuntimeTest)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RuntimeTest: DesktopHandlersLayer = DesktopHandlersLive.pipe(
  Layer.provide([
    FixtureTurnKernel,
    Thread.ThreadStoreInMemoryLayer,
    Workspace.WorkspaceVaultStoreInMemoryLayer,
    UsageRecordSinkInMemory,
    DocumentsServerLive,
    DocumentsSyncFixtureLive,
    OntologyServerLive,
  ]),
  Layer.provideMerge(BunServices.layer)
);
