# Doc Hub and Spokes

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Two questions asked on 2026-10-28 while reviewing `@beep/md` against `@beep/markdown`
turned into one thesis. First: `@beep/md` should be a notation-free semantic document hub
(renamed `@beep/doc`), with markdown, html, lexical and pandoc as spokes that depend on it,
instead of today's mixed dependency directions and hand-rolled Markdown writer. Second: the
notation codecs that make the hub work (lossless positioned parse, source map, typed losses,
located findings, span repair) are the front end of something larger: a typechecker for
agent work product, where the oracle, not the agent, is the product. Coding agents work
because their domain shipped a compiler; every other knowledge domain has the rulebook but
no oracle. The worked example is patent drafting; the design must not be patent-shaped.

## Next Open Question

None. Graduated into [`goals/oracle-loop-poc`](../../goals/oracle-loop-poc/README.md) and
[`goals/doc-hub-spokes-inversion`](../../goals/doc-hub-spokes-inversion/README.md). The gated
rows in [`MAP.md`](./MAP.md) (`html-spoke-parser`, `doc-core-promotion`,
`rule-dsl-projections`, `process-admissibility-gate`) are the re-entry points; a fired gate
reopens this packet at decompose. The effected-promotion D-02/D-50 amendment is owned by the
inversion goal.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's dump: the hub ruling, the thesis, the tiers,
   the process-ontology correction, the DSL idea, the two-week experiment.
3. [`DECISIONS.md`](./DECISIONS.md) - operator rulings D-01, D-02 and the align log.
4. [`RESEARCH.md`](./RESEARCH.md) - landscape summary, in-repo capability inventory with the
   overlapping goals, and constraints.
5. [`research/REPORT-2026-10-28-prior-art.md`](./research/REPORT-2026-10-28-prior-art.md) -
   the synthesized prior-art report (every claim marked verified, snippet, or memory).
6. [`research/panel/`](./research/panel/) - six independent reviews (GPT-6 Astra, Grok 4.7,
   Muse Wonder 1.0, Claude Opus 5.5, Kimi K3, GLM 5.3) against
   [`PANEL-BRIEF.md`](./research/panel/PANEL-BRIEF.md).
7. [`research/notes/`](./research/notes/) - the six research sweeps the report was built from.
8. [`assets/md-hub-and-spokes-v6.html`](./assets/md-hub-and-spokes-v6.html) - the eight-section
   page that carried the discussion (also published privately as a Claude artifact).
9. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Trail

- 2026-10-28 (decompose, graduate): shape accepted; lab app named `oracle-loop` (D-12);
  MAP.md names two promised-now goals and four gated ones; graduated with
  `bun run beep explore graduate` (plan 6d9f178d), SPECs seeded from the brief, SOURCES carried.
- 2026-10-28 (align round 2, shape): D-08 model-path-first finding address, D-09 separate
  domain graph keyed by path, D-10 spokes prove their own projections, D-11 docx via Pandoc.
  BRIEF.md drafted; shape review open.
- 2026-10-28 (align round 1): D-03 harness loop first, D-04 `@beep/doc`, D-05 parse5 in the
  lab, D-06 profile 2 consumes the antecedent-check findings; D-07 (operator): the POC must
  enforce patent-like rules over a primitive document model including .docx, so findings are
  addressed by model path with spans derived per codec. Round 2 open.
- 2026-10-28 (later): operator rulings D-01 (agent output is the center; domain rules are
  profiles and the panel's pushbacks are seeds for the core) and D-02 (validate by building a
  lab app POC under `apps/labs`, third-party deps allowed). Stage moved to align; round 1 open.
- 2026-10-28: packet opened from a live design session. Capture filed; research pre-seeded
  from the panel (6 models), the deep-research sweep (6 notes) and its report; in-repo
  inventory written, including the overlap with `goals/claim-element-antecedent-check`,
  `goals/pandoc-ast-foundation`, `goals/patent-document-schema` and
  `goals/citation-verified-span-substrate`. Stopped at the start of align; the hub ruling
  has not yet been sent to the effected-promotion session (D-02/D-50 amendment pending).
