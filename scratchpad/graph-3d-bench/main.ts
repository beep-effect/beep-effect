/**
 * P0 design-gate benchmark: clean-room instanced Three.js graph renderer at ~2,500 nodes.
 *
 * Architecture under test (DESIGN.md D1, custom instanced driver on catalog three@0.185.1):
 *  - worker-analog layout: deterministic seed + grid-bounded force relaxation (D4 prototype)
 *  - nodes: one InstancedBufferGeometry draw of camera-facing circle quads
 *  - edges: one InstancedBufferGeometry draw of quadratic-Bezier ribbons (30 segments)
 *  - labels: pooled canvas-texture sprites, adaptive budget K with rank/fade declutter,
 *    selection override
 *  - picking: CPU screen-space nearest-node (measured during the sweep)
 *  - selection dimming: full per-instance alpha/color attribute rewrite
 *  - handle shape: mount() -> { update, select, destroy } exercising the full teardown table
 *
 * URL params: ?nodes=2500&edges=5000&auto=1
 * All visual parameters come from the prose spec in goals/graph-3d-view/research/
 * (bundle-static-analysis.md, label-anti-overlap.md, VERIFICATION.md). No bundle code.
 */
import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";

const params = new URLSearchParams(location.search);
const NODE_COUNT = Number(params.get("nodes") ?? 2500);
const EDGE_COUNT = Number(params.get("edges") ?? 5000);
const COMMUNITY_COUNT = 8;
const LABEL_POOL = 96;
const BENCH_SECONDS = 20;

// 12-slot community palette (prose spec, bundle-static-analysis.md §3)
const PALETTE = [
  0xa6cee3, 0x1f78b4, 0xb2df8a, 0x33a02c, 0xfb9a99, 0xe31a1c, 0xfdbf6f, 0xff7f00, 0xcab2d6, 0x6a3d9a, 0xffff99,
  0xb15928,
];

// ---------------------------------------------------------------------------
// deterministic PRNG
// ---------------------------------------------------------------------------
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---------------------------------------------------------------------------
// synthetic graph
// ---------------------------------------------------------------------------
interface GraphData {
  positions: Float32Array; // xyz, stride 3 — output of the layout pass
  community: Uint8Array;
  importance: Float32Array; // normalized [0,1] bc-analog
  labels: string[];
  edges: Uint32Array; // pairs
  edgeWeight: Float32Array; // normalized [0,1]
  adjacency: number[][];
  order: Uint32Array; // node indices sorted importance desc
  layoutMs: number;
  layoutTicks: number;
}

