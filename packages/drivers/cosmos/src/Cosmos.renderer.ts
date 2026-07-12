/**
 * Lazy graph render adapters for cosmos.gl and sigma.js.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="./vendor.d.ts" />

import { $CosmosId } from "@beep/identity/packages";
import { HexColor, SchemaUtils } from "@beep/schema";
import { P } from "@beep/utils";
import { Duration, Effect, Match } from "effect";
import * as S from "effect/Schema";
import { probeWebGl2, selectCosmosBackend } from "./Cosmos.backend.js";
import { CosmosDriverError } from "./Cosmos.errors.js";
import type { CosmosBackend } from "./Cosmos.backend.js";
import type { CosmosGraphProjection } from "./Cosmos.projection.js";

const $I = $CosmosId.create("Cosmos.renderer");

class CosmosGraphConfig extends S.Class<CosmosGraphConfig>($I`CosmosGraphConfig`)(
  {
    enableDrag: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    enableSimulation: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    fitViewDelay: S.Finite.pipe(SchemaUtils.withKeyDefaults(100)),
    fitViewOnInit: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    fitViewPadding: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.15)),
    linkBlending: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    simulationFriction: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.15)),
    simulationGravity: S.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
    simulationRepulsion: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.45)),
    transitionDuration: S.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
  },
  $I.annote("CosmosGraphConfig", {
    description: "Stable cosmos.gl simulation and viewport defaults used for each mounted graph renderer.",
  })
) {}

type CosmosGraphInstance = {
  readonly destroy?: () => void;
  readonly render: () => void;
  readonly setLinks: (links: Float32Array) => void;
  readonly setPointPositions: (positions: Float32Array) => void;
  readonly stop?: () => void;
};

type CosmosGraphConstructor = new (container: HTMLElement, config: CosmosGraphConfig) => CosmosGraphInstance;

type CosmosGraphModule = {
  readonly Graph: CosmosGraphConstructor;
};

class GraphologyOptions extends S.Class<GraphologyOptions>($I`GraphologyOptions`)(
  {
    multi: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    type: S.tag("directed"),
  },
  $I.annote("GraphologyOptions", {
    description: "Directed multi-graph options required by the sigma.js fallback adapter.",
  })
) {}

class EdgeAttributes extends S.Class<EdgeAttributes>($I`EdgeAttributes`)(
  {
    color: HexColor.pipe(SchemaUtils.withKeyDefaults(HexColor.make("#94a3b8"))),
    size: S.Finite.pipe(SchemaUtils.withKeyDefaults(1)),
  },
  $I.annote("EdgeAttributes", {
    description: "Default visual attributes assigned to graphology edges rendered by sigma.js.",
  })
) {}

class NodeAttributes extends S.Class<NodeAttributes>($I`NodeAttributes`)(
  {
    color: HexColor.pipe(SchemaUtils.withKeyDefaults(HexColor.make("#38bdf8"))),
    label: S.NonEmptyString,
    size: S.Finite.pipe(SchemaUtils.withKeyDefaults(2)),
    x: S.Finite,
    y: S.Finite,
  },
  $I.annote("NodeAttributes", {
    description: "Position, label, and default visual attributes for a sigma.js graph node.",
  })
) {}

type GraphologyGraph = {
  readonly addDirectedEdgeWithKey: (key: string, source: string, target: string, attributes: EdgeAttributes) => void;
  readonly addNode: (key: string, attributes: NodeAttributes) => void;
  readonly clear: () => void;
};

type GraphologyConstructor = new (options: GraphologyOptions) => GraphologyGraph;

type GraphologyModule = {
  readonly default: GraphologyConstructor;
};

type SigmaInstance = {
  readonly kill?: undefined | (() => void);
  readonly refresh?: undefined | (() => void);
};

type SigmaConstructor = new (graph: GraphologyGraph, container: HTMLElement) => SigmaInstance;

type SigmaModule = {
  readonly default: SigmaConstructor;
};

type FpsSampler = {
  readonly fps: () => number;
  readonly stop: () => void;
};

const fpsSampleWindow = Duration.millis(500).pipe(Duration.toMillis);

const isCosmosGraphModule = (value: unknown): value is CosmosGraphModule =>
  P.isObject(value) && P.hasProperty(value, "Graph") && P.isFunction(value.Graph);

const isGraphologyModule = (value: unknown): value is GraphologyModule =>
  P.isObject(value) && P.hasProperty(value, "default") && P.isFunction(value.default);

const isSigmaModule = (value: unknown): value is SigmaModule =>
  P.isObject(value) && P.hasProperty(value, "default") && P.isFunction(value.default);

const loadCosmosGraphModule = Effect.tryPromise({
  try: () => import("@cosmos.gl/graph"),
  catch: CosmosDriverError.fromUnknown("importFailed")("Failed to import @cosmos.gl/graph."),
}).pipe(
  Effect.filterOrFail(isCosmosGraphModule, () => CosmosDriverError.adapterInvariant("Invalid cosmos.gl module."))
);

const loadGraphologyModule = Effect.tryPromise({
  try: () => import("graphology"),
  catch: CosmosDriverError.fromUnknown("importFailed")("Failed to import graphology."),
}).pipe(
  Effect.filterOrFail(isGraphologyModule, () => CosmosDriverError.adapterInvariant("Invalid graphology module."))
);

const loadSigmaModule = Effect.tryPromise({
  try: () => import("sigma"),
  catch: CosmosDriverError.fromUnknown("importFailed")("Failed to import sigma."),
}).pipe(Effect.filterOrFail(isSigmaModule, () => CosmosDriverError.adapterInvariant("Invalid sigma module.")));

const makeFpsSampler = (): FpsSampler => {
  if (!P.isFunction(globalThis.requestAnimationFrame)) {
    return {
      fps: () => 0,
      stop: () => undefined,
    };
  }

  // crispen: mutable counters are requestAnimationFrame callback state; move them
  // into Effect Ref only if this sampler becomes an Effect-owned scoped resource.
  let active = true;
  let currentFps = 0;
  let frames = 0;
  let lastTime = 0;
  let frameId = 0;

  const tick = (time: number): void => {
    if (lastTime === 0) {
      lastTime = time;
    }
    frames += 1;
    if (time - lastTime >= fpsSampleWindow) {
      currentFps = (frames * 1_000) / (time - lastTime);
      frames = 0;
      lastTime = time;
    }
    if (active) {
      frameId = globalThis.requestAnimationFrame(tick);
    }
  };

  frameId = globalThis.requestAnimationFrame(tick);

  return {
    fps: () => currentFps,
    stop: () => {
      active = false;
      if (P.isFunction(globalThis.cancelAnimationFrame)) {
        globalThis.cancelAnimationFrame(frameId);
      }
    },
  };
};

/**
 * Mounted graph renderer handle.
 *
 * @example
 * ```ts
 * import { type CosmosRenderHandle } from "@beep/cosmos"
 *
 * const handle: CosmosRenderHandle = {
 *   backend: "sigma",
 *   fps: () => 0,
 *   update: () => undefined,
 *   destroy: () => undefined
 * }
 *
 * console.log(handle.backend)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export interface CosmosRenderHandle {
  readonly backend: CosmosBackend;
  readonly destroy: () => void;
  readonly fps: () => number;
  readonly update: (projection: CosmosGraphProjection) => void;
}

const renderWithCosmos = Effect.fn("Cosmos.renderWithCosmos")(function* (
  container: HTMLElement,
  projection: CosmosGraphProjection
) {
  const module = yield* loadCosmosGraphModule;
  const graph = yield* Effect.try({
    try: () => new module.Graph(container, CosmosGraphConfig.make()),
    catch: CosmosDriverError.fromUnknown("renderFailed")("Failed to construct cosmos.gl graph."),
  });

  yield* Effect.try({
    try: () => {
      graph.setPointPositions(projection.pointPositions);
      graph.setLinks(projection.links);
      graph.render();
    },
    catch: CosmosDriverError.fromUnknown("renderFailed")("Failed to render cosmos.gl graph."),
  });

  const sampler = makeFpsSampler();

  return {
    backend: "cosmos",
    fps: sampler.fps,
    update: (nextProjection) => {
      graph.setPointPositions(nextProjection.pointPositions);
      graph.setLinks(nextProjection.links);
      graph.render();
    },
    destroy: () => {
      sampler.stop();
      if (P.isFunction(graph.stop)) {
        graph.stop();
      }
      if (P.isFunction(graph.destroy)) {
        graph.destroy();
      }
    },
  } satisfies CosmosRenderHandle;
});

const renderWithSigma = Effect.fn("Cosmos.renderWithSigma")(function* (
  container: HTMLElement,
  projection: CosmosGraphProjection
) {
  const graphology = yield* loadGraphologyModule;
  const sigma = yield* loadSigmaModule;
  const graph = new graphology.default(GraphologyOptions.make());
  const populateGraph = (nextProjection: CosmosGraphProjection): void => {
    // crispen: graphology exposes a mutating adapter API and these loops avoid
    // allocating index arrays on the 100k-node benchmark path; keep explicit.
    let nodeIndex = 0;

    while (nodeIndex < nextProjection.nodeCount) {
      const positionOffset = nodeIndex * 2;
      const nodeId = `n${nextProjection.nodeIds[nodeIndex]}`;

      graph.addNode(
        nodeId,
        NodeAttributes.make({
          x: nextProjection.pointPositions[positionOffset],
          y: nextProjection.pointPositions[positionOffset + 1],
          label: nodeId,
        })
      );
      nodeIndex += 1;
    }

    let edgeIndex = 0;

    while (edgeIndex < nextProjection.edgeCount) {
      const linkOffset = edgeIndex * 2;
      const sourceIndex = nextProjection.links[linkOffset] % nextProjection.nodeCount;
      const targetIndex = nextProjection.links[linkOffset + 1] % nextProjection.nodeCount;

      graph.addDirectedEdgeWithKey(
        `e${edgeIndex}`,
        `n${nextProjection.nodeIds[sourceIndex]}`,
        `n${nextProjection.nodeIds[targetIndex]}`,
        EdgeAttributes.make()
      );
      edgeIndex += 1;
    }
  };

  populateGraph(projection);

  const renderer = yield* Effect.try({
    try: () => new sigma.default(graph, container),
    catch: CosmosDriverError.fromUnknown("renderFailed")("Failed to construct sigma graph."),
  });

  if (P.isFunction(renderer.refresh)) {
    renderer.refresh();
  }

  const sampler = makeFpsSampler();

  return {
    backend: "sigma",
    fps: sampler.fps,
    update: (nextProjection) => {
      graph.clear();
      populateGraph(nextProjection);
      if (P.isFunction(renderer.refresh)) {
        renderer.refresh();
      }
    },
    destroy: () => {
      sampler.stop();
      if (P.isFunction(renderer.kill)) {
        renderer.kill();
      }
    },
  } satisfies CosmosRenderHandle;
});

/**
 * Renders a graph projection with the selected runtime backend.
 *
 * @remarks
 * The returned handle owns a frame sampler and renderer resources. Call
 * `destroy` when the host unmounts the graph.
 *
 * @example
 * ```ts
 * import { CosmosGraphProjection, renderCosmosGraph } from "@beep/cosmos"
 * import { Effect } from "effect"
 *
 * const projection = CosmosGraphProjection.make({
 *   nodeCount: 1,
 *   edgeCount: 0,
 *   nodeIds: new Uint32Array([0]),
 *   pointPositions: new Float32Array([0, 0]),
 *   links: new Float32Array()
 * })
 * const backend = renderCosmosGraph(document.createElement("div"), projection).pipe(
 *   Effect.map((handle) => handle.backend)
 * )
 *
 * console.log(backend)
 * ```
 *
 * @effects Mounts a browser graph renderer and starts a request-animation-frame sampler.
 *
 * @category adapters
 * @since 0.0.0
 */
export const renderCosmosGraph = Effect.fn("Cosmos.renderCosmosGraph")(function* (
  container: HTMLElement,
  projection: CosmosGraphProjection
) {
  const selection = selectCosmosBackend(probeWebGl2());

  return yield* Match.type<CosmosBackend>().pipe(
    Match.withReturnType<Effect.Effect<CosmosRenderHandle, CosmosDriverError>>(),
    Match.when("cosmos", () => renderWithCosmos(container, projection)),
    Match.orElse(() => renderWithSigma(container, projection))
  )(selection.backend);
});
