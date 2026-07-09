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
import { OntologyServerLive } from "@beep/ontology-server/layer";
import { Thread } from "@beep/workspace-server";
import { BunServices } from "@effect/platform-bun";
import { Config, Effect, Layer } from "effect";
import { ChatHandlersLive } from "@/chat/ChatOrchestrator";
import { UsageRecordSinkDrizzle, UsageRecordSinkInMemory } from "@/chat/UsageRecordSink";
import { OntologyHandlersLive } from "@/ontology/OntologyOrchestrator";
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
 * import type { DesktopHandlersLayer } from "@/runtime/Layer"
 * import type { RuntimeLive } from "@/runtime/Layer"
 *
 * type Check = typeof RuntimeLive extends DesktopHandlersLayer ? true : false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DesktopHandlersLayer = Layer.Layer<
  Layer.Success<typeof ChatHandlersLive> | Layer.Success<typeof OntologyHandlersLive>
>;

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

const ChatRuntimeLive = ChatHandlersLive.pipe(
  Layer.provide([TurnKernelLive, Thread.ThreadStoreDrizzleLayer, UsageRecordSinkDrizzle]),
  Layer.provide(PgliteDrizzleLive),
  Layer.provideMerge(ObservabilityLive)
);

const OntologyRuntimeLive = OntologyHandlersLive.pipe(
  Layer.provide(OntologyServerLive),
  Layer.provide(BunServices.layer),
  Layer.provideMerge(ObservabilityLive)
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
export const RuntimeLive: DesktopHandlersLayer = Layer.merge(ChatRuntimeLive, OntologyRuntimeLive);

const ChatRuntimeTest = ChatHandlersLive.pipe(
  Layer.provide([FixtureTurnKernel, Thread.ThreadStoreInMemoryLayer, UsageRecordSinkInMemory])
);

const OntologyRuntimeTest = OntologyHandlersLive.pipe(
  Layer.provide(OntologyServerLive),
  Layer.provide(BunServices.layer)
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
export const RuntimeTest: DesktopHandlersLayer = Layer.merge(ChatRuntimeTest, OntologyRuntimeTest);
