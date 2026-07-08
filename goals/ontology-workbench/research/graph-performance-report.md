**Large-Graph Web Stack Recommendation**

As of July 8, 2026, I would not make WebGPU a hard dependency for a Tauri 2 desktop app that must run on Linux. Tauri Linux uses WebKitGTK/webkit2gtk, not Chromium, and WebGPU is not reliably available there. Chrome’s improving Linux WebGPU support does not transfer to Tauri’s Linux webview. So the practical target should be **WebGL2 GPU rendering/layout plus workers**, with WebGPU treated as optional future acceleration.

## Short Verdict

Ranked stack:

1. **`@cosmos.gl/graph` / cosmos.gl**  
   Best match. WebGL2 GPU force simulation and rendering, built for hundreds of thousands to million-scale graphs, active, MIT, reasonable bundle size.

2. **sigma.js v3 + graphology**  
   Best fallback and editing-friendly graph UI stack. WebGL renderer plus worker layouts, great React story, but realistically “thousands to tens of thousands” unless layout is precomputed or heavily filtered.

3. **@antv/g6 v5**  
   Rich graph-editing/product UI framework with WebGL/worker-layout claims, but heavier and less convincing for 50k-1M continuous force simulation.

4. **ngraph ecosystem**  
   Useful algorithm/toolbox fallback. `ngraph.forcelayout` supports dynamic graph changes and can run in a worker, but it is CPU Barnes-Hut, not GPU-scale.

5. **react-force-graph / three.js**  
   Excellent prototyping and interaction affordances, but CPU force layout by default and official “large” examples are far below this requirement.

6. **Roll your own WebGPU compute + renderer**  
   Technically viable, strategically expensive, and still needs a WebGL/worker fallback for Linux Tauri.

## Option Matrix

| Stack | Rendering | Layout | Practical Scale | Incremental Updates | Editing / Interaction | React Story | License / Health / Bundle | Verdict |
|---|---|---|---|---|---|---|---|---|
| **cosmos.gl / `@cosmos.gl/graph`** | WebGL2 via luma.gl; GPU point/link rendering | GPU force simulation in shaders; simulation separated from rendering | Official docs claim hundreds of thousands; Cosmograph examples discuss million-node/edge graphs | Supports typed-array updates, GPU transitions, point/link APIs; verify exact add/remove diff behavior in POC | Built-in hover, drag, selection helpers, polygon/rect selection, context events | Imperative engine inside React component; do not render nodes as React | MIT; active GitHub, latest 2026; Bundlephobia: ~701.6 kB min / ~162.4 kB gzip | **Primary choice** |
| **sigma.js v3 + graphology** | WebGL renderer | graphology layouts; worker ForceAtlas2 available | Official positioning says thousands of nodes/edges; can stretch with filtering/precomputed layout | Excellent graph data model; mutations are natural | Strong hover/select/drag/edit examples | `@react-sigma` is mature | MIT; active; modular bundle | **Best fallback / secondary focused view** |
| **@antv/g6 v5** | Canvas/WebGL, 3D/WebGL extensions; WebGPU claims in ecosystem | `@antv/layout`, worker-enabled layouts, some GPU/WASM positioning | Strong product diagrams; less proven for live 1M force graphs | Good graph framework model | Very rich built-in behaviors and editing affordances | React extension exists, but React nodes should not be used at huge scale | MIT; very active; likely heavier bundle | Good for small editor surfaces, not the main million-scale viewport |
| **react-force-graph / three.js** | Canvas/Three.js/WebGL | `d3-force-3d` or `ngraph.forcelayout`, CPU by default | Official large demo is ~4k elements | Supports dynamic `graphData` updates | Excellent click/hover/drag/link examples | Easiest React ergonomics | MIT; active; bundle can be large, issue reports ~2.1 MB / 300 kB gz in Vite | Prototype only for this requirement |
| **ngraph** | `ngraph.pixel` uses shader/three approach, but stale | `ngraph.forcelayout` CPU Barnes-Hut, iterative, dynamic graph-aware | Good for thousands; not 1M live force | Yes, layout listens to graph changes | Basic examples | Manual integration | Mixed repo license metadata; old renderer, active-ish layout package | Useful worker/offline fallback, not primary |
| **Roll your own WebGPU** | WebGPU instanced nodes/edges | Compute shader simulation | Potentially highest ceiling | Whatever you build | Whatever you build | Custom wrapper | Full ownership cost | Only justified if graph rendering becomes a core product differentiator |

## Tauri WebGPU Reality

