# Legal & Patent KG Deepening

## Status

Stage: `align`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Extract the gold from a second hand-curated research corpus (~120 papers,
~24 repos, 15 seed URLs) on legal/patent ontologies, knowledge graphs, legal
GraphRAG, and patent LLM tooling — wave 2 of the strand
[`legal-ontology-landscape`](../legal-ontology-landscape/README.md) opened,
building on its graduated findings without re-litigating them.

## Next Open Question

Drive the opened first wedge
[`patent-citation-candor-gate`](../patent-citation-candor-gate/README.md)
through research → align (its two research lanes and align questions are
recorded in that packet). This packet itself waits: the remaining P1 wedges
(`legal-position-relator-runtime` — now also carrying the re-routed
contradiction-semantics cluster, `patent-drafting-episode-ledger`,
FunctionalUnit into `uspto-patent-driver-depth`) queue until the candor wedge
reaches align, per the 2026-08-04 phase-2 grill
([`DECISIONS.md`](./DECISIONS.md)).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`HANDOFF.md`](./HANDOFF.md) - the cold-session runbook: artifact map, constraints, next phase.
3. [`ROUTING-SEED.md`](./ROUTING-SEED.md) / [`routing-seed.json`](./routing-seed.json) - the grounded routing matrix awaiting sign-off.
4. [`DECISIONS.md`](./DECISIONS.md) - the 2026-08-01 campaign-design grill log (8 locked decisions).
5. [`RESEARCH.md`](./RESEARCH.md) - campaign operating plan and capability inventory.
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger (mining complete).
7. [`BRIEF.md`](./BRIEF.md) / [`MAP.md`](./MAP.md) - template placeholders; shaping is gated on sign-off.

## Trail

- 2026-08-01: packet opened from a grill-with-docs interview; corpus at
  `~/YeeBois/research/legal-patent-ontology-knowledge-graph-and-related-research/`
  inventoried into CAPTURE; 8 campaign decisions locked into DECISIONS
  (codex-mines-inside-Workflow engine, papers-full/repos-triaged intake, 4
  sequential deep-research tracks, post-synthesis /adhd, gold-intake artifact
  contracts, seed-PR-then-stop-at-routing-seed staging). Mining not yet
  launched.
- 2026-08-01: completed the 24-repository shallow triage: 9 deep-mine, 11
  reference-only, 4 skip; R16 is the sole wave-1 overlap, and FOPNet-priority
  R22 is reference-only because no license evidence was found.
- 2026-08-01: wave-1 mining complete — 119 distillates (papers P001-P099,
  links L01-L14, repo deep-mines) in `research/mined/`; catalog + inventory
  landed (`research/00-*`). Late corpus additions mined as P100 (FLINT),
  P101 (controlled language), R25 (flint-ontology repo); catalog now 140 rows.
- 2026-08-01: four deep-research track syntheses landed
  (`research/10..13-track-*.md`): tracks 1-3 all 10 claims survived 2-of-3
  adversarial verify; track 4 landed 8/10 with two kills reported in-file.
  `research/14-addendum-new-items.md` routes the unverified late items.
- 2026-08-01: /adhd integration pass (`research/20-adhd-integration.md`):
  5 isolated codex frames × 6 ideas, critic inline, 3 deepened plays.
- 2026-08-01: routing layer landed — `research/nugget-catalog.json` (46
  nuggets), `ROUTING-SEED.md`/`routing-seed.json` (9 grounded clusters, 5
  proposed slugs, 3 grill-gated challenges), `HANDOFF.md`. Campaign stopped
  at the routing seed per DECISIONS staging; awaiting Benjamin's sign-off.
- 2026-08-01: reconciliation grill with Benjamin — matrix SIGNED OFF as
  amended: remo1/remo2/remo3 all resolved without supersession (five new
  DECISIONS entries + a clarifying memory-architecture decision-log entry);
  promotion-gates cluster merged into `patent-drafting-episode-ledger` (4
  proposed slugs); first wedge = `patent-citation-candor-gate`. Stage
  research → align.
- 2026-08-04: phase-2 grill with Benjamin — first wedge OPENED
  (`explorations/patent-citation-candor-gate`, capture stage, decisions
  pre-seeded); contradiction-semantics cluster re-routed compose-don't-widen
  to ride with `legal-position-relator-runtime` (both routing-seed forms
  amended); phase shape sequential. Three new DECISIONS entries.
