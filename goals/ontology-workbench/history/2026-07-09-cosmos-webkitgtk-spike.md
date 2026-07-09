# Cosmos.gl webkitgtk viability spike — PASS

Date: 2026-07-09. Phase: P3 Visualizer early spike (SPEC stop-condition gate).

## Verdict

cosmos.gl is viable on webkitgtk. The stop condition does not trigger; sigma.js
remains capability-detection fallback only. P3 deep integration proceeds on the
cosmos path.

## Measurements

Environment: Tauri dev window (webkitgtk, Linux 7.1.3-2-cachyos, Wayland),
`VITE_COSMOS_SPIKE=1 VITE_COSMOS_SPIKE_SIZE=100k bun run dev:tauri`, spike page
`apps/professional-desktop/src/spikes/CosmosSpike.tsx`, synthetic projection from
`@beep/cosmos` `generateSyntheticOntologyProjection` (seed 97).

| Metric | Value |
| --- | --- |
| Backend selected | cosmos (WebGL2 probe positive in webkitgtk) |
| Elements | 100,000 (50,000 nodes / 50,000 edges) |
| Setup time | 240.0 ms |
| FPS | 60.0 (display-rate) |

Evidence: `2026-07-09-cosmos-webkitgtk-spike.png` (window screenshot with
readout). Browser cross-check (Chromium engine via vite dev, headless preview):
backend cosmos, 1k setup 376.2 ms, 10k and 100k datasets initialize cleanly;
FPS not measurable headless (rAF throttled in hidden tabs).

## Folds-active re-proof (P3 exit criterion)

After P3 deep integration (worker-side projection + folds), re-run on webkitgtk
(`VITE_COSMOS_SPIKE=1 VITE_COSMOS_SPIKE_SIZE=100k bun run dev:tauri`):

| Metric | Value |
| --- | --- |
| Backend | cosmos |
| Elements | 100,000 (50,000 nodes / 50,000 edges source) |
| Fold level | L3 (contract-verified in browser: 50k nodes fold to 300 community buckets, 49,610 edges) |
| Setup (worker projection, off UI thread) | 8,185 ms |
| FPS | 60.0 |

Evidence: `2026-07-09-cosmos-webkitgtk-folds.png`. Browser cross-check confirmed
`window.__COSMOS_SPIKE__.foldLevel === "L3"` with projected node/edge counts.
UI remained responsive during projection (worker-side, unlike the pre-P3 spike
where 100k generation blocked the main thread).

During this re-proof a worker blocker was found and fixed: the visualizer
workers crashed at module load (`document is not defined` via the
`@beep/ontology-use-cases` barrel → `@beep/schema` root → `Markdown.ts` →
`micromark`) and hung silently without error listeners. Fix: worker-safe
`aggregates/Session/worker` entrypoint, `error`/`messageerror` listeners in
both worker consumers, and a DOM-free import-graph regression test
(`WorkerImportGraph.test.ts`).

## Integration notes discovered by the spike

- `@cosmos.gl/graph` 3.1.0 ships CJS/UMD deps that break Vite's rolldown
  optimizer: `gl-bench` must be aliased to its shipped ESM build
  (`dist/gl-bench.module.js`; the optimizer picks the default-less UMD `main`)
  and `seedrandom` needs `optimizeDeps.include` interop. Both handled in
  `apps/professional-desktop/vite.config.ts`.
- `@cosmos.gl/graph` stays in `optimizeDeps.exclude` so it consumes the
  wrapped modules.
- Spike page gained `VITE_COSMOS_SPIKE_SIZE` (1k|10k|100k) because Tauri's
  fixed `devUrl` cannot carry the `?cosmos-spike` query's size selection.
- 100k synthetic generation runs on the UI thread in the spike and blocks it
  for several seconds — deep integration must keep projection generation
  worker-side (already the P3 plan: worker-computed buffers + incremental
  diffs).