Tauri 2 webviews are platform-native: WebView2 on Windows, WKWebView on macOS, and WebKitGTK/webkit2gtk on Linux. Tauri’s own webview-version docs call out this platform split and Linux distro variability.

WebGPU status is uneven:

- Chromium/WebView2 is the strongest path, but Chrome Linux support is still hardware/driver/flag dependent.
- Safari/WebKit support is tied to recent Apple OS versions.
- WebKitGTK is not a reliable production WebGPU target today.
- A Tauri issue about WebGPU flags noted that Linux/macOS webviews do not expose the same Chromium flag mechanism.

So for Linux Tauri, assume **`navigator.gpu` may be absent**. Use WebGL2 as the baseline.

## Recommended Architecture

Use **cosmos.gl as the main graph viewport**:

- React 19 owns app state, panels, search, filters, ontology inspectors, editing commands.
- cosmos.gl owns the graph canvas, camera, hit testing, hover/select, GPU simulation, and rendering.
- Use Web Workers for RDF/ontology parsing, graph diffing, search indexes, clustering, and layout preprocessing.
- Render labels only for selected, hovered, pinned, searched, or neighborhood-expanded nodes.
- Use progressive disclosure: whole graph as geometry, active neighborhood as inspectable graph, side panel for ontology facts.
- For edge creation: pointer down on source, draw a lightweight overlay edge, pointer up on target, commit to graph model, then update cosmos data.

This matches the requirement better than a diagramming framework because the hard part is not drawing an edge; it is staying interactive at 50k-1M elements.

## Fallback If WebGPU Is Unavailable

Do not make WebGPU part of the baseline. The fallback should be:

1. **cosmos.gl WebGL2 path first**.
2. If required WebGL capabilities fail, switch to **sigma.js + graphology** with worker layout or precomputed positions.
3. Cap visible graph size through clustering, semantic filtering, neighborhood expansion, and LOD.
4. For very large ontologies, store the full graph in the model/index, but render only the current semantic slice plus aggregate context.

## Roll Your Own vs Cosmos

Adopting cosmos.gl is likely a **1-2 week technical spike** and **3-6 week production integration**: React wrapper, data adapters, worker pipeline, selection/edit overlays, benchmarks on WebView2/WKWebView/WebKitGTK.

Rolling your own credible engine is more like:

- **2-4 engineer-months** for a serious prototype.
- **6-12+ months** for production quality across platforms.
- You would need GPU memory management, picking, camera controls, label LOD, dynamic graph diffs, force kernels, clustering, worker sync, WebGL fallback, WebGPU feature detection, and cross-webview QA.

Because Linux Tauri cannot rely on WebGPU, rolling your own WebGPU-first engine still leaves you building a WebGL/worker fallback. That makes cosmos.gl the pragmatic choice.

## Sources

- cosmos.gl graph repo: https://github.com/cosmosgl/graph  
- Cosmograph docs: https://cosmograph.app/docs-general/  
- Million-node Cosmograph article: https://nightingaledvs.com/how-to-visualize-a-graph-with-a-million-nodes/  
- Bundlephobia `@cosmos.gl/graph`: https://bundlephobia.com/package/@cosmos.gl/graph  
- sigma.js docs: https://www.sigmajs.org/  
- React Sigma worker layouts: https://sim51.github.io/react-sigma/docs/example/layouts/  
- AntV G6 repo: https://github.com/antvis/g6  
- AntV G6 v5 beta notes: https://medium.com/antv/g6-5-0-beta-changlog-f86caccd2ce7  
- 3d-force-graph repo: https://github.com/vasturiano/3d-force-graph  
- react-force-graph package info: https://www.jsdelivr.com/package/npm/react-force-graph-3d  
- ngraph.pixel repo: https://github.com/anvaka/ngraph.pixel  
- ngraph.forcelayout repo: https://github.com/anvaka/ngraph.forcelayout  
- Tauri webview versions: https://v2.tauri.app/reference/webview-versions/  
- WebGPU implementation status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status  
- Chrome WebGPU on Linux rollout: https://developer.chrome.com/blog/new-in-webgpu-144  
- WebGPU browser support: https://caniuse.com/webgpu  
- WebGPU samples, compute boids: https://webgpu.github.io/webgpu-samples/samples/computeBoids/  
- d3-force-webgpu: https://github.com/jamescarruthers/d3-force-webgpu  


Codex session ID: 019f43dd-df32-7ee0-a539-efe6361d15ed
Resume in Codex: codex resume 019f43dd-df32-7ee0-a539-efe6361d15ed
