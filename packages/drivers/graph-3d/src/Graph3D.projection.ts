/**
 * Typed-array 3D graph projections and deterministic synthetic graph generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $Graph3dId } from "@beep/identity/packages";
import { Float32Arr } from "@beep/schema/Float32Array";
import { Effect, Number as N, Order } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $Graph3dId.create("Graph3D.projection");

const Uint32Arr = S.instanceOf<globalThis.Uint32ArrayConstructor, globalThis.Uint32Array>(globalThis.Uint32Array).pipe(
  $I.annoteSchema("Uint32Arr", {
    description: "A schema that validates native Uint32Array instances for 3D graph node identifiers.",
  })
);

const Uint16Arr = S.instanceOf<globalThis.Uint16ArrayConstructor, globalThis.Uint16Array>(globalThis.Uint16Array).pipe(
  $I.annoteSchema("Uint16Arr", {
    description: "A schema that validates native Uint16Array instances for 3D graph community ordinals.",
  })
);

/**
 * Typed-array projection consumed by the 3D graph renderer.
 *
 * `pointPositions` stores interleaved xyz coordinates with stride 3. Community
 * ordinals are renderer palette inputs, while importance and weight channels
 * are normalized to the inclusive range from zero to one.
 *
 * @example
 * ```ts
 * import { Graph3DProjection } from "@beep/graph-3d"
 *
 * const projection = Graph3DProjection.make({
 *   nodeCount: 2,
 *   edgeCount: 1,
 *   nodeIds: new Uint32Array([0, 1]),
 *   pointPositions: new Float32Array([0, 0, 0, 1, 1, 1]),
 *   links: new Float32Array([0, 1]),
 *   nodeCommunities: new Uint16Array([0, 1]),
 *   nodeImportance: new Float32Array([1, 0.25]),
 *   edgeWeights: new Float32Array([1]),
 *   labels: ["pizza", "topping"]
 * })
 *
 * console.log(projection.pointPositions.length) // 6
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class Graph3DProjection extends S.Class<Graph3DProjection>($I`Graph3DProjection`)(
  {
    nodeCount: S.Int,
    edgeCount: S.Int,
    nodeIds: Uint32Arr,
    // Interleaved xyz coordinates in node order, with stride 3.
    pointPositions: Float32Arr,
    // Source/target node-index pairs in edge order, with stride 2.
    links: Float32Arr,
    // Stable community ordinal per node; the renderer maps ordinals into its 12-slot palette.
    nodeCommunities: Uint16Arr,
    // Normalized [0, 1] importance per node, used for node sizing and label priority.
    nodeImportance: Float32Arr,
    // Normalized [0, 1] weight per edge, used for ribbon width and per-edge alpha.
    edgeWeights: Float32Arr,
    labels: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("Graph3DProjection", {
    description:
      "Typed-array 3D graph projection with interleaved positions, indexed links, community ordinals, importance, weights, and optional labels.",
  })
) {
  /**
   * Buffer-coherence invariants for a projection: every typed array agrees
   * with the declared counts, link indices address real nodes, and no edge is
   * a self-loop (the reference's cubic self-loop variant is out of contract).
   *
   * Enforced by the renderer at mount and update as a trusted-boundary
   * precondition — `Schema.Class` attaches statics in-body because piping a
   * cross-field check would lose the constructor identity.
   *
   * @since 0.0.0
   */
  static readonly hasCoherentBuffers = (projection: Graph3DProjection): boolean =>
    hasCoherentBufferLengths(projection) && hasCoherentLinkIndices(projection);
}

const hasCoherentBufferLengths = (projection: Graph3DProjection): boolean =>
  projection.nodeIds.length === projection.nodeCount &&
  projection.pointPositions.length === projection.nodeCount * 3 &&
  projection.nodeCommunities.length === projection.nodeCount &&
  projection.nodeImportance.length === projection.nodeCount &&
  projection.links.length === projection.edgeCount * 2 &&
  projection.edgeWeights.length === projection.edgeCount &&
  (projection.labels === undefined || projection.labels.length === projection.nodeCount);