const buildGraph = (): GraphData => {
  const rand = mulberry32(1337);
  const syllables = ["ka", "lo", "mi", "ra", "ve", "tu", "so", "ne", "pi", "da", "fu", "ge", "ba", "chi", "or", "ex"];
  const pseudoWord = () => {
    const n = 2 + Math.floor(rand() * 3);
    let w = "";
    for (let i = 0; i < n; i++) w += syllables[Math.floor(rand() * syllables.length)];
    return w;
  };
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const positions = new Float32Array(NODE_COUNT * 3);
  const community = new Uint8Array(NODE_COUNT);
  const importance = new Float32Array(NODE_COUNT);
  const labels: string[] = new Array(NODE_COUNT);

  // deterministic seed: community centers on a sphere shell, gaussian scatter
  const centers: Array<[number, number, number]> = [];
  for (let c = 0; c < COMMUNITY_COUNT; c++) {
    const phi = Math.acos(1 - (2 * (c + 0.5)) / COMMUNITY_COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * c;
    centers.push([260 * Math.sin(phi) * Math.cos(theta), 260 * Math.sin(phi) * Math.sin(theta), 260 * Math.cos(phi)]);
  }
  let maxRawImportance = 0;
  for (let i = 0; i < NODE_COUNT; i++) {
    const c = Math.floor(rand() * COMMUNITY_COUNT);
    community[i] = c;
    const [cx, cy, cz] = centers[c]!;
    positions[i * 3] = cx + gauss() * 95;
    positions[i * 3 + 1] = cy + gauss() * 95;
    positions[i * 3 + 2] = cz + gauss() * 95;
    const p = Math.pow(rand(), 8) * 0.4; // pareto skew mirroring reference bc distribution
    importance[i] = p;
    maxRawImportance = Math.max(maxRawImportance, p);
    labels[i] = pseudoWord();
  }
  for (let i = 0; i < NODE_COUNT; i++) importance[i] = importance[i]! / maxRawImportance;

  const edges = new Uint32Array(EDGE_COUNT * 2);
  const edgeWeight = new Float32Array(EDGE_COUNT);
  const adjacency: number[][] = Array.from({ length: NODE_COUNT }, () => []);
  const byCommunity: number[][] = Array.from({ length: COMMUNITY_COUNT }, () => []);
  for (let i = 0; i < NODE_COUNT; i++) byCommunity[community[i]!]!.push(i);
  const pickFrom = (pool: number[]) => pool[Math.floor(Math.pow(rand(), 2) * pool.length)]!;

  let maxW = 0;
  for (let e = 0; e < EDGE_COUNT; e++) {
    const intra = rand() < 0.7;
    let a: number;
    let b: number;
    if (intra) {
      const pool = byCommunity[Math.floor(rand() * COMMUNITY_COUNT)]!;
      a = pickFrom(pool);
      b = pickFrom(pool);
    } else {
      a = pickFrom(byCommunity[Math.floor(rand() * COMMUNITY_COUNT)]!);
      b = pickFrom(byCommunity[Math.floor(rand() * COMMUNITY_COUNT)]!);
    }
    if (a === b) b = (b + 1) % NODE_COUNT;
    edges[e * 2] = a;
    edges[e * 2 + 1] = b;
    const w = 1 + Math.pow(rand(), 3) * 9;
    edgeWeight[e] = w;
    maxW = Math.max(maxW, w);
    adjacency[a]!.push(b);
    adjacency[b]!.push(a);
  }
  for (let e = 0; e < EDGE_COUNT; e++) edgeWeight[e] = edgeWeight[e]! / maxW;

  const order = new Uint32Array(NODE_COUNT);
  for (let i = 0; i < NODE_COUNT; i++) order[i] = i;
  order.sort((x, y) => importance[y]! - importance[x]!);

  // ---- force relaxation (D4 worker-algorithm prototype, DOM-free) ----------
  // d3-family model with the prose-spec constants where scale-independent:
  // charge -60 bounded to range 150 (grid-bucketed), springs 50 intra / 150
  // cross-community, centering, velocityDecay 0.4, alpha 1 -> <0.02 at decay
  // 0.10 (39 ticks). Collision/radial-limit terms are reference-scale and
  // replaced by a soft radial containment at R=420 (product-tuned).
  const t0 = performance.now();
  const vel = new Float32Array(NODE_COUNT * 3);
  const CHARGE = -60;
  const RANGE = 150;
  const CELL = RANGE;
  let alpha = 1;
  let ticks = 0;
  const grid = new Map<number, number[]>();
  const cellKey = (x: number, y: number, z: number) =>
    (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0) >>> 0;

  while (alpha >= 0.02 && ticks < 60) {
    alpha *= 0.9;
    ticks += 1;
    // rebuild spatial hash
    grid.clear();
    for (let i = 0; i < NODE_COUNT; i++) {
      const k = cellKey(
        Math.floor(positions[i * 3]! / CELL),
        Math.floor(positions[i * 3 + 1]! / CELL),
        Math.floor(positions[i * 3 + 2]! / CELL)
      );
      const bucket = grid.get(k);
      if (bucket) bucket.push(i);
      else grid.set(k, [i]);
    }
    // bounded many-body repulsion over the 27-cell neighborhood
    for (let i = 0; i < NODE_COUNT; i++) {
      const ix = positions[i * 3]!;
      const iy = positions[i * 3 + 1]!;
      const iz = positions[i * 3 + 2]!;
      const cx = Math.floor(ix / CELL);
      const cy = Math.floor(iy / CELL);
      const cz = Math.floor(iz / CELL);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++)
          for (let oz = -1; oz <= 1; oz++) {
            const bucket = grid.get(cellKey(cx + ox, cy + oy, cz + oz));
            if (!bucket) continue;
            for (const j of bucket) {
              if (j === i) continue;
              const dx = ix - positions[j * 3]!;
              const dy = iy - positions[j * 3 + 1]!;
              const dz = iz - positions[j * 3 + 2]!;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > RANGE * RANGE || d2 < 1e-6) continue;
              const f = (-CHARGE * alpha) / d2;
              const d = Math.sqrt(d2);
              vel[i * 3] += (dx / d) * f;
              vel[i * 3 + 1] += (dy / d) * f;
              vel[i * 3 + 2] += (dz / d) * f;
            }
          }
    }
    // link springs
    for (let e = 0; e < EDGE_COUNT; e++) {
      const a = edges[e * 2]!;
      const b = edges[e * 2 + 1]!;
      const rest = community[a] === community[b] ? 50 : 150;
      const dx = positions[b * 3]! - positions[a * 3]!;
      const dy = positions[b * 3 + 1]! - positions[a * 3 + 1]!;
      const dz = positions[b * 3 + 2]! - positions[a * 3 + 2]!;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const k = ((d - rest) / d) * alpha * 0.3;
      const fx = dx * k;
      const fy = dy * k;
      const fz = dz * k;
      const degA = Math.max(1, adjacency[a]!.length);
      const degB = Math.max(1, adjacency[b]!.length);
      const biasA = degB / (degA + degB);
      vel[a * 3] += fx * biasA;
      vel[a * 3 + 1] += fy * biasA;
      vel[a * 3 + 2] += fz * biasA;
      vel[b * 3] -= fx * (1 - biasA);
      vel[b * 3 + 1] -= fy * (1 - biasA);
      vel[b * 3 + 2] -= fz * (1 - biasA);
    }
    // integrate with velocity decay + soft radial containment + centering
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (let i = 0; i < NODE_COUNT; i++) {
      vel[i * 3] *= 0.6;
      vel[i * 3 + 1] *= 0.6;
      vel[i * 3 + 2] *= 0.6;
      positions[i * 3] += vel[i * 3]!;
      positions[i * 3 + 1] += vel[i * 3 + 1]!;
      positions[i * 3 + 2] += vel[i * 3 + 2]!;
      const r = Math.hypot(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
      if (r > 420) {
        const s = 1 - (0.05 * (r - 420)) / r;
        positions[i * 3] *= s;
        positions[i * 3 + 1] *= s;
        positions[i * 3 + 2] *= s;
      }
      mx += positions[i * 3]!;
      my += positions[i * 3 + 1]!;
      mz += positions[i * 3 + 2]!;
    }
    mx /= NODE_COUNT;
    my /= NODE_COUNT;
    mz /= NODE_COUNT;
    for (let i = 0; i < NODE_COUNT; i++) {
      positions[i * 3] -= mx;
      positions[i * 3 + 1] -= my;
      positions[i * 3 + 2] -= mz;
    }
  }
  const layoutMs = performance.now() - t0;

  return { positions, community, importance, labels, edges, edgeWeight, adjacency, order, layoutMs, layoutTicks: ticks };
};

