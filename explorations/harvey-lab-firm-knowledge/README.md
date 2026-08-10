# Harvey LAB Firm-Knowledge Mining

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Harvey + Engram open-sourced a synthetic law firm (Calderwood & Harkness: 266
matters, ~9.3k Office files, ~100M tokens, 250 graded retrieval/reasoning
tasks) inside the MIT-licensed harvey-labs LAB repo. Mine it for patterns beep
can leverage: a graded testbed for the knowledge-engine bet, schema-first
synthetic corpus generation for confidentiality-safe OIP evals, portable eval
methodology, and a legal-DMS task taxonomy.

## Next Open Question

Align Q2 (the wedge question) first: is beep's bet against this corpus
"amortized structural representation" (crowded — Harvey and Engram both claim
it) or "tracked-changes-aware ingest" (unclaimed, 371-task graded testbed,
OIP-load-bearing, gated on U4: does `@beep/pandoc-ast` preserve
`w:ins`/`w:del`)? Full queue: RESEARCH.md §Open Questions (8, from
verify-completeness §5).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

<Dated one-liners, newest first: what each session did and where it stopped.>

- 2026-08-08 (shipping): the packet's two live-defect finds shipped on
  `feat/judge-rubric-lint-and-json-salvage` (beep lint judge-rubric +
  unfenced-JSON salvage; full yeet verify green; PR held for the CI lane
  freeze). Strategy pass landed 4 more reports (harvey-landscape-*,
  beep-kg-profile, beep-kg-direction); verdict synthesized in RESEARCH.md.

- 2026-08-08 (later): mining workflow completed (12 opus-5 agents, ~2.5M
  tokens; 12 reports in research/). Verify pass: 286 fact-checks (251
  confirmed), 20 opportunities → 6 KEEP / 2 KEEP-cond / 10 WEAKEN / 2 KILL;
  completeness critic found the redline-blindness defect (G2) and the
  97%-unmined caveat. RESEARCH.md synthesized; two decisions pre-seeded in
  DECISIONS.md (standing test asset; eval-as-reference-for-roll-our-own).
  Stopped at: ready for align — 8 questions queued.
- 2026-08-08: packet opened from live session; X post scraped into assets/;
  first-pass recon captured; opus-5 mining workflow (map → mine → verify)
  launched over the local clone.
