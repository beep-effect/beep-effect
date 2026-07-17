/**
 * Lazy instanced three.js render adapter for 3D knowledge graphs.
 *
 * Visual grammar (clean-room, from the graph-3d-view research prose spec):
 * dark `#111111` canvas, community-colored billboard nodes sized by
 * importance, quadratic-Bézier ribbon edges, canvas-sprite labels with an
 * adaptive camera-distance budget, and selection dimming. The renderer draws
 * baked positions only — layout is upstream (worker) work by design.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $Graph3dId } from "@beep/identity/packages";
import { Fn, SchemaUtils } from "@beep/schema";
import { O, P } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { Graph3DDriverError } from "./Graph3D.errors.js";
import { Graph3DProjection } from "./Graph3D.projection.js";
import type * as THREE from "three";

const $I = $Graph3dId.create("Graph3D.renderer");

type ThreeModule = typeof import("three");
type ControlsModule = typeof import("three/addons/controls/TrackballControls.js");

const isThreeModule = (value: unknown): value is ThreeModule =>
  P.isObject(value) && P.hasProperty(value, "WebGLRenderer") && P.isFunction(value.WebGLRenderer);

const isControlsModule = (value: unknown): value is ControlsModule =>
  P.isObject(value) && P.hasProperty(value, "TrackballControls") && P.isFunction(value.TrackballControls);

const loadThreeModule = Effect.tryPromise({
  try: () => import("three"),
  catch: Graph3DDriverError.fromUnknown("importFailed")("Failed to import three."),
}).pipe(Effect.filterOrFail(isThreeModule, () => Graph3DDriverError.adapterInvariant("Invalid three module.")));

const loadControlsModule = Effect.tryPromise({
  try: () => import("three/addons/controls/TrackballControls.js"),
  catch: Graph3DDriverError.fromUnknown("importFailed")("Failed to import TrackballControls."),
}).pipe(
  Effect.filterOrFail(isControlsModule, () => Graph3DDriverError.adapterInvariant("Invalid TrackballControls module."))
);

class Graph3DConfig extends S.Class<Graph3DConfig>($I`Graph3DConfig`)(
  {
    // The observed reference canvas is #111111; #000000 is only the bundle's
    // no-override fallback (research VERIFICATION.md §5.4). Fixed dark grammar
    // in both app themes, matching the cosmos driver's hardcoded-color
    // convention.
    background: S.Finite.pipe(SchemaUtils.withKeyDefaults(0x111111)),
    cameraFov: S.Finite.pipe(SchemaUtils.withKeyDefaults(40)),
    // Importance sizing: logical = sizeBase + importance * sizeScale, world
    // diameter = logical * sizeWorldFactor * zoomDamping.
    sizeBase: S.Finite.pipe(SchemaUtils.withKeyDefaults(10)),
    sizeScale: S.Finite.pipe(SchemaUtils.withKeyDefaults(22.4)),
    sizeWorldFactor: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.5)),
    // Edge ribbons: width 0.4..5.0 by weight^1.2; global opacity
    // max(0.10, 0.95 - sqrt(E)/100); per-edge alpha 0.5..1.0 by weight.
    edgeWidthBase: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.4)),
    edgeWidthScale: S.Finite.pipe(SchemaUtils.withKeyDefaults(4.6)),
    edgeSegments: S.Int.pipe(SchemaUtils.withKeyDefaults(30)),
    edgeCurvature: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.25)),
    edgeCurveRotation: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.25)),
    // Label declutter: budget K = clamp(round(4.5 * sqrt(n) * (700/d)^0.7), 8, 90),
    // pool-bounded; opacity floor 0.10; depth fade >35 units behind center over
    // 130 units capped at 85%.
    labelPoolSize: S.Int.pipe(SchemaUtils.withKeyDefaults(96)),
    labelBudgetMax: S.Int.pipe(SchemaUtils.withKeyDefaults(90)),
    labelBudgetMin: S.Int.pipe(SchemaUtils.withKeyDefaults(8)),
    // Selection dimming (confirmed reference values).
    dimmedNodeOpacity: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.1)),
    dimmedEdgeOpacity: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.3)),
    pickRadiusPx: S.Finite.pipe(SchemaUtils.withKeyDefaults(24)),
    panSpeed: S.Finite.pipe(SchemaUtils.withKeyDefaults(0.3)),
    rotateSpeed: S.Finite.pipe(SchemaUtils.withKeyDefaults(2.2)),
  },
  $I.annote("Graph3DConfig", {
    description: "Stable visual-grammar and interaction defaults for each mounted 3D graph.",
  })
) {}

/** 12-slot community palette from the reference renderer (ordinal % 12). */
const COMMUNITY_PALETTE: ReadonlyArray<number> = [
  0xa6cee3, 0x1f78b4, 0xb2df8a, 0x33a02c, 0xfb9a99, 0xe31a1c, 0xfdbf6f, 0xff7f00, 0xcab2d6, 0x6a3d9a, 0xffff99,
  0xb15928,
];