// ---------------------------------------------------------------------------
// sizing model (prose spec §3)
// ---------------------------------------------------------------------------
const BC_SCALE = 22.4; // importance is normalized, so scale = min(150, 22.4/1)
const logicalSize = (imp: number) => 10 + imp * BC_SCALE;
const zoomDamping = (camDist: number) => Math.min(3, Math.max(0.35, Math.pow(camDist / 600, 0.65)));
const smoothstep = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// ---------------------------------------------------------------------------
// renderer handle — mirrors the Graph3DRenderHandle ownership table (D6/DESIGN)
// ---------------------------------------------------------------------------
interface BenchHandle {
  update: (g: GraphData) => number; // returns rewrite ms
  select: (nodeIndex: number | undefined) => void;
  pick: (clientX: number, clientY: number) => number | undefined;
  fps: () => number;
  visibleLabels: () => number;
  drawCalls: () => number;
  triangles: () => number;
  camDist: () => number;
  setBenchCamera: (t01: number) => void;
  resetCamera: () => void;
  destroy: () => void;
}

const mount = (container: HTMLElement, graph: GraphData): BenchHandle => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111); // observed canvas, not #000 fallback

  const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 1, 8000);
  camera.position.set(0, 0, 900);

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 2.2;
  controls.panSpeed = 0.3;
  controls.dynamicDampingFactor = 0.15;

  const n = graph.positions.length / 3;
  const e = graph.edges.length / 2;
  const tmpColor = new THREE.Color();

  // --- nodes -----------------------------------------------------------------
  const nodeGeo = new THREE.InstancedBufferGeometry();
  nodeGeo.setAttribute("corner", new THREE.Float32BufferAttribute([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5], 2));
  nodeGeo.setIndex([0, 1, 2, 0, 2, 3]);
  nodeGeo.instanceCount = n;
  const nodeOffsets = new THREE.InstancedBufferAttribute(graph.positions, 3);
  const nodeSizes = new Float32Array(n);
  const nodeColors = new Float32Array(n * 3);
  const nodeAlphas = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    nodeSizes[i] = logicalSize(graph.importance[i]!) * 0.5;
    tmpColor.setHex(PALETTE[graph.community[i]! % 12]!);
    nodeColors[i * 3] = tmpColor.r;
    nodeColors[i * 3 + 1] = tmpColor.g;
    nodeColors[i * 3 + 2] = tmpColor.b;
  }
  const nodeSizeAttr = new THREE.InstancedBufferAttribute(nodeSizes, 1);
  const nodeColorAttr = new THREE.InstancedBufferAttribute(nodeColors, 3);
  const nodeAlphaAttr = new THREE.InstancedBufferAttribute(nodeAlphas, 1);
  nodeGeo.setAttribute("iOffset", nodeOffsets);
  nodeGeo.setAttribute("iSize", nodeSizeAttr);
  nodeGeo.setAttribute("iColor", nodeColorAttr);
  nodeGeo.setAttribute("iAlpha", nodeAlphaAttr);

  const nodeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uDamping: { value: 1 } },
    vertexShader: /* glsl */ `
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
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying vec2 vCorner;
      void main() {
        float r = length(vCorner) * 2.0;
        float mask = 1.0 - smoothstep(0.92, 1.0, r);
        if (mask <= 0.0) discard;
        gl_FragColor = vec4(vColor, vAlpha * mask);
      }
    `,
  });
  const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
  nodeMesh.frustumCulled = false;
  scene.add(nodeMesh);

  // --- edges -----------------------------------------------------------------
  const SEGMENTS = 30;
  const tPos: number[] = [];
  for (let s = 0; s <= SEGMENTS; s++) tPos.push(s / SEGMENTS, -1, s / SEGMENTS, 1);
  const tIdx: number[] = [];
  for (let s = 0; s < SEGMENTS; s++) {
    const base = s * 2;
    tIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const edgeGeo = new THREE.InstancedBufferGeometry();
  edgeGeo.setAttribute("param", new THREE.Float32BufferAttribute(tPos, 2));
  edgeGeo.setIndex(tIdx);
  edgeGeo.instanceCount = e;

  const p0Arr = new Float32Array(e * 3);
  const p1Arr = new Float32Array(e * 3);
  const ctrlArr = new Float32Array(e * 3);
  const edgeColorArr = new Float32Array(e * 3);
  const edgeAlphaArr = new Float32Array(e);
  const edgeWidthArr = new Float32Array(e);
  // global link opacity 0.95 - sqrt(E)/100, clamped at 0.10 (design note: the
  // prose formula goes negative above 9,025 edges; the clamp is part of D1)
  const globalEdgeOpacity = Math.max(0.1, 0.95 - Math.sqrt(e) / 100);

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const perp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(1, 0, 0);

  const writeEdgeGeometry = (i: number) => {
    const a = graph.edges[i * 2]!;
    const b = graph.edges[i * 2 + 1]!;
    va.fromArray(graph.positions, a * 3);
    vb.fromArray(graph.positions, b * 3);
    dir.subVectors(vb, va);
    const len = dir.length();
    dir.normalize();
    perp.crossVectors(dir, Math.abs(dir.y) > 0.9 ? alt : up).normalize();
    perp.applyAxisAngle(dir, 0.25);
    ctrlArr[i * 3] = (va.x + vb.x) / 2 + perp.x * len * 0.25;
    ctrlArr[i * 3 + 1] = (va.y + vb.y) / 2 + perp.y * len * 0.25;
    ctrlArr[i * 3 + 2] = (va.z + vb.z) / 2 + perp.z * len * 0.25;
    p0Arr.set([va.x, va.y, va.z], i * 3);
    p1Arr.set([vb.x, vb.y, vb.z], i * 3);
  };
  const baseEdgeColor = (i: number) => {
    const a = graph.edges[i * 2]!;
    tmpColor.setHex(PALETTE[graph.community[a]! % 12]!);
    edgeColorArr[i * 3] = tmpColor.r;
    edgeColorArr[i * 3 + 1] = tmpColor.g;
    edgeColorArr[i * 3 + 2] = tmpColor.b;
    edgeAlphaArr[i] = (0.5 + 0.5 * graph.edgeWeight[i]!) * globalEdgeOpacity;
  };
  const writeAllEdges = () => {
    for (let i = 0; i < e; i++) {
      writeEdgeGeometry(i);
      baseEdgeColor(i);
      edgeWidthArr[i] = 0.4 + 4.6 * Math.pow(graph.edgeWeight[i]!, 1.2);
    }
  };
  writeAllEdges();

  const p0Attr = new THREE.InstancedBufferAttribute(p0Arr, 3);
  const p1Attr = new THREE.InstancedBufferAttribute(p1Arr, 3);
  const ctrlAttr = new THREE.InstancedBufferAttribute(ctrlArr, 3);
  const edgeColorAttr = new THREE.InstancedBufferAttribute(edgeColorArr, 3);
  const edgeAlphaAttr = new THREE.InstancedBufferAttribute(edgeAlphaArr, 1);
  const edgeWidthAttr = new THREE.InstancedBufferAttribute(edgeWidthArr, 1);
  edgeGeo.setAttribute("iP0", p0Attr);
  edgeGeo.setAttribute("iP1", p1Attr);
  edgeGeo.setAttribute("iCtrl", ctrlAttr);
  edgeGeo.setAttribute("iColor", edgeColorAttr);
  edgeGeo.setAttribute("iAlpha", edgeAlphaAttr);
  edgeGeo.setAttribute("iWidth", edgeWidthAttr);

  const edgeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
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
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
  });
  const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
  edgeMesh.frustumCulled = false;
  scene.add(edgeMesh);

  // --- labels ----------------------------------------------------------------
  interface PooledLabel {
    sprite: THREE.Sprite;
    canvas: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    material: THREE.SpriteMaterial;
    nodeId: number;
    aspect: number;
  }
  const labelPool: PooledLabel[] = [];
  for (let i = 0; i < LABEL_POOL; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 1000;
    sprite.visible = false;
    scene.add(sprite);
    labelPool.push({ sprite, canvas, texture, material, nodeId: -1, aspect: 4 });
  }
  const drawLabelText = (label: PooledLabel, text: string) => {
    const ctx = label.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, label.canvas.width, label.canvas.height);
    ctx.font = "90px system-ui, sans-serif"; // rasterized at 90px per prose spec
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    const metrics = ctx.measureText(text);
    const w = Math.min(metrics.width, label.canvas.width - 8);
    ctx.fillText(text, (label.canvas.width - w) / 2, label.canvas.height / 2, w);
    label.texture.needsUpdate = true;
  };
  // pre-rasterize the top-pool candidates so the first frame carries no
  // rasterization spike (DESIGN §9 cold-start note)
  for (let i = 0; i < LABEL_POOL && i < graph.order.length; i++) {
    const id = graph.order[i]!;
    labelPool[i]!.nodeId = id;
    drawLabelText(labelPool[i]!, graph.labels[id]!);
  }

  const graphCenter = new THREE.Vector3(0, 0, 0);
  const nodePos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const toNode = new THREE.Vector3();
  let visibleLabels = 0;

  let selection: { anchor: number; keep: Set<number> } | null = null;

  const updateLabels = () => {
    const camDist = camera.position.distanceTo(graphCenter);
    const zoomFactor = Math.pow(700 / camDist, 0.7);
    const K = Math.min(90, Math.max(8, Math.round(4.5 * Math.sqrt(n) * zoomFactor)));
    const damping = zoomDamping(camDist);
    camera.getWorldDirection(camDir);
    const fullyOpaque = Math.max(2, Math.round(10 * zoomFactor));
    const opaqueBand = Math.max(fullyOpaque, Math.round(K * 0.15));

    visibleLabels = 0;
    let poolIdx = 0;
    // selection override: the selected node's label is always admitted first
    const admit = (id: number, rankInBudget: number) => {
      const label = labelPool[poolIdx]!;
      poolIdx += 1;
      if (label.nodeId !== id) {
        label.nodeId = id;
        drawLabelText(label, graph.labels[id]!);
      }
      nodePos.fromArray(graph.positions, id * 3);
      const behind = toNode.copy(nodePos).sub(graphCenter).dot(camDir);
      const depthFade = 1 - 0.85 * smoothstep((behind - 35) / 130);
      let bandOpacity = 1;
      if (rankInBudget > opaqueBand && rankInBudget > K * 0.5) {
        bandOpacity = Math.max(0.1, 1 - smoothstep((rankInBudget - K * 0.5) / (K * 0.5)));
      }
      const dimmed = selection && !selection.keep.has(id) ? 0.1 : 1;
      const logical = logicalSize(graph.importance[id]!);
      const worldH = (logical + 8) * damping * 0.75;
      label.sprite.position.set(nodePos.x, nodePos.y + logical * 0.5 * damping * 0.75, nodePos.z);
      label.sprite.scale.set(worldH * label.aspect, worldH, 1);
      label.material.opacity = Math.max(0.1, bandOpacity * depthFade) * dimmed;
      label.sprite.visible = true;
      visibleLabels += 1;
    };
    if (selection) admit(selection.anchor, 1);
    for (let rank = 0; rank < graph.order.length && poolIdx < Math.min(K, LABEL_POOL); rank++) {
      const id = graph.order[rank]!;
      if (selection && id === selection.anchor) continue;
      admit(id, poolIdx + 1);
    }
    for (; poolIdx < LABEL_POOL; poolIdx++) labelPool[poolIdx]!.sprite.visible = false;
  };

  // --- selection -------------------------------------------------------------
  const applySelection = (nodeIndex: number | undefined) => {
    if (nodeIndex === undefined) {
      selection = null;
      nodeAlphas.fill(1);
      for (let i = 0; i < e; i++) baseEdgeColor(i);
    } else {
      const keep = new Set<number>([nodeIndex, ...graph.adjacency[nodeIndex]!]);
      selection = { anchor: nodeIndex, keep };
      for (let i = 0; i < n; i++) nodeAlphas[i] = keep.has(i) ? 1 : 0.1;
      for (let i = 0; i < e; i++) {
        const a = graph.edges[i * 2]!;
        const b = graph.edges[i * 2 + 1]!;
        if (a === nodeIndex || b === nodeIndex) {
          baseEdgeColor(i);
          edgeAlphaArr[i] = 1.0;
        } else {
          edgeColorArr[i * 3] = 80 / 255;
          edgeColorArr[i * 3 + 1] = 80 / 255;
          edgeColorArr[i * 3 + 2] = 80 / 255;
          edgeAlphaArr[i] = 0.3;
        }
      }
    }
    nodeAlphaAttr.needsUpdate = true;
    edgeColorAttr.needsUpdate = true;
    edgeAlphaAttr.needsUpdate = true;
  };

  const camPos = new THREE.Vector3();
  const pick = (clientX: number, clientY: number): number | undefined => {
    const rect = renderer.domElement.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const proj = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camPos.copy(camera.position);
    let best = -1;
    let bestDist = 24 * 24;
    for (let i = 0; i < n; i++) {
      proj.fromArray(graph.positions, i * 3);
      // reject points behind the camera plane before projecting
      if (toNode.copy(proj).sub(camPos).dot(camDir) <= camera.near) continue;
      proj.project(camera);
      const sx = ((proj.x + 1) / 2) * rect.width;
      const sy = ((1 - proj.y) / 2) * rect.height;
      const d = (sx - px) * (sx - px) + (sy - py) * (sy - py);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best >= 0 ? best : undefined;
  };

  const onClick = (ev: MouseEvent) => applySelection(pick(ev.clientX, ev.clientY));
  renderer.domElement.addEventListener("click", onClick);
  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener("resize", onResize);

  // --- frame loop ------------------------------------------------------------
  const frameTimes: number[] = [];
  let lastT = performance.now();
  let frameId = 0;
  let benchCamera: number | null = null;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = now - lastT;
    frameTimes.push(dt);
    lastT = now;
    if (frameTimes.length > 120) frameTimes.shift();
    if (benchCamera === null) controls.update();
    nodeMat.uniforms.uDamping!.value = zoomDamping(camera.position.distanceTo(graphCenter));
    updateLabels();
    renderer.render(scene, camera);
    onFrame?.(dt);
  };
  frameId = requestAnimationFrame(animate);

  return {
    update: (g: GraphData) => {
      // full-projection replacement analog: rewrite every instance buffer
      const t0 = performance.now();
      nodeOffsets.needsUpdate = true;
      for (let i = 0; i < n; i++) nodeSizes[i] = logicalSize(g.importance[i]!) * 0.5;
      nodeSizeAttr.needsUpdate = true;
      writeAllEdges();
      p0Attr.needsUpdate = true;
      p1Attr.needsUpdate = true;
      ctrlAttr.needsUpdate = true;
      edgeColorAttr.needsUpdate = true;
      edgeAlphaAttr.needsUpdate = true;
      edgeWidthAttr.needsUpdate = true;
      return performance.now() - t0;
    },
    select: applySelection,
    pick,
    fps: () => 1000 / (frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length)),
    visibleLabels: () => visibleLabels,
    drawCalls: () => renderer.info.render.calls,
    triangles: () => renderer.info.render.triangles,
    camDist: () => camera.position.distanceTo(graphCenter),
    setBenchCamera: (t01: number) => {
      benchCamera = t01;
      const theta = t01 * Math.PI * 2;
      const dist = 580 - 320 * Math.cos(t01 * Math.PI * 2);
      camera.position.set(Math.sin(theta) * dist, Math.sin(theta * 0.7) * dist * 0.3, Math.cos(theta) * dist);
      camera.lookAt(0, 0, 0);
    },
    resetCamera: () => {
      benchCamera = null;
      camera.position.set(0, 0, 900);
      camera.lookAt(0, 0, 0);
      controls.reset();
    },
    // ownership table: rAF, controls, listeners, label textures/materials,
    // geometries, shader materials, renderer + canvas. Idempotent by clearing.
    destroy: () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      for (const label of labelPool) {
        label.texture.dispose();
        label.material.dispose();
        scene.remove(label.sprite);
      }
      labelPool.length = 0;
      nodeGeo.dispose();
      edgeGeo.dispose();
      nodeMat.dispose();
      edgeMat.dispose();
      scene.remove(nodeMesh);
      scene.remove(edgeMesh);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};

