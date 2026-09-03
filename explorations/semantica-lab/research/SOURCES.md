# semantica-lab — Sources & Provenance

- **Cluster / origin:** session-driven grounding sweep (2026-08-24) around the Semantica KG
  framework, the beep-effect labs doctrine, and the `@beep/semantica` Notion atlas; plus
  Benjamin's own v3 archive as reasoning prior art.
- **Provenance:** grounding files in this directory (each authored by a GPT-5.6 Sol xhigh agent
  from primary sources); decisions in [`../DECISIONS.md`](../DECISIONS.md).

## 1. Mined source corpus

Mined at symbol granularity by the D5 extraction pipeline: `scratchpad/semantica-ir/` emits a
schema-validated JSONL IR over `semantica/**` (6,105 records, 354 files, SHA-256-stamped; stats
in [`ir-extraction-report.md`](./ir-extraction-report.md)). The IR output itself is gitignored;
the extractor, schema, and report are committed.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| unpdf (npm `unpdf` ^1.8.1, root dep; used by `@beep/doc-text`) https://github.com/unjs/unpdf | MIT (node_modules `unpdf/package.json`) | reuse as dependency | PDF text extraction (`getDocumentProxy`, `extractText`, `extractTextItems`); the first PDF probe (M1) |
| PDF.js (Mozilla) https://github.com/mozilla/pdf.js | Apache-2.0 upstream; **vendored inside `unpdf/dist/pdfjs.mjs` (6.1.200) with no license header, no `pdfjs-dist` package in this repo** — attribution/NOTICE obligation must be verified against upstream, not node_modules | reference via unpdf | text items, `disableNormalization` switch, NFKC behaviour (the breaker retry, M1) |
| `semantica-agi/semantica` (out-of-repo workstation clone under workstation-apps/semantica @ `add1c006`, branch `danklocal`) | MIT (Hawksight AI, verified in `LICENSE`) | port-with-attribution (ideas ported schema-first, not vendored code) | concepts: provenance events, storage capability families, ContextGraph, ontology lifecycle, typed inference explanations, pipeline DAG contract |
| `beep-effect-logos` (out-of-repo workstation clone under projects/beep-effect-logos, archived v3 beep-effect) | Apache-2.0 (verified in its LICENSE on 2026-08-24) | salvage with Apache-2.0 attribution/NOTICE for copied code and tests; re-derived patterns need none. **2026-09-03: the clone is absent from that path (searched `~/YeeBois`, `~/data-home`, `~/.cache/beep` to depth 4); reference-only until relocated — MAP v1.1 makes locating it a P3 entry condition of the reasoning spike** | `rete` SALVAGE (network topology + behavioral test oracle), `rules` PATTERN (operator taxonomy), `logos` PATTERN (rule-AST + validator semantics) — per `grounding-v3-logos.md` §5 |
| `scratchpad/effect-ontology` (in-repo quarantined experiment) | in-repo; upstream was MIT per its ledger | reference + pattern; explicitly non-importable, promotion unauthorized | PORTING_LEDGER per-symbol method as template precedent; Effect v4 ontology idioms |

Benjamin's `danklocal` branch carries 3 unique local fixes not upstream (explorer ontology
registry: URL-keyed entries, persistence across restarts, DELETE of implicit entries) — evidence
for the Findings DB and candidates for the upstream lane (DECISIONS D16).

## 3. External research sources

- Semantica docs: https://docs.getsemantica.ai/ (glossary: https://docs.getsemantica.ai/glossary/)
- Notion atlas page: `@beep/semantica` in the private Todox workspace (identifier withheld;
  find it via Notion search)
- Bake-off candidate URLs: fetch-verified in [`docs-url-census.md`](./docs-url-census.md) and
  in each family sheet's Sources appendix (`bakeoff-*.md`).
