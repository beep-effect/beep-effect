# Graph 3D Navigation — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.

PACKET-SPECIFIC BINDING DISCIPLINE (locked 2026-07-14, grill interview):
- `graph.infranodus.com` JS/CSS bundle (research/seed/bundle/**): PROPRIETARY,
  REFERENCE-ONLY. Findings must be expressed as prose parameters (numbers,
  curves, technique names). NEVER copy, transcribe, or lightly paraphrase code
  from the bundle into any report or implementation.
- InfraNodus / Nodus Labs open-source repos (textexture, noduslabs/infranodus,
  etc.): AGPL ⇒ read-for-understanding only, CLEAN-ROOM. No vendored code, no
  near-verbatim ports. Patterns may be described in prose and reimplemented from
  the prose spec only.
- Cloned integration repos (~/YeeBois/infranodus/*): used for the DATA CONTRACT
  only (types, postMessage protocol). LICENSE files confirmed 2026-07-14:
  mcp-server-infranodus = MIT (port-with-attribution); infranodus-obsidian-plugin
  = AGPL-3.0 (reference-only / clean-room).
- Implementation of the eventual component is clean-room from the documented
  prose spec in this packet's research reports.
-->

- **Cluster / origin:** InfraNodus 3D graph-view reverse-engineering sweep,
  2026-07-14: browser artifact capture (claude-in-chrome) + public bundle
  download + web corpora, analyzed by 6 codex gpt-5.6-sol (--effort medium)
  lanes + 1 codex verify gate. Raw artifacts under `research/seed/`.
- **Provenance:** user spark + screenshots in `CAPTURE.md`; grill-with-docs
  interview decisions (to be logged in `DECISIONS.md`).

## 1. Mined source corpus

The primary mined corpus is the proprietary `graph.infranodus.com` bundle
(reference-only) plus the two live-demo browser captures — every extracted
style parameter cites `research/seed/bundle/**` or `research/seed/demo/**` by
`file:line`. Rather than duplicate ~90 rows here, **each lane report carries its
own complete `## Sources` table** with ids `g3d-{a..f}-NN`. The two data-contract
rows below plus the per-lane tables are the full mined ledger.

> **`research/seed/` is gitignored and NOT committed** — it is ~12.4 MB of
> third-party reference artifacts (proprietary bundle, scraped vendor docs,
> copyrighted papers, their demo dataset) and this repo is public. Seed
> `file:line` citations are provenance of a **local reproduction**; see
> `research/SEED-INVENTORY.md` for the corpus manifest and re-fetch recipe.
> `research/VERIFICATION.md` resolved every load-bearing citation against the
> corpus while it existed locally — that pass is the durable proof.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `g3d-contract-01` | GraphNode/GraphEdge render-attribute model | infranodus-mcp-server (MIT) | `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-37` | data contract | reference |
| `g3d-contract-02` | iframe embed + postMessage protocol (LOAD_JSON, UPDATE_SELECTED_NODES, …) | infranodus-obsidian-plugin (AGPL-3.0) | `~/YeeBois/infranodus/infranodus-obsidian-plugin/src/graph_view/GraphView.tsx:63-74,1164-1180` | renderer input contract | reference |
| `g3d-bundle-01` | Proprietary renderer JS (three.js r158 + ForceGraph3D + d3-force-3d): force config, node/label sizing, palette, declutter, edge geometry, dimming, toggle, controls | graph.infranodus.com (proprietary) | `research/seed/bundle/beautified/index-ZkCMfQ39.js` (targeted ranges per `research/bundle-static-analysis.md`) | full style spec | reference |
| `g3d-demo-01` | Live scene census + graph store export (r158, Sprite labels, tube edges, 0.10/0.35 dimming, z-flatten toggle, 150-node/6-community dataset) | graph.infranodus.com runtime | `research/seed/demo/scene-introspection.json`, `research/seed/demo/spacex_s1.graph.json`, `research/seed/demo/interaction-notes.md` | runtime corroboration | reference |

**How these inform this packet:** the node attribute set
(`degree`, `bc`, `community`, `weighedDegree`, 2D `x/y`) is the vocabulary the
renderer maps to color/size/label prominence; the postMessage protocol proves
the renderer is a standalone client app consuming plain JSON — our component
gets the same shape of contract (flat projection in, handle out). All
quantitative style parameters are adversarially verified in
`research/VERIFICATION.md` (net assessment: trustworthy-with-fixes).

## 2. Upstream repositories & licenses

Licenses verified against local LICENSE files 2026-07-14 (VERIFICATION.md §4).

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| graph.infranodus.com bundle (not a repo; served JS/CSS) | proprietary (no license) | **reference-only** — prose parameters, zero code | style parameters, technique identification |
| noduslabs/* OSS (textexture, infranodus legacy) | AGPL-3.0 | **clean-room** — read for understanding only | layout/label concepts as prose |
| ~/YeeBois/infranodus/mcp-server-infranodus | **MIT** (LICENSE confirmed) | port-with-attribution | data model types |
| ~/YeeBois/infranodus/infranodus-obsidian-plugin | **AGPL-3.0** (LICENSE confirmed) | **reference-only / clean-room** | postMessage/iframe contract |
| vasturiano/3d-force-graph, react-force-graph, three-forcegraph, d3-force-3d | MIT | port-with-attribution | candidate engine |
| protectwise/troika (troika-three-text) | MIT | port-with-attribution | SDF label rendering |
| pmndrs/react-three-fiber, drei | MIT | port-with-attribution | candidate React wrapper |
| reagraph | Apache-2.0 | port-with-attribution | candidate wrapper — **NOTE:** its `three ^0.184.0` **excludes** repo `0.185.1` (0.x caret), so it needs a lockfile override/patch or is disqualified; precomputed-position API also undocumented (VERIFICATION.md §1, must-fix #1) |

## 3. External research sources

Fetched as local markdown under `research/seed/web/**` (2026-07-14). The
`corpus-index.md` summaries in `web/libraries/` and `web/labels/` are **not
citable evidence** (VERIFICATION.md §3 flags inaccurate rows) — cite the primary
files below or the lane reports.

- **InfraNodus method (reference-only):** Paranyushkin, "InfraNodus: Generating
  Insight Using Text Network Analysis", The Web Conference (WWW) 2019 —
  `dl.acm.org/doi/10.1145/3308558.3314123`
  (`seed/web/infranodus-method/acm-www19.md`); Paranyushkin,
  "Identifying the Pathways for Meaning Circulation…" (2011),
  `noduslabs.com/research/...` (`pathways-2011.md`); InfraNodus docs
  (`how-it-works.md`, `docs-network-analysis.md`, `graph-settings.md`,
  `centrality-support.md`).
- **3D graph libraries (MIT/Apache, port-with-attribution):** `github.com`
  READMEs + package.json for `vasturiano/3d-force-graph`, `react-force-graph`,
  `three-forcegraph`, `d3-force-3d`; `protectwise/troika` (`troika-three-text`);
  `pmndrs/react-three-fiber`, `@react-three/drei`; `reaviz/reagraph`; `three.js`;
  `@cosmos.gl/graph` (`seed/web/libraries/*`).
- **Label / anti-overlap (reference / permissive docs):** troika SDF docs,
  `sigmajs.org` customization, `threejs.org` billboards + CSS2DRenderer,
  discourse CSS2D optimization thread, MDPI + PMC WebGL-visual-analytics
  benchmarks (`seed/web/labels/*`).

## 4. In-repo capability references

| Brick | Path | Mode |
|-------|------|------|
| `@beep/cosmos` render driver (handle contract, label overlay, WebGL2 probe) | `packages/drivers/cosmos` | reuse (contract mirror) / extend |
| `OntologyGraphProjection` + visualizer worker (clusters, labelDetail, typed arrays) | `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts` | extend (z coordinate / 3D layout) |
| Ontology client atom chain (worker bridge, render bridge) | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts` | extend (parallel 3D bridge + toggle) |
| Ontology workbench mount | `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx` | extend (renderer toggle UI) |
| R3F precedent + Storybook | `packages/foundation/ui-system/ui/src/components/orb.tsx`, `apps/storybook` | reuse (pattern) |
| FPS spike pattern | `apps/professional-desktop/src/spikes/CosmosSpike.tsx` | reuse (verification pattern) |
| 3D graph engine + React component | (per P0 design gate) | NET-NEW |

## 5. Cross-links & provenance

- Packet: `explorations/graph-3d-navigation/` (this file's owner).
- Graduated → `goals/graph-3d-view` (2026-07-14); back-link in
  `ops/manifest.json` `links.goals`.
- Research reports (lanes a–f) + `VERIFICATION.md`: `research/*.md` in this
  packet, carried into the goal's `research/`.
- Raw artifact corpus: `research/seed/` — **local-only, gitignored** (third-party
  reference material; public repo). Manifest + re-fetch recipe:
  `research/SEED-INVENTORY.md`.
- Synthesis: `RESEARCH.md`; decisions log: `DECISIONS.md`.

## 6. Verify-gate corrections (VERIFICATION.md §5, binding on the goal's P0)

Adversarial verify net assessment: **trustworthy with fixes.** Design-gate must
honor: (1) reagraph `^0.184.0` excludes `0.185.1` — needs override or is out;
(2) 2D/3D toggle is **non-destructive z flatten/restore**, not delete+regenerate;
(3) layout is baked-xyz **into an active d3 component** — freeze-vs-simulate is a
P0 choice, not "no active force"; (4) dark canvas target is observed `#111111`
(`#000000` is only the bundle fallback); (5) selection *values* (0.10 ordinary /
0.35 group) are confirmed but click *causality/semantics* are unresolved (idle
auto-cycle confound); (6) edge curvature/opacity constants are static-analysis
confirmed, not demo-measured; (7) **no stack is proven at ~2,500 nodes** — a
WebKitGTK benchmark is the acceptance gate, not assumed evidence.
