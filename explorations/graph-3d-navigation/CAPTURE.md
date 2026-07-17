# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-14

User spark (verbatim intent): found InfraNodus (https://infranodus.com) and its 3D
knowledge-graph view; likes it much more than the flat 2D view we use in the
professional desktop app. "At scale it makes navigating graphs easier. A big
problem with 2d graphs is node label/text overlap and this design does a good
job of solving that problem." Wants the style researched / reverse-engineered
and, by the end, a goals packet whose completion yields a React component on our
existing graph rendering stack.

Reference demo: <https://infranodus.com/demo/spacex_s1?background=dark&show_analytics=1&most_influential=bc2&maxnodes=150&labelsize=proportional&edgestype=curve&drawedges=true&drawnodes=true&labelsizeratio=2&graph_panel=gaps&hide_edit=1&dynamic=highlight&cutgraph=1&selected=highlight>
(the URL params themselves are a style vocabulary: `labelsize=proportional`,
`edgestype=curve`, `labelsizeratio=2`, `dynamic=highlight`, `selected=highlight`,
`maxnodes=150`, `background=dark`.)

User screenshots (assets/screenshots/):

- `user-01-overview-labels.png` — default 3D view: dark bg, community-colored
  nodes (green/blue/red/pink clusters), label size proportional to node metric,
  distant/less-important labels dimmed to near-invisibility, curved translucent
  edges.
- `user-02-zoomed-labels.png` — zoomed: more labels resolve, still no overlap;
  big hubs ("million", "share", "segment") dominate.
- `user-00-selected-dimming.png` — two nodes selected ("million", "operation"):
  selected labels get background pills, neighborhood stays lit, everything else
  dims; dashed path-like highlight between selections.

Six visual behaviors to reverse-engineer:

1. dark space background
2. force-directed 3D layout (server sends 2D x/y only → depth is client-side)
3. community-colored nodes (color by modularity class, size by weighted degree/bc)
4. proportional text labels that fade/attenuate with distance & importance
   (THE anti-overlap mechanism)
5. curved edges
6. selection highlight + neighborhood dimming; 2D/3D toggle button

Cloned repos inventory (~/YeeBois/infranodus/): `infranodus-obsidian-plugin`,
`mcp-server-infranodus`, `skills`. Verified 2026-07-14: ZERO rendering code in
any of them. Obsidian plugin embeds `https://graph.infranodus.com` in an iframe
(`src/graph_view/GraphView.tsx:1164`, base URL `src/settings/index.ts:68`) and
drives it over postMessage: `LOAD_JSON`, `UPDATE_SELECTED_NODES`,
`UPDATE_GROUPS`, `GAPS`, `RECALCULATION`, `TOPICS_UPDATE`. So the renderer is
the closed bundle served at graph.infranodus.com — that's the RE target.

Data contract (best artifact from the clones —
`mcp-server-infranodus/src/types/index.ts`):

- `GraphNode { id, label, degree, bc /* betweenness */, community, x, y, weighedDegree }`
- `GraphEdge { source, target, id, weight }`
- graph attributes: `modularity`, `top_nodes`, `top_clusters` (with `aiName`),
  `gaps`, `diversity_stats`. `graphologyGraph` property naming ⇒ graphology
  server-side. No z anywhere ⇒ 3D depth synthesized client-side.

Our existing stack (verified): `@beep/cosmos` (packages/drivers/cosmos) wraps
cosmos.gl 3.3.0 (WebGL2, 2D) + sigma fallback; uniform green nodes; DOM label
overlay capped at 300. The rich `OntologyGraphProjection`
(packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts:1413)
already computes clusters, labelDetail full|key|hidden, node kinds — all
discarded by the flat cosmos path. Workbench mount:
packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx; atom chain in
packages/ontology/client/src/aggregates/Session/Session.atoms.ts
(`cosmosProjectionFromOntology` ~1244, `ontologyGraphRenderBridgeAtom` ~1279).
R3F precedent: packages/foundation/ui-system/ui/src/components/orb.tsx
(three ^0.185.1, R3F ^9.6.1) + story.

Locked session decisions (grill-with-docs interview, 2026-07-14; full log goes
to DECISIONS.md at align):

1. exploration → graduate route; this packet → `goals/graph-3d-view`
2. one phased goal: P0 design gate → P1 generic component (Storybook) →
   P2 workbench integration → P3 close
3. scale target ~2,500 visible nodes, interactive
4. stack NOT pre-committed; P0 design gate decides (Fable designs)
5. full RE of public bundle + live demo, reference-only discipline; AGPL repos
   read-for-understanding only; clean-room implementation
6. routing: sonnet/haiku fetch web/browser artifacts; codex gpt-5.6-sol
   --effort medium analyzes/drafts; Fable orchestrates/designs/reviews/writes
   user-facing frontend; codex --write drafts non-visual plumbing
7. workbench 2D/3D toggle, cosmos 2D stays default
8. 6 codex research lanes + 1 codex verify gate

Half-thoughts / contradictions worth keeping: InfraNodus caps demo at
maxnodes=150 — their anti-overlap story is partly *curation* (top-N nodes),
not just rendering; our 2.5k target is more ambitious than what the reference
actually displays. The `bc2` in `most_influential=bc2` suggests
bc-relative-to-degree ("gateway") ranking, matches their gap/bridge talk.
InfraNodus 2D mode exists behind a "2D" button — parity suggests toggle, not
replacement. Their old OSS textexture/infranodus repos are AGPL — patterns only.