- **Upstream tracker sweep (2026-08-24):** the semantica-agi/semantica GitHub tracker as of that
  date (330 issues, 67 open PRs, 328 PRs merged since 2026-06-01; 725 items) pulled with `gh`,
  classified by seven concurrent Grok 4.6 lanes (one JSONL row per item, count-checked against
  the shards), synthesized by one Grok lane into
  [`upstream-tracker-mining.md`](./upstream-tracker-mining.md), verified by a Codex Sol skeptic
  ([`reviews/2026-08-24-tracker-mining-review.md`](./reviews/2026-08-24-tracker-mining-review.md)).
  Committed: the classified inventory [`tracker/inventory.jsonl`](./tracker/inventory.jsonl)
  (number, kind, state, title, url, family, disposition, evidence <= 30 words). Not committed:
  issue/PR bodies and comments (third-party content; quoted at most 12 words per item) — the raw
  dump, lane reports, and the orchestrator live in the out-of-repo mirror under the workstation
  semantica clone (dot-directory tracker-mining). Every cited item is addressable as
  https://github.com/semantica-agi/semantica/issues/N or /pull/N.
- **Benchmarks vocabulary skim (T3, 2026-08-24):** [`benchmarks-vocab.md`](./benchmarks-vocab.md).
  The relocated `semantica-benchmarks` sidecar is **not fetchable** (both URLs named in PR #607 and
  the extraction commit return 404; absent from the semantica-agi org listing) — license
  UNVERIFIED, reference-only, nothing vendored. The lane read the last in-tree snapshot before
  extraction (parent of deletion commit `98cec956fe7e`, 56 files, MIT source tree): a
  pytest-benchmark throughput harness. Metric names borrowed from issue #574 only.
