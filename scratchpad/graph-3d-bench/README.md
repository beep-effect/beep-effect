# graph-3d P0 design-gate benchmark

Clean-room prototype of the architecture chosen by
`goals/graph-3d-view/research/DESIGN.md` D1 (custom instanced Three.js driver),
built from the prose parameters in the packet's frozen research only — no
bundle/AGPL source consulted. This is P0 evidence; the committed P1 FPS-probe
story supersedes it as the living benchmark.

## Run

```sh
# dev server (also registered as "graph3d-bench" in .claude/launch.json)
node_modules/.bin/vite scratchpad/graph-3d-bench --port 5199 --strictPort

# interactive: open http://localhost:5199/?nodes=2500&edges=5000
# (buttons: 20s scripted benchmark / select hub / clear / destroy+double-remount)

# headless with real GPU (system chromium via repo playwright):
node scratchpad/graph-3d-bench/bench-headless.mjs 2500 5000
node scratchpad/graph-3d-bench/bench-headless.mjs 2500 12500
```

Protocol: 20 s scripted camera sweep (full orbit, dolly 900 → 260 → 900) with a
selection-dim full-attribute rewrite at t=8 s, cleared at t=12 s, and a
full-projection buffer rewrite at t=15 s. Labels re-ranked/faded every frame.
Picking measured at viewport center every 30 frames. The remount exercise runs
destroy → mount → destroy → mount and asserts a single canvas remains.

## Recorded results (2026-07-16)

Hardware: AMD Ryzen Threadripper 9970X, AMD Radeon AI PRO R9700
(radeonsi gfx1201, ANGLE OpenGL ES 3.2), CachyOS Linux 7.1.3, headless
Chromium via Playwright, 1600×1000 @ dpr 1.

```json
{"nodes":2500,"edges":5000,"dpr":1,"viewport":[1600,1000],"layoutMs":1251,"layoutTicks":38,"graphBuildMs":1258,"mountMs":75,"updateRewriteMs":14,"frames":1186,"avgFps":59.3,"p95FrameMs":19.6,"p99FrameMs":26.4,"worstFrameMs":51.9,"onePercentLowFps":37.9,"pickAvgMs":0.23,"pickMaxMs":2.2,"labelsAvg":90,"labelsMax":90,"drawCalls":78,"triangles":305152,"heapMb":16,"gpu":"ANGLE (AMD, AMD Radeon AI PRO R9700 (radeonsi gfx1201 ACO), OpenGL ES 3.2)","remount":"REMOUNT_OK doubleMountAvgMs=19.8 canvases=1"}
{"nodes":2500,"edges":12500,"dpr":1,"viewport":[1600,1000],"layoutMs":1410,"layoutTicks":38,"graphBuildMs":1416,"mountMs":23,"updateRewriteMs":2.5,"frames":1201,"avgFps":60,"p95FrameMs":16.8,"p99FrameMs":16.9,"worstFrameMs":17,"onePercentLowFps":59.2,"pickAvgMs":0.11,"pickMaxMs":0.6,"labelsAvg":90,"labelsMax":90,"drawCalls":92,"triangles":755180,"heapMb":18,"gpu":"ANGLE (AMD, AMD Radeon AI PRO R9700 (radeonsi gfx1201 ACO), OpenGL ES 3.2)","remount":"REMOUNT_OK doubleMountAvgMs=12.9 canvases=1"}
```

Earlier in-pane interactive runs (867×887 viewport, same machine, Browser
pane): cold 50.9 avg fps with a single 2,025 ms first-frame spike (shader
compile + label-pool rasterization — since eliminated by pre-rasterization),
warm 60.0 avg / p99 16.9 ms / worst 17.0 ms.

All runs are display-capped at 60 Hz: they bound performance from below and do
not establish a ceiling. The binding acceptance benchmark is the P2 run inside
Tauri/WebKitGTK (`goals/graph-3d-view/SPEC.md`).