/** Non-highlighted edge color while a selection is active: rgba(80,80,80,0.30). */
const DIMMED_EDGE_RGB = 80 / 255;

const NODE_VERTEX_SHADER = /* glsl */ `
  attribute vec2 corner;
  attribute vec3 iOffset;
  attribute float iSize;
  attribute vec3 iColor;
  attribute float iAlpha;
  uniform float uDamping;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vCorner;
  void main() {
    vColor = iColor;
    vAlpha = iAlpha;
    vCorner = corner;
    vec4 mv = modelViewMatrix * vec4(iOffset, 1.0);
    mv.xy += corner * iSize * uDamping;
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vCorner;
  void main() {
    float r = length(vCorner) * 2.0;
    float mask = 1.0 - smoothstep(0.92, 1.0, r);
    if (mask <= 0.0) discard;
    gl_FragColor = vec4(vColor, vAlpha * mask);
  }
`;

const EDGE_VERTEX_SHADER = /* glsl */ `
  attribute vec2 param;
  attribute vec3 iP0;
  attribute vec3 iP1;
  attribute vec3 iCtrl;
  attribute vec3 iColor;
  attribute float iAlpha;
  attribute float iWidth;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = iColor;
    vAlpha = iAlpha;
    float t = param.x;
    float omt = 1.0 - t;
    vec3 p = omt * omt * iP0 + 2.0 * omt * t * iCtrl + t * t * iP1;
    vec3 tangent = normalize(2.0 * omt * (iCtrl - iP0) + 2.0 * t * (iP1 - iCtrl));
    vec3 viewDir = normalize(cameraPosition - p);
    vec3 side = normalize(cross(tangent, viewDir));
    p += side * param.y * iWidth * 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const EDGE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

const smoothstep01 = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Reference zoom damping: clamp((cameraDistance / 600)^0.65, 0.35, 3). */
const zoomDamping = (cameraDistance: number): number => Math.min(3, Math.max(0.35, (cameraDistance / 600) ** 0.65));

/** Reference global edge opacity: max(0.10, 0.95 - sqrt(edgeCount) / 100). */
const globalEdgeOpacityFor = (edgeCount: number): number => Math.max(0.1, 0.95 - Math.sqrt(edgeCount) / 100);

const probeWebGl2 = (): boolean =>
  pipe(
    O.fromUndefinedOr(globalThis.document),
    O.map((runtimeDocument) => runtimeDocument.createElement("canvas")),
    O.match({
      onNone: () => false,
      onSome: (canvas) => P.isNotNull(canvas.getContext("webgl2")),
    })
  );

/**
 * Mount options: selection callbacks and error surfacing. Selection identity
 * is a node **index into the mounted projection**; the ontology-aware caller
 * owns the index → IRI resolution.
 *
 * @example
 * ```ts
 * import { Graph3DRenderOptions } from "@beep/graph-3d/browser"
 *
 * const options = Graph3DRenderOptions.make({})
 *
 * console.log(options)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export class Graph3DRenderOptions extends S.Class<Graph3DRenderOptions>($I`Graph3DRenderOptions`)(
  {
    // Fired only from user clicks (never from `select` calls), so a bridge
    // re-applying selection after a projection update cannot loop.
    onNodeSelect: Fn({ input: S.UndefinedOr(S.Int), output: S.Void }).pipe(S.optionalKey),
    // Post-mount failures (WebGL context loss) surface here as typed errors.
    onRuntimeError: Fn({ input: Graph3DDriverError, output: S.Void }).pipe(S.optionalKey),
  },
  $I.annote("Graph3DRenderOptions", {
    description: "Optional selection and runtime-error callbacks for a mounted 3D graph renderer.",
  })
) {}