- **S1–S5 primary sources** (each URL fetched and the claim located on the page, 2026-08-24):
  - S1 stop rule — Shape Up ch. 3 "Appetite" https://basecamp.com/shapeup/1.2-chapter-03 ;
    ch. 8 "The circuit breaker" https://basecamp.com/shapeup/2.2-chapter-08 ; ch. 14 "Decide
    When to Stop" https://basecamp.com/shapeup/3.5-chapter-14
  - S2 gold-label separation — Zheng et al. 2023, "Judging LLM-as-a-Judge with MT-Bench and
    Chatbot Arena" (self-enhancement bias) https://arxiv.org/abs/2306.05685 ; Panickssery,
    Bowman, Feng 2024, "LLM Evaluators Recognize and Favor Their Own Generations"
    https://arxiv.org/abs/2404.13076 ; Yang et al. 2023 (rephrased-sample contamination)
    https://arxiv.org/abs/2311.04850
  - S3 embeddings — `Effect-TS/effect` main `.repos/effect/packages/effect/src/unstable/ai/EmbeddingModel.ts`
    and `.repos/effect/packages/ai/openai/src/OpenAiEmbeddingModel.ts` (reference checkout, 02a5146d69);
    OpenAI `POST /embeddings` wire format
    https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml
  - S4 lab shape — Tauri v2 process model https://v2.tauri.app/concept/process-model/ ; sidecar
    https://v2.tauri.app/develop/sidecar/ ; architecture https://v2.tauri.app/concept/architecture/
  - S5/S8 reasoning — RDF 1.1 Semantics §9.2.1 RDFS entailment patterns
    https://www.w3.org/TR/rdf11-mt/#patterns-of-rdfs-entailment-informative ; Muñoz, Pérez,
    Gutierrez 2009, "Simple and Efficient Minimal RDFS" (ρdf; JWS 7(3))
    https://users.dcc.uchile.cl/~cgutierr/papers/jws09.pdf ; SWAP reason vocabulary
    https://www.w3.org/2000/10/swap/reason# ; EYE repo (MIT) https://github.com/eyereasoner/eye
    (`reasoning/socrates/socrates-proof.n3`, `documentation/command_line.md`); eye-js (npm
    `eyereasoner`, MIT) https://github.com/eyereasoner/eye-js ; Doorenbos 1995, CMU-CS-95-113
    http://reports-archive.adm.cs.cmu.edu/anon/1995/CMU-CS-95-113.pdf ; Doyle 1979, "A Truth
    Maintenance System" https://doi.org/10.1016/0004-3702(79)90008-0

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| RDF value models, OWL/PROV vocab, SPARQL | `packages/foundation/capability/semantic-web` (`@beep/semantic-web`) | reuse (bake-off candidate, D7: competes, no bye) |
| Ontology slice (SKOS/SHACL, bounded reasoning, workbench UI) | `packages/ontology/*` | reuse/extend — shared spine per D13 |
| File/document processing | `@beep/file-processing`, `@beep/md`, `@beep/html`, `@beep/tika` (default lane: HTTP localhost:9998 — envelope analysis needed), `@beep/pandoc-ast` | reuse (input-stack bake-off, per-stage) |
| NLP + extraction | `@beep/nlp`, `@beep/nlp-processing`, `@beep/langextract` | reuse (input/extraction sheets) |
| RDF terms & provenance primitives | `@beep/rdf` (term model), `@beep/provenance` (TextAnchor — NOT a PROV-O log) | reuse/extend (shared-schema input, A7) |
| Span owner (M1) | `@beep/provenance` (`SourceTextIdentity`, `SourceTextExtractor`, `TextAnchor`, `VerifiedTextAnchor`, `verifyTextAnchor`, `TextAnchorVerificationReceipt`), `@beep/file-processing` `SourceText` (`ResolvedSourceText`, `SourceTextResolver`), `goals/citation-verified-span-substrate` constraint 4 | compose — `CanonicalText` is not built |
| PDF text extraction (M1) | `@beep/doc-text` (`packages/drivers/doc-text`, unpdf; single normalized string, `empty-text-layer` fail-closed) | reuse as first probe; direct `unpdf` items as retry |
| Witness / ledger precedents (M1) | `@beep/epistemic-domain` `ContradictionCandidate`, `Activity`, `UsageRecord` | pattern for `ConflictWitness` and the `ProvenanceEvent` write model |
| Embedded analytics | `@beep/duckdb` (shipping in practice-kg-mcp) | reuse candidate (storage projections) |
| Embedded Postgres + ORM | `@beep/pglite`, `@beep/postgres` | reuse (storage bake-off; pgvector-on-PGlite convergence) |
| Property graph in-memory | `effect/Graph` (Effect v4) | reuse candidate |
| LLM providers / agent chat | agents slice (`@beep/agents-client` etc.) | already-have (LLM multiplexing auto-parked, D10) |
| Embeddings (S3-rev, one row; M3) | contract `effect/unstable/ai` `EmbeddingModel` (4.0.0-rc.111) + shipped `@effect/ai-openai` `OpenAiEmbeddingModel` (`.model()` when `Dimensions` is needed; `.layer` yields `EmbeddingModel` only; verified in `.repos/effect/packages/ai/openai/src/OpenAiEmbeddingModel.ts`) wrapped by a new `@beep/openai` driver mirroring `@beep/anthropic` — its own goal packet `openai-driver`; lab owns `EmbeddingVector` + `ModelIdentity` | reuse contract + Layer; NET-NEW = thin driver only. Superseded: a hand-written `EmbeddingModel.make` Layer over `@beep/venice-ai` `createEmbedding` (S3, rejected) |
| effect-ontology shapes (`ProviderMetadata`, `toReifiedTriples`, `Timeline`, `QuadDelta`, `ProvenanceUri`) | `scratchpad/effect-ontology` — non-importable | borrow-shape / pattern-only per `effect-ontology-map.md` (S6) |
| Reasoning oracle (test-time) | `apps/labs/semantica/test/helpers/EyeOracleChild.ts` + `scripts/generate-g-entailment.ts` (restricted EYE 11.24.5 via `eyereasoner` 21.1.18, MIT; 64 KiB input / 1 MiB output caps) — shipped by `semantica-canary` C2 | reuse (was NET-NEW wiring; MAP v1.1 extends the generator for `g-entailment-rules/v1`) |
| Local practice-KG precedent (PGlite + DuckDB + read-only MCP) | `apps/practice-kg-mcp` | pattern |
| Tauri shell + Bun sidecar + migrations | `apps/professional-desktop` | pattern only (never imported) |
| Lab scaffold + lifecycle | `bun run beep create-package --lab`, `standards/architecture/15-lab-apps.md` | reuse |
| Retrieval/projection lab (charter counterpart) | `apps/labs/trustgraph-workbench` | boundary per D13 |
| Extraction pipeline IR + Notion sync (D5) | extractor `scratchpad/semantica-ir/{extract.py,ir-schema.json,README.md}` at git history `fd560ca8e5` (#790; deleted by #882); sync method `goals/semantica-canary/history/p5-atlas-sync.md`; tracked-data precedent `research/tracker/inventory.jsonl` | MAP v1.1 split: verdict lane = NET-NEW `atlas-verdicts/v1` + small render/diff script; facts lane = extractor recovered from history, home decided when the 0.6.7+ trigger fires |
| Reasoning substrate (Effect-native, schema-first) | lab bricks from C2: `src/schema/Reasoning.ts` (`RdfsRule`, `StatementPattern`, `ProofDag`, `InferenceEvent`, `GEntailmentExpectation`/`GEntailmentWitness`, `CrashProjectionInput`), `src/layers/ReasonerLive.ts` naive fixpoint | NET-NEW dated spike (A6) entered through MAP v1.1 P1–P4; v3 `rete` SALVAGE (archive currently absent), `rules`/`logos` PATTERN; family verdict `pick-one` (C2) |
| Storage inversion (delete / compaction / desktop storage) | `src/schema/Provenance.ts` (`InvalidatedEventBody`, hash chain `prev` + `makeProvenanceEventId`), `src/layers/LedgerLive.ts` (seven append-only PGlite tables, `dataDir` layout), `src/schema/Projection.ts` `QuadDelta`, `test/helpers/CrashProbeChild.ts`; `@beep/pglite` `makeLayer({ dataDir })`; `@beep/rdf` Prov `invalidatedAtTime`; effect-ontology `ClaimWithRank`/`CurationEvent`/`ConflictTransition` (borrow-shape, `effect-ontology-map.md`) | NET-NEW per MAP v1.1: `Redacted` + `Compacted` event bodies, `CompactedSnapshot`, support-set retraction, size accounting; spike fixture = the C2 ledger regenerated cache-only |

## 5. Cross-links & provenance

- This packet: [`../CAPTURE.md`](../CAPTURE.md), [`../RESEARCH.md`](../RESEARCH.md),
  [`../DECISIONS.md`](../DECISIONS.md), [`./OPPORTUNITIES.md`](./OPPORTUNITIES.md)
- Grounding files: [`grounding-semantica-repo.md`](./grounding-semantica-repo.md),
  [`grounding-beep-labs.md`](./grounding-beep-labs.md),
  [`grounding-notion-semantica.md`](./grounding-notion-semantica.md),
  [`grounding-v3-logos.md`](./grounding-v3-logos.md)
- Graduated goals (2026-08-24, primary consumers of this ledger): [`goals/semantica-canary`](../../../goals/semantica-canary/research/SOURCES.md), [`goals/openai-driver`](../../../goals/openai-driver/research/SOURCES.md) — each carries a goal-side mirror of this ledger and links back here as primary.
- Graduated goals (2026-09-03, MAP v1.1 re-entry): [`goals/semantica-atlas-sync`](../../../goals/semantica-atlas-sync/research/SOURCES.md),
  [`goals/semantica-storage-inversion`](../../../goals/semantica-storage-inversion/research/SOURCES.md),
  [`goals/semantica-reasoning-spike`](../../../goals/semantica-reasoning-spike/research/SOURCES.md)
  — each carries a goal-side mirror of the rows it composes and links back here as primary.
- Sibling doctrine: `goals/lab-apps-lifecycle/` (D13 names `semantica` a first-wave lab source);
  `docs/BEEPGRAPH_ARCHITECTURE.md` (trustgraph direction)
