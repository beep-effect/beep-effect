/**
 * Lazy graph render adapters for cosmos.gl and sigma.js.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="./vendor.d.ts" />

import { P } from "@beep/utils";
import { Effect, Match } from "effect";
import { probeWebGl2, selectCosmosBackend } from "./Cosmos.backend.js";
import { CosmosDriverError } from "./Cosmos.errors.js";
import type { CosmosBackend } from "./Cosmos.backend.js";
import type { CosmosDriverErrorReason } from "./Cosmos.errors.js";
import type { CosmosGraphProjection } from "./Cosmos.projection.js";

type CosmosGraphConfig = {
  readonly enableDrag: boolean;
  readonly enableSimulation: boolean;
  readonly fitViewDelay: number;
  readonly fitViewOnInit: boolean;
  readonly fitViewPadding: number;
  readonly linkBlending: boolean;
  readonly simulationFriction: number;
  readonly simulationGravity: number;
  readonly simulationRepulsion: number;
  readonly transitionDuration: number;
};

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

type GraphologyOptions = {
  readonly multi: boolean;
  readonly type: "directed";
};

type GraphologyGraph = {
  readonly addDirectedEdgeWithKey: (
    key: string,
    source: string,
    target: string,
    attributes: { readonly color: string; readonly size: number }
  ) => void;
  readonly addNode: (
    key: string,
    attributes: {
      readonly color: string;
      readonly label: string;
      readonly size: number;
      readonly x: number;
      readonly y: number;
    }
  ) => void;
  readonly clear: () => void;
};

type GraphologyConstructor = new (options: GraphologyOptions) => GraphologyGraph;

type GraphologyModule = {
  readonly default: GraphologyConstructor;
};

type SigmaInstance = {
  readonly kill?: () => void;
  readonly refresh?: () => void;
};

type SigmaConstructor = new (graph: GraphologyGraph, container: HTMLElement) => SigmaInstance;

type SigmaModule = {
  readonly default: SigmaConstructor;
};

type FpsSampler = {
  readonly fps: () => number;
  readonly stop: () => void;
};

const cosmosConfig: CosmosGraphConfig = {
  enableDrag: true,
  enableSimulation: true,
  fitViewDelay: 100,
  fitViewOnInit: true,
  fitViewPadding: 0.15,
  linkBlending: false,
  simulationFriction: 0.15,
  simulationGravity: 0,
  simulationRepulsion: 0.45,
  transitionDuration: 0,
};

const unknownMessage = (cause: unknown, fallback: string): string =>
  P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : fallback;

const driverError =
  (reason: CosmosDriverErrorReason, fallback: string) =>
  (cause: unknown): CosmosDriverError =>
    CosmosDriverError.make({
      reason,
      message: unknownMessage(cause, fallback),
    });

const adapterInvariant = (message: string): CosmosDriverError =>
  CosmosDriverError.make({
    reason: "adapterInvariant",
    message,
  });

const isCosmosGraphModule = (value: unknown): value is CosmosGraphModule =>
  P.isObject(value) && P.hasProperty(value, "Graph") && P.isFunction(value.Graph);

const isGraphologyModule = (value: unknown): value is GraphologyModule =>
  P.isObject(value) && P.hasProperty(value, "default") && P.isFunction(value.default);

const isSigmaModule = (value: unknown): value is SigmaModule =>
  P.isObject(value) && P.hasProperty(value, "default") && P.isFunction(value.default);

const loadCosmosGraphModule = Effect.tryPromise({
  try: () => import("@cosmos.gl/graph"),
  catch: driverError("importFailed", "Failed to import @cosmos.gl/graph."),
}).pipe(
  Effect.flatMap((module) =>
    isCosmosGraphModule(module) ? Effect.succeed(module) : Effect.fail(adapterInvariant("Invalid cosmos.gl module."))
  )
);

const loadGraphologyModule = Effect.tryPromise({
  try: () => import("graphology"),
  catch: driverError("importFailed", "Failed to import graphology."),
}).pipe(
  Effect.flatMap((module) =>
    isGraphologyModule(module) ? Effect.succeed(module) : Effect.fail(adapterInvariant("Invalid graphology module."))
  )
);

const loadSigmaModule = Effect.tryPromise({
  try: () => import("sigma"),
  catch: driverError("importFailed", "Failed to import sigma."),
}).pipe(
  Effect.flatMap((module) =>
    isSigmaModule(module) ? Effect.succeed(module) : Effect.fail(adapterInvariant("Invalid sigma module."))
  )
);

const makeFpsSampler = (): FpsSampler => {
  if (!P.isFunction(globalThis.requestAnimationFrame)) {
    return {
      fps: () => 0,
      stop: () => undefined,
    };
  }

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
    if (time - lastTime >= 500) {
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
    try: () => new module.Graph(container, cosmosConfig),
    catch: driverError("renderFailed", "Failed to construct cosmos.gl graph."),
  });

  yield* Effect.try({
    try: () => {
      graph.setPointPositions(projection.pointPositions);
      graph.setLinks(projection.links);
      graph.render();
    },
    catch: driverError("renderFailed", "Failed to render cosmos.gl graph."),
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
  const graph = new graphology.default({ multi: true, type: "directed" });
  const populateGraph = (nextProjection: CosmosGraphProjection): void => {
    let nodeIndex = 0;

    while (nodeIndex < nextProjection.nodeCount) {
      const positionOffset = nodeIndex * 2;
      const nodeId = `n${nextProjection.nodeIds[nodeIndex]}`;

      graph.addNode(nodeId, {
        x: nextProjection.pointPositions[positionOffset],
        y: nextProjection.pointPositions[positionOffset + 1],
        label: nodeId,
        size: 2,
        color: "#38bdf8",
      });
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
        {
          size: 1,
          color: "#94a3b8",
        }
      );
      edgeIndex += 1;
    }
  };

  populateGraph(projection);

  const renderer = yield* Effect.try({
    try: () => new sigma.default(graph, container),
    catch: driverError("renderFailed", "Failed to construct sigma graph."),
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
 * @example
 * ```ts
 * import { renderCosmosGraph } from "@beep/cosmos"
 *
 * console.log(renderCosmosGraph)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const renderCosmosGraph = Effect.fn("Cosmos.renderCosmosGraph")(function* (
  container: HTMLElement,
  projection: CosmosGraphProjection
) {
  const selection = selectCosmosBackend(probeWebGl2());

  return yield* Match.value(selection.backend).pipe(
    Match.withReturnType<Effect.Effect<CosmosRenderHandle, CosmosDriverError>>(),
    Match.when("cosmos", () => renderWithCosmos(container, projection)),
    Match.orElse(() => renderWithSigma(container, projection))
  );
});
