# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-10

Origin: Notion `Development Todo's` parking-lot page "Add more strict planning
& design requirements in goal packets & general exploration / goal packet
improvements" (Benjamin), plus a Codex deep-research revision of that page.
Both copied verbatim into this packet:

- [`research/2026-08-10-notion-strict-planning-three-pass.md`](./research/2026-08-10-notion-strict-planning-three-pass.md)
  — the original requirements plus three research/review passes done on the
  Notion page itself (2026-08-10): first-pass architecture proposal,
  second-pass adversarial review (derive-don't-store, unforgeable approvals,
  ratchet adoption), third-pass repo-grounded review (stage/ownership
  contradictions, gate memoization via the docgen proof-manifest pattern,
  in-toto/Sigstore, property-tested transition tables, design gate before the
  lane slot).
- [`research/2026-08-10-codex-deep-research-redesign.md`](./research/2026-08-10-codex-deep-research-redesign.md)
  — Codex deep-research pass over the same page, done without repo access:
  tiered planning (Light/Standard/Full), exact files but only significant
  symbols, four amendment classes, hybrid control-event chain (per-event files
  with parent digests, not whole-packet event sourcing), externally verifiable
  approvals (`gitsign verify` correction), derived readiness with `blockedBy`
  explanations, subject-bound evidence receipts compatible with in-toto.
  This document is the primary artifact of a larger Codex bundle (diagrams,
  schemas, HTML dashboard prototype); the bundle's other files were not
  retrieved — the markdown carries the decisions.

The original raw requirements from the page, preserved:

- Before any code in a goal implementation phase: exact file tree (incl.
  tests) predetermined; amendments logged with reasons in a canonical packet
  file.
- Every module symbol predetermined before written; unplanned symbols require
  a reuse search, an amendment with reason, and an OPPORTUNITIES.md item.
- Use HTML artifacts more.

## 2026-08-10 (later) — internal `packets` app idea (operator, verbatim intent)

Research the best way to create an internal `packets` app: a simple, likely
React web UI to see goal & exploration packets and their status (imagining
kanban), a roadmap, execution order, goals & their prerequisites /
dependencies, which goals can run in parallel. React UI reflecting goal
packets in realtime, maybe HMR. Click into goals with different tabs
displaying the different canonical goal packet files; markdown renderer.

Operator clarification (same day): the dashboard is READ-ONLY — a reflection
of the packets' states. No write path.

Operator reasoning (same day, verbatim intent): "I'm always struggling with
what to do next. What is active & what the priority / roadmap should be.
Having to click through the numerous goals, open the READMEs to get a pulse
has been a bottleneck." — The job-to-be-done is the operator's
next-action/pulse question, not packet browsing; kanban/DAG/tabs are means.

Operator note: knowledge-surface-automation may have captured some of these
ideas already. (Confirmed on ground: KSA ratified decision D (2026-07-31,
do-not-reopen) sequences a generated Mermaid block in `goals/INDEX.md` first,
then a single self-contained HTML dashboard — kanban + DAG, no server, no
React build; its bun:sqlite projection engine computes frontier / blockers /
cycles / shortest-unlock-path, with one deterministic projection feeding
JSON, Mermaid, and the dashboard "so renderers cannot invent divergent
semantics".)
