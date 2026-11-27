/**
 * Lazy graph render adapters for cosmos.gl and sigma.js.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="./vendor.d.ts" />

import { $CosmosId } from "@beep/identity/packages";
import { Fn, HexColor } from "@beep/schema";
import { A, O, P } from "@beep/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CosmosBackend, probeWebGl2, selectCosmosBackend } from "./Cosmos.backend.ts";
import { CosmosDriverError } from "./Cosmos.errors.ts";
import { CosmosGraphProjection } from "./Cosmos.projection.ts";

const $I = $CosmosId.create("Cosmos.renderer");

class CosmosGraphConfig extends S.Opaque<CosmosGraphConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    enableDrag: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    enableSimulation: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    fitViewDelay: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(100)),
      S.withDecodingDefaultTypeKey(Effect.succeed(100))
    ),
    fitViewOnInit: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    fitViewPadding: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0.15)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.15))
    ),
    linkBlending: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    simulationFriction: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0.15)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.15))
    ),
    simulationGravity: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0))
    ),
    simulationRepulsion: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0.45)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0.45))
    ),
    transitionDuration: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefaultTypeKey(Effect.succeed(0))
    ),
    linkWidthScale: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(1.6)),
      S.withDecodingDefaultTypeKey(Effect.succeed(1.6))
    ),
    pointSizeScale: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(2.4)),
      S.withDecodingDefaultTypeKey(Effect.succeed(2.4))
    ),
    renderLinks: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    scalePointsOnZoom: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
  }).pipe(
    $I.annoteSchema("CosmosGraphConfig", {
      description: "Stable cosmos.gl simulation, appearance, and viewport defaults used for each mounted graph.",
    })
  )
) {}

const BRIGHT_POINT_RGBA: readonly [number, number, number, number] = [0.44, 0.87, 0.53, 1];

const SUBDUED_LINK_RGBA: readonly [number, number, number, number] = [0.55, 0.68, 0.6, 0.55];

const POINT_SIZE_BEFORE_SCALE = 4;

const LINK_WIDTH_BEFORE_SCALE = 1;

const repeatRgba = (count: number, rgba: readonly [number, number, number, number]): Float32Array => {
  const values = new Float32Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    values.set(rgba, index * 4);
  }
  return values;
};

const filled = (count: number, value: number): Float32Array => new Float32Array(count).fill(value);

type CosmosGraphUsedMembers = {
  readonly destroy?: () => void;
  readonly render: () => void;
  readonly setLinkColors?: (linkColors: Float32Array) => void;
  readonly setLinkWidths?: (linkWidths: Float32Array) => void;
  readonly setLinks: (links: Float32Array) => void;
  readonly setPointColors?: (pointColors: Float32Array) => void;
  readonly setPointPositions: (positions: Float32Array) => void;
  readonly setPointSizes?: (pointSizes: Float32Array) => void;
  readonly spaceToScreenPosition?: (this: CosmosGraphUsedMembers, spacePosition: [number, number]) => [number, number];
  readonly getPointPositions?: () => ReadonlyArray<number>;
  readonly stop?: () => void;
};

const MAX_RENDERED_LABELS = 300;

type LabelRect = {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
};

type LabelCandidate = {
  readonly anchorX: number;
  readonly anchorY: number;
  readonly offsetX: number;
  readonly offsetY: number;
};

const cardinalThenDiagonalRing = (distance: number): ReadonlyArray<LabelCandidate> => [
  { anchorX: 0, anchorY: 0.5, offsetX: distance, offsetY: 0 },
  { anchorX: 1, anchorY: 0.5, offsetX: -distance, offsetY: 0 },
  { anchorX: 0.5, anchorY: 0, offsetX: 0, offsetY: distance },
  { anchorX: 0.5, anchorY: 1, offsetX: 0, offsetY: -distance },
  { anchorX: 0, anchorY: 0, offsetX: distance, offsetY: distance },
  { anchorX: 1, anchorY: 0, offsetX: -distance, offsetY: distance },
  { anchorX: 0, anchorY: 1, offsetX: distance, offsetY: -distance },
  { anchorX: 1, anchorY: 1, offsetX: -distance, offsetY: -distance },
];

const LABEL_CANDIDATES = A.flatMap([30, 48, 66, 84, 102, 120, 138], cardinalThenDiagonalRing);
const LABEL_POINT_CLEARANCE = 26;

const labelRect = (
  x: number,
  y: number,
  size: Pick<LabelRect, "height" | "width">,
  candidate: LabelCandidate
): LabelRect => ({
  height: size.height,
  left: x + candidate.offsetX - size.width * candidate.anchorX,
  top: y + candidate.offsetY - size.height * candidate.anchorY,
  width: size.width,
});

const labelRectsOverlap = (left: LabelRect, right: LabelRect): boolean =>
  left.left < right.left + right.width &&
  left.left + left.width > right.left &&
  left.top < right.top + right.height &&
  left.top + left.height > right.top;

const labelFits = (candidate: LabelRect, layer: HTMLElement, occupied: ReadonlyArray<LabelRect>): boolean =>
  candidate.left >= 2 &&
  candidate.top >= 2 &&
  candidate.left + candidate.width <= layer.clientWidth - 2 &&
  candidate.top + candidate.height <= layer.clientHeight - 2 &&
  A.every(occupied, (placed) => !labelRectsOverlap(candidate, placed));

const graphPointObstacles = (
  graph: CosmosGraphUsedMembers,
  positions: ReadonlyArray<number>,
  count: number
): Array<LabelRect> => {
  const obstacles: Array<LabelRect> = [];
  for (let index = 0; index < count; index += 1) {
    const x = positions[index * 2];
    const y = positions[index * 2 + 1];
    if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) continue;
    const screen = graph.spaceToScreenPosition?.([x, y]);
    if (screen === undefined) continue;
    obstacles.push({
      height: LABEL_POINT_CLEARANCE * 2,
      left: screen[0] - LABEL_POINT_CLEARANCE,
      top: screen[1] - LABEL_POINT_CLEARANCE,
      width: LABEL_POINT_CLEARANCE * 2,
    });
  }
  return obstacles;
};

const makeLabelLayer = (container: HTMLElement, labels: ReadonlyArray<string>) => {
  const layer = document.createElement("div");
  layer.setAttribute("data-testid", "cosmos-labels");
  layer.setAttribute(
    "style",
    "position:absolute;inset:0;overflow:hidden;pointer-events:none;font-size:11px;line-height:1;"
  );

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  const shown = labels.slice(0, MAX_RENDERED_LABELS);
  const elements = A.map(shown, (label) => {
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

  const sizes = A.map(elements, (element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  });

  return {
    element: layer,
    elements,
    sizes,
    count: shown.length,
    fail: (reason: string): void => layer.setAttribute("data-label-error", reason),
    destroy: (): void => layer.remove(),
  };
};

const positionLabel = (
  graph: CosmosGraphUsedMembers,
  positions: ReadonlyArray<number>,
  layer: ReturnType<typeof makeLabelLayer>,
  index: number,
  occupied: Array<LabelRect>
): boolean => {
  const x = positions[index * 2];
  const y = positions[index * 2 + 1];
  const element = layer.elements[index];
  const size = layer.sizes[index];
  if (element === undefined || size === undefined || x === undefined || y === undefined) return false;
  if (Number.isNaN(x) || Number.isNaN(y)) return false;

  const screen = graph.spaceToScreenPosition?.([x, y]);
  if (screen === undefined) return false;

  const placement = pipe(
    LABEL_CANDIDATES,
    A.findFirst((candidate) => labelFits(labelRect(screen[0], screen[1], size, candidate), layer.element, occupied)),
    O.map((candidate) => labelRect(screen[0], screen[1], size, candidate))
  );
  return O.match(placement, {
    onNone: () => {
      element.hidden = true;
      element.style.transform = "translate(-9999px,-9999px)";
      return false;
    },
    onSome: (placed) => {
      occupied.push(placed);
      element.hidden = false;
      element.style.transform = `translate(${Math.round(placed.left)}px, ${Math.round(placed.top)}px)`;
      return true;
    },
  });
};

type CosmosGraphConstructor = new (container: HTMLElement, config: CosmosGraphConfig) => CosmosGraphUsedMembers;

type CosmosGraphModule = {
  readonly Graph: CosmosGraphConstructor;
};

class GraphologyOptions extends S.Opaque<GraphologyOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    multi: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    type: S.tag("directed"),
  }).pipe(
    $I.annoteSchema("GraphologyOptions", {
      description: "Directed multi-graph options required by the sigma.js fallback adapter.",
    })
  )
) {}

const edgeAttributesColorDefault = HexColor.make("#94a3b8");
class EdgeAttributes extends S.Opaque<EdgeAttributes, { readonly brand: unique symbol }>()(
  S.Struct({
    color: HexColor.pipe(
      S.withConstructorDefault(Effect.succeed(edgeAttributesColorDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(edgeAttributesColorDefault))
    ),
    size: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(1)), S.withDecodingDefaultTypeKey(Effect.succeed(1))),
  }).pipe(
    $I.annoteSchema("EdgeAttributes", {
      description: "Default visual attributes assigned to graphology edges rendered by sigma.js.",
    })
  )
) {}

const nodeAttributesColorDefault = HexColor.make("#38bdf8");
class NodeAttributes extends S.Opaque<NodeAttributes, { readonly brand: unique symbol }>()(
  S.Struct({
    color: HexColor.pipe(
      S.withConstructorDefault(Effect.succeed(nodeAttributesColorDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(nodeAttributesColorDefault))
    ),
    label: S.NonEmptyString,
    size: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(2)), S.withDecodingDefaultTypeKey(Effect.succeed(2))),
    x: S.Finite,
    y: S.Finite,
  }).pipe(
    $I.annoteSchema("NodeAttributes", {
      description: "Position, label, and default visual attributes for a sigma.js graph node.",
    })
  )
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

  // decision: fps-sampler-counters-stay-mutable
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
 * **Example** (Construct a render handle)
 *
 * ```ts
 * import { CosmosRenderHandle } from "@beep/cosmos"
 *
 * const handle = CosmosRenderHandle.make({
 *   backend: "sigma",
 *   fps: () => 0,
 *   update: () => undefined,
 *   destroy: () => undefined
 * })
 *
 * console.log(handle.backend)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export class CosmosRenderHandle extends S.Opaque<CosmosRenderHandle, { readonly brand: unique symbol }>()(
  S.Struct({
    backend: CosmosBackend,
    destroy: Fn({ output: S.Void }),
    fps: Fn({ output: S.Finite }),
    update: Fn({
      input: CosmosGraphProjection,
      output: S.Void,
    }),
  }).pipe(
    $I.annoteSchema("CosmosRenderHandle", {
      description: "",
    })
  )
) {}

const renderWithCosmos = Effect.fn("Cosmos.renderWithCosmos")(function* (
  container: HTMLElement,
  projection: CosmosGraphProjection
) {
  const module = yield* loadCosmosGraphModule;
  const graph: CosmosGraphUsedMembers = yield* Effect.try({
    try: () => new module.Graph(container, CosmosGraphConfig.make({})),
    catch: CosmosDriverError.fromUnknown("renderFailed")("Failed to construct cosmos.gl graph."),
  });

  const paint = (current: CosmosGraphProjection): void => {
    const linkCount = current.links.length / 2;
    graph.setPointSizes?.(filled(current.nodeCount, POINT_SIZE_BEFORE_SCALE));
    graph.setPointColors?.(repeatRgba(current.nodeCount, BRIGHT_POINT_RGBA));
    graph.setLinkWidths?.(filled(linkCount, LINK_WIDTH_BEFORE_SCALE));
    graph.setLinkColors?.(repeatRgba(linkCount, SUBDUED_LINK_RGBA));
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

  const layerFor = (current: CosmosGraphProjection): O.Option<ReturnType<typeof makeLabelLayer>> =>
    pipe(
      O.fromNullishOr(current.labels),
      O.filter(A.isReadonlyArrayNonEmpty),
      O.map((names) => makeLabelLayer(container, names))
    );

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
          const positions = graph.getPointPositions?.() ?? [];
          const occupied = graphPointObstacles(graph, positions, current.count);
          let suppressedCount = 0;
          for (let index = 0; index < current.count; index += 1) {
            if (!positionLabel(graph, positions, current, index, occupied)) suppressedCount += 1;
          }
          current.element.setAttribute("data-label-collisions", "0");
          current.element.setAttribute("data-label-suppressed", String(suppressedCount));
        },
      })
    );
  };

  const tick = (): void => {
    Result.match(Result.try(positionLabels), {
      onFailure: (cause) => {
        pipe(
          layer,
          O.match({
            onNone: () => undefined,
            onSome: (current) => current.fail(cause instanceof Error ? cause.message : String(cause)),
          })
        );
        frame = undefined;
      },
      onSuccess: () => {
        frame = globalThis.requestAnimationFrame(tick);
      },
    });
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
  const graph = new graphology.default(GraphologyOptions.make({}));
  const populateGraph = (nextProjection: CosmosGraphProjection): void => {
    // decision: typed-array-hot-paths-stay-imperative
    let nodeIndex = 0;

    while (nodeIndex < nextProjection.nodeCount) {
      const positionOffset = nodeIndex * 2;
      const nodeId = `n${nextProjection.nodeIds[nodeIndex]}`;

      graph.addNode(
        nodeId,
        NodeAttributes.make({
          x: nextProjection.pointPositions[positionOffset]!,
          y: nextProjection.pointPositions[positionOffset + 1]!,
          label: nodeId,
        })
      );
      nodeIndex += 1;
    }

    let edgeIndex = 0;

    while (edgeIndex < nextProjection.edgeCount) {
      const linkOffset = edgeIndex * 2;
      const sourceIndex = nextProjection.links[linkOffset]! % nextProjection.nodeCount;
      const targetIndex = nextProjection.links[linkOffset + 1]! % nextProjection.nodeCount;

      graph.addDirectedEdgeWithKey(
        `e${edgeIndex}`,
        `n${nextProjection.nodeIds[sourceIndex]}`,
        `n${nextProjection.nodeIds[targetIndex]}`,
        EdgeAttributes.make({})
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

  return CosmosRenderHandle.make({
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
  });
});

/**
 * Renders a graph projection with the selected runtime backend.
 *
 * **Details**
 *
 * The cosmos backend sets every point's and link's size and colour itself,
 * because cosmos.gl's defaults draw single-pixel grey points and hairline links
 * that are barely visible; a cosmos.gl build without those setters (they
 * arrived in 2.x) draws with its defaults. cosmos.gl draws no text, so a
 * projection's labels go in a DOM layer (`data-testid="cosmos-labels"`) over
 * the canvas and are re-pinned on every animation frame through the graph's
 * space-to-screen transform, following the simulation, pans and zooms. At most
 * the first 300 labels are rendered. Each label tries the four cardinal
 * positions, then the diagonals, on successively wider rings in the same order
 * every frame, so labels do not wander once the simulation settles; a label
 * that fits nowhere is hidden, and the layer's `data-label-suppressed`
 * attribute counts those. Only nodes with a rendered label are obstacles: a
 * label never covers another label or a labelled node, but it can cover a node
 * whose label is not rendered. `update` rebuilds the layer from the new
 * projection's labels.
 *
 * **Gotchas**
 *
 * The returned handle owns a frame sampler and renderer resources. Call
 * `destroy` when the host unmounts the graph.
 *
 * A container with static positioning is set to `position: relative`, so the
 * label layer anchors to it instead of the page. A projection with labels fails
 * with an adapter invariant on a cosmos.gl build that cannot report point
 * positions. A failure while placing labels stops the label loop and sets the
 * layer's `data-label-error` attribute to its message.
 *
 * **Example** (Render graph and extract backend)
 *
 * ```ts
 * import { CosmosGraphProjection, renderCosmosGraph } from "@beep/cosmos"
 * import * as Effect from "effect/Effect";
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