// ---------------------------------------------------------------------------
// page wiring + benchmark protocol
// ---------------------------------------------------------------------------
const app = document.getElementById("app")!;
const hud = document.getElementById("hud")!;
let onFrame: ((dt: number) => void) | null = null;

const tGraph0 = performance.now();
const graph = buildGraph();
const graphBuildMs = performance.now() - tGraph0;

const tMount0 = performance.now();
let handle = mount(app, graph);
let mountMs = performance.now() - tMount0;

interface BenchState {
  start: number;
  frames: number[];
  phase: string;
  pickSamples: number[];
  labelSamples: number[];
  updateMs: number;
}
let bench: BenchState | null = null;

const heapMb = () => {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? Math.round(memory.usedJSHeapSize / 1048576) : null;
};

const startBench = () => {
  handle.select(undefined);
  handle.resetCamera();
  bench = { start: performance.now(), frames: [], phase: "orbit", pickSamples: [], labelSamples: [], updateMs: -1 };
};

const finishBench = () => {
  if (!bench) return;
  const frames = bench.frames;
  const sorted = [...frames].sort((a, b) => a - b);
  const total = frames.reduce((a, b) => a + b, 0);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
  const result = {
    nodes: NODE_COUNT,
    edges: EDGE_COUNT,
    dpr: window.devicePixelRatio,
    viewport: [app.clientWidth, app.clientHeight],
    layoutMs: Math.round(graph.layoutMs),
    layoutTicks: graph.layoutTicks,
    graphBuildMs: Math.round(graphBuildMs),
    mountMs: Math.round(mountMs),
    updateRewriteMs: Math.round(bench.updateMs * 100) / 100,
    frames: frames.length,
    avgFps: Math.round((1000 / (total / frames.length)) * 10) / 10,
    p95FrameMs: Math.round(q(0.95) * 100) / 100,
    p99FrameMs: Math.round(q(0.99) * 100) / 100,
    worstFrameMs: Math.round(sorted[sorted.length - 1]! * 100) / 100,
    onePercentLowFps: Math.round((1000 / q(0.99)) * 10) / 10,
    pickAvgMs: Math.round((bench.pickSamples.reduce((a, b) => a + b, 0) / Math.max(1, bench.pickSamples.length)) * 100) / 100,
    pickMaxMs: Math.round(Math.max(0, ...bench.pickSamples) * 100) / 100,
    labelsAvg: Math.round(bench.labelSamples.reduce((a, b) => a + b, 0) / Math.max(1, bench.labelSamples.length)),
    labelsMax: Math.max(0, ...bench.labelSamples),
    drawCalls: handle.drawCalls(),
    triangles: handle.triangles(),
    heapMb: heapMb(),
    gpu: (() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return ext && gl ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "masked";
    })(),
  };
  console.log("BENCH_RESULT " + JSON.stringify(result));
  (window as unknown as { __benchResult: unknown }).__benchResult = result;
  bench = null;
  handle.resetCamera();
};

