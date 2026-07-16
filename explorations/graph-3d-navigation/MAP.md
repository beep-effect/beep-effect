# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `graph-3d-view` | Ship an InfraNodus-grade React 3D knowledge-graph renderer on the existing stack, integrated into the ontology workbench behind a 2D/3D toggle (cosmos default), ~2.5k-node target. | none | `@beep/cosmos` handle contract (reuse/mirror), `OntologyGraphProjection` + visualizer worker (extend: z/3D), ontology client atom chain (extend: 3D bridge + toggle), `Session.workbench.tsx` (extend: toggle UI), `@beep/ui` orb.tsx + Storybook (reuse pattern), `CosmosSpike.tsx` (reuse: FPS proof); 3D engine + component = **NET-NEW** (placement per P0) |

Single goal — the scope decision (`DECISIONS.md` goal-scope) is one phased
packet, not multiple. Phases P0–P3 live in the goal `PLAN.md`/manifest.

## Sequencing

Within `goals/graph-3d-view`:

1. **P0 design gate (Fable)** — consume `research/*`, pick stack + placement +
   label technique + layout location + interaction model + theming, with a 2.5k
   benchmark; emit `research/DESIGN.md`. Blocks everything.
2. **P1 generic component (Fable frontend; codex drafts schema/generator/test
   assertions)** — the 3D renderer + labels + interactions on synthetic data,
   Storybook + FPS probe + vitest browser test. Proves the visuals + perf in
   isolation.
3. **P2 workbench integration (codex drafts worker-z/mapping/bridge atoms; Fable
   reviews + writes toggle UI + QA)** — z in the projection/worker,
   `graph3dProjectionFromOntology`, parallel render bridge + toggle atom, header
   toggle, browser + Tauri QA, cosmos-default regression.
4. **P3 close (Fable)** — `/reflect`, evidence, `bun run beep yeet` to a
   mergeable PR.

## First Vertical Slice

P0 → P1: a Storybook story renders a synthetic ~2,500-node graph exhibiting all
six InfraNodus behaviors (dark bg, community colors, bc-proportional
distance-faded labels, curved edges, selection dimming, 2D/3D toggle) with a
CosmosSpike-style FPS readout. Verified by: the story renders; a vitest browser
test mounts it, asserts node count, drives `select(id)` and checks the dim
state, and asserts clean `destroy()` (StrictMode-safe); the FPS probe records
≥ target framerate at 2.5k (number recorded even if below target). No workbench
or ontology dependency yet — pure `@beep/*`-agnostic proof.

## Open Risks Inherited From The Brief

- 2.5k performance unproven on any candidate; P0/P1 must benchmark on
  WebKitGTK — stack choice is contingent (SPEC constraint + P1 gate).
- Single `three` instance mandatory; verify lockfile dedupe (SPEC constraint).
- StrictMode double-mount + Tauri CSP (bundle SDF fonts, stable ref, full GL
  teardown) (SPEC constraint).
- Label engine at 2.5k: keep ≤300 visible cap + SDF/screen budget; DOM overlay
  is fallback only (SPEC constraint).
- Layout location (worker-z vs renderer-sim vs server-2D+z-synthesis) is a P0
  decision under worker-DOM-free + transferable constraints.
- Clean-room discipline is binding: no bundle/AGPL code copied; `rg` audit at
  P1/P2 (SPEC acceptance criterion).
