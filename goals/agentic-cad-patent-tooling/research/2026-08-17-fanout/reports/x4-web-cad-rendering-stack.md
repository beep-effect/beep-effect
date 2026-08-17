# X4 — Embeddable CAD rendering + kernel stack (React/TS desktop, offline)

**Lane:** x4-web-cad-rendering-stack
**As of:** 2026-08-17
**Requirement:** a professional desktop app (React + TypeScript, Effect-based runtime, Electron/Tauri-class) must display CAD inline — STEP / IGES / STL / 3MF / GLTF — with pan / orbit / section, measurement, and export of 2D black-line projections. Must run offline.
**Method:** live GitHub API, npm registry, jsDelivr package listings, official docs, and license files fetched on this date. Claims without a live page are labeled `UNVERIFIED`.

---

## Verdict

**There is no single JS/WASM package that is simultaneously (a) offline, (b) STEP/IGES-capable, (c) measurement + section, (d) hidden-line 2D export, and (e) free of copyleft.** The workable stack is a split:

| Layer | Ship this | License |
| --- | --- | --- |
| Viewport (pan / orbit / section / measure UI) | `three` 0.185.1 | MIT |
| Mesh formats (STL / 3MF / GLTF) | three.js official loaders | MIT |
| STEP / IGES / BREP import | `occt-import-js` 0.0.23 as a **separate worker + WASM file** | LGPL-2.1 |
| Optional embeddable viewer chrome | `online-3d-viewer` 0.18.0 | MIT (importer underneath is still LGPL) |
| Optional B-rep kernel (create / boolean / STEP *export*) | `replicad` 1.0.0 + `replicad-opencascadejs` 1.0.0 | MIT wrapper + **LGPL-2.1-only WASM** |
| 2D black-line / HLR | **not available as a shipped JS API** — see §4 | — |

**Hard nos for a proprietary offline desktop app:** Chili3D (AGPL-3.0), xeokit (AGPL-3.0 unless you buy Creoox commercial), Autodesk APS Viewer (cloud, not offline), Speckle's hosted STEP importer (cloud conversion). Fornjot is archived and unfinished.

**Winner / runner-up / the bite** are in §7.

---

## 1. Requirement decomposition

| Need | What actually satisfies it | What people think satisfies it |
| --- | --- | --- |
| STEP / IGES load | B-rep kernel importer (OCCT family compiled to WASM) | “three.js STEP loader” — **does not exist** (§3.1) |
| STL / 3MF / GLTF | three.js `STLLoader` / `3MFLoader` / `GLTFLoader`; model-viewer for glTF only | — |
| Pan / orbit / section | Any WebGL viewer + `THREE.Plane` clipping | CAD Assistant (standalone app, not embeddable) |
| Measurement | Viewer-level (raycast) is cheap; kernel-level (B-rep edge/face) needs OCCT | O3DV has no documented measure API in the embeddable engine |
| 2D black-line projection | OCCT Hidden Line Removal (`HLRBRep_Algo` / `HLRBRep_PolyAlgo`) then SVG/DXF | three.js `EdgesGeometry` / O3DV “Show Edges” — crease-angle mesh edges, **not** HLR |
| Offline | Local WASM + local files | APS Viewer, Speckle file-import, most “CAD in the browser” demos |
| No GPL/AGPL contamination | MIT/Apache + *careful* LGPL-2.1-with-exception bundling | “replicad is MIT so we are clean” — the WASM is LGPL |

---

## 2. WASM CAD kernels

Sizes below are **uncompressed file sizes from jsDelivr package listings on 2026-08-17**, unless noted.

