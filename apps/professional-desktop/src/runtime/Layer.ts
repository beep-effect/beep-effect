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
 * three requirements to `never`, so the sidecar only has to add the rpc/http
 * transport on top.
 *
 * A {@link RuntimeTest} variant (fixture kernel + in-memory store + in-memory
 * sink, no database, no key) is provided for smoke/dev.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicTurnKernel } from "@beep/agents-server/AnthropicTurnKernel";
import { FixtureTurnKernel } from "@beep/agents-use-cases/proof";
import { DocumentsServerLive } from "@beep/documents-server/layer";
import { Thread, Workspace } from "@beep/workspace-server";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { Config, Effect, Layer } from "effect";
import { ChatHandlersLive } from "@/chat/ChatOrchestrator";
import { UsageRecordSinkDrizzle, UsageRecordSinkInMemory } from "@/chat/UsageRecordSink";
import { DocumentIntakeHandlersLive, WorkspaceVaultHandlersLive } from "@/intake/DocumentIntakeOrchestrator";
import { ObservabilityLive } from "@/runtime/Observability";
import { PgliteDrizzleLive } from "@/runtime/Pglite";
import type { AgentTurnKernel } from "@beep/agents-use-cases/public";

/**
 * The fully-provided `ChatRpcs` handler layer that the sidecar serves. All of
 * the handler group's requirements
 * (`AgentTurnKernel | ThreadStore | UsageRecordSink`) are satisfied here, so the
 * remaining requirement is whatever rpc/http transport the sidecar adds on top.
 *
 * @example
 * ```ts
 * import type { ChatHandlersLayer } from "@/runtime/Layer"
 * import type { RuntimeLive } from "@/runtime/Layer"
 *
 * type Check = typeof RuntimeLive extends ChatHandlersLayer ? true : false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const DesktopHandlersLive = Layer.mergeAll(ChatHandlersLive, WorkspaceVaultHandlersLive, DocumentIntakeHandlersLive);

/**
 * Type of the fully-provided RPC handler layer served by the desktop sidecar.
 *
 * @example
 * ```ts
 * import type { ChatHandlersLayer } from "@/runtime/Layer"
 * import { RuntimeLive } from "@/runtime/Layer"
 *
 * type RuntimeProvidesHandlers = typeof RuntimeLive extends ChatHandlersLayer ? true : false
 * const runtimeProvidesHandlers: RuntimeProvidesHandlers = true
 * console.log(runtimeProvidesHandlers)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ChatHandlersLayer = Layer.Layer<Layer.Success<typeof DesktopHandlersLive>>;

/**
 * Select the assistant-turn kernel from the `CHAT_AGENT` env flag. `anthropic`
 * (default) uses the live {@link AnthropicTurnKernel} (resolves
 * `AI_ANTHROPIC_API_KEY` itself); `fixture` uses the deterministic keyless
 * {@link FixtureTurnKernel}. Both are self-contained `Layer<AgentTurnKernel>`.
 *
 * @category layers
 * @since 0.0.0
 */
const TurnKernelLive: Layer.Layer<AgentTurnKernel> = Layer.unwrap(
  Effect.gen(function* () {
    const agent = yield* Config.literals(["anthropic", "fixture"], "CHAT_AGENT").pipe(
      Config.withDefault("anthropic" as const)
    );
    return agent === "fixture" ? FixtureTurnKernel : AnthropicTurnKernel;
  }).pipe(Effect.orDie)
);

/**
 * App-local live runtime Layer: the fully-provided `ChatRpcs` handler group
 * backed by the live assistant-turn kernel, the Drizzle ThreadStore, and the
 * Drizzle usage-record sink — all over one shared PGlite-backed
 * {@link PgliteDrizzleLive} database, with env-gated observability merged in.
 *
 * This is the thing the sidecar launches; its only remaining requirement is the
 * rpc/http transport the sidecar provides on top.
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
export const RuntimeLive: ChatHandlersLayer = DesktopHandlersLive.pipe(
  Layer.provide([
    TurnKernelLive,
    Thread.ThreadStoreDrizzleLayer,
    Workspace.WorkspaceVaultStoreDrizzleLayer,
    UsageRecordSinkDrizzle,
    DocumentsServerLive,
  ]),
  Layer.provide(PgliteDrizzleLive),
  Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)),
  Layer.provideMerge(ObservabilityLive)
);

/**
 * App-local fixture runtime Layer for smoke/dev: the deterministic keyless
 * {@link FixtureTurnKernel}, the in-memory ThreadStore, and the in-memory
 * usage-record sink — no database, no API key, no external dependency. Mirrors
 * the wiring exercised by the app-level chat contract test.
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
export const RuntimeTest: ChatHandlersLayer = DesktopHandlersLive.pipe(
  Layer.provide([
    FixtureTurnKernel,
    Thread.ThreadStoreInMemoryLayer,
    Workspace.WorkspaceVaultStoreInMemoryLayer,
    UsageRecordSinkInMemory,
    DocumentsServerLive,
  ]),
  Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))
);
