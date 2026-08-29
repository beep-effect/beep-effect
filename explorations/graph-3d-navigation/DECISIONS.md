# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-07-14 — pipeline-route

**Question:** Exploration→graduate packet, or scaffold a goals packet directly?

**Answer:** Exploration packet `explorations/graph-3d-navigation/` → graduate
into `goals/graph-3d-view/`.

**Rationale:** Research needed to de-risk the design before a goal exists;
decisions, brief, and decomposition each get their proper home and graduation
carries `SOURCES.md` + provenance into the goal manifest (the
`effect-ontology-harvest` precedent). Direct-goal was rejected as premature —
the packet would start before research settled the stack.

## 2026-07-14 — goal-scope

**Question:** What does the graduated goal deliver?

**Answer:** ONE phased goal — P0 research-informed design gate → P1 generic 3D
graph React component (Storybook, synthetic data) → P2 ontology-workbench
integration behind a renderer toggle → P3 close/reflect.

**Rationale:** De-risks the visuals in isolation (Storybook loop, R3F precedent)
before touching the desktop app, while keeping the user-visible payoff
(navigating big graphs) in scope via P2. Rejected: component-only (defers the
payoff), workbench-only (no isolated design surface), two separate goals (packet
overhead without benefit at this size).

## 2026-07-14 — scale-target

**Question:** What node scale must the 3D view handle well?

**Answer:** Smooth interaction at **~2,500 visible nodes**.

**Rationale:** Matches the ontology projection's `keyLabelThreshold` (2500) and
fold levels keep real workbench graphs at/under this. Rejected: InfraNodus
parity (~150 — too small to stress the label-overlap problem the user cares
about, and the reference itself only ever displays ~150); 10k+ (forces custom
GPU/worker layout before any visual payoff). Research confirms the InfraNodus
reference is a curated 150-node slice, so 2.5k is deliberately more ambitious
than the reference and is a **P1 benchmark obligation**, not an assumed given.

## 2026-07-14 — rendering-stack (DEFERRED to goal P0)

**Question:** Which rendering stack and engine placement?

**Answer:** DEFERRED to the goal's P0 design gate (run by Fable). Shortlist,
evidence, and consequences are in `research/library-landscape-3d.md` and
`research/integration-constraints.md`; no pick made at exploration stage.

**Rationale:** All candidates (3d-force-graph/react-force-graph-3d, custom
instanced three.js, R3F+drei, reagraph, three-forcegraph) are permissive-licensed
and `three ^0.185.1`-compatible, so the choice turns on control/effort/measured
2.5k performance — and **no candidate ships a 2.5k benchmark**, so the decision
needs a P0/P1 measurement, not a research guess. Placement (drivers vs
ui-system vs hybrid) is a doctrine call with three legal options; deferred to P0
where the design owns the tradeoff.

## 2026-07-14 — re-discipline

**Question:** How deep does the reverse-engineering go, under what license?

**Answer:** Full RE of the **public** `graph.infranodus.com` bundle + live demo,
documented as **prose parameters** ("reference-only"). AGPL Nodus Labs repos are
read-for-understanding only. Implementation is clean-room from the prose spec;
no code copied from the bundle or AGPL sources.

**Rationale:** Styles/techniques are not copyrightable; code is. The bundle is
proprietary → reference-only per `research/SOURCES.md`. This yielded a complete,
citable parameter spec (palette, force config, label-declutter formula, dimming
values, toggle mechanism) without copying code. Rejected: visual-emulation-only
(would miss the actual declutter algorithm); AGPL deep-read as primary source
(heavier clean-room process for little gain — the bundle + live capture
sufficed).

## 2026-07-14 — execution-routing

**Question:** Who runs which work?

**Answer:** Cheap sonnet/haiku agents do all web fetch + claude-in-chrome
browser capture (raw artifacts → packet). Codex gpt-5.6-sol `--effort medium`
background jobs do all deep-read/analysis/report drafting + non-visual
implementation plumbing (worker layout, schemas, bridge atoms) via `--write`.
Fable (main loop) orchestrates, reviews every diff, runs the design gate, and
writes all user-facing frontend/renderer/UX code.

**Rationale:** Preserves the scarce weekly Fable quota for design/review/frontend
where Fable is strongest, per the user's standing routing memory
([[prefer-codex-subagents-for-fable-limits]]). Codex runs on a separate quota;
its sandbox cannot browse, hence the cheap-agent fetch lane. This routing is
carried verbatim into the goal `GOAL.md`.

## 2026-07-14 — 2d-3d-coexistence

**Question:** Does 3D replace the cosmos 2D renderer or sit beside it?

**Answer:** A renderer **toggle** in the workbench; cosmos 2D stays the
**default**. 3D is opt-in per session.

**Rationale:** Keeps the proven cosmos path and its sigma.js non-WebGL2 fallback
intact while 3D matures (3D has no cheap fallback); cheapest rollback. Mirrors
InfraNodus's own 2D/3D toggle. The `ontologyGraphRenderBridgeAtom` is the seam.
Rejected: 3D-default (makes 3D polish a launch blocker), 3D-replaces-2D (loses
the fallback renderer; cosmos also serves the 100k spike).

## 2026-07-14 — research-rigor

**Question:** How rigorous is the research pass?

**Answer:** 6 codex lanes (bundle-static, demo-behavior, label-anti-overlap,
library-landscape, method-corpus, integration-constraints) + 1 codex verify
gate over merged claims.

**Rationale:** Matches the `effect-ontology-harvest` multi-lane + verify-gate
precedent; enough to hand P0 a de-risked, adversarially-checked corpus without
the full 100-agent deep-research workflow (overkill for a styling-centric
question). All lanes completed; two independent browser passes cross-corroborate
the visual parameters.
