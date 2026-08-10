# Harvey LAB Firm-Knowledge Mining — Sources & Provenance

- **Cluster / origin:** X post by @ItsJulioPereyra (Harvey) announcing the LAB
  firm-knowledge expansion, 2026-08-07; local clone of the harvey-labs repo at
  `~/YeeBois/research/harvey-labs` mined by an opus-5 workflow (map → mine →
  verify), reports under `research/`.
- **Provenance:** scraped post at
  [`../assets/x-post-itsjuliopereyra-2085772997944803682.md`](../assets/x-post-itsjuliopereyra-2085772997944803682.md);
  workflow map/mine/verify reports land in this directory.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `fk-tasks` | 250 firm-knowledge task.json rubrics | harveyai/harvey-labs | `tasks/firm-knowledge/tasks/*/task.json` | task taxonomy, rubric authoring | port-with-attribution |
| `fk-dms` | C&H synthetic corpus (9,288 Office files) | harveyai/harvey-labs | `tasks/firm-knowledge/dms/matters/` | STANDING TEST ASSET — ingestion/retrieval/indexing/KG evals (DECISIONS 2026-08-08) | reference (sample-only in research; 100M tokens) |
| `lab-harness` | agent loop + sandboxed tools + format skills | harveyai/harvey-labs | `harness/` | harness patterns | port-with-attribution |
| `lab-eval` | rubric judge, all-pass scoring, dual-judge | harveyai/harvey-labs | `evaluation/` | eval methodology | reference → roll-our-own Effect-native eval (DECISIONS 2026-08-08) |
| `lab-docs` | architecture / eval-strategies / tutorial | harveyai/harvey-labs | `docs/` | methodology prose | reference |

**How these inform this packet:** the task.jsons are the high-density layer
(taxonomy + rubric discipline); the harness/eval code carries portable
mechanics (criterion-scoped judging, all-pass scoring); the dms corpus is
sampled only for anatomy — the spec→feature→render generation pipeline is NOT
in the repo, so that pattern is reconstructed from docs + rendered output.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [harveyai/harvey-labs](https://github.com/harveyai/harvey-labs) | MIT | port-with-attribution | eval/rubric mechanics, harness patterns, task taxonomy; corpus used as test data |

## 3. External research sources

- Julio Pereyra, "We are open-sourcing our next LAB expansion…" X post,
  2026-08-07 — https://x.com/ItsJulioPereyra/status/2085772997944803682
  (scraped copy:
  [`../assets/x-post-itsjuliopereyra-2085772997944803682.md`](../assets/x-post-itsjuliopereyra-2085772997944803682.md))
- Harvey, "Introducing Harvey's Legal Agent Benchmark" —
  https://www.harvey.ai/blog/introducing-harveys-legal-agent-benchmark
  (linked from repo README; not yet scraped)
- harvey-labs dataset tree —
  https://github.com/harveyai/harvey-labs/tree/main/tasks/firm-knowledge

## 4. In-repo capability references

Verified by the mining lenses (full cites in `mine-*.md`; every path re-checked
with rg/ls at mining time):

| Brick | Path | Disposition |
|-------|------|-------------|
| corpus ingest commands (`catalog\|extract\|organize`) | `packages/repo-cli` `commands/Corpus/Corpus.command.ts:142-334` | reuse |
| PracticeKg projections + BM25 FTS | `PracticeKg.projections.ts`, `PracticeKg.fts.ts:142-170` | reuse (BM25 SQL NOT portable verbatim to stdlib sqlite3 — refuted) |
| patent-prosecution domain schemas (OfficeAction, Rejection, Claim, PriorArtReference, IdsSubmissionFact, PatentAsset, Matter+`fixtureKey`) | `packages/law-practice/domain/src/entities/` | reuse |
| qa judge machinery (JudgePack/Ingest/Check, `qa-inventory/v1`) | `Qa/Inventory.schemas.ts`, `JudgeCheck.ts` | extend (per-criterion scoping, all-pass split, closure criterion, neutral band) |
| per-criterion scoped judge call shape | `docgen quality-worker-eval` (`QualityWorkerEval.ts:607`) | reuse as pattern |
| Pandoc AST mapping/codec (no binary driver) | `Pandoc.mapping.ts:1271`, `Pandoc.codec.ts:1595` | extend — docx render lane owned by `explorations/docx-roundtrip-interop` (`pandoc-driver-sidecar`) |
| pptx/eml in `FileFormatFamily` | `file-processing/src/Strategy/index.ts:99-133` | NET-NEW (gap: 660/9,288 C&H files unroutable) |
| adverse-party + matter lifecycle modeling | `law-practice` (zero rg hits) | NET-NEW |
| tracked-changes (`w:ins`/`w:del`) awareness | anywhere (zero rg hits) | NET-NEW — gates the redline wedge (U4) |

## 5. Cross-links & provenance

- This packet: [`../RESEARCH.md`](../RESEARCH.md) (synthesis),
  [`../CAPTURE.md`](../CAPTURE.md) (raw recon),
  [`../DECISIONS.md`](../DECISIONS.md) (standing-test-asset;
  eval-as-reference).
- Mining-run reports (2026-08-08, 12 opus-5 agents): maps `map-harness.md`,
  `map-evaluation.md`, `map-task-census.md`, `map-corpus.md`,
  `map-pipeline-docs.md`; lenses `mine-benchmark-integration.md`,
  `mine-synthetic-corpus.md`, `mine-eval-methodology.md`,
  `mine-dms-taxonomy.md`; verification `verify-facts.md` (286 checks),
  `verify-refutations.md` (20 verdicts), `verify-completeness.md` (gaps +
  align questions). Quote numbers only as corrected by `verify-facts.md` §G.
- Strategy-comparison reports (2026-08-08, second pass):
  `beep-kg-direction.md` (intended architecture from explorations/goals/docs —
  authority-vs-projection doctrine, ten bets profiled, honest trajectory
  risks), `harvey-landscape-architecture.md` (Harvey public sources),
  `harvey-landscape-engram.md` (Engram prior art), `beep-kg-profile.md`
  (shipped capability).
- Sibling explorations: `legal-patent-kg-deepening` (KG strand),
  `agent-memory-tiers-bitemporal-edges` (Engram-adjacent memory prior art),
  `academia-corpus-mining` (corpus-mining pattern), `docx-roundtrip-interop` +
  `deterministic-doc-structure-extraction` (Office-format handling),
  `citation-grounding-hallucination-guard` (grounding).
