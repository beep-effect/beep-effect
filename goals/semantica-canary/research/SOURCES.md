# Semantica Canary: Sources and Provenance

- **Source exploration:**
  [`explorations/semantica-lab`](../../../explorations/semantica-lab/README.md)
- **Primary ledger:**
  [`explorations/semantica-lab/research/SOURCES.md`](../../../explorations/semantica-lab/research/SOURCES.md)
  — this file is the goal-side mirror; when the two disagree, the exploration
  ledger wins and this copy is corrected.
- **Decision authority:**
  [`explorations/semantica-lab/DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md)
- **Contracts in force:**
  [`shared-schema.md`](../../../explorations/semantica-lab/research/shared-schema.md)
  v1.3,
  [`workload-contract.md`](../../../explorations/semantica-lab/research/workload-contract.md)
  v1.3
- **Carry-forward date:** 2026-08-24

The tables below reproduce the exploration's corpus for implementation
convenience. Machine-local paths in the original are rendered here as
out-of-repo locations by name only.

## 1. Mined source corpus

Mined at symbol granularity by the D5 extraction pipeline:
[`scratchpad/semantica-ir`](../../../scratchpad/semantica-ir) emits a
schema-validated JSONL IR over the semantica repository (6,105 records, 354
files, SHA-256-stamped; stats in
[`ir-extraction-report.md`](../../../explorations/semantica-lab/research/ir-extraction-report.md)).
The IR output itself is gitignored; the extractor, schema, and report are
committed. The IR pipeline's SHA-256 discipline is the determinism model for
`EvalReport`s (workload contract §Determinism).

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What the canary takes |
| --- | --- | --- | --- |
| unpdf (npm `unpdf` ^1.8.1, root dep; used by `@beep/doc-text`) https://github.com/unjs/unpdf | MIT (`unpdf/package.json` in `node_modules`) | reuse as dependency | PDF text extraction (`getDocumentProxy`, `extractText`, `extractTextItems`); the first PDF probe is `@beep/doc-text` over it (M1) |
| PDF.js (Mozilla) https://github.com/mozilla/pdf.js | Apache-2.0 upstream; **vendored inside `unpdf/dist/pdfjs.mjs` (6.1.200) with no license header and no `pdfjs-dist` package in this repo** | reference via unpdf | text items, the `disableNormalization` switch, NFKC behaviour (the breaker's single retry, M1) |
| `semantica-agi/semantica` (out-of-repo workstation clone, `danklocal` branch at `add1c006`) | MIT (Hawksight AI, verified in its `LICENSE`) | port-with-attribution (ideas ported schema-first, not vendored code) | concepts: provenance events, storage capability families, ContextGraph, ontology lifecycle, typed inference explanations, pipeline DAG contract |
| `beep-effect-logos` (out-of-repo archived v3 beep-effect) | Apache-2.0 (verified in its LICENSE) | salvage with Apache-2.0 attribution/NOTICE for copied code and tests; re-derived patterns need none | `rete` SALVAGE (network topology + behavioral test oracle) enters at the reasoning spike, not C2; `rules`/`logos` PATTERN — per [`grounding-v3-logos.md`](../../../explorations/semantica-lab/research/grounding-v3-logos.md) §5 |
| [`scratchpad/effect-ontology`](../../../scratchpad/effect-ontology) (in-repo quarantined experiment) | in-repo; upstream was MIT per its ledger | reference + pattern; explicitly non-importable, promotion unauthorized | borrow-shape only: `ProviderMetadata` dimension invariant, `QuadDelta` (C1 rebuild-identity witness), `Timeline`, `ProvenanceUri` — per [`effect-ontology-map.md`](../../../explorations/semantica-lab/research/effect-ontology-map.md) |
| EYE (https://github.com/eyereasoner/eye) and eye-js (npm `eyereasoner`, https://github.com/eyereasoner/eye-js) | MIT | reuse as a test-time dependency once C2 wires it; not yet a dependency | gold conclusions and proofs for `G-entailment/rdfs`; spot-check oracle, never the runtime (G3/G5, S8) |

**pdfjs-vendored-in-unpdf attribution note.** `unpdf` ships PDF.js compiled
into `unpdf/dist/pdfjs.mjs` without a license header, and this repo carries no
`pdfjs-dist` package. PDF.js is Apache-2.0, which carries an attribution/NOTICE
obligation. The obligation must be verified against PDF.js upstream (its
`LICENSE` and any `NOTICE`), not against `node_modules`; the lab's first PDF
probe (`@beep/doc-text`) and the breaker retry (direct `unpdf` text items) both
sit on this dependency, so the note travels with the packet until a NOTICE
decision is recorded.

Benjamin's `danklocal` branch carries three unique local fixes not upstream
(explorer ontology registry: URL-keyed entries, persistence across restarts,
DELETE of implicit entries). They are evidence for the Findings DB and the
held upstream lane (O2); nothing posts without him.

## 3. External research sources

Titles and URLs as they appear in the exploration ledger; nothing added.

- Semantica docs: https://docs.getsemantica.ai/ (glossary:
  https://docs.getsemantica.ai/glossary/)
- Notion atlas page: `@beep/semantica` in the private Todox workspace
  (identifier withheld; find it via Notion search). Atlas writes from this
  packet are final park/drop values only (B1).
- Bake-off candidate URLs: fetch-verified in
  [`docs-url-census.md`](../../../explorations/semantica-lab/research/docs-url-census.md)
  and in each family sheet's Sources appendix (the exploration's
  `bakeoff-*.md` files).
- Upstream tracker sweep (2026-08-24):
  [`upstream-tracker-mining.md`](../../../explorations/semantica-lab/research/upstream-tracker-mining.md),
  verified by
  [`reviews/2026-08-24-tracker-mining-review.md`](../../../explorations/semantica-lab/research/reviews/2026-08-24-tracker-mining-review.md);
  classified inventory
  [`tracker/inventory.jsonl`](../../../explorations/semantica-lab/research/tracker/inventory.jsonl).
  Every cited item is addressable as
  https://github.com/semantica-agi/semantica/issues/N or /pull/N. Standing T2
  rule: never wait on overlapping upstream PRs.
- Benchmarks vocabulary skim (T3):
  [`benchmarks-vocab.md`](../../../explorations/semantica-lab/research/benchmarks-vocab.md).
  The relocated `semantica-benchmarks` sidecar is not fetchable (404); license
  UNVERIFIED, reference-only, nothing vendored. `EvalReport` metric names are
  borrowed from upstream issue #574 only.
- S1-S5 primary sources (each fetched and the claim located on the page,
  2026-08-24):
  - S1 stop rule — Shape Up ch. 3 "Appetite"
    https://basecamp.com/shapeup/1.2-chapter-03 ; ch. 8 "The circuit breaker"
    https://basecamp.com/shapeup/2.2-chapter-08 ; ch. 14 "Decide When to Stop"
    https://basecamp.com/shapeup/3.5-chapter-14
  - S2 gold-label separation — Zheng et al. 2023, "Judging LLM-as-a-Judge with
    MT-Bench and Chatbot Arena" https://arxiv.org/abs/2306.05685 ;
    Panickssery, Bowman, Feng 2024, "LLM Evaluators Recognize and Favor Their
    Own Generations" https://arxiv.org/abs/2404.13076 ; Yang et al. 2023
    https://arxiv.org/abs/2311.04850
  - S3 embeddings — `Effect-TS/effect` main at 02a5146d69 (the Effect
    reference checkout): `EmbeddingModel.ts` under the effect package's
    unstable/ai directory and `OpenAiEmbeddingModel.ts` under the ai/openai
    package; OpenAI `POST /embeddings` wire format
    https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml
  - S4 lab shape — Tauri v2 process model
    https://v2.tauri.app/concept/process-model/ ; sidecar
    https://v2.tauri.app/develop/sidecar/ ; architecture
    https://v2.tauri.app/concept/architecture/
  - S5/S8 reasoning — RDF 1.1 Semantics §9.2.1 RDFS entailment patterns
    https://www.w3.org/TR/rdf11-mt/#patterns-of-rdfs-entailment-informative ;
    Muñoz, Pérez, Gutierrez 2009, "Simple and Efficient Minimal RDFS" (ρdf)
    https://users.dcc.uchile.cl/~cgutierr/papers/jws09.pdf ; SWAP reason
    vocabulary https://www.w3.org/2000/10/swap/reason# ; EYE repo (MIT)
    https://github.com/eyereasoner/eye ; eye-js (npm `eyereasoner`, MIT)
    https://github.com/eyereasoner/eye-js ; Doorenbos 1995, CMU-CS-95-113
    http://reports-archive.adm.cs.cmu.edu/anon/1995/CMU-CS-95-113.pdf ; Doyle
    1979, "A Truth Maintenance System"
    https://doi.org/10.1016/0004-3702(79)90008-0

## 4. In-repo capability references

Bricks the canary composes, with the stage that first touches them.

| Brick | Path | Stage | Mark |
| --- | --- | --- | --- |
| Lab scaffold + lifecycle | `bun run beep create-package` with `--lab`; [`standards/architecture/15-lab-apps.md`](../../../standards/architecture/15-lab-apps.md); [`apps/labs/README.md`](../../../apps/labs/README.md); [`apps/labs/trustgraph-workbench/lab.manifest.json`](../../../apps/labs/trustgraph-workbench/lab.manifest.json) (`lab-manifest/v1` shape) | P1 | reuse |
| Tauri shell + Bun sidecar split | [`apps/professional-desktop/server/main.ts`](../../../apps/professional-desktop/server/main.ts), [`apps/professional-desktop/src/runtime/Layer.ts`](../../../apps/professional-desktop/src/runtime/Layer.ts) | P1 | pattern only; never imported |
| Document source | `@beep/file-processing` ([`packages/foundation/capability/file-processing`](../../../packages/foundation/capability/file-processing)) — `Artifact`, `SourceText`, `PathSafety`, `Service` | C0 | reuse |
| Span owner (M1) | `@beep/provenance` ([`packages/foundation/modeling/provenance`](../../../packages/foundation/modeling/provenance)) — `SourceTextIdentity`, `SourceTextExtractor`, `TextAnchor`, `VerifiedTextAnchor`, `verifyTextAnchor`, `TextAnchorVerificationReceipt`; `@beep/file-processing` `ResolvedSourceText`/`SourceTextResolver`; same law as [`goals/citation-verified-span-substrate`](../../citation-verified-span-substrate/README.md) constraint 4 | C0 | compose — `CanonicalText` is not built |
| PDF text extraction (M1) | `@beep/doc-text` ([`packages/drivers/doc-text`](../../../packages/drivers/doc-text); unpdf; single normalized string; `empty-text-layer` fail-closed) | C0 | reuse as first probe; direct `unpdf` items as the retry |
| Other parsers | `@beep/md` ([`packages/foundation/modeling/md`](../../../packages/foundation/modeling/md)), `@beep/html` ([`packages/foundation/modeling/html`](../../../packages/foundation/modeling/html)), `@beep/tika` ([`packages/drivers/tika`](../../../packages/drivers/tika)) fallback, `@beep/pandoc-ast` ([`packages/foundation/modeling/pandoc-ast`](../../../packages/foundation/modeling/pandoc-ast)) for AST needs | C0 | reuse |
| Chunking | `@beep/nlp` ([`packages/foundation/modeling/nlp`](../../../packages/foundation/modeling/nlp)) `Sentence`/`SentenceIndex`/`Span`; `@beep/nlp-processing` ([`packages/foundation/capability/nlp-processing`](../../../packages/foundation/capability/nlp-processing)) `ChunkBySentences`, `Tokenization` | C0 | reuse; the `Handoff` envelope is never on the span path (M2) |
| Extraction | `@beep/langextract` ([`packages/foundation/capability/langextract`](../../../packages/foundation/capability/langextract)) — `Extraction`, `Handoff`, `Service`, `Target`, `VerifiedSpan`; `@beep/nlp-processing` Wink backend; hosted `LanguageModel` Layers `@beep/anthropic` ([`packages/drivers/anthropic`](../../../packages/drivers/anthropic)), `@beep/xai` ([`packages/drivers/xai`](../../../packages/drivers/xai)), `@beep/openai-compat` ([`packages/drivers/openai-compat`](../../../packages/drivers/openai-compat)), `@beep/venice-ai` ([`packages/drivers/venice-ai`](../../../packages/drivers/venice-ai)) | C0 | reuse; both known defects decoded to degraded states at the boundary |
| Witness / ledger precedents (M1) | `@beep/epistemic-domain` ([`packages/epistemic/domain`](../../../packages/epistemic/domain)) — `ContradictionCandidate`, `Activity`, `UsageRecord`, `Confidence` | C0 | pattern for `ConflictWitness` and the `ProvenanceEvent` write model |
| Ledger (SoR) | `@beep/pglite` ([`packages/drivers/pglite`](../../../packages/drivers/pglite)), `@beep/postgres`; `@beep/rdf` ([`packages/foundation/modeling/rdf`](../../../packages/foundation/modeling/rdf)) Prov `ObjectRef`/`ProvBundle`/`Activity`/`Entity`; `@beep/schema` `UnitInterval` | C0 | reuse; DDL lives in the lab |
| Eval report discipline | `qa-inventory/v1` in [`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts`](../../../packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts) | C0 | pattern for the lab-local `EvalReport`/`EvalRun` |
| Embeddings (S3-rev, M3) | contract `effect/unstable/ai` `EmbeddingModel` (4.0.0-rc.111) + shipped `@effect/ai-openai` `OpenAiEmbeddingModel` (`.model()` when `Dimensions` is needed) wrapped by the sibling `openai-driver` packet; lab owns `EmbeddingVector` + `ModelIdentity` | C1 | reuse contract + Layer; NET-NEW = the thin driver only, in its own packet |
| Embedded analytics | `@beep/duckdb` ([`packages/drivers/duckdb`](../../../packages/drivers/duckdb)) — no vector surface; exact kNN is SQL in the lab | C1 | reuse |
| RDF projection | [`packages/drivers/oxigraph`](../../../packages/drivers/oxigraph) (`Oxigraph.sparql.ts`, `Oxigraph.errors.ts`), `@beep/semantic-web` ([`packages/foundation/capability/semantic-web`](../../../packages/foundation/capability/semantic-web)) | C1 | reuse; every call under an Effect-level timeout |
| Ontology slice (shared spine, D13) | [`packages/ontology`](../../../packages/ontology); SKOS schemes from [`goals/semantic-foundation`](../../semantic-foundation/README.md) | C2 | reuse/extend |
| Reasoning oracle (test-time) | none in `packages/drivers` ([`n3`](../../../packages/drivers/n3), [`oxigraph`](../../../packages/drivers/oxigraph), [`shacl`](../../../packages/drivers/shacl), [`rdf-canonize`](../../../packages/drivers/rdf-canonize) exist; no EYE) | C2 | NET-NEW wiring: EYE WASM decode for gold proofs |
| Runtime reasoner | v3 `rete` audit vocabulary as seed ([`grounding-v3-logos.md`](../../../explorations/semantica-lab/research/grounding-v3-logos.md)) | C2 | NET-NEW (small): ρdf closure as `RdfsRule` values |
| Local practice-KG precedent | [`apps/practice-kg-mcp`](../../../apps/practice-kg-mcp) (PGlite + DuckDB + read-only MCP) | — | pattern |
| Charter counterpart | [`apps/labs/trustgraph-workbench`](../../../apps/labs/trustgraph-workbench) | — | boundary per D13 |
| Lab doctrine precedent | [`goals/lab-apps-lifecycle`](../../lab-apps-lifecycle/README.md) (D13 names `semantica` a first-wave lab source) | — | doctrine |

## 5. Cross-links and provenance

- Primary exploration ledger:
  [`explorations/semantica-lab/research/SOURCES.md`](../../../explorations/semantica-lab/research/SOURCES.md).
- Binding decisions:
  [`explorations/semantica-lab/DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md)
  (Current law table; M1-M6).
- Exploration packet files:
  [`CAPTURE.md`](../../../explorations/semantica-lab/CAPTURE.md),
  [`RESEARCH.md`](../../../explorations/semantica-lab/RESEARCH.md),
  [`OPPORTUNITIES.md`](../../../explorations/semantica-lab/research/OPPORTUNITIES.md)
  (friction ledger; record at the moment it happens).
- Grounding files:
  [`grounding-semantica-repo.md`](../../../explorations/semantica-lab/research/grounding-semantica-repo.md),
  [`grounding-beep-labs.md`](../../../explorations/semantica-lab/research/grounding-beep-labs.md),
  [`grounding-notion-semantica.md`](../../../explorations/semantica-lab/research/grounding-notion-semantica.md),
  [`grounding-v3-logos.md`](../../../explorations/semantica-lab/research/grounding-v3-logos.md).
- Sibling packet: the `openai-driver` goal (C1 embeddings Layer; graduated in
  the same ceremony, M5).
- This packet's decision log: [`SPEC.md`](../SPEC.md#decision-log).
- The Notion atlas remains a facts mirror; repository packets are the
  normative execution contracts (D2, A9).