onFrame = (dt) => {
  if (bench) {
    const t = (performance.now() - bench.start) / 1000;
    bench.frames.push(dt);
    bench.labelSamples.push(handle.visibleLabels());
    if (t < BENCH_SECONDS) {
      handle.setBenchCamera(t / BENCH_SECONDS);
      // measured pick every 30 frames at viewport center
      if (bench.frames.length % 30 === 0) {
        const t0 = performance.now();
        handle.pick(app.clientWidth / 2, app.clientHeight / 2);
        bench.pickSamples.push(performance.now() - t0);
      }
      if (t > 8 && bench.phase === "orbit") {
        bench.phase = "selected";
        handle.select(graph.order[0]!);
      }
      if (t > 12 && bench.phase === "selected") {
        bench.phase = "cleared";
        handle.select(undefined);
      }
      if (t > 15 && bench.phase === "cleared") {
        bench.phase = "updated";
        bench.updateMs = handle.update(graph);
      }
    } else {
      finishBench();
    }
  }
  hud.textContent =
    `nodes ${NODE_COUNT}  edges ${EDGE_COUNT}  labels ${handle.visibleLabels()}\n` +
    `fps ${handle.fps().toFixed(1)}  layout ${graph.layoutMs.toFixed(0)}ms/${graph.layoutTicks}t  mount ${mountMs.toFixed(0)}ms\n` +
    `draw calls ${handle.drawCalls()}  tris ${handle.triangles()}  cam ${handle.camDist().toFixed(0)}` +
    (bench ? `\nBENCH ${((performance.now() - bench.start) / 1000) | 0}s/${BENCH_SECONDS}s [${bench.phase}]` : "");
};

document.getElementById("bench")!.addEventListener("click", startBench);
document.getElementById("select")!.addEventListener("click", () => handle.select(graph.order[0]!));
document.getElementById("clear")!.addEventListener("click", () => handle.select(undefined));
// StrictMode-style remount: destroy -> mount -> destroy -> mount, recording costs
document.getElementById("remount")!.addEventListener("click", () => {
  const t0 = performance.now();
  handle.destroy();
  handle = mount(app, graph);
  handle.destroy();
  handle = mount(app, graph);
  mountMs = (performance.now() - t0) / 2;
  console.log("REMOUNT_OK doubleMountAvgMs=" + mountMs.toFixed(1) + " canvases=" + app.querySelectorAll("canvas").length);
});

if (params.get("auto") === "1") setTimeout(startBench, 1500);
