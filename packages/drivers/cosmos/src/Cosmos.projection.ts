/**
 * Typed-array graph projections and synthetic graph generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CosmosId } from "@beep/identity/packages";
import { Float32Arr } from "@beep/schema/Float32Array";
import { Number as N } from "effect";
import * as S from "effect/Schema";

const $I = $CosmosId.create("Cosmos.projection");

const Uint32Arr = S.instanceOf<globalThis.Uint32ArrayConstructor, globalThis.Uint32Array>(globalThis.Uint32Array).pipe(
  $I.annoteSchema("Uint32Arr", {
    description: "A schema that validates native Uint32Array instances for graph node identifiers.",
  })
);

/**
 * Typed-array projection consumed by the graph render adapters.
 *
 * **Example** (Make typed-array projection)
 *
 * ```ts
 * import { CosmosGraphProjection } from "@beep/cosmos"
 *
 * const projection = CosmosGraphProjection.make({
 *   nodeCount: 2,
 *   edgeCount: 1,
 *   nodeIds: new Uint32Array([0, 1]),
 *   pointPositions: new Float32Array([0, 0, 1, 1]),
 *   links: new Float32Array([0, 1])
 * })
 *
 * console.log(projection.nodeCount + projection.edgeCount)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class CosmosGraphProjection extends S.Class<CosmosGraphProjection>($I`CosmosGraphProjection`)(
  {
    nodeCount: S.Int,
    edgeCount: S.Int,
    nodeIds: Uint32Arr,
    pointPositions: Float32Arr,
    links: Float32Arr,
    // One label per point, in point order. cosmos.gl draws no text — it is a WebGL
    // point renderer — but it exposes the coordinate hooks to place text over the
    // canvas, which is how a label layer is built. Absent or empty means a bare
    // graph; a caller with more points than it wants to name simply sends fewer.
    labels: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("CosmosGraphProjection", {
    description: "Typed-array graph projection: node ids, point positions, source-target link pairs, and labels.",
  })
) {}

/**
 * Options for deterministic synthetic ontology graph generation.
 *
 * **Example** (Make synthetic graph options)
 *
 * ```ts
 * import { SyntheticOntologyGraphOptions } from "@beep/cosmos"
 *
 * const options = SyntheticOntologyGraphOptions.make({
 *   nodeCount: 500,
 *   edgeCount: 500,
 *   seed: 7
 * })
 *
 * console.log(options.nodeCount + options.edgeCount)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export class SyntheticOntologyGraphOptions extends S.Class<SyntheticOntologyGraphOptions>(
  $I`SyntheticOntologyGraphOptions`
)(
  {
    nodeCount: S.Int,
    edgeCount: S.Int,
    seed: S.Int,
  },
  $I.annote("SyntheticOntologyGraphOptions", {
    description: "Deterministic synthetic ontology graph generation options.",
  })
) {}

const nextSeed = (value: number): number => (value * 1_664_525 + 1_013_904_223) % 4_294_967_296;
const gridColumns = 512;
const positionScale = 3;

/**
 * Generates a deterministic typed-array ontology graph projection.
 *
 * **Example** (Generate synthetic ontology projection)
 *
 * ```ts
 * import { generateSyntheticOntologyProjection, SyntheticOntologyGraphOptions } from "@beep/cosmos"
 *
 * const projection = generateSyntheticOntologyProjection(
 *   SyntheticOntologyGraphOptions.make({ nodeCount: 10, edgeCount: 20, seed: 1 })
 * )
 *
 * console.log(projection.pointPositions.length)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const generateSyntheticOntologyProjection = (options: SyntheticOntologyGraphOptions): CosmosGraphProjection => {
  const nodeCount = N.max(options.nodeCount, 1);
  const edgeCount = N.max(options.edgeCount, 0);
  const nodeIds = new Uint32Array(nodeCount);
  const pointPositions = new Float32Array(nodeCount * 2);
  const links = new Float32Array(edgeCount * 2);
  // crispen: kept imperative to fill typed arrays without allocating intermediate arrays;
  // move to schema-derived collection combinators if the benchmark no longer requires this hot path.
  let nodeIndex = 0;

  while (nodeIndex < nodeCount) {
    const x = nodeIndex % gridColumns;
    const y = (nodeIndex - x) / gridColumns;
    const positionOffset = nodeIndex * 2;

    nodeIds[nodeIndex] = nodeIndex;
    pointPositions[positionOffset] = (x - gridColumns / 2) * positionScale;
    pointPositions[positionOffset + 1] = y * positionScale;
    nodeIndex += 1;
  }

  let edgeIndex = 0;
  let state = N.max(options.seed, 1);

  while (edgeIndex < edgeCount) {
    state = nextSeed(state);
    const source = edgeIndex % nodeCount;
    const targetOffset = nodeCount === 1 ? 0 : 1 + (state % (nodeCount - 1));
    const target = (source + targetOffset) % nodeCount;
    const linkOffset = edgeIndex * 2;

    links[linkOffset] = source;
    links[linkOffset + 1] = target;
    edgeIndex += 1;
  }

  return CosmosGraphProjection.make({
    nodeCount,
    edgeCount,
    nodeIds,
    pointPositions,
    links,
  });
};
