/**
 * Schema-backed RPC contract for the Cosmos projection worker.
 *
 * @packageDocumentation
 * @category protocols
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity";
import { OntologyGraphProjection } from "@beep/ontology-use-cases/aggregates/Session/worker";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";

const $I = $ProfessionalDesktopId.create("spikes/CosmosSpike.rpc");

const SyntheticProjectionNodeCount = S.Int.check(
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

const SyntheticProjectionCount = S.Int.check(
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
 * @example
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
    elementCount: SyntheticProjectionCount,
    projection: OntologyGraphProjection,
  },
  $I.annote("SyntheticProjectionResponse", {
    description: "Synthetic ontology graph projection returned across the worker RPC boundary.",
  })
) {}

/**
 * Builds a deterministic synthetic ontology graph projection in a browser worker.
 *
 * @example
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
 * @example
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

/** Decoded payload accepted by {@link ProjectSyntheticGraphRpc}. */
export type ProjectSyntheticGraphRequest = Rpc.Payload<typeof ProjectSyntheticGraphRpc>;