### 2.1 OpenCascade.js (`donalffons/opencascade.js`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 916 / 136 | [GitHub API 2026-08-17](https://api.github.com/repos/donalffons/opencascade.js) |
| License (repo + npm) | LGPL-2.1 / `LGPL-2.1-only` | [repo license badge](https://github.com/donalffons/opencascade.js); [npm `opencascade.js`](https://www.npmjs.com/package/opencascade.js) |
| Last *code* commit on `master` | 2023-03-27 (`5ff2b75` “fix pip command”) | [repo page 2026-08-17](https://github.com/donalffons/opencascade.js) |
| Last push | 2023-08-15 | GitHub API |
| OCCT version advertised | 7.6.2 (shield on README) | [README](https://github.com/donalffons/opencascade.js) |
| npm `latest` | **1.1.1 (2020-09-27)** — stale | npm registry |
| npm `beta` | `2.0.0-beta.b5ff984` | npm `dist-tags` |
| Full WASM | `dist/opencascade.full.wasm` **50,305,130 B (~48.0 MiB)** | [jsDelivr `@2.0.0-beta.b5ff984`](https://data.jsdelivr.com/v1/packages/npm/opencascade.js@2.0.0-beta.b5ff984) |
| Full JS glue | 404,584 B | same |
| Docs claim (gzip/brotli) | full build ships ~9.1 MB compressed; custom example build 7.1 MB / 2.4 MB compressed | [ocjs.org file-size, fetched 2026-08-17](https://ocjs.org/docs/getting-started/file-size) |
| Memory flags in official custom-build YAML | `-sINITIAL_MEMORY=15MB -sMAXIMUM_MEMORY=4GB -sALLOW_MEMORY_GROWTH=1` | [customBuild.yml](https://github.com/donalffons/opencascade.js/blob/master/website/ocjs-editor-theme/src/customBuild/customBuild.yml) |

What it is: an Emscripten/Embind port of nearly the whole OCCT C++ API. That is the only JS binding that *can* expose HLR, STEP write, fillets, booleans, XCAF, etc. — but only if those symbols are listed in a custom-build YAML.

What it is not: a maintained product. `master` is three years stale. Downstream projects (replicad, CascadeStudio, Bitbybit, Chili3D) have all forked or rebuilt their own WASM rather than depending on `opencascade.js@latest`.

The official example custom-build YAML binds boxes, spheres, booleans, fillets, STEP/glTF writers (`RWGltf_CafWriter`, `STEPCAFControl_Reader` is shown in the custom-build *docs* example) — **it does not bind `HLRBRep_Algo`, `HLRBRep_PolyAlgo`, or `HLRBRep_HLRToShape`.** ([customBuild.yml](https://github.com/donalffons/opencascade.js/blob/master/website/ocjs-editor-theme/src/customBuild/customBuild.yml); [custom-builds docs](https://ocjs.org/docs/app-dev-workflow/custom-builds), 2026-08-17)

Cold-start reality (author-reported, 2021, still the best published number): a non-modularized full module is ~43 MB WASM and “startup-time of the finished Emscripten module is very long”; Chrome caches the non-modularized blob better than SIDE_MODULEs. ([emscripten#13495](https://github.com/emscripten-core/emscripten/issues/13495), 2021-06-14)

### 2.2 occt-import-js (`kovacsv/occt-import-js`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 282 / 54 | [GitHub API 2026-08-17](https://api.github.com/repos/kovacsv/occt-import-js) |
| License | LGPL-2.1 | [repo](https://github.com/kovacsv/occt-import-js); npm |
| Last commit | 2024-12-03 (`41e4708` “Update version”) | repo page |
| OCCT pin | **7.6.1** (reverted from a newer pin; “Surfaces are occasionally missed” #42) | [README commit 2024-12-02](https://github.com/kovacsv/occt-import-js) |
| npm | `0.0.23` (2024-12-03), unpacked 11.6 MB | npm registry |
| WASM | `dist/occt-import-js.wasm` **7,604,031 B (~7.25 MiB)** | [jsDelivr `@0.0.23`](https://data.jsdelivr.com/v1/packages/npm/occt-import-js@0.0.23) |

API is three functions: `ReadBrepFile` / `ReadStepFile` / `ReadIgesFile` → JSON mesh (`position`, `normal`, `index`, optional `color`, `brep_faces` triangle ranges, assembly `root` tree). Explicitly “geometry representation is compatible with three.js.” ([README](https://github.com/kovacsv/occt-import-js), 2026-08-17)

This is the smallest *production* STEP/IGES WASM in the survey. It is also **import-and-tessellate only**: no B-rep keep, no HLR, no STEP write, no measure on exact geometry.

Known limit: [issue #66 “big assembly is too slow”](https://github.com/kovacsv/occt-import-js/issues/66) opened 2026-03-30, still open, no maintainer reply as of this fetch.

Used in production by Online 3D Viewer (§3.3).

### 2.3 replicad (`sgenoud/replicad`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 671 / 78 | [GitHub API 2026-08-17](https://api.github.com/repos/sgenoud/replicad) |
| Last commit | 2026-08-14 (3 days before this report) | repo page |
| Wrapper license | MIT (`LICENSE` “Relicense everything to MIT”, 2023-08-14) | [LICENSE](https://github.com/sgenoud/replicad/blob/main/LICENSE) |
| Kernel package | `replicad-opencascadejs@1.0.0` **LGPL-2.1-only** | [package.json](https://raw.githubusercontent.com/sgenoud/replicad/main/packages/replicad-opencascadejs/package.json) |
| npm `replicad` | 1.0.0 (2026-08-14), unpacked 5.7 MB, MIT | npm |
| WASM (single) | `replicad_single.wasm` **22,970,161 B (~21.9 MiB)** | [jsDelivr `@1.0.0`](https://data.jsdelivr.com/v1/packages/npm/replicad-opencascadejs@1.0.0) |
| WASM (multi-thread) | `replicad_multi.wasm` **22,471,397 B** | same |
| OCCT generation | **OCCT v8** custom build via `ghcr.io/taucad/opencascade.js:canary-…` | package `build` scripts; PR #263 commit message on 2026-08-14: “replicad_single: 18.96 MB + exceptions 22.22 MB” (author-measured; jsDelivr listing is 21.9 MiB for the published single) |

`replicad` is a CadQuery-inspired TypeScript API over a *trimmed* OCCT WASM. Keywords on the package: `cad`, `opencascadejs`, `brep`, `STEP`, `STL`. STEP *export* is a first-class advertised feature. ([replicad.xyz](https://replicad.xyz/), 2026-08-17)

SVG: `Blueprint` / `Drawing` / `Blueprints` have `toSVG()`, `toSVGPaths()`, `toSVGViewBox()`. That is **2D sketch/blueprint serialization**, not 3D hidden-line projection. ([Blueprint / Blueprints API](https://replicad.xyz/docs/api/classes/Blueprints/), 2026-08-17)

`replicad-opencascadejs` is a **devDependency** of `replicad`, not a runtime dependency — the host app must load the WASM itself. That is the correct LGPL seam (separate file), but it is easy to miss and then illegally bundle.

### 2.4 manifold-3d (`elalish/manifold`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 2,228 / 242 | [GitHub API 2026-08-17](https://api.github.com/repos/elalish/manifold) |
| License | Apache-2.0 | GitHub + npm |
| Last commit | 2026-08-14 / pushed 2026-08-16 | GitHub API |
| npm `manifold-3d` | 3.5.1 (2026-06-04), unpacked 2.76 MB | npm |
| WASM | `manifold.wasm` **541,470 B (~0.52 MiB)** | [jsDelivr `@3.5.1`](https://data.jsdelivr.com/v1/packages/npm/manifold-3d@3.5.1) |

This is a **mesh** kernel (robust booleans, genus, decimation). It does not read STEP/IGES B-rep and cannot produce exact HLR. Correct role: post-process tessellated solids, not replace OCCT.

### 2.5 CascadeStudio (`zalo/CascadeStudio`) + `cascade-core`

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 1,447 / 180 | [GitHub API 2026-08-17](https://api.github.com/repos/zalo/CascadeStudio) |
| App license | MIT | [LICENSE](https://github.com/zalo/CascadeStudio/blob/master/LICENSE) |
| Last merge on `master` | 2026-06-16 (PR #197); last push 2026-08-15 | repo + API |
| Kernel | “full power of OpenCascade (OCCT 8.0)” via Embind | [README](https://github.com/zalo/CascadeStudio) |
| npm `cascade-core` | 2.0.6 (2026-04-06), MIT, unpacked 23.7 MB | npm |
| WASM | `dist/cascadestudio.wasm` **21,241,345 B (~20.3 MiB)** | [jsDelivr `@2.0.6`](https://data.jsdelivr.com/v1/packages/npm/cascade-core@2.0.6) |
| Worker glue | `cascade-worker.js` 375 KB | same |
| Hidden dep | `"opencascade.js": "github:zalo/opencascade.js#cascadestudio-v2"` | [cascade-core package.json](https://raw.githubusercontent.com/zalo/CascadeStudio/master/packages/cascade-core/package.json) |

`cascade-core` is the reusable piece: “Evaluate CAD code in a Web Worker and get triangle mesh data back.” Import `.STEP` / `.IGES` / `.STL`; export `.STEP` / `.STL` / `.OBJ`. Measurement helpers in the *studio* stdlib: `Volume()`, `SurfaceArea()`, `CenterOfMass()`. ([README features](https://github.com/zalo/CascadeStudio))

License trap identical to replicad: MIT TypeScript + LGPL OCCT WASM (via a private fork of opencascade.js). CascadeStudio’s own README still says “Free and open source under the MIT License” without mentioning OCCT LGPL on the same page.

### 2.6 Fornjot (`hannobraun/fornjot`) — dead

| Field | Live value | Source |
| --- | --- | --- |
| Stars | 2,556 | GitHub API |
| Status | **`archived: true`**. Description: “No longer in development.” | [GitHub API 2026-08-17](https://api.github.com/repos/hannobraun/fornjot) |
| README first line | “This project has been shut down. Its goals were never reached.” | [README](https://raw.githubusercontent.com/hannobraun/fornjot/main/README.md) |
| License | 0BSD (`LICENSE.md`) | same |
| Last push | 2026-06-19 | GitHub API |

Not a candidate. WASM was always incidental (Rust→wasm is easy; a finished B-rep kernel is not).

### 2.7 truck (`ricosjp/truck`) — Rust kernel, WASM exists, not a viewer stack

| Field | Live value | Source |
| --- | --- | --- |
| Stars | 1,531 | [GitHub API 2026-08-17](https://api.github.com/repos/ricosjp/truck) |
| License | Apache-2.0 | README + `truck-js/Cargo.toml` |
| Last push | 2026-08-10 | GitHub API |
| JS crate | `truck-js` 0.2.0, `crate-type = ["cdylib", "rlib"]`, `wasm-bindgen` | [Cargo.toml](https://raw.githubusercontent.com/ricosjp/truck/master/truck-js/Cargo.toml) |
| WASM deps | `truck-modeling`, `truck-shapeops`, **`truck-stepio`**, `truck-meshalgo` | same |
| Drafting crate | `truck-drafting` exists in the monorepo | [repo tree](https://github.com/ricosjp/truck) |

Apache-2.0 is the cleanest *kernel* license in this survey. `truck-js` proves a WASM target is first-class. What is missing for the requirement: a published npm WASM blob with documented STEP/IGES fidelity, a React viewer, measurement, and an HLR path comparable to OCCT. Treat as a 2027+ option, not a 2026 ship vehicle. Published wasm size: **not listed on npm**; would require building `truck-js` yourself. `UNVERIFIED` whether `truck-stepio` via wasm-bindgen covers real-world vendor STEP assemblies.

### 2.8 Chili3D (`xiangechen/chili3d`) — AGPL trap

| Field | Live value | Source |
| --- | --- | --- |
| Stars | **4,740** | [GitHub API 2026-08-17](https://api.github.com/repos/xiangechen/chili3d) |
| Last push | 2026-08-05 | GitHub API |
| App license | **AGPL-3.0** | [LICENSE](https://github.com/xiangechen/chili3d/blob/master/LICENSE); [README](https://github.com/xiangechen/chili3d) |
| C++ WASM dir | “The C++ WASM module (`cpp/`) is licensed under **LGPL-3.0**” | README License section |
| Stack | TypeScript + Three.js 0.184 + **OCCT 8.0.0** WASM | README |
| Commercial | “For commercial licensing options, contact xiangetg@msn.cn” | README |
| npm `chili3d` | 1.1.2 (2026-01-25), unpacked **49.8 MB**, `license: None` on the registry | npm |

This is the most complete *product* in the browser-CAD set (ribbon UI, wasm OCC, three viewport). It is also the most dangerous: **AGPL-3.0 on the TypeScript app** means a network-deployed or modified derivative must ship source. Bundling Chili3D UI/engine code into a closed desktop app is GPL-family contamination. The `cpp/` LGPL-3.0 WASM is a *second*, different copyleft (LGPL-3.0, **not** OCCT’s LGPL-2.1-with-exception). Do not take a “we only use the WASM” shortcut without counsel — the published app you would copy from is AGPL.

### 2.9 JSCAD (`jscad/OpenJSCAD.org`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 3,227 / 562 | [GitHub API 2026-08-17](https://api.github.com/repos/jscad/OpenJSCAD.org) |
| License | MIT | [LICENSE](https://raw.githubusercontent.com/jscad/OpenJSCAD.org/master/LICENSE); GitHub |
| Last push | 2026-08-05 | GitHub API |
| npm `@jscad/modeling` | 2.13.0 (2026-02-22), unpacked 1.59 MB, MIT | npm |

Pure-JS CSG. No STEP/IGES B-rep, no HLR, no OCCT. Fine as a sandbox kernel, useless as the STEP viewer.

### 2.10 Adjacent: Bitbybit OCCT worker (not requested, but it is the other maintained OCCT-WASM)

| Field | Live value | Source |
| --- | --- | --- |
| npm `@bitbybit-dev/occt` | 1.1.1 (2026-06-25), **MIT wrapper**, unpacked 105.6 MB | npm |
| WASM variants | 32-bit 34.5 MB; 64-bit 35.5 MB; 64-bit-MT 33.0 MB | [jsDelivr `@1.1.1`](https://data.jsdelivr.com/v1/packages/npm/@bitbybit-dev/occt@1.1.1) |
| LGPL stance | OCCT worker + WASM loaded at runtime from a configurable `cdnUrl`; documented as dynamic linking so users can replace the WASM | [Runner licensing](https://github.com/bitbybit-dev/bitbybit/blob/d3f52bd1fcf78148b60800d69ed6b42e53f4ad06/docs/learn/runners/licensing.mdx) |

Useful as a **pattern** (separate worker, replaceable WASM, 64-bit to beat the 4 GB ceiling). The MIT stamp on the npm wrapper does **not** relicense OCCT.

---

## 3. Viewers and loaders

### 3.1 three.js — what actually exists for STEP/IGES

`three@0.185.1` (npm 2026-07-01, MIT, 23.2 MB unpacked). Official loaders on `dev` as of this fetch ([`examples/jsm/loaders`](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/loaders)):

**Present:** `STLLoader.js`, `3MFLoader.js`, `GLTFLoader.js`, plus OBJ/FBX/PLY/USD/VRML/…

**Absent:** `STEPLoader.js`, `IGESLoader.js`, any file matching `STEP` / `IGES` / `STP` / `IGS`.

The 2015 issue “[STEP loader antlr v4 based](https://github.com/mrdoob/three.js/issues/7125)” never landed. Discourse answers from maintainers point at STL, not STEP. ([discourse.threejs.org #2842](https://discourse.threejs.org/t/is-there-any-way-to-load-step-file-using-three-js/2842), 2018; [#8713](https://discourse.threejs.org/t/does-three-js-support-any-geomatric-format-like-step-or-iges/8713), 2019)

What three.js *will* give you for free: `OrbitControls`, `TransformControls`, `THREE.Plane` clipping (section), `Raycaster` picking (measure), `EdgesGeometry` (silhouette-ish crease edges), `SVGRenderer` (vector dump of the *mesh scene*, not HLR). That last one is the most common false friend for “patent figures.”

### 3.2 model-viewer (`google/model-viewer`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars | 8,201 | GitHub API |
| License | Apache-2.0 | GitHub + npm |
| npm `@google/model-viewer` | 4.3.1 (2026-06-04) | npm |
| Last push | 2026-07-07 | GitHub API |

`<model-viewer>` is a glTF/GLB + AR web component. It does not load STEP/IGES/STL/3MF as CAD. Wrong layer. ([modelviewer.dev](https://modelviewer.dev/), 2026-08-17)

### 3.3 Online3DViewer / O3DV (`kovacsv/Online3DViewer`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 3,654 / 760 | GitHub API |
| License | MIT | repo |
| Last push | 2026-06-24 | GitHub API |
| npm `online-3d-viewer` | 0.18.0 (2025-12-18), unpacked 5.37 MB | npm |
| Engine JS | `o3dv.min.js` 1.06 MB; `o3dv.module.js` 469 KB | jsDelivr `@0.18.0` |

**Import:** 3dm, 3ds, 3mf, amf, bim, brep, dae, fbx, fcstd, gltf, ifc, iges, step, stl, obj, off, ply, wrl.

**Export:** 3dm, bim, gltf, obj, off, stl, ply. **No SVG, no DXF.** ([README](https://github.com/kovacsv/Online3DViewer); [3dviewer.net/info](https://3dviewer.net/info), 2026-08-17)

STEP/IGES/BREP/FCStd go through `occt-import-js`. IFC through `web-ifc`. 3dm through `rhino3dm`. 3MF through three.js.

Embed API: `OV.EmbeddedViewer` / `Init3DViewerElements`. Edge display is `EdgeSettings(on, rgb, thresholdAngle)` — “Edges will be visible only if the angle between the adjoining faces exceeds the threshold.” That is **crease-angle mesh edges**, not HLR. ([Usage](https://kovacsv.github.io/Online3DViewer/Page_Usage.html); [info#Settings](https://3dviewer.net/info))

Closest thing to “drop a STEP into a React desktop webview this week.” Does not meet the 2D-figure requirement.

### 3.4 CAD Assistant (Open Cascade)

Standalone **offline** desktop/mobile viewer+converter, “free for both personal and commercial use.” Formats include STEP/IGES/STL. Not a library. No npm, no embed API, no React surface. ([opencascade.com/products/cad-assistant](https://www.opencascade.com/products/cad-assistant/), 2026-08-17; winget id `OpenCascade.CADAssistant`)

Useful as a *reference viewer* to check your WASM tessellation against, not as a component.

### 3.5 xeokit (`xeokit/xeokit-sdk`)

| Field | Live value | Source |
| --- | --- | --- |
| Stars / forks | 923 / 332 | GitHub API |
| License | **AGPL-3.0** | GitHub + npm `@xeokit/xeokit-sdk@2.6.112` (2026-06-26) |
| Last push | 2026-08-04 | GitHub API |
| Commercial | Creoox: contact@creoox.com / [xeokit.io/#pricing](https://xeokit.io/#pricing) | [SDK README licensing](https://xeokit.github.io/xeokit-sdk/docs/) |

First-class: IFC → XKT, glTF, OBJ, CityJSON, point clouds, double-precision BIM, section planes, measurements. **Not first-class: STEP/IGES B-rep.** Conversion tools (`convert2xkt`) target AEC formats; IFC-STEP is the “STEP” people confuse with AP214 mechanical STEP. ([SDK README](https://xeokit.github.io/xeokit-sdk/docs/), 2026-08-17)

AGPL-3.0 is a hard no for a closed desktop app unless you buy the commercial license.

### 3.6 Autodesk Platform Services viewer

Cloud translation + proprietary JS viewer. Formats include RVT/DWG/IFC/STEP on the *translation service*. Offline capability: **No** in a 2025 comparison that matches Autodesk’s model (models are translated in Autodesk’s cloud, viewer streams SVF/SVF2). ([iolabs comparison, 2025-06-05](https://iolabs.ch/en/blog/comparing-viewers/); [aps.autodesk.com](https://aps.autodesk.com/))

Fails the offline + confidentiality requirement even before license.

### 3.7 Speckle (`specklesystems/speckle-server`, `@speckle/viewer`)

| Field | Live value | Source |
| --- | --- | --- |
| Server stars | 834 | GitHub API |
| License | Apache-2.0 (repo + `@speckle/viewer@2.31.14`) | [speckle-server README](https://github.com/specklesystems/speckle-server); npm |
| Last push | 2026-08-12 | GitHub API |
| Viewer unpacked | 2.09 MB | npm |

The *viewer* is a three.js extension you can embed. Self-hosting the *server* is documented. Speckle’s 2025 “file viewer” announcement lists STP/STEP/IGES/STL/3MF among **hosted upload** formats (1 GB cap) — that path is a **cloud importer**, not a local WASM kernel. ([speckle.systems blog, 2025-09-04](https://speckle.systems/blog/view-and-analyze-cad-and-3d-files-easier-than-ever-with-speckle/))

For an offline attorney desktop: you can embed `@speckle/viewer` to render Speckle objects you already have, but you do not get a local STEP→mesh pipeline from that package.

---

## 4. 2D technical-drawing output from 3D in JS/WASM

### 4.1 What OCCT itself provides (C++)

OCCT’s Hidden Line Removal component exposes two algorithms ([OCCT modeling algorithms guide](https://dev.opencascade.org/doc/refman/html/class_h_l_r_algo.html); [HLRBRep_Algo](https://dev.opencascade.org/doc/refman/html/class_h_l_r_b_rep___algo.html)):

- `HLRBRep_Algo` — exact, works on real B-rep geometry.
- `HLRBRep_PolyAlgo` — polygonal, works on triangulation (faster, worse on fillets).

Canonical extract path: `HLRBRep_Algo` → `Projector` → `Update` → `Hide` → `HLRBRep_HLRToShape` to pull visible / hidden / outline / iso edges as `TopoDS_Shape`. ([dev.opencascade.org “Project to 2D”, 2023-12-14](https://dev.opencascade.org/content/project-2d))

This is the same machinery FreeCAD TechDraw and build123d sit on.

### 4.2 What the JS bindings actually expose

| Binding | HLR symbols shipped? | Evidence |
| --- | --- | --- |
| `opencascade.js` full + official example custom build | **No** `HLRBRep_*` in the published example YAML | [customBuild.yml](https://github.com/donalffons/opencascade.js/blob/master/website/ocjs-editor-theme/src/customBuild/customBuild.yml) |
| `occt-import-js` | No — tessellate only | [README API](https://github.com/kovacsv/occt-import-js) |
| `replicad` / `replicad-opencascadejs` | No public HLR API. SVG is 2D blueprint `toSVG()` | [Blueprints API](https://replicad.xyz/docs/api/classes/Blueprints/) |
| CascadeStudio / `cascade-core` | No HLR in advertised stdlib (Volume / SurfaceArea / CenterOfMass only) | [README](https://github.com/zalo/CascadeStudio) |
| Chili3D | `UNVERIFIED` (AGPL anyway) | — |
| O3DV | Crease-angle “Show Edges”, not HLR | [3dviewer.net/info](https://3dviewer.net/info) |
| three.js | `EdgesGeometry` / `SVGRenderer` = mesh, not HLR | loader tree + three docs |

HLR *can* be added: opencascade.js custom builds are “list the C++ symbol in YAML.” Nobody in this survey ships that list for `HLRBRep_Algo` + `HLRBRep_HLRToShape` + a projector helper. Doing it is a custom WASM build, not an npm install.

### 4.3 SVG / DXF export paths that *do* exist in JS

- **replicad** `Drawing.toSVG()` / `Blueprints.toSVG()` — 2D sketches you already have as blueprints. Not a projection of a 3D solid.
- **O3DV** export: glTF / OBJ / STL / PLY / 3dm / bim. No SVG/DXF.
- **three.js** `SVGRenderer` — paints the WebGL scene graph as SVG polygons/lines. Hidden surfaces are *not* removed in the CAD sense; you get a vectorized raster equivalent.
- **JSCAD** can emit SVG of 2D geometries. No 3D HLR.

### 4.4 Gap vs Python build123d

build123d (Apache-2.0, 2,866 stars, last push 2026-08-14) is the existence proof that OCCT HLR + a polite API is enough for patent-ish figures:

```python
visible, hidden = part.project_to_viewport(view_port_origin)
exporter = ExportSVG(scale=100 / max_dimension)
exporter.add_layer("Visible")
exporter.add_layer("Hidden", line_color=(99, 99, 99), line_type=LineType.ISO_DOT)
exporter.add_shape(visible, layer="Visible")
exporter.add_shape(hidden, layer="Hidden")
exporter.write("part_projection.svg")
```

([import_export docs](https://build123d.readthedocs.io/en/latest/import_export.html), 2026-08-17)

`TechnicalDrawing` adds an A-series border, title block, `ExtensionLine` / `DimensionLine`, ISO hidden linetype. The tutorial composes isometric + plan + elevations onto one A4 SVG. ([tech_drawing_tutorial](https://build123d.readthedocs.io/en/latest/tech_drawing_tutorial.html), 2026-08-17)

`ExportDXF` exists on the same 2D edge lists.

There is a Pyodide port (`yeicor/OCP.wasm`, 45 stars, MIT wrapper, last push 2026-07-09) that runs build123d *in the browser*. Cold start is “a bit slow” per the author (CadQuery discussion #1876). That is a research demo, not a desktop-embed contract, and it still carries OCCT LGPL in the Pyodide wheel.

**JS/WASM gap, concretely:**

1. No published `project_to_viewport(origin, up) -> (visible_edges, hidden_edges)`.
2. No ISO hidden-linetype SVG/DXF writer fed from HLR.
3. No `TechnicalDrawing` title-block primitive.
4. No dimension/extension-line objects that live in the projected 2D plane.

Until someone binds `HLRBRep_*` and writes those ~200 lines of API, the 2D-figure half of the requirement is **Python-or-custom-WASM**, not `npm install`.

---

## 5. Bundle size, cold start, workers, memory

### 5.1 WASM blobs you would actually ship

| Artifact | Uncompressed | Role |
| --- | --- | --- |
| `occt-import-js.wasm` 0.0.23 | **7.6 MB** | STEP/IGES/BREP → mesh |
| `replicad_single.wasm` 1.0.0 | **23.0 MB** | trimmed OCCT 8 kernel |
| `cascadestudio.wasm` 2.0.6 | **21.2 MB** | CascadeStudio OCCT 8 |
| `opencascade.full.wasm` 2.0.0-beta | **50.3 MB** (docs: ~9.1 MB brotli) | full Embind API |
| `@bitbybit-dev/occt` 32-bit | **34.5 MB** | another trimmed OCCT |
| `@bitbybit-dev/occt` 64-bit | **35.5 MB** | memory64, >4 GB heaps |
| `manifold.wasm` 3.5.1 | **0.54 MB** | mesh kernel |
| `o3dv.min.js` | **1.06 MB** | viewer (WASM is extra) |
| `three` (you tree-shake this) | — | viewport |

A desktop app that only *views* STEP can ship **~8 MB WASM + ~1 MB viewer + three**. A desktop app that also *authors* B-rep ships **~22–35 MB WASM**.

### 5.2 Cold start

Published numbers:

- ocjs.org: 9 MB brotli “~9 s on good 3G, <1 s on 4G/DSL” — plus “compile and optimize the WASM … might take longer than downloading.” ([file-size](https://ocjs.org/docs/getting-started/file-size))
- donalffons (2021): full-module instantiate is the long pole; Chrome caches the single blob. ([emscripten#13495](https://github.com/emscripten-core/emscripten/issues/13495))
- `occt-wasm` crate (Rust host, not browser): first `OcctKernel::new()` “decompresses ~4.7 MB brotli and JIT-compiles … Expect ~100–500 ms.” ([lib.rs/occt-wasm](https://lib.rs/crates/occt-wasm)) — **not** a browser number; cited only as a lower bound.

For Electron/Tauri: ship the `.wasm` on disk, instantiate once in a dedicated worker at app start, keep the instance warm. Do not re-fetch. OPFS is optional on desktop (you already have a filesystem); it matters if you also ship a browser build.

### 5.3 Worker / OPFS strategy that matches LGPL

The Bitbybit pattern is the one to copy, regardless of vendor:

1. Main thread (proprietary React) never `import`s OCCT C++ bindings into the same compilation unit as business logic.
2. A worker script + `.wasm` sit as **loose files** next to the app (`resources/occt/`).
3. `postMessage` is the only link (documented command protocol).
4. A user (or you, later) can drop in a rebuilt WASM without relinking the app.

That is “dynamic linking” in LGPL §6(b) clothing. WASM cannot be a classic `.so`, so counsel will want this seam explicit. Bitbybit writes it down; replicad/cascade-core imply it by shipping a separate package.

OPFS: useful in a *browser* to persist the decoded WASM and large STEP buffers off IndexedDB. In Electron/Tauri, read the file with the native FS and `Transfer` the `ArrayBuffer` into the worker. Sync OPFS handles are worker-only anyway. ([MDN / RxDB notes](https://rxdb.info/rx-storage-opfs.html))

### 5.4 Memory ceilings on large assemblies

- Default Emscripten wasm32 heap max in the official OCJS custom build is **4 GB** (`MAXIMUM_MEMORY=4GB`). That is the hard ceiling for almost every binding in this survey.
- Bitbybit ships a **64-bit** OCCT wasm specifically to get past that.
- Native OCCT on a KUKA-robot STEP: “at least ten minutes … memory exceeds ten [GB]” on OCCT 7.9.0. ([dev.opencascade.org, 2026-03-25](https://dev.opencascade.org/content/slow-import-step-files-and-high-memory-usage-occt-790))
- `occt-import-js` #66 (2026-03-30): “big assembly is too slow” — open, no fix.

Practical rule for an attorney desktop: **parts and small assemblies (tens of MB STEP) are fine; vehicle/engine assemblies are not a WASM job.** Overflow path: shell out to a local native OCCT / pythonocc / build123d process with a real 64-bit address space, write glTF, load that in three.js.

---

## 6. License-trap audit

This is the section that decides the stack. I am not your lawyer; I am reporting what the files say.

### 6.1 OCCT itself: LGPL-2.1-**only** + Open CASCADE Exception 1.0

Upstream statement ([OCCT README](https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/README.md); [occt_public_license.html](https://occt3d.com/dev/doc/overview/html/occt_public_license.html), both fetched 2026-08-17):

> Open CASCADE Technology is free software; you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License version 2.1 … **with a special exception defined in the file `OCCT_LGPL_EXCEPTION.txt`**.
>
> Alternatively, Open CASCADE Technology may be used under the terms of the Open CASCADE commercial license.

SPDX identifier: `LGPL-2.1-only WITH OCCT-exception-1.0`. ([spdx.org/licenses/OCCT-exception-1.0.html](https://spdx.org/licenses/OCCT-exception-1.0.html))

**Full exception text** ([OCCT_LGPL_EXCEPTION.txt](https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/OCCT_LGPL_EXCEPTION.txt)):

> The object code (i.e. not a source) form of a "work that uses the Library" can incorporate material from a header file that is part of the Library. As a special exception to the GNU Lesser General Public License version 2.1, you may distribute such object code incorporating material from header files provided with the Open CASCADE Technology libraries (including code of CDL generic classes) under terms of your choice, provided that you give prominent notice in supporting documentation to this code that it makes use of or is based on facilities provided by the Open CASCADE Technology software.

What the exception **does**: lets you statically compile against OCCT headers (templates, inline CDL generics) and still keep *your* object code proprietary, with a notice.

What the exception **does not** do:

- It does **not** turn OCCT into MIT.
- It does **not** waive LGPL §6 (user must be able to relink/replace the library).
- It does **not** waive source-offer for *the library itself*.
- It does **not** bless combining OCCT with AGPL app code and calling the result “MIT.”

### 6.2 How JS bindings inherit this

A WASM binary produced by compiling OCCT C++ is a **binary form of the Library** (LGPL §4). Embind glue that is generated from OCCT headers is either part of the Library or a “work that uses the Library.” Either way:

| Package | Declared license | What it actually is |
| --- | --- | --- |
| `opencascade.js` | LGPL-2.1-only | Honest. Ships LGPL text. **Does not ship `OCCT_LGPL_EXCEPTION.txt`.** |
| `occt-import-js` | LGPL-2.1 | Honest. Same. |
| `replicad` | MIT | Honest *for the TS API*. |
| `replicad-opencascadejs` | **LGPL-2.1-only** | Honest for the WASM. Exception file not in the npm package. |
| `cascade-core` | MIT | **Misleading if read alone** — depends on `opencascade.js` (LGPL) via a GitHub fork. |
| CascadeStudio README | “MIT” | Same omission. |
| `@bitbybit-dev/occt` | MIT | Wrapper MIT; docs correctly say OCCT stays LGPL and must be replaceable. |
| Chili3D app | **AGPL-3.0** | Copyleft upgrade. `cpp/` is LGPL-3.0 (different from OCCT’s 2.1-with-exception). |
| xeokit | **AGPL-3.0** | Independent of OCCT. |
| O3DV engine | MIT | Honest for *their* code; they depend on `occt-import-js` (LGPL) for STEP. |
| JSCAD / three / manifold / truck | MIT / Apache-2.0 | Clean. |

**“LGPL-2.1-only” vs “LGPL-2.1-only WITH OCCT-exception-1.0”:** the JS packages typically copy `LICENSE_LGPL_21.txt` and drop the exception file. SPDX on npm is `LGPL-2.1` / `LGPL-2.1-only`. That is *stricter on paper* than upstream OCCT (you lose the header-incorporation comfort). In WASM practice the exception matters less than §6 replaceability, because you are not compiling your React app against OCCT headers — Emscripten already did that inside the `.wasm`.

### 6.3 What LGPL-2.1 requires of a closed Electron/Tauri app that *bundles* the WASM

From LGPL-2.1 §6 (paraphrase, see the [full text](https://occt3d.com/dev/doc/overview/html/occt_public_license.html)):

1. Prominent notice that the app uses the Library, plus a copy of the LGPL.
2. One of: (a) ship complete corresponding source of the Library *and* the object files of the “work that uses the Library” so the user can relink; **or** (b) use a shared-library mechanism so the user can drop in a modified Library; **or** (c)/(d)/(e) written offer / equivalent access.
3. Do not impose further restrictions on the Library.

For WASM, (b) is the only mechanism that maps cleanly: **the `.wasm` + worker must be a replaceable file**, not inlined into a single asar/blob that a user cannot swap. Provide:

- `THIRD_PARTY_NOTICES` naming OCCT + the binding, with LGPL-2.1 and (ideally) the OCCT exception.
- A URL or on-disk copy of the exact OCCT + binding sources used to build *that* `.wasm`.
- A one-page “how to rebuild and replace `occt-import-js.wasm`” note.

Static-linking panic (“LGPL forbids static link”) is the wrong framing. OCCT’s *exception* exists specifically because OCCT is usually statically compiled. The remaining duty is **replaceability + source of the library**, not open-sourcing your app.

### 6.4 What *would* contaminate a proprietary app

| Action | Effect |
| --- | --- |
| Copy Chili3D TypeScript / UI into your app | **AGPL-3.0** on the combination if you distribute |
| `npm i @xeokit/xeokit-sdk` into a closed app without a Creoox deal | **AGPL-3.0** |
| Vendor FreeCAD (LGPLv2+ *plus* many GPL plugins) as the renderer | GPL risk from plugins; not this lane’s focus |
| Compile OCCT objects *into* your main native binary and strip symbols / refuse source | Classic LGPL violation |
| Take `replicad`’s MIT as a blanket for the WASM | Wrong; `replicad-opencascadejs` is LGPL-2.1-only |
| Use APS Viewer | Not copyleft — but cloud + proprietary ToS, fails offline |

LGPL is **not** GPL. Calling LGPL “GPL contamination” is the other frequent error. You can ship a closed app that *uses* OCCT. You cannot ship a closed app that *is* Chili3D or xeokit.

### 6.5 Clean licenses (no copyleft)

three.js (MIT), O3DV engine (MIT), model-viewer (Apache-2.0), manifold-3d (Apache-2.0), JSCAD (MIT), truck (Apache-2.0), Fornjot (0BSD, dead), Speckle viewer (Apache-2.0), build123d (Apache-2.0, Python).

---

## 7. Recommended stack

### Winner — “view CAD offline in React/TS, no AGPL/GPL, STEP included”

```
React + TypeScript viewport
        │
        ├─ three@0.185 (MIT)
        │     STLLoader / 3MFLoader / GLTFLoader
        │     OrbitControls + clipping planes + raycast measure
        │
        ├─ Worker: occt-import-js@0.0.23 (LGPL-2.1)
        │     occt-import-js.wasm  (~7.6 MB, replaceable file on disk)
        │     ReadStepFile / ReadIgesFile → Transferables into main thread
        │
        └─ Optional chrome: online-3d-viewer@0.18 EmbeddedViewer (MIT)
              already wires the above; fork if you need a tighter React API
```

**Why this and not replicad/CascadeStudio as the default:** viewing does not need a 22 MB authoring kernel. `occt-import-js` is the smallest STEP WASM, is what O3DV already ships in production, and has a three.js-shaped JSON output. LGPL duty is one replaceable file.

**Offline:** yes. **Confidentiality:** files never leave the machine. **GPL/AGPL:** none. **LGPL:** yes, contained.

**Does not do:** exact-geometry measure, STEP write, fillets, or HLR figures.

### Runner-up — same viewer, plus an authoring kernel when you need B-rep

Keep the winner, add:

```
Worker #2: replicad@1.0.0 (MIT) + replicad-opencascadejs@1.0.0 (LGPL-2.1-only)
           replicad_single.wasm (~23 MB, OCCT 8, replaceable)
```

Use this worker for “build / boolean / STEP export / 2D blueprint SVG.” Do not load it until the user opens a modeling tool. CascadeStudio `cascade-core@2.0.6` is the alternative if you want an already-workerized stdlib (`Box`, `Fillet`, `ImportSTEP`) instead of replicad’s CadQuery-ish API — same license shape, similar ~21 MB WASM, less TypeScript-native.

**Do not** take Chili3D as the runner-up. The product is better; the license ends the conversation.

### The thing that will bite (concrete)

**Hidden-line 2D export is not in any shippable JS package, and the thing that looks like it (O3DV “Show Edges”, three.js `EdgesGeometry`, replicad `toSVG`) is not HLR.**

What will happen in week six:

1. Product asks for USPTO-style black-line isometric + hidden lines from the STEP that is already on screen.
2. Someone turns on edge overlay. Fillets become a chicken-wire mess; hidden edges are either all drawn or all missing.
3. Someone files an issue on `opencascade.js` and discovers `master` last moved in 2023 and the example YAML never bound `HLRBRep_Algo`.
4. You now own a custom OCCT-8 WASM build (replicad’s `taucad/opencascade.js` docker image is the least-stale starting point) that adds `HLRBRep_Algo`, `HLRAlgo_Projector`, `HLRBRep_HLRToShape`, plus an SVG/DXF writer. That is a kernel project, not a viewer ticket.
5. Meanwhile large assemblies already OOM the wasm32 4 GB heap (`occt-import-js` #66), so the same week you also need a native 64-bit overflow path.

**Mitigation if figures are in v1:** do not wait for JS HLR. Ship a local sidecar — build123d `project_to_viewport` + `TechnicalDrawing` + `ExportSVG` / `ExportDXF` — talking to the desktop app over stdin/files. Apache-2.0 Python + OCCT LGPL in a *separate process* is cleaner than a half-HLR WASM, and it is the only stack that already emits ISO hidden linetypes and title blocks. Keep the in-app viewer on the winner stack.

Second bite, almost as sharp: **“replicad/cascade-core is MIT” will fail the first real license review.** Budget a `THIRD_PARTY_NOTICES`, the OCCT exception text, and a replaceable-WASM layout on day one, or counsel will bounce the build.

---

## Comparison table (live 2026-08-17)

| Project | Ver / last commit | WASM / bundle | License | STEP/IGES | Offline embed | 2D HLR | Proprietary-safe? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| opencascade.js | beta 2.0.0 / code 2023-03 | 50 MB full | LGPL-2.1-only | yes (if bound) | yes | only if you bind it | yes, with LGPL duties |
| occt-import-js | 0.0.23 / 2024-12 | **7.6 MB** | LGPL-2.1 | import→mesh | yes | no | yes, with LGPL duties |
| replicad + ocjs | 1.0.0 / 2026-08-14 | 23 MB | MIT + **LGPL-2.1-only** | yes + export | yes | 2D blueprint SVG only | yes, if WASM stays separate |
| cascade-core | 2.0.6 / 2026-06 | 21 MB | MIT (OCCT LGPL underneath) | yes | yes | no | same caveat |
| manifold-3d | 3.5.1 / 2026-08 | 0.54 MB | Apache-2.0 | no | yes | no | yes |
| Fornjot | archived 2026-06 | n/a | 0BSD | no (unfinished) | n/a | no | dead |
| truck / truck-js | crate 0.2.0 / 2026-08-10 | DIY wasm | Apache-2.0 | `truck-stepio` | possible | `truck-drafting` native, WASM `UNVERIFIED` | yes, immature |
| Chili3D | 2026-08-05 | ~50 MB npm | **AGPL-3.0** (+ LGPL-3.0 cpp) | yes | yes | `UNVERIFIED` | **no** |
| JSCAD | modeling 2.13.0 | JS only | MIT | no | yes | no | yes, wrong job |
| three.js | 0.185.1 | n/a | MIT | **no loader** | yes | mesh edges only | yes |
| model-viewer | 4.3.1 | n/a | Apache-2.0 | glTF only | yes | no | yes, wrong job |
| O3DV | 0.18.0 / 2026-06 | 1 MB JS + 7.6 MB wasm | MIT + LGPL importer | yes | yes | crease edges | yes, with LGPL duties |
| CAD Assistant | desktop app | n/a | freeware (not a lib) | yes | **not embeddable** | some viz `UNVERIFIED` | n/a |
| xeokit | 2.6.112 / 2026-08 | 26 MB unpacked | **AGPL-3.0** | IFC/XKT, not AP214 | yes | BIM edges, not HLR | **no** (unless paid) |
| APS Viewer | cloud | n/a | proprietary | via cloud | **no** | 2D sheets via translation | no (offline fail) |
| Speckle viewer | 2.31.14 | 2 MB | Apache-2.0 | hosted import | viewer yes / import no | no | viewer yes; importer no |
| build123d | 2026-08-14 | Python/native | Apache-2.0 (+ OCCT) | yes | sidecar, not in-process JS | **yes** (`project_to_viewport`) | yes as sidecar |

---

## Sources

- GitHub API + repo pages for every named project, fetched 2026-08-17.
- npm registry `latest` / `dist-tags` / `unpackedSize`, fetched 2026-08-17.
- jsDelivr `data.jsdelivr.com/v1/packages/npm/…` file listings, fetched 2026-08-17.
- [ocjs.org/docs/getting-started/file-size](https://ocjs.org/docs/getting-started/file-size)
- [ocjs.org/docs/app-dev-workflow/custom-builds](https://ocjs.org/docs/app-dev-workflow/custom-builds)
- [OCCT README + OCCT_LGPL_EXCEPTION.txt](https://github.com/Open-Cascade-SAS/OCCT)
- [occt3d.com OCCT public license](https://occt3d.com/dev/doc/overview/html/occt_public_license.html)
- [SPDX OCCT-exception-1.0](https://spdx.org/licenses/OCCT-exception-1.0.html)
- [three.js examples/jsm/loaders on `dev`](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/loaders)
- [3dviewer.net/info](https://3dviewer.net/info) and [O3DV engine docs](https://kovacsv.github.io/Online3DViewer/)
- [build123d import/export](https://build123d.readthedocs.io/en/latest/import_export.html) and [Technical Drawing tutorial](https://build123d.readthedocs.io/en/latest/tech_drawing_tutorial.html)
- [xeokit SDK licensing](https://xeokit.github.io/xeokit-sdk/docs/)
- [Chili3D README license](https://github.com/xiangechen/chili3d)
- [Fornjot README shutdown banner](https://raw.githubusercontent.com/hannobraun/fornjot/main/README.md)
- [truck-js Cargo.toml](https://raw.githubusercontent.com/ricosjp/truck/master/truck-js/Cargo.toml)
- [Bitbybit runner licensing](https://github.com/bitbybit-dev/bitbybit/blob/d3f52bd1fcf78148b60800d69ed6b42e53f4ad06/docs/learn/runners/licensing.mdx)
- [occt-import-js#66](https://github.com/kovacsv/occt-import-js/issues/66)
- [emscripten#13495](https://github.com/emscripten-core/emscripten/issues/13495)
- [APS / iolabs viewer comparison](https://iolabs.ch/en/blog/comparing-viewers/)
- [Speckle file-import blog 2025-09-04](https://speckle.systems/blog/view-and-analyze-cad-and-3d-files-easier-than-ever-with-speckle/)
