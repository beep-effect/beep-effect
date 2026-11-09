# Agent Memory Store — Sources & Provenance

- **Source exploration:** none in this repository. The exploration ran
  machine-locally on 2026-11-06..09 in the operator's agent-memory knowledge
  folder (three deep-research reports, a reconciliation, a pre-registered
  spike plan) and a throwaway `memory-spikes` repository (nine spike
  directories, each with code, fixtures and a `REPORT.md` carrying a
  `VERDICT` line). The scoreboard and the spike plan are imported here with
  machine-local paths replaced by descriptions; the spike code is not imported.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| Validation scoreboard | Day 1 and Day 2 spike verdicts, design v3 | machine-local knowledge folder | [`2026-11-08-validation-scoreboard.md`](./2026-11-08-validation-scoreboard.md) | Evidence for every acceptance bar | Imported; normative for bars |
| Spike plan v2 | Pre-registered pass and kill clauses | machine-local knowledge folder | [`2026-11-07-validation-spike-plan.md`](./2026-11-07-validation-spike-plan.md) | Criteria the verdicts were judged against | Imported; historical |
| Spike reports S1, S2, S5, S7, S9, S10, S14, S14b, S15, S35 | Per-spike `REPORT.md` | machine-local `memory-spikes` repository | not imported | Raw measurements | Summarized in the scoreboard; re-run on request |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `loro-crdt` (npm, 1.17.x) | MIT | Not ported; measured and rejected for agent paths (S14, S15) | Nothing on agent write paths; the measurement only |
| SQLite FTS5, `sqlite-vec` | Public domain / Apache-2.0 | Through the repo driver family | Full-text and optional vector index for projections |
| `bge-reranker-base` (BAAI) | MIT | Optional local model, feature-gated | Cross-encoder stage, off by default in tests |
| `micromark` / `mdast` | MIT | Structure only; raw byte slices stay canonical (S1) | Parse boundaries for the L0 projection |
| SCIP (`scip-typescript`) | Apache-2.0 | Identity of code symbols for code-referencing notes (S35) | Symbol resolution; the span hash marks re-verify |

## 3. External research sources

- "The Price of Meaning: Why Every Semantic Memory System Forgets",
  arXiv:2603.27116. Its ~120-competitor attention cliff was shown by S5 to be
  question truncation at 4096 tokens; the No-Escape Theorem framing in
  `standards/memory-architecture/00-no-escape-theorem.md` still governs.
- PROV-O (W3C) for provenance vocabulary, via the repo's semantic-web kernel.

## 4. In-repo capability references

- `standards/memory-architecture/04-decision-log.md` — the 2026-11-09 entry
  this packet builds; the 2026-04-15 "Semantic Memory = Managed Cache" and
  2026-08-29 "File Memory Is the Memory Layer" entries it refines and keeps.
- `standards/memory-architecture/01-memory-layer-taxonomy.md` — Layer 1
  curation and Layer 2 split text amended with the entry.
- `goals/text-knowledge-stack-rebuild/` — occurrence preimage the store's span
  anchoring converges on; `@beep/text` adopted when it lands.
- `packages/epistemic/*`, `packages/ontology/*` — kernels reused where they
  fit (PROV-O, `ClaimLifecycle` transitions for typed status fields).
- `@beep/repo-cli` — home of the `bun run beep memory` command family.

## 5. Cross-links & provenance

- PR #2996 (merged 2026-11-09 as 1e0b8c107c0): the decision entry and
  taxonomy amendments, grilled with `/grill-with-docs` in six rounds.
- `explorations/agent-memory-tiers-bitemporal-edges/` (graduated): the
  bitemporal framing behind the Layer 2 split of 2026-07-25.
- The spike launcher recipe (headless Opus 5.5 medium lanes with
  pre-registered verdict lines) lives with the spikes repository; re-running a
  spike is a request to the operator, not a packet step.