const isCoherentLinkPair = (source: number, target: number, nodeCount: number): boolean =>
  Number.isInteger(source) &&
  Number.isInteger(target) &&
  source >= 0 &&
  target >= 0 &&
  source < nodeCount &&
  target < nodeCount &&
  source !== target;

const hasCoherentLinkIndices = (projection: Graph3DProjection): boolean => {
  let edgeIndex = 0;

  while (edgeIndex < projection.edgeCount) {
    const source = projection.links[edgeIndex * 2] ?? Number.NaN;
    const target = projection.links[edgeIndex * 2 + 1] ?? Number.NaN;

    if (!isCoherentLinkPair(source, target, projection.nodeCount)) {
      return false;
    }

    edgeIndex += 1;
  }

  return true;
};

/**
 * Options for deterministic synthetic 3D graph generation.
 *
 * Every field has a constructor default, so an empty input produces the
 * standard 2,500-node, 5,000-edge fixture used by renderer examples.
 *
 * @example
 * ```ts
 * import { SyntheticGraph3DOptions } from "@beep/graph-3d"
 *
 * const options = SyntheticGraph3DOptions.make({})
 *
 * console.log(options.nodeCount) // 2500
 * console.log(options.communityCount) // 8
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export class SyntheticGraph3DOptions extends S.Class<SyntheticGraph3DOptions>($I`SyntheticGraph3DOptions`)(
  {
    nodeCount: S.Int.pipe(S.withConstructorDefault(Effect.succeed(2_500))),
    edgeCount: S.Int.pipe(S.withConstructorDefault(Effect.succeed(5_000))),
    communityCount: S.Int.pipe(S.withConstructorDefault(Effect.succeed(8))),
    seed: S.Int.pipe(S.withConstructorDefault(Effect.succeed(1_337))),
  },
  $I.annote("SyntheticGraph3DOptions", {
    description: "Defaulted options for deterministic synthetic 3D graph generation.",
  })
) {}

const sphereRadius = 260;
const scatterSigma = 95;
const goldenAngle = Math.PI * (1 + Math.sqrt(5));
const syllables = ["ka", "lo", "mi", "ra", "ve", "tu", "so", "ne", "pi", "da", "fu", "ge", "ba", "chi", "or", "ex"];

const makeRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/**
 * Generates a deterministic, community-clustered 3D graph projection.
 *
 * Positions use golden-angle sphere centers plus Gaussian scatter. Importance
 * and edge weights are normalized after generation, and endpoint sampling is
 * biased toward nodes with greater generated importance.
 *
 * @example
 * ```ts
 * import { generateSyntheticGraph3DProjection, SyntheticGraph3DOptions } from "@beep/graph-3d"
 *
 * const projection = generateSyntheticGraph3DProjection(
 *   SyntheticGraph3DOptions.make({ nodeCount: 10, edgeCount: 20, communityCount: 2, seed: 7 })
 * )
 *
 * console.log(projection.pointPositions.length) // 30
 * console.log(projection.edgeWeights.length) // 20
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const generateSyntheticGraph3DProjection = (options: SyntheticGraph3DOptions): Graph3DProjection => {
  const nodeCount = N.max(options.nodeCount, 1);
  const requestedEdgeCount = N.max(options.edgeCount, 0);
  const edgeCount = nodeCount === 1 ? 0 : requestedEdgeCount;
  const communityCount = N.min(N.max(options.communityCount, 1), nodeCount);
  const random = makeRandom(options.seed);
  const gaussian = (): number => {
    const magnitude = Math.sqrt(-2 * Math.log(N.max(random(), 1e-9)));
    return magnitude * Math.cos(2 * Math.PI * random());
  };
  const pseudoWord = (): string => {
    const syllableCount = 2 + Math.floor(random() * 3);
    let word = "";
    let syllableIndex = 0;

    while (syllableIndex < syllableCount) {
      word += A.getUnsafe(syllables, Math.floor(random() * syllables.length));
      syllableIndex += 1;
    }

    return word;
  };

  const nodeIds = new Uint32Array(nodeCount);
  const pointPositions = new Float32Array(nodeCount * 3);
  const links = new Float32Array(edgeCount * 2);
  const nodeCommunities = new Uint16Array(nodeCount);
  const nodeImportance = new Float32Array(nodeCount);
  const edgeWeights = new Float32Array(edgeCount);
  const labels = A.makeBy(nodeCount, () => "");
  const centers = new Float32Array(communityCount * 3);
  const communityPools = A.makeBy(communityCount, (): Array<number> => []);

  let communityIndex = 0;

  while (communityIndex < communityCount) {
    const phi = Math.acos(1 - (2 * (communityIndex + 0.5)) / communityCount);
    const theta = goldenAngle * communityIndex;
    const centerOffset = communityIndex * 3;
    centers[centerOffset] = sphereRadius * Math.sin(phi) * Math.cos(theta);
    centers[centerOffset + 1] = sphereRadius * Math.sin(phi) * Math.sin(theta);
    centers[centerOffset + 2] = sphereRadius * Math.cos(phi);
    communityIndex += 1;
  }

  let maxImportance = 0;
  let nodeIndex = 0;

  // Imperative typed-array fills keep the fixture generator suitable for renderer hot paths.
  while (nodeIndex < nodeCount) {
    const community = nodeIndex < communityCount ? nodeIndex : Math.floor(random() * communityCount);
    const centerOffset = community * 3;
    const positionOffset = nodeIndex * 3;
    const importance = random() ** 8 * 0.4;

    nodeIds[nodeIndex] = nodeIndex;
    nodeCommunities[nodeIndex] = community;
    pointPositions[positionOffset] = centers[centerOffset] + gaussian() * scatterSigma;
    pointPositions[positionOffset + 1] = centers[centerOffset + 1] + gaussian() * scatterSigma;
    pointPositions[positionOffset + 2] = centers[centerOffset + 2] + gaussian() * scatterSigma;
    nodeImportance[nodeIndex] = importance;
    maxImportance = N.max(maxImportance, importance);
    labels[nodeIndex] = pseudoWord();
    A.getUnsafe(communityPools, community).push(nodeIndex);
    nodeIndex += 1;
  }

  const importanceDenominator = N.max(maxImportance, 1e-12);
  nodeIndex = 0;

  while (nodeIndex < nodeCount) {
    nodeImportance[nodeIndex] /= importanceDenominator;
    nodeIndex += 1;
  }

  const byImportanceDescending = Order.mapInput(Order.Number, (index: number) => -nodeImportance[index]);
  const rankedNodes = A.sort(nodeIds, byImportanceDescending);
  communityIndex = 0;

  while (communityIndex < communityCount) {
    communityPools[communityIndex] = A.sort(A.getUnsafe(communityPools, communityIndex), byImportanceDescending);
    communityIndex += 1;
  }

  const pickBiased = (pool: ReadonlyArray<number>): number =>
    A.getUnsafe(pool, Math.floor(random() ** 2 * pool.length));
  let maxEdgeWeight = 0;
  let edgeIndex = 0;

  while (edgeIndex < edgeCount) {
    const source = pickBiased(rankedNodes);
    const sourceCommunity = nodeCommunities[source];
    const intraCommunity = random() < 0.7 || communityCount === 1;
    const targetCommunity = intraCommunity
      ? sourceCommunity
      : (sourceCommunity + 1 + Math.floor(random() * (communityCount - 1))) % communityCount;
    let target = pickBiased(A.getUnsafe(communityPools, targetCommunity));

    if (source === target) {
      target = (target + 1) % nodeCount;
    }

    const linkOffset = edgeIndex * 2;
    const weight = 1 + random() ** 3 * 9;
    links[linkOffset] = source;
    links[linkOffset + 1] = target;
    edgeWeights[edgeIndex] = weight;
    maxEdgeWeight = N.max(maxEdgeWeight, weight);
    edgeIndex += 1;
  }

  edgeIndex = 0;

  while (edgeIndex < edgeCount) {
    edgeWeights[edgeIndex] /= maxEdgeWeight;
    edgeIndex += 1;
  }

  return Graph3DProjection.make({
    nodeCount,
    edgeCount,
    nodeIds,
    pointPositions,
    links,
    nodeCommunities,
    nodeImportance,
    edgeWeights,
    labels,
  });
};