/**
 * Introspection snapshot of a mounted renderer, for probes and tests.
 *
 * @example
 * ```ts
 * import { Graph3DRenderStats } from "@beep/graph-3d/browser"
 *
 * const stats = Graph3DRenderStats.make({
 *   nodeCount: 1,
 *   edgeCount: 0,
 *   visibleLabelCount: 0,
 *   dimmedNodeCount: 0
 * })
 *
 * console.log(stats.nodeCount)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export class Graph3DRenderStats extends S.Class<Graph3DRenderStats>($I`Graph3DRenderStats`)(
  {
    nodeCount: S.Int,
    edgeCount: S.Int,
    visibleLabelCount: S.Int,
    // Nodes currently at the dimmed opacity because a selection is active.
    dimmedNodeCount: S.Int,
    selectedNodeIndex: S.Int.pipe(S.optionalKey),
  },
  $I.annote("Graph3DRenderStats", {
    description: "Snapshot of rendered node/edge/label counts and active selection dimming.",
  })
) {}

/**
 * Mounted 3D graph renderer handle.
 *
 * @example
 * ```ts
 * import { type Graph3DRenderHandle } from "@beep/graph-3d/browser"
 *
 * const describe = (handle: Graph3DRenderHandle): string => handle.backend
 * console.log(typeof describe)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export class Graph3DRenderHandle extends S.Class<Graph3DRenderHandle>($I`Graph3DRenderHandle`)(
  {
    backend: S.Literal("three-instanced"),
    destroy: Fn({ output: S.Void }),
    fps: Fn({ output: S.Finite }),
    update: Fn({
      input: Graph3DProjection,
      output: S.Void,
    }),
    // Applies selection dimming for a node index of the *currently rendered*
    // projection; `undefined` clears. Never fires `onNodeSelect`.
    select: Fn({ input: S.UndefinedOr(S.Int), output: S.Void }),
    stats: Fn({ output: Graph3DRenderStats }),
  },
  $I.annote("Graph3DRenderHandle", {
    description:
      "Imperative lifecycle for a mounted instanced three.js graph: destroy, fps sampling, full-projection update, selection dimming, and stats introspection.",
  })
) {}

interface LabelSlot {
  aspect: number;
  readonly canvas: HTMLCanvasElement;
  readonly material: THREE.SpriteMaterial;
  nodeIndex: number;
  readonly sprite: THREE.Sprite;
  readonly texture: THREE.CanvasTexture;
}

interface EdgePaintTarget {
  readonly communities: Uint16Array;
  readonly edgeAlphas: Float32Array;
  readonly edgeColors: Float32Array;
  readonly links: Float32Array;
}

interface SceneGraph {
  readonly adjacency: ReadonlyArray<ReadonlyArray<number>>;
  readonly center: THREE.Vector3;
  readonly communities: Uint16Array;
  readonly edgeAlphas: Float32Array;
  readonly edgeColors: Float32Array;
  readonly edgeGeometry: THREE.InstancedBufferGeometry;
  readonly edgeMaterial: THREE.ShaderMaterial;
  readonly edgeMesh: THREE.Mesh;
  readonly edgeWeights: Float32Array;
  readonly fitDistance: number;
  readonly importance: Float32Array;
  readonly importanceOrder: Uint32Array;
  readonly labelPool: ReadonlyArray<LabelSlot>;
  readonly labels: ReadonlyArray<string>;
  readonly links: Float32Array;
  readonly nodeAlphas: Float32Array;
  readonly nodeGeometry: THREE.InstancedBufferGeometry;
  readonly nodeMaterial: THREE.ShaderMaterial;
  readonly nodeMesh: THREE.Mesh;
  readonly positions: Float32Array;
}

const mountRenderer = (
  three: ThreeModule,
  TrackballControls: ControlsModule["TrackballControls"],
  container: HTMLElement,
  initialProjection: Graph3DProjection,
  options: Graph3DRenderOptions
): Graph3DRenderHandle => {
  const config = Graph3DConfig.make();
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(globalThis.devicePixelRatio ?? 1);
  renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
  container.appendChild(renderer.domElement);

  const scene = new three.Scene();
  scene.background = new three.Color(config.background);

  const camera = new three.PerspectiveCamera(
    config.cameraFov,
    Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
    1,
    20_000
  );

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = config.rotateSpeed;
  controls.panSpeed = config.panSpeed;
  controls.dynamicDampingFactor = 0.15;

  const tmpColor = new three.Color();
  const va = new three.Vector3();
  const vb = new three.Vector3();
  const dir = new three.Vector3();
  const perp = new three.Vector3();
  const upAxis = new three.Vector3(0, 1, 0);
  const altAxis = new three.Vector3(1, 0, 0);
  const camDir = new three.Vector3();
  const scratch = new three.Vector3();

  let sceneGraph: SceneGraph | undefined;
  let selectedIndex: number | undefined;
  let destroyed = false;

  const logicalSize = (importanceValue: number): number => config.sizeBase + importanceValue * config.sizeScale;

  const disposeSceneGraph = (): void => {
    if (P.isUndefined(sceneGraph)) {
      return;
    }
    for (const slot of sceneGraph.labelPool) {
      slot.texture.dispose();
      slot.material.dispose();
      scene.remove(slot.sprite);
    }
    sceneGraph.nodeGeometry.dispose();
    sceneGraph.edgeGeometry.dispose();
    sceneGraph.nodeMaterial.dispose();
    sceneGraph.edgeMaterial.dispose();
    scene.remove(sceneGraph.nodeMesh);
    scene.remove(sceneGraph.edgeMesh);
    sceneGraph = undefined;
  };

  const drawLabelText = (slot: LabelSlot, text: string): void => {
    const context = slot.canvas.getContext("2d");
    if (P.isNull(context)) {
      return;
    }
    context.clearRect(0, 0, slot.canvas.width, slot.canvas.height);
    // The reference rasterizes labels at 90 texture pixels of system-ui.
    context.font = "90px system-ui, sans-serif";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    const width = Math.min(context.measureText(text).width, slot.canvas.width - 8);
    context.fillText(text, (slot.canvas.width - width) / 2, slot.canvas.height / 2, width);
    slot.texture.needsUpdate = true;
  };

  // Community color + alpha rewrite for one edge ribbon, shared by the build
  // pass and both selection paint paths.
  const paintEdgeCommunity = (target: EdgePaintTarget, edge: number, alpha: number): void => {
    const source = target.links[edge * 2]!;
    tmpColor.setHex(COMMUNITY_PALETTE[target.communities[source]! % COMMUNITY_PALETTE.length]!);
    target.edgeColors[edge * 3] = tmpColor.r;
    target.edgeColors[edge * 3 + 1] = tmpColor.g;
    target.edgeColors[edge * 3 + 2] = tmpColor.b;
    target.edgeAlphas[edge] = alpha;
  };

  const buildNodeLayer = (
    nodeCount: number,
    positions: Float32Array,
    importance: Float32Array,
    communities: Uint16Array
  ) => {
    const nodeGeometry = new three.InstancedBufferGeometry();
    nodeGeometry.setAttribute(
      "corner",
      new three.Float32BufferAttribute([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5], 2)
    );
    nodeGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    nodeGeometry.instanceCount = nodeCount;
    const nodeSizes = new Float32Array(nodeCount);
    const nodeColors = new Float32Array(nodeCount * 3);
    const nodeAlphas = new Float32Array(nodeCount).fill(1);
    for (let index = 0; index < nodeCount; index += 1) {
      nodeSizes[index] = logicalSize(importance[index]!) * config.sizeWorldFactor;
      tmpColor.setHex(COMMUNITY_PALETTE[communities[index]! % COMMUNITY_PALETTE.length]!);
      nodeColors[index * 3] = tmpColor.r;
      nodeColors[index * 3 + 1] = tmpColor.g;
      nodeColors[index * 3 + 2] = tmpColor.b;
    }
    nodeGeometry.setAttribute("iOffset", new three.InstancedBufferAttribute(positions, 3));
    nodeGeometry.setAttribute("iSize", new three.InstancedBufferAttribute(nodeSizes, 1));
    nodeGeometry.setAttribute("iColor", new three.InstancedBufferAttribute(nodeColors, 3));
    nodeGeometry.setAttribute("iAlpha", new three.InstancedBufferAttribute(nodeAlphas, 1));

    const nodeMaterial = new three.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uDamping: { value: 1 } },
      vertexShader: NODE_VERTEX_SHADER,
      fragmentShader: NODE_FRAGMENT_SHADER,
    });
    const nodeMesh = new three.Mesh(nodeGeometry, nodeMaterial);
    nodeMesh.frustumCulled = false;
    scene.add(nodeMesh);
    return { nodeAlphas, nodeGeometry, nodeMaterial, nodeMesh };
  };

  const buildEdgeLayer = (
    edgeCount: number,
    positions: Float32Array,
    links: Float32Array,
    edgeWeights: Float32Array,
    communities: Uint16Array
  ) => {
    const segments = config.edgeSegments;
    const templateParams: number[] = [];
    for (let segment = 0; segment <= segments; segment += 1) {
      templateParams.push(segment / segments, -1, segment / segments, 1);
    }
    const templateIndex: number[] = [];
    for (let segment = 0; segment < segments; segment += 1) {
      const base = segment * 2;
      templateIndex.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const edgeGeometry = new three.InstancedBufferGeometry();
    edgeGeometry.setAttribute("param", new three.Float32BufferAttribute(templateParams, 2));
    edgeGeometry.setIndex(templateIndex);
    edgeGeometry.instanceCount = edgeCount;

    const p0 = new Float32Array(edgeCount * 3);
    const p1 = new Float32Array(edgeCount * 3);
    const ctrl = new Float32Array(edgeCount * 3);
    const edgeColors = new Float32Array(edgeCount * 3);
    const edgeAlphas = new Float32Array(edgeCount);
    const edgeWidths = new Float32Array(edgeCount);
    const globalEdgeOpacity = globalEdgeOpacityFor(edgeCount);
    const paintTarget: EdgePaintTarget = { communities, edgeAlphas, edgeColors, links };

    for (let edge = 0; edge < edgeCount; edge += 1) {
      const source = links[edge * 2]!;
      const target = links[edge * 2 + 1]!;
      va.fromArray(positions, source * 3);
      vb.fromArray(positions, target * 3);
      dir.subVectors(vb, va);
      const length = dir.length();
      dir.normalize();
      // Control point: midpoint + perpendicular offset of len × curvature,
      // rotated `edgeCurveRotation` radians about the link axis.
      perp.crossVectors(dir, Math.abs(dir.y) > 0.9 ? altAxis : upAxis).normalize();
      perp.applyAxisAngle(dir, config.edgeCurveRotation);
      ctrl[edge * 3] = (va.x + vb.x) / 2 + perp.x * length * config.edgeCurvature;
      ctrl[edge * 3 + 1] = (va.y + vb.y) / 2 + perp.y * length * config.edgeCurvature;
      ctrl[edge * 3 + 2] = (va.z + vb.z) / 2 + perp.z * length * config.edgeCurvature;
      p0[edge * 3] = va.x;
      p0[edge * 3 + 1] = va.y;
      p0[edge * 3 + 2] = va.z;
      p1[edge * 3] = vb.x;
      p1[edge * 3 + 1] = vb.y;
      p1[edge * 3 + 2] = vb.z;
      paintEdgeCommunity(paintTarget, edge, (0.5 + 0.5 * edgeWeights[edge]!) * globalEdgeOpacity);
      edgeWidths[edge] = config.edgeWidthBase + config.edgeWidthScale * edgeWeights[edge]! ** 1.2;
    }

    edgeGeometry.setAttribute("iP0", new three.InstancedBufferAttribute(p0, 3));
    edgeGeometry.setAttribute("iP1", new three.InstancedBufferAttribute(p1, 3));
    edgeGeometry.setAttribute("iCtrl", new three.InstancedBufferAttribute(ctrl, 3));
    edgeGeometry.setAttribute("iColor", new three.InstancedBufferAttribute(edgeColors, 3));
    edgeGeometry.setAttribute("iAlpha", new three.InstancedBufferAttribute(edgeAlphas, 1));
    edgeGeometry.setAttribute("iWidth", new three.InstancedBufferAttribute(edgeWidths, 1));

    const edgeMaterial = new three.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: three.DoubleSide,
      vertexShader: EDGE_VERTEX_SHADER,
      fragmentShader: EDGE_FRAGMENT_SHADER,
    });
    const edgeMesh = new three.Mesh(edgeGeometry, edgeMaterial);
    edgeMesh.frustumCulled = false;
    scene.add(edgeMesh);
    return { edgeAlphas, edgeColors, edgeGeometry, edgeMaterial, edgeMesh };
  };

  // Fixed sprite pool; textures for the top-importance slots are rasterized at
  // build time so the first frame carries no rasterization spike.
  const buildLabelPool = (labels: ReadonlyArray<string>, importanceOrder: Uint32Array): Array<LabelSlot> => {
    const labelPool: Array<LabelSlot> = [];
    if (labels.length === 0) {
      return labelPool;
    }
    for (let index = 0; index < config.labelPoolSize; index += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const texture = new three.CanvasTexture(canvas);
      texture.colorSpace = three.SRGBColorSpace;
      const material = new three.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new three.Sprite(material);
      sprite.renderOrder = 1000;
      sprite.visible = false;
      scene.add(sprite);
      const slot: LabelSlot = { sprite, canvas, texture, material, nodeIndex: -1, aspect: 4 };
      const nodeIndex = importanceOrder[index];
      if (P.isNotUndefined(nodeIndex) && P.isNotUndefined(labels[nodeIndex])) {
        slot.nodeIndex = nodeIndex;
        drawLabelText(slot, labels[nodeIndex]!);
      }
      labelPool.push(slot);
    }
    return labelPool;
  };

  // Camera fit: frame the bounding sphere of the baked layout.
  const cameraFraming = (
    positions: Float32Array,
    nodeCount: number
  ): { readonly center: THREE.Vector3; readonly fitDistance: number } => {
    const center = new three.Vector3();
    for (let index = 0; index < nodeCount; index += 1) {
      center.x += positions[index * 3]!;
      center.y += positions[index * 3 + 1]!;
      center.z += positions[index * 3 + 2]!;
    }
    center.divideScalar(Math.max(1, nodeCount));
    let radius = 1;
    for (let index = 0; index < nodeCount; index += 1) {
      scratch.fromArray(positions, index * 3);
      radius = Math.max(radius, scratch.distanceTo(center));
    }
    const fitDistance = (radius * 1.2) / Math.tan(((config.cameraFov / 2) * Math.PI) / 180);
    return { center, fitDistance };
  };

  const buildSceneGraph = (projection: Graph3DProjection): SceneGraph => {
    const nodeCount = projection.nodeCount;
    const edgeCount = projection.edgeCount;
    // Owned copies: the projection is caller data and must stay immutable
    // across the handle's lifetime.
    const positions = new Float32Array(projection.pointPositions);
    const importance = new Float32Array(projection.nodeImportance);
    const communities = new Uint16Array(projection.nodeCommunities);
    const links = new Float32Array(projection.links);
    const edgeWeights = new Float32Array(projection.edgeWeights);
    const labels = P.isUndefined(projection.labels) ? [] : [...projection.labels];

    const adjacency = A.makeBy(nodeCount, (): Array<number> => []);
    for (let edge = 0; edge < edgeCount; edge += 1) {
      const source = links[edge * 2]!;
      const target = links[edge * 2 + 1]!;
      adjacency[source]?.push(target);
      adjacency[target]?.push(source);
    }

    const importanceOrder = new Uint32Array(nodeCount);
    for (let index = 0; index < nodeCount; index += 1) {
      importanceOrder[index] = index;
    }
    importanceOrder.sort((left, right) => importance[right]! - importance[left]! || left - right);

    const nodeLayer = buildNodeLayer(nodeCount, positions, importance, communities);
    const edgeLayer = buildEdgeLayer(edgeCount, positions, links, edgeWeights, communities);
    const labelPool = buildLabelPool(labels, importanceOrder);
    const framing = cameraFraming(positions, nodeCount);

    return {
      ...nodeLayer,
      ...edgeLayer,
      labelPool,
      positions,
      importance,
      communities,
      links,
      edgeWeights,
      labels,
      adjacency,
      importanceOrder,
      center: framing.center,
      fitDistance: framing.fitDistance,
    };
  };

  const fitCamera = (): void => {
    if (P.isUndefined(sceneGraph)) {
      return;
    }
    camera.position.set(sceneGraph.center.x, sceneGraph.center.y, sceneGraph.center.z + sceneGraph.fitDistance);
    camera.lookAt(sceneGraph.center);
    controls.target.copy(sceneGraph.center);
  };

  const paintClearedSelection = (current: SceneGraph): void => {
    current.nodeAlphas.fill(1);
    const globalEdgeOpacity = globalEdgeOpacityFor(current.edgeAlphas.length);
    for (let edge = 0; edge < current.edgeAlphas.length; edge += 1) {
      paintEdgeCommunity(current, edge, (0.5 + 0.5 * current.edgeWeights[edge]!) * globalEdgeOpacity);
    }
  };

  const paintDimmedSelection = (current: SceneGraph, nodeIndex: number): void => {
    // Uint8 membership mask over node indices: 1 = selected node or neighbor.
    const neighborhood = new Uint8Array(current.nodeAlphas.length);
    neighborhood[nodeIndex] = 1;
    for (const neighbor of current.adjacency[nodeIndex] ?? []) {
      neighborhood[neighbor] = 1;
    }
    for (let index = 0; index < current.nodeAlphas.length; index += 1) {
      current.nodeAlphas[index] = neighborhood[index] === 1 ? 1 : config.dimmedNodeOpacity;
    }
    for (let edge = 0; edge < current.edgeAlphas.length; edge += 1) {
      const source = current.links[edge * 2]!;
      const target = current.links[edge * 2 + 1]!;
      if (source === nodeIndex || target === nodeIndex) {
        paintEdgeCommunity(current, edge, 1);
      } else {
        current.edgeColors[edge * 3] = DIMMED_EDGE_RGB;
        current.edgeColors[edge * 3 + 1] = DIMMED_EDGE_RGB;
        current.edgeColors[edge * 3 + 2] = DIMMED_EDGE_RGB;
        current.edgeAlphas[edge] = config.dimmedEdgeOpacity;
      }
    }
  };

  const applySelection = (nodeIndex: number | undefined): void => {
    if (P.isUndefined(sceneGraph)) {
      return;
    }
    selectedIndex = nodeIndex;
    const current = sceneGraph;
    if (P.isUndefined(nodeIndex)) {
      paintClearedSelection(current);
    } else {
      paintDimmedSelection(current, nodeIndex);
    }
    (current.nodeGeometry.getAttribute("iAlpha") as THREE.InstancedBufferAttribute).needsUpdate = true;
    (current.edgeGeometry.getAttribute("iColor") as THREE.InstancedBufferAttribute).needsUpdate = true;
    (current.edgeGeometry.getAttribute("iAlpha") as THREE.InstancedBufferAttribute).needsUpdate = true;
  };

  let visibleLabels = 0;
  const updateLabels = (): void => {
    if (P.isUndefined(sceneGraph) || sceneGraph.labelPool.length === 0) {
      return;
    }
    const current = sceneGraph;
    const nodeCount = current.positions.length / 3;
    const cameraDistance = camera.position.distanceTo(current.center);
    const zoomFactor = (700 / Math.max(1, cameraDistance)) ** 0.7;
    const budget = Math.min(
      config.labelBudgetMax,
      Math.max(config.labelBudgetMin, Math.round(4.5 * Math.sqrt(nodeCount) * zoomFactor))
    );
    const damping = zoomDamping(cameraDistance);
    camera.getWorldDirection(camDir);
    const fullyOpaqueFloor = Math.max(2, Math.round(10 * zoomFactor));
    const opaqueBand = Math.max(fullyOpaqueFloor, Math.round(budget * 0.15));

    visibleLabels = 0;
    let poolIndex = 0;
    const admit = (nodeIndex: number, rank: number): void => {
      const slot = current.labelPool[poolIndex];
      if (P.isUndefined(slot) || P.isUndefined(current.labels[nodeIndex])) {
        return;
      }
      poolIndex += 1;
      if (slot.nodeIndex !== nodeIndex) {
        slot.nodeIndex = nodeIndex;
        drawLabelText(slot, current.labels[nodeIndex]!);
      }
      scratch.fromArray(current.positions, nodeIndex * 3);
      const behind = va.copy(scratch).sub(current.center).dot(camDir);
      const depthFade = 1 - 0.85 * smoothstep01((behind - 35) / 130);
      let bandOpacity = 1;
      if (rank > opaqueBand && rank > budget * 0.5) {
        bandOpacity = Math.max(0.1, 1 - smoothstep01((rank - budget * 0.5) / (budget * 0.5)));
      }
      const dimmed =
        P.isNotUndefined(selectedIndex) &&
        nodeIndex !== selectedIndex &&
        !current.adjacency[selectedIndex]?.includes(nodeIndex)
          ? config.dimmedNodeOpacity
          : 1;
      const logical = logicalSize(current.importance[nodeIndex]!);
      const worldHeight = (logical + 8) * damping * 0.75;
      slot.sprite.position.set(scratch.x, scratch.y + logical * config.sizeWorldFactor * damping * 0.75, scratch.z);
      slot.sprite.scale.set(worldHeight * slot.aspect, worldHeight, 1);
      slot.material.opacity = Math.max(0.1, bandOpacity * depthFade) * dimmed;
      slot.sprite.visible = true;
      visibleLabels += 1;
    };

    // interaction override first: the selected node's label is always admitted
    if (P.isNotUndefined(selectedIndex)) {
      admit(selectedIndex, 1);
    }
    const poolLimit = Math.min(budget, current.labelPool.length);
    for (let rank = 0; rank < current.importanceOrder.length && poolIndex < poolLimit; rank += 1) {
      const nodeIndex = current.importanceOrder[rank]!;
      if (nodeIndex === selectedIndex) {
        continue;
      }
      admit(nodeIndex, poolIndex + 1);
    }
    for (; poolIndex < current.labelPool.length; poolIndex += 1) {
      current.labelPool[poolIndex]!.sprite.visible = false;
    }
  };

  const pick = (clientX: number, clientY: number): number | undefined => {
    if (P.isUndefined(sceneGraph)) {
      return undefined;
    }
    const current = sceneGraph;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    camera.getWorldDirection(camDir);
    let best = -1;
    let bestDistance = config.pickRadiusPx * config.pickRadiusPx;
    const nodeCount = current.positions.length / 3;
    for (let index = 0; index < nodeCount; index += 1) {
      scratch.fromArray(current.positions, index * 3);
      // reject points behind the camera plane before projecting
      if (va.copy(scratch).sub(camera.position).dot(camDir) <= camera.near) {
        continue;
      }
      scratch.project(camera);
      const screenX = ((scratch.x + 1) / 2) * rect.width;
      const screenY = ((1 - scratch.y) / 2) * rect.height;
      const distance = (screenX - pointerX) * (screenX - pointerX) + (screenY - pointerY) * (screenY - pointerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return best >= 0 ? best : undefined;
  };

  const onClick = (event: MouseEvent): void => {
    const hit = pick(event.clientX, event.clientY);
    applySelection(hit);
    options.onNodeSelect?.(hit);
  };
  renderer.domElement.addEventListener("click", onClick);

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    options.onRuntimeError?.(
      Graph3DDriverError.make({
        reason: "renderFailed",
        message: "The WebGL context was lost.",
      })
    );
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  const resizeObserver = P.isFunction(globalThis.ResizeObserver)
    ? new ResizeObserver(() => {
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      })
    : undefined;
  resizeObserver?.observe(container);

  // frame loop + fps sampling from real frame deltas
  const frameDeltas: number[] = [];
  let lastFrameTime = 0;
  let frameId = 0;
  const animate = (time: number): void => {
    frameId = globalThis.requestAnimationFrame(animate);
    if (lastFrameTime !== 0) {
      frameDeltas.push(time - lastFrameTime);
      if (frameDeltas.length > 120) {
        frameDeltas.shift();
      }
    }
    lastFrameTime = time;
    controls.update();
    if (P.isNotUndefined(sceneGraph)) {
      const cameraDistance = camera.position.distanceTo(sceneGraph.center);
      const dampingUniform = sceneGraph.nodeMaterial.uniforms.uDamping;
      if (P.isNotUndefined(dampingUniform)) {
        dampingUniform.value = zoomDamping(cameraDistance);
      }
    }
    updateLabels();
    renderer.render(scene, camera);
  };
  frameId = globalThis.requestAnimationFrame(animate);

  sceneGraph = buildSceneGraph(initialProjection);
  fitCamera();

  return {
    backend: "three-instanced" as const,
    fps: () => {
      if (frameDeltas.length === 0) {
        return 0;
      }
      const total = frameDeltas.reduce((sum, delta) => sum + delta, 0);
      return (frameDeltas.length * 1_000) / total;
    },
    update: (projection: Graph3DProjection) => {
      if (destroyed) {
        return;
      }
      // Incoherent buffers at a trusted boundary are a programmer error.
      if (!Graph3DProjection.hasCoherentBuffers(projection)) {
        options.onRuntimeError?.(
          Graph3DDriverError.adapterInvariant("The 3D graph projection buffers are incoherent.")
        );
        return;
      }
      // Full-projection replacement (cosmos parity): topology can change
      // across updates (focus reprojection), so the scene graph is rebuilt
      // and selection identity resets — the ontology bridge re-applies it by
      // resolving its selected IRI against the new projection.
      disposeSceneGraph();
      selectedIndex = undefined;
      sceneGraph = buildSceneGraph(projection);
    },
    select: (nodeIndex: number | undefined) => {
      if (!destroyed) {
        applySelection(nodeIndex);
      }
    },
    stats: () => {
      if (P.isUndefined(sceneGraph)) {
        return Graph3DRenderStats.make({ nodeCount: 0, edgeCount: 0, visibleLabelCount: 0, dimmedNodeCount: 0 });
      }
      let dimmedNodeCount = 0;
      for (let index = 0; index < sceneGraph.nodeAlphas.length; index += 1) {
        if (sceneGraph.nodeAlphas[index]! < 1) {
          dimmedNodeCount += 1;
        }
      }
      return Graph3DRenderStats.make({
        nodeCount: sceneGraph.positions.length / 3,
        edgeCount: sceneGraph.edgeAlphas.length,
        visibleLabelCount: visibleLabels,
        dimmedNodeCount,
        ...(P.isUndefined(selectedIndex) ? {} : { selectedNodeIndex: selectedIndex }),
      });
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      if (P.isFunction(globalThis.cancelAnimationFrame)) {
        globalThis.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      controls.dispose();
      disposeSceneGraph();
      renderer.dispose();
      renderer.domElement.remove();
    },
  } satisfies Graph3DRenderHandle;
};

/**
 * Renders a 3D graph projection with the instanced three.js backend.
 *
 * @remarks
 * The returned handle owns the frame loop, controls, listeners, observers,
 * GPU geometries/materials/textures, and the canvas; call `destroy` when the
 * host unmounts the graph. WebGL2 is required — there is no fallback backend.
 *
 * @example
 * ```ts
 * import { Graph3DProjection, renderGraph3D } from "@beep/graph-3d/browser"
 * import { Effect } from "effect"
 *
 * const projection = Graph3DProjection.make({
 *   nodeCount: 2,
 *   edgeCount: 1,
 *   nodeIds: new Uint32Array([0, 1]),
 *   pointPositions: new Float32Array([0, 0, 0, 10, 0, 0]),
 *   links: new Float32Array([0, 1]),
 *   nodeCommunities: new Uint16Array([0, 1]),
 *   nodeImportance: new Float32Array([1, 0.2]),
 *   edgeWeights: new Float32Array([0.5])
 * })
 * const backend = renderGraph3D(document.createElement("div"), projection).pipe(
 *   Effect.map((handle) => handle.backend)
 * )
 *
 * console.log(backend)
 * ```
 *
 * @effects Mounts a browser WebGL renderer and starts a request-animation-frame loop.
 *
 * @category adapters
 * @since 0.0.0
 */
export const renderGraph3D = Effect.fn("Graph3D.renderGraph3D")(function* (
  container: HTMLElement,
  projection: Graph3DProjection,
  options?: Graph3DRenderOptions
) {
  if (!probeWebGl2()) {
    return yield* Graph3DDriverError.make({
      reason: "webglUnavailable",
      message: "WebGL2 is unavailable; the 3D graph renderer requires it.",
    });
  }
  if (!Graph3DProjection.hasCoherentBuffers(projection)) {
    return yield* Graph3DDriverError.adapterInvariant("The 3D graph projection buffers are incoherent.");
  }
  const three = yield* loadThreeModule;
  const controlsModule = yield* loadControlsModule;
  return yield* Effect.try({
    try: () =>
      mountRenderer(
        three,
        controlsModule.TrackballControls,
        container,
        projection,
        options ?? Graph3DRenderOptions.make({})
      ),
    catch: Graph3DDriverError.fromUnknown("renderFailed")("Failed to mount the 3D graph renderer."),
  });
});
