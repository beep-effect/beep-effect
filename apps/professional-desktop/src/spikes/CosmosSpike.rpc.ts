/**
 * Schema-backed RPC contract for the Cosmos projection worker.
 *
 * @packageDocumentation
 * @category protocols
 * @since 0.0.0
 */
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { Session } from "@beep/ontology-use-cases/worker";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";

const $I = $ProfessionalDesktopId.create("spikes/CosmosSpike.rpc");

/**
 * Positive node or element count accepted by the synthetic projection spike.
 *
 * **Example** (Schema validation of positive count)
 *
 * ```ts
 * import { SyntheticProjectionNodeCount } from "@/spikes/CosmosSpike.rpc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SyntheticProjectionNodeCount)(1)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SyntheticProjectionNodeCount = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`SyntheticProjectionNodeCountCheck`,
    title: "Synthetic projection node count",
    description: "A synthetic projection needs at least one node.",
    message: "Expected at least one synthetic projection node",
  })
).pipe(
  $I.annoteSchema("SyntheticProjectionNodeCount", {
    description: "Positive node count accepted by the synthetic projection worker.",
  })
);

/**
 * Runtime type for a positive synthetic projection node or element count.
 *
 * **Example** (Constructing branded node count)
 *
 * ```ts
 * import { SyntheticProjectionNodeCount } from "@/spikes/CosmosSpike.rpc"
 *
 * const count: SyntheticProjectionNodeCount = SyntheticProjectionNodeCount.make(1)
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SyntheticProjectionNodeCount = typeof SyntheticProjectionNodeCount.Type;

/**
 * Non-negative edge or aggregate count accepted by the synthetic projection spike.
 *
 * **Example** (Schema validation of zero count)
 *
 * ```ts
 * import { SyntheticProjectionCount } from "@/spikes/CosmosSpike.rpc"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SyntheticProjectionCount)(0)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SyntheticProjectionCount = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`SyntheticProjectionCountCheck`,
    title: "Synthetic projection count",
    description: "Synthetic projection counts cannot be negative.",
    message: "Expected a non-negative synthetic projection count",
  })
).pipe(
  $I.annoteSchema("SyntheticProjectionCount", {
    description: "Non-negative element or edge count used by the synthetic projection worker.",
  })
);

/**
 * Runtime type for a non-negative synthetic projection edge or aggregate count.
 *
 * **Example** (Constructing branded zero count)
 *
 * ```ts
 * import { SyntheticProjectionCount } from "@/spikes/CosmosSpike.rpc"
 *
 * const count: SyntheticProjectionCount = SyntheticProjectionCount.make(0)
 * console.log(count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SyntheticProjectionCount = typeof SyntheticProjectionCount.Type;

const SyntheticProjectionSeed = SyntheticProjectionCount.pipe(
  S.withConstructorDefault(Effect.succeed(97)),
  S.withDecodingDefaultKey(Effect.succeed(97)),
  $I.annoteSchema("SyntheticProjectionSeed", {
    description: "Deterministic synthetic graph seed defaulting to 97 at construction and decoding boundaries.",
  })
);

/**
 * Response returned by the synthetic projection worker.
 *
 * **Example** (Accessing response schema fields)
 *
 * ```ts
 * import { SyntheticProjectionResponse } from "@/spikes/CosmosSpike.rpc"
 *
 * console.log(SyntheticProjectionResponse.fields.elementCount)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class SyntheticProjectionResponse extends S.Class<SyntheticProjectionResponse>($I`SyntheticProjectionResponse`)(
  {
    elementCount: SyntheticProjectionNodeCount,
    projection: Session.OntologyGraphProjection,
  },
  $I.annote("SyntheticProjectionResponse", {
    description: "Synthetic ontology graph projection returned across the worker RPC boundary.",
  })
) {}

/**
 * Builds a deterministic synthetic ontology graph projection in a browser worker.
 *
 * **Example** (Inspecting RPC protocol tag)
 *
 * ```ts
 * import { ProjectSyntheticGraphRpc } from "@/spikes/CosmosSpike.rpc"
 *
 * console.log(ProjectSyntheticGraphRpc._tag)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
const ProjectSyntheticGraphRpc = Rpc.make("ProjectSyntheticGraph", {
  payload: {
    edgeCount: SyntheticProjectionCount,
    nodeCount: SyntheticProjectionNodeCount,
    seed: SyntheticProjectionSeed,
  },
  success: SyntheticProjectionResponse,
});

/**
 * RPC group served by the Cosmos projection worker.
 *
 * **Example** (Checking registered RPC request)
 *
 * ```ts
 * import { CosmosSpikeRpcs } from "@/spikes/CosmosSpike.rpc"
 *
 * console.log(CosmosSpikeRpcs.requests.has("ProjectSyntheticGraph"))
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const CosmosSpikeRpcs = RpcGroup.make(ProjectSyntheticGraphRpc);

/**
 * Decoded payload accepted by {@link ProjectSyntheticGraphRpc}.
 *
 * **Example** (Satisfying request payload type)
 *
 * ```ts
 * import type { ProjectSyntheticGraphRequest } from "@/spikes/CosmosSpike.rpc"
 *
 * const request = { edgeCount: 24, nodeCount: 12, seed: 97 } satisfies ProjectSyntheticGraphRequest
 * console.log(request.nodeCount) // 12
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type ProjectSyntheticGraphRequest = Rpc.Payload<typeof ProjectSyntheticGraphRpc>;
