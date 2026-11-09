/**
 * Observation log contract: records who observed a node and counts distinct
 * lineages for consolidation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { ObservationError } from "./AgentMemoryStore.errors.ts";
import type { NodeId } from "./NodeIdentity.models.ts";
import type { ObservationEvent } from "./Observation.events.ts";

const $I = $AgentMemoryStoreId.create("ObservationLog.service");

/**
 * Append-only observation log.
 *
 * **Details**
 *
 * Ruling 3: prevalence never ranks or gates. Only consolidation may call
 * `distinctLineageCount`; retrieval rank and the admissibility gate must not
 * depend on this service.
 *
 * - `observe` appends one observation.
 * - `distinctLineageCount` returns how many distinct lineages observed a node.
 *
 * **Example** (Count distinct lineages)
 *
 * ```ts
 * import { NodeId, ObservationLog } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const observations = yield* ObservationLog
 *   return yield* observations.distinctLineageCount(NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"))
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ObservationLog extends Context.Service<
  ObservationLog,
  {
    readonly observe: (event: ObservationEvent) => Effect.Effect<void, ObservationError>;
    readonly distinctLineageCount: (nodeId: NodeId) => Effect.Effect<number, ObservationError>;
  }
>()($I`ObservationLog`) {}
