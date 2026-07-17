# Seed Artifact Inventory

> **NOT COMMITTED — deliberately.** `research/seed/` is gitignored
> (`.gitignore`, "graph-3d-navigation reverse-engineering capture corpus"). It
> holds ~12.4 MB of **third-party reference artifacts only**: the proprietary
> `graph.infranodus.com` JS/CSS bundle, scraped vendor docs, copyrighted papers,
> and InfraNodus's demo dataset. This repo is public; publishing that corpus
> would redistribute proprietary/copyrighted third-party material and contradict
> this packet's binding reference-only discipline (`SOURCES.md`).
>
> **The committed prose reports are the deliverable.** The lane reports cite
> `research/seed/**` paths by `file:line`; those citations are **provenance of a
> local reproduction**, resolvable only in a checkout that has re-fetched the
> corpus. `VERIFICATION.md` resolved every load-bearing citation against the
> corpus while it existed locally (2026-07-14) — that adversarial pass is the
> durable proof, not the raw files.
>
> **To reproduce locally** (all sources are public; see `SOURCES.md` §3 for the
> full URL list): `curl` the bundle from `https://graph.infranodus.com/`
> (entry HTML → the `assets/index-*.js|css` it references), beautify with
> `bunx js-beautify`; re-fetch the web corpora from the URLs in `SOURCES.md` §3;
> re-capture the demo from the `CAPTURE.md` demo URL. Exact filenames, byte
> sizes, and sha256 for the bundle are in `seed/bundle/raw/bundle-inventory.md`
> once re-fetched.

Raw artifacts captured 2026-07-14 by the fetch wave (two claude-in-chrome
browser passes + bundle download + web corpora). These are the primary evidence
the six codex research lanes analyzed. **Reference-only**: the bundle is
proprietary; web docs are third-party. No files here are copied into
implementation.

## bundle/ — proprietary graph.infranodus.com renderer (reference-only)

| File | Bytes | What |
|---|---:|---|
| `bundle/raw/index-ZkCMfQ39.js` | 3,861,641 | The monolithic Vite JS chunk (three.js r158 + ForceGraph3D + A-Frame + vendor). |
| `bundle/raw/index-BqJZWaTP.css` | 47,003 | App stylesheet (UI tokens; graph labels are canvas sprites, not CSS). |
| `bundle/raw/index.html`, `index-root.html` | 1,238 ea | Entry HTML (`?iframe=true` and root). |
| `bundle/raw/bundle-inventory.md` | — | Download inventory (URLs, bytes, sha256). |
| `bundle/beautified/index-ZkCMfQ39.js` | 6,679,367 | Beautified JS — lane (a) grep target (do NOT read whole). |
| `bundle/beautified/index-BqJZWaTP.css` | 54,422 | Beautified CSS. |

## demo/ — live-demo capture (two corroborating browser passes)

| File | What |
|---|---|
| `spacex_s1.graph.json` | Graphology export from the app's zustand store: 150 nodes (key/degree/weighedDegree/bc/community/x/y/z), 1,497 of 1,500 edge triples, 6 communities. |
| `scene-introspection.json` | THREE.Scene census (244 objects): Sprite labels, tube edges (no GL_LINES), dimming 1.0/0.35, r158, graphology/zustand store. |
| `scene-introspection-selected.json` | Sprite opacity histogram (40×1.0, 8×0.35). |
| `webgl-fingerprint.json` | WebGL2/GLSL ES 3.00, canvas inventory, unmasked renderer. |
| `network-requests.json` | Request list + key endpoints (`/react/graph/recalculate`). |
| `resource-inventory.json` | Scripts/stylesheets/iframe inventory (three.js bundled). |
| `behavior-notes.md`, `interaction-notes.md` | Prose behavior: zoom/label bands, idle auto-cycle confound, definitive z-flatten 2D/3D toggle. |
| `fps-probe.md` | Draw-call counts (drag vs idle); hidden-tab rAF caveat. |
| `url-param-matrix.md` | URL-param → visual-effect probes. |
| `graph-app-standalone-notes.md` | A-Frame 1.5.0 on the standalone `graph.infranodus.com` surface. |
| `canvas-capture-attempts.md` | toDataURL capture method notes. |
| `F1-MANIFEST.md` | Capture provenance, dual-pass reconciliation, edge-loss disclosure. |

Screenshots live in `../../assets/screenshots/` (six numbered demo states +
`live-01-default.png` + three original `user-*.png`; F1 flagged `02==03` a failed
distinct zoom, `07==01`).

## web/infranodus-method/ — method corpus (reference-only, third-party)

Paranyushkin WWW'19 (`acm-www19.md`) + 2011 pathways (`pathways-2011.md`) +
polysingularity; InfraNodus docs (how-it-works, network-analysis,
graph-settings, centrality-support, use-case pages). `corpus-index.md` present.

## web/libraries/ — 3D-graph library corpus (port-with-attribution)

READMEs + package.json for: 3d-force-graph, react-force-graph, three-forcegraph,
d3-force-3d, troika-three-text, react-three-fiber, drei, reagraph, three.js,
cosmos. `corpus-index.md` present.

## web/labels/ — label / anti-overlap corpus (reference / permissive)

Troika SDF docs, sigma.js customization, three.js billboards/CSS2DRenderer,
visual-encyclopedia, discourse CSS2D optimization, MDPI + PMC benchmarks.
`corpus-index.md` present.

## Evidence caveats (from VERIFICATION.md §3)

- `web/libraries/corpus-index.md` and `web/labels/corpus-index.md` are secondary
  summaries with over-stated / inaccurate rows (e.g. three-forcegraph peer
  range, reagraph precomputed-position support, a CSS2D ~100-label limit, Sigma
  `labelGrid` internals). **Do not cite the index summaries as design evidence**
  — cite the primary README/doc files or the lane reports.
- `demo/spacex_s1.graph.json` is read from the in-memory store, not a network
  response body; 3 of 1,500 edges were lost in chunk reassembly (disclosed in
  `F1-MANIFEST.md`), not an app count.
