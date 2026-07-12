/**
 * Lazy graph render adapters for cosmos.gl and sigma.js.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="./vendor.d.ts" />

import { $CosmosId } from "@beep/identity/packages";
import { Fn, HexColor, SchemaUtils } from "@beep/schema";
import { A, O, P } from "@beep/utils";
import { Duration, Effect, Match, pipe } from "effect";
import * as S from "effect/Schema";
import { CosmosBackend, probeWebGl2, selectCosmosBackend } from "./Cosmos.backend.js";
import { CosmosDriverError } from "./Cosmos.errors.js";
import { CosmosGraphProjection } from "./Cosmos.projection.js";

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
    // Appearance was left entirely to cosmos.gl's defaults, which draw a graph you
    // can barely see: single-pixel grey points and hairline links on a dark
    // background. A diagram nobody can read is not a diagram.
    linkWidthScale: S.Finite.pipe(SchemaUtils.withKeyDefaults(1.6)),
    pointSizeScale: S.Finite.pipe(SchemaUtils.withKeyDefaults(2.4)),
    renderLinks: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    scalePointsOnZoom: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
  },
  $I.annote("CosmosGraphConfig", {
    description: "Stable cosmos.gl simulation, appearance, and viewport defaults used for each mounted graph.",
  })
) {}

/** Points: bright enough to read against the workbench's dark canvas. */
const POINT_RGBA: readonly [number, number, number, number] = [0.44, 0.87, 0.53, 1];

/** Links: visible, but never louder than the points they connect. */
const LINK_RGBA: readonly [number, number, number, number] = [0.55, 0.68, 0.6, 0.55];

/** Baseline point radius, before `pointSizeScale`. */
const POINT_SIZE = 4;

/** Baseline link width, before `linkWidthScale`. */
const LINK_WIDTH = 1;

const repeatRgba = (count: number, rgba: readonly [number, number, number, number]): Float32Array => {
  const values = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    values.set(rgba, index * 4);
  }
  return values;
};

const filled = (count: number, value: number): Float32Array => new Float32Array(count).fill(value);

type CosmosGraphInstance = {
  readonly destroy?: () => void;
  readonly render: () => void;
  readonly setLinkColors?: (linkColors: Float32Array) => void;
  readonly setLinkWidths?: (linkWidths: Float32Array) => void;
  readonly setLinks: (links: Float32Array) => void;
  readonly setPointColors?: (pointColors: Float32Array) => void;
  readonly setPointPositions: (positions: Float32Array) => void;
  readonly setPointSizes?: (pointSizes: Float32Array) => void;
  // The graph's own space -> screen transform, which is what makes an HTML label
  // layer possible: cosmos.gl renders no text, but it will tell you where a point
  // currently is on screen, through every pan, zoom and simulation tick.
  readonly spaceToScreenPosition?: (spacePosition: [number, number]) => [number, number];
  readonly getPointPositions?: () => ReadonlyArray<number>;
  readonly stop?: () => void;
};

/** Beyond this many points, labels stop being readable and start being noise. */
const MAX_RENDERED_LABELS = 300;

/**
 * An HTML label layer over the WebGL canvas.
 *
 * The labels the ontology computes were being thrown away: cosmos.gl draws points
 * and lines, never text, so a graph of a dozen named classes rendered as a dozen
 * anonymous dots. The library does expose its space-to-screen transform, though,
 * which is exactly what a text layer needs — so the names go in a DOM layer pinned
 * over the canvas and follow their points through pan, zoom and simulation.
 */
const makeLabelLayer = (container: HTMLElement, labels: ReadonlyArray<string>) => {
  const layer = document.createElement("div");
  layer.setAttribute("data-testid", "cosmos-labels");
  layer.setAttribute(
    "style",
    "position:absolute;inset:0;overflow:hidden;pointer-events:none;font-size:11px;line-height:1;"
  );

  // The canvas is positioned within the container, so the layer must be too —
  // otherwise the labels anchor to the page and drift away from their points.
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  const shown = labels.slice(0, MAX_RENDERED_LABELS);
  const elements = shown.map((label) => {
    const element = document.createElement("span");
    element.textContent = label;
    element.setAttribute(
      "style",
      "position:absolute;top:0;left:0;white-space:nowrap;transform:translate(-9999px,-9999px);" +
        "color:rgba(226,240,230,0.92);text-shadow:0 1px 2px rgba(0,0,0,0.85);will-change:transform;"
    );
    layer.appendChild(element);
    return element;
  });

  container.appendChild(layer);

  return {
    elements,
    count: shown.length,
    // A label layer that cannot place its labels says so, on the layer itself, where
    // both a human and a test can see it. Silence was the original bug.
    fail: (reason: string): void => layer.setAttribute("data-label-error", reason),
    destroy: (): void => layer.remove(),
  };
};

const positionLabel = (
  graph: CosmosGraphInstance,
  positions: ReadonlyArray<number>,
  layer: ReturnType<typeof makeLabelLayer>,
  index: number
): void => {
  const x = positions[index * 2];
  const y = positions[index * 2 + 1];
  const element = layer.elements[index];
  if (element === undefined || x === undefined || y === undefined) return;
  if (Number.isNaN(x) || Number.isNaN(y)) return;

  const screen = graph.spaceToScreenPosition?.([x, y]);
  if (screen === undefined) return;

  // Offset below the point so the text never sits on top of the dot it names.
  element.style.transform = `translate(${Math.round(screen[0])}px, ${Math.round(screen[1] + 8)}px) translateX(-50%)`;
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
export class CosmosRenderHandle extends S.Class<CosmosRenderHandle>($I`CosmosRenderHandle`)(
  {
    backend: CosmosBackend,
    destroy: Fn({ output: S.Void }),
    fps: Fn({ output: S.Finite }),
    update: Fn({
      input: CosmosGraphProjection,
      output: S.Void,
    }),
  },
  $I.annote("CosmosRenderHandle", {
    description: "",
  })
) {}

const renderWithCosmos = Effect.fn("Cosmos.renderWithCosmos")(function* (
  container: HTMLElement,
  projection: CosmosGraphProjection
) {
  const module = yield* loadCosmosGraphModule;
  // Held as the instance shape this driver declares, not as cosmos.gl's class: the
  // wrapper depends on exactly the members it names here and nothing more.
  const graph: CosmosGraphInstance = yield* Effect.try({
    try: () => new module.Graph(container, CosmosGraphConfig.make()),
    catch: CosmosDriverError.fromUnknown("renderFailed")("Failed to construct cosmos.gl graph."),
  });

  // Sizes and colours are set per element, not left to the library's defaults. The
  // setters are optional in the instance type because they arrived in cosmos.gl 2.x:
  // where they are missing the graph still draws, just with the plain defaults.
  const paint = (current: CosmosGraphProjection): void => {
    const linkCount = current.links.length / 2;
    graph.setPointSizes?.(filled(current.nodeCount, POINT_SIZE));
    graph.setPointColors?.(repeatRgba(current.nodeCount, POINT_RGBA));
    graph.setLinkWidths?.(filled(linkCount, LINK_WIDTH));
    graph.setLinkColors?.(repeatRgba(linkCount, LINK_RGBA));
  };

  yield* Effect.try({
    try: () => {
      graph.setPointPositions(projection.pointPositions);
      graph.setLinks(projection.links);
      paint(projection);
      graph.render();
    },
    catch: CosmosDriverError.fromUnknown("renderFailed")("Failed to render cosmos.gl graph."),
  });

  // Labels live in a DOM layer over the canvas and are re-pinned to their points on
  // every frame, because the simulation, a pan, and a zoom all move them. The graph
  // is the only thing that knows where a point currently is, so it is asked, rather
  // than the transform being reconstructed here.
  const layerFor = (current: CosmosGraphProjection): O.Option<ReturnType<typeof makeLabelLayer>> =>
    pipe(
      O.fromNullishOr(current.labels),
      O.filter(A.isReadonlyArrayNonEmpty),
      O.map((names) => makeLabelLayer(container, names))
    );

  // A graph that cannot say where its points are cannot carry labels, and pretending
  // otherwise is how the first attempt at this failed: the labels were built, mounted,
  // and left sitting at their off-screen start position, saying nothing.
  const canPlaceLabels = P.isFunction(graph.getPointPositions) && P.isFunction(graph.spaceToScreenPosition);
  if (A.isReadonlyArrayNonEmpty(projection.labels ?? []) && !canPlaceLabels) {
    return yield* CosmosDriverError.adapterInvariant(
      "cosmos.gl cannot report point positions, so labels cannot be placed."
    );
  }

  let layer = layerFor(projection);
  let frame: number | undefined = undefined;

  const positionLabels = (): void => {
    pipe(
      layer,
      O.match({
        onNone: () => undefined,
        onSome: (current) => {
          // Called ON the graph, never lifted off it. Holding the method in a local
          // (`const toScreen = graph.spaceToScreenPosition`) detaches it from its
          // instance, so `this` is undefined and every call throws — inside an
          // animation frame, where the throw goes nowhere anyone will see it. The
          // labels simply never moved, and nothing said why.
          const positions = graph.getPointPositions?.() ?? [];
          for (let index = 0; index < current.count; index += 1) {
            positionLabel(graph, positions, current, index);
          }
        },
      })
    );
  };

  // A throw inside an animation frame lands nowhere: the browser swallows it, the
  // loop keeps being rescheduled, and the labels sit motionless with nothing to
  // explain them. That is exactly how the unbound-method bug above stayed invisible.
  // So a failure here stops the loop and marks the layer, which is visible in the
  // DOM and in a test, instead of failing in a place no one can look.
  const tick = (): void => {
    try {
      positionLabels();
    } catch (cause) {
      pipe(
        layer,
        O.match({
          onNone: () => undefined,
          onSome: (current) => current.fail(cause instanceof Error ? cause.message : String(cause)),
        })
      );
      frame = undefined;
      return;
    }
    frame = globalThis.requestAnimationFrame(tick);
  };
  if (O.isSome(layer)) {
    tick();
  }

  const sampler = makeFpsSampler();

  return CosmosRenderHandle.make({
    backend: "cosmos",
    fps: sampler.fps,
    update: CosmosRenderHandle.fields.update.implement((nextProjection) => {
      graph.setPointPositions(nextProjection.pointPositions);
      graph.setLinks(nextProjection.links);
      paint(nextProjection);
      graph.render();

      // A re-projection can rename, add or drop nodes, so the layer is rebuilt from
      // the labels that arrived with it rather than left describing the old graph.
      pipe(layer, O.match({ onNone: () => undefined, onSome: (current) => current.destroy() }));
      layer = layerFor(nextProjection);
      if (O.isSome(layer) && frame === undefined) {
        tick();
      }
    }),
    destroy: () => {
      sampler.stop();
      if (frame !== undefined) {
        globalThis.cancelAnimationFrame(frame);
        frame = undefined;
      }
      pipe(layer, O.match({ onNone: () => undefined, onSome: (current) => current.destroy() }));
      layer = O.none();
      if (P.isFunction(graph.stop)) {
        graph.stop();
      }
      if (P.isFunction(graph.destroy)) {
        graph.destroy();
      }
    },
  });
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
