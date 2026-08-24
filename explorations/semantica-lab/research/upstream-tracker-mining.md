# Upstream tracker mining — semantica-agi/semantica (2026-08-24)

Status line: research-stage artifact produced at decompose (stage loop); consumer = MAP.md; it amends nothing in BRIEF v1.0. Skeptic verdict **RATIFY-WITH-EDITS** ([review](./reviews/2026-08-24-tracker-mining-review.md), Codex Sol, 188 cited numbers all verified against the raw dump); the four corrections and three missed items are applied below and marked *(review)*.

## Method and coverage

Seven-lane sweep of the semantica-agi/semantica GitHub tracker as of 2026-08-24. Prompt census: 330 issues, 67 open PRs, 328 PRs merged since 2026-06-01. Inventory total: **725 rows**, 0 unparsable.

| Shard | Kind | Classified | Disposition mix (lane report) |
| --- | --- | ---: | --- |
| closed-issues-a | closed issues (#124–#549 band) | 141 / 141 | material bodies pulled for ~40 items; rest classified from condensed view |
| closed-issues-b | closed issues (through #1191) | 142 / 142 | 141 CLOSED/COMPLETED; **#771 CLOSED/NOT_PLANNED** |
| merged-prs-a | merged PRs | 158 / 158 | 115 ignore, 35 map-evidence, 4 port-hazard, 2 corroborates-finding, 2 gate-signal, 0 dedupes-our-draft |
| merged-prs-b | merged PRs | 54 / 54 | 28 ignore, 20 map-evidence, 6 port-hazard, 0 corroborates/gate/dedupe |
| merged-prs-c | merged PRs | 116 / 116 | RDF/SHACL campaign, SPARQL reasoner, embeddings fallback, MCP dual surface, storage matrix, ER/merge, pipeline |
| open-issues | open issues | 47 / 47 | 2 recorded OPEN/REOPENED in source (#765, #300); JSONL `state` is OPEN |
| open-prs | open PRs | 67 / 67 | 21 map-evidence, 19 ignore, 15 port-hazard, 6 gate-signal, 6 corroborates-finding |

Inventory kind × state: 328 `pr/MERGED`, 67 `pr/OPEN`, 282 `issue/CLOSED/COMPLETED`, 47 `issue/OPEN`, 1 `issue/CLOSED/NOT_PLANNED`. Shard sizes sum to 725.

**How lanes classified.** Exactly one family and one disposition per item. Families: `storage-ledger`, `embeddings`, `input-parse`, `chunking-spans`, `extraction`, `entity-resolution-conflicts`, `provenance`, `reasoning`, `ontology-shacl`, `pipeline`, `evals`, plus `mcp-integrations`, `explorer-ui`, `infra-deps`, `other`. Dispositions: `corroborates-finding` (matches a D6 in-source finding), `map-evidence`, `gate-signal` (queued OSS gates `reasoning-package` or `evals-harness`), `dedupes-our-draft`, `port-hazard` (a shared-schema law would make the bug unrepresentable), `ignore` (Dependabot, CI, cosmetic, or outside charter: Explorer UI, agent-frameworks, deploy). Dedupe of the six held drafts was a separate per-lane section; the inventory contains **1** `dedupes-our-draft` row after the review reclassification (#518, in `closed-issues-a`).

**Where the artifacts live.**

- Inventory (725 JSONL rows, jq-able, committed): `explorations/semantica-lab/research/tracker/inventory.jsonl`
- Held drafts being deduped (committed): `explorations/semantica-lab/research/drafts/upstream-contributions.md`
- Not committed (upstream issue/PR text is third-party content; the packet keeps only the classified inventory): the seven lane reports, the per-shard condensed views and JSONL, and the raw `gh` dump live in the session scratchpad and are mirrored out-of-repo under the workstation semantica clone in a dot-directory named tracker-mining. Regenerate with the orchestrator script in the same mirror.

**Known limits.**

- Lanes classified from condensed titles/bodies; full JSONL was pulled only for items the lane judged material. Dispositions are lane judgments, not maintainer labels.
- Closed issues marked COMPLETED can still describe a hole at filing (#228 evals empty; #570 suite “shifted to new repo”).
- `chunking-spans` is thin (5 rows). Simulated HermiT/Pellet consistency checks produced **zero** title hits.
- Explorer UI / agent-framework / Dependabot volume is real and mostly `ignore`; it must not set lab shape.
- Open PRs overlap and are not collapsing quickly; this snapshot can race later merges.
- This artifact feeds MAP.md. It does not amend BRIEF v1.0, shared-schema v1.2, or the Current law table.

## Numbers

Family × disposition from `explorations/semantica-lab/research/tracker/inventory.jsonl`:

| Family | corroborates-finding | gate-signal | map-evidence | port-hazard | ignore | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| storage-ledger | 0 | 0 | 33 | 10 | 2 | 45 |
| embeddings | 2 | 0 | 26 | 11 | 2 | 41 |
| input-parse | 0 | 0 | 32 | 4 | 16 | 52 |
| chunking-spans | 0 | 0 | 5 | 0 | 0 | 5 |
| extraction | 0 | 0 | 30 | 5 | 4 | 39 |
| entity-resolution-conflicts | 0 | 0 | 25 | 4 | 2 | 31 |
| provenance | 0 | 0 | 38 | 16 | 2 | 56 |
| reasoning | 3 | 13 | 5 | 1 | 0 | 22 |
| ontology-shacl | 1 | 4 | 33 | 18 | 1 | 57 |
| pipeline | 0 | 0 | 10 | 2 | 3 | 15 |
| evals | 2 | 13 | 4 | 1 | 2 | 22 |
| mcp-integrations | 4 | 0 | 5 | 2 | 16 | 27 |
| explorer-ui | 1 | 0 | 0 | 0 | 79 (+1 dedupes-our-draft: #518, reclassified after review) | 81 |
| infra-deps | 0 | 0 | 0 | 1 | 103 | 104 |
| other | 0 | 0 | 29 | 13 | 86 | 128 |
| **total** | **13** | **30** | **275** | **88** | **318** (+1 dedupes-our-draft) | **725** |

**Reading.** 318/725 rows are ignore (Dependabot/`infra-deps` 103, Explorer UI 79, `other` 86): the tracker’s merge volume is not the kernel. The kernel that should hit MAP is the 275 map-evidence + 88 port-hazard + 30 gate-signal + 13 corroborates-finding rows. `reasoning` and `evals` are the only families whose majority signal is a queued OSS gate (13 gate-signal each). `ontology-shacl` (18) and `provenance` (16) are the densest port-hazard families; `embeddings` is next (11) and carries both D6 corroborations for the random/hash fallback. `chunking-spans` is almost absent as a tracker conversation — span fidelity is enforced by our C0 tripwire, not by their issue traffic. Every `reasoning` row was treated as material (0 ignore). `mcp-integrations` rows (#870, #1134, #967, #1151) establish two MCP surfaces with documented behavioral drift; the exact 12-vs-17 tool split is our source-derived D6 count, not a tracker finding.

## What a MAP author must see

Per family: the material tracker items, then one MAP implication. URLs are `https://github.com/semantica-agi/semantica/{issues|pull}/N`.

### storage-ledger

- #838 https://github.com/semantica-agi/semantica/pull/838 — embedded Oxigraph TripletStore (memory or `path`), named graphs, SPARQL four forms, literal datatype/lang preserved; closest cousin to the C1 Oxigraph rebuild slate.
- #918 https://github.com/semantica-agi/semantica/pull/918 — v0.6.5 bundles that Oxigraph store with PROV-O completeness.
- #970 https://github.com/semantica-agi/semantica/pull/970 — open: `OxigraphStore` ignores `storage_path` and skips flush; looks persistent, is in-memory.
- #757 https://github.com/semantica-agi/semantica/pull/757 — remote Jena `add_triplets` used a read-only SPARQLStore, swallowed TypeError, returned `success=True/added=0`.
- #448 https://github.com/semantica-agi/semantica/issues/448 — BulkLoader serializes every object as a URI; literals 400 the store.
- #1173 https://github.com/semantica-agi/semantica/pull/1173 — open: Neo4j persist creates nodes, zero edges (string app ids vs `id(n)`), still reports success.
- #899 https://github.com/semantica-agi/semantica/pull/899 — ships `docs/storage-backends.md` RDF/LPG matrix (Oxigraph vs BYO); page is not added to `docs.json`.
- #1019 https://github.com/semantica-agi/semantica/issues/1019 — open: no shared store-backend contract; five backends have zero tests.

MAP implication: keep the law’s PGlite-ledger SoR + Oxigraph rebuild-from-ledger; treat persistence-lies (#970, #757, #1173) as the anti-pattern the C1 rebuild-identity probe exists to catch, and do not port the RDF/LPG adapter zoo (#749, #899).

### embeddings

- #994 https://github.com/semantica-agi/semantica/issues/994 — `embed generate` falls back after model-load failure, still exits 0, writes corrupt non-Parquet; same class as the D6 random-vector success-shaped fallback.
- #1006 https://github.com/semantica-agi/semantica/pull/1006 — open: doctor was green while `TextEmbedder` silently degrades to hash fallback.
- #433 https://github.com/semantica-agi/semantica/issues/433 — FAISS path with `dimension=768` silently drops memories when the extra is missing.
- #726 https://github.com/semantica-agi/semantica/pull/726 — optional sqlite-vec `vec0` local-disk backend (also requested as #240).
- #835 https://github.com/semantica-agi/semantica/pull/835 — `store_vectors` silently dropped `metadata` for `add_vectors`-only backends; FAISS retrieval returned empty content/`{}`.
- #1139 https://github.com/semantica-agi/semantica/issues/1139 — open: document-path `store()` never fills wrapper dicts; `save()` succeeds with `vectors: {}`.
- #1029 https://github.com/semantica-agi/semantica/issues/1029 — open: size-derived vector ids reissue after delete and overwrite live vectors.
- #853 https://github.com/semantica-agi/semantica/pull/853 — canonical `search_vectors` row `{id, score, metadata, vector}` is still an untyped dict; missing vector is `None`.

MAP implication: C1’s `EmbeddingModel` + `ModelIdentity` + dimension-keyed DuckDB exact kNN + `DegradedEmbedding` is the schema answer to a cluster that still ships hash/random fallbacks, hardwired 768, and untyped search rows; sqlite-vec (#726) is a cousin, not a Layer.

### input-parse

- #1020 https://github.com/semantica-agi/semantica/issues/1020 — open: scanned PDFs complete with empty `full_text` and no warning (twin PR #1021).
- #1021 https://github.com/semantica-agi/semantica/pull/1021 — open: same empty-`full_text` + status `"completed"`; failure only shows up as zero entities later.
- #124 https://github.com/semantica-agi/semantica/issues/124 — optional Docling backend for tables/structure (charter parks OCR; this is table/structure, not a C0 winner).
- #1014 https://github.com/semantica-agi/semantica/issues/1014 — ExcelParser raises NameError on every instantiation (missing progress-tracker import).
- #705 https://github.com/semantica-agi/semantica/pull/705 — Arrow/Feather ingestor; ingest surface keeps growing.
- #1156 https://github.com/semantica-agi/semantica/pull/1156 — open: JSON-LD named `@graph` dropped by `rdflib.Graph.parse`; ontology load returns success with `class_count: 0`.

MAP implication: C0 Parser must fail closed on empty `CanonicalText` (#1020/#1021); ingest-surface expansion (#705, #748) is outside appetite (no URL ingest before an SSRF policy; no OCR/DOCX).

### chunking-spans

- #864 https://github.com/semantica-agi/semantica/issues/864 — 9 of 11 public chunker classes had zero behavior tests; span preservation is unproven.
- #904 https://github.com/semantica-agi/semantica/pull/904 — merged coverage for those untested chunker classes.
- #998 https://github.com/semantica-agi/semantica/issues/998 — repeated spaCy model loading on split/chunk paths (fixed by #1042).
- #1042 https://github.com/semantica-agi/semantica/pull/1042 — caches spaCy in chunkers; performance, not span ownership.
- #1068 https://github.com/semantica-agi/semantica/pull/1068 — open: mutable default arguments on split helpers.

MAP implication: tracker traffic does not name `CanonicalText` as the span owner; C0’s “every span slices back to its text” is the tripwire their chunker suite still does not provide.

### extraction

- #149 https://github.com/semantica-agi/semantica/issues/149 — extractors return empty lists on missing keys/connectivity (success-shaped failure).
- #400 https://github.com/semantica-agi/semantica/issues/400 — extraction discards temporal signals with no loss declaration.
- #941 https://github.com/semantica-agi/semantica/pull/941 — GraphBuilder raw-text defaults to local ML/pattern; relation extraction off unless requested.
- #1074 https://github.com/semantica-agi/semantica/pull/1074 — open: cache aliases let `start_char`/`confidence` in-place rewrites poison later hits.
- #186 https://github.com/semantica-agi/semantica/issues/186 — sequential chunk loop, no cache, no I/O parallelization (same sequential class as D6 pipeline).
- #168 https://github.com/semantica-agi/semantica/issues/168 — provider-native structured outputs verified against a canonical schema.
- #1213 https://github.com/semantica-agi/semantica/pull/1213 — open: relation extraction silently dropped generation kwargs (`max_tokens`, `seed`).
- #581 https://github.com/semantica-agi/semantica/pull/581 — CLI still called `SemanticAnalyzer.extract` after the API vanished.

MAP implication: C0 hybrid + pattern under one gold probe with non-zero G-relation (S7) is the counter to silent relation-off defaults (#941), empty-success extractors (#149), and in-place span mutation (#1074).

### entity-resolution-conflicts

- #1137 https://github.com/semantica-agi/semantica/issues/1137 — `merge_entities=True` (quickstart default) collapses Person Alice and Organization Acme.
- #1149 https://github.com/semantica-agi/semantica/pull/1149 — Dedup merged a Person and an Organization with no type penalty.
- #1031 https://github.com/semantica-agi/semantica/issues/1031 — `strategy=exact` still fuzzy-merges; id-less non-duplicates are dropped.
- #1026 https://github.com/semantica-agi/semantica/pull/1026 — same: `strategy="exact"` still ran fuzzy duplicate detection.
- #1207 https://github.com/semantica-agi/semantica/issues/1207 — open: voting/credibility hash conflict values; dict/list values crash (twin PR #1208).
- #208 https://github.com/semantica-agi/semantica/issues/208 — GraphBuilder silently drops all valid external relationships; 0 rels, no warning.
- #700 https://github.com/semantica-agi/semantica/pull/700 — `merge_duplicates()` / `merge_entity_group()` persist a winner (not `ConflictResolved`).
- #701 https://github.com/semantica-agi/semantica/pull/701 — `detect_entity_conflicts` persists resolved values in place, not as `ConflictWitness`.

MAP implication: `ConflictWitness` (claims stay separate nodes) is the schema law their merge-winner APIs still violate; C0 must not fold Alice/Acme and must not treat 0 relations as a score.

### provenance

- #827 https://github.com/semantica-agi/semantica/pull/827 — PROV-O closeout: `invalidate()` tombstones, hash-chain `verify_chain()`, typed Agent/Activity, `previous_version_id` vs `derived_from_id`.
- #802 https://github.com/semantica-agi/semantica/pull/802 — every call site minted its own `ProvenanceManager()` → InMemoryStorage; the SQLite audit log was empty at process end.
- #825 https://github.com/semantica-agi/semantica/issues/825 — maintainer-filed: `clear()` hard-deletes rows; high-stakes bar is tombstone Invalidation.
- #820 https://github.com/semantica-agi/semantica/pull/820 — storage failures returned a fully-populated `ProvenanceEntry` with no log (twin issue #783).
- #743 https://github.com/semantica-agi/semantica/pull/743 — re-track overwrote explicit `parent_entity_id`/`derived_from` in place with an auto history link.
- #1165 https://github.com/semantica-agi/semantica/pull/1165 — RDF serializers dropped source/page/extractor/reviewer metadata; JSON-LD kept it.
- #246 https://github.com/semantica-agi/semantica/issues/246 — claim lineage to DOI + page + quote, PROV-O (span-bearing evidence).
- #946 https://github.com/semantica-agi/semantica/issues/946 — open: provenance tests `return` strings instead of asserting (vacuous green on the SoR family).

MAP implication: PGlite append-only `ProvenanceEvent` as SoR is the inversion of InMemory-default + in-place overwrite; C2 `Invalidated` tombstones match #827, not #825’s `clear()`, and C0 must not inherit vacuous provenance tests (#946).

### reasoning

- #1083 https://github.com/semantica-agi/semantica/issues/1083 — `SPARQLReasoner.execute_query` stub, always empty bindings; twin merged PR #1087 now raises `NotImplementedError` instead of implementing proofs.
- #368 https://github.com/semantica-agi/semantica/issues/368 — maintainers admit SPARQLReasoner and peers “none handle recursive rules”; Datalog fixpoint requested.
- #354 https://github.com/semantica-agi/semantica/issues/354 — `infer_facts()` returns `[]` on `founded_by` even with a matching IF/THEN rule.
- #733 https://github.com/semantica-agi/semantica/issues/733 — forward-chain explanations always have empty premises (“Given the premises: , we conclude”); patched in #739 by plumbing `_match_rule` facts.
- #300 https://github.com/semantica-agi/semantica/issues/300 — open/reopened: RETE `_matches`/`_can_join` always `True`; twin PR #1077 fills unification.
- #1095 https://github.com/semantica-agi/semantica/issues/1095 — open: `Rule.handler` never invoked; users want provenanced Assert/Retract/Emit (PR #1096).
- #1033 https://github.com/semantica-agi/semantica/pull/1033 — official docs: explainability is system-level, not foundation-model CoT (README twin #1034).
- #398 https://github.com/semantica-agi/semantica/issues/398 — deterministic LLM-free interval algebra because “LLMs hallucinate dates”.

MAP implication: C2 runtime stays ρdf closure + EYE oracle (S5/S8); do not wait on open RETE/action PRs, and do not treat SPARQLReasoner/Rete/Datalog as a verified engine zoo (#687, #578).

### ontology-shacl

- #1124 https://github.com/semantica-agi/semantica/pull/1124 — SHACL shapes targeted the shapes namespace, matched nothing, still `conforms: True` (issue #1104).
- #1182 https://github.com/semantica-agi/semantica/pull/1182 — RDFS entailment plus `rdfs:range` makes `sh:class` unfalsifiable; open doc twins #1158/#1150; issue #1130.
- #1082 https://github.com/semantica-agi/semantica/issues/1082 — open: hash-namespace `base_uri` becomes `#/`; SHACL targets nothing and validation silently passes (PR #1084).
- #446 https://github.com/semantica-agi/semantica/issues/446 — OWLGenerator silently skips datatype properties and subclassOf via dict-key mismatches (exporter twin #478; OWL round-trip PR #1123).
- #1109 https://github.com/semantica-agi/semantica/pull/1109 — declares a 14-term vocabulary and stops minting unresolvable fallback IRIs; JSON-LD still interpolated entity text in #1120.
- #318 https://github.com/semantica-agi/semantica/issues/318 — SHACL-from-OWL: ontologies as executable data contracts.
- #774 https://github.com/semantica-agi/semantica/issues/774 — SKOS broader/narrower had no write-time cycle detection; C2 SKOS transitivity needs acyclic premises (write-time reject in #819).
- #1186 https://github.com/semantica-agi/semantica/issues/1186 — documented SHACL path is private `_run_pyshacl`; `OntologyValidator` is structure-only.

MAP implication: C2 must split `G-entailment/rdfs` from constraint checking (S8 already does); vacuous `conforms: True` (#1124, #1082, #1182) is the anti-pattern the EYE/ρdf gate exists to make unrepresentable.

### pipeline

- #683 https://github.com/semantica-agi/semantica/pull/683 — pipeline guide documents `set_parallelism()` / `ExecutionEngine(max_workers=...)` and an “excessive parallelism” pitfall (D6 sequential engine advertised as parallel).
- #578 https://github.com/semantica-agi/semantica/pull/578 — full CLI: `run --parallel`, `reason --engine sparql`, 12 parsers; **no eval command**.
- #862 https://github.com/semantica-agi/semantica/pull/862 — Pipeline is a dataclass; execution lives on ExecutionEngine; provenance wrapper could not import or `run()` (issue #858).
- #1127 https://github.com/semantica-agi/semantica/pull/1127 — registered custom methods could not refuse: exceptions swallowed, default ran.
- #186 https://github.com/semantica-agi/semantica/issues/186 — sequential chunk loop in extraction; same “parallel in name” class.

MAP implication: `PipelineStep` is serializable algebra interpreted by services; never port `set_parallelism` / `run --parallel` as a parallelism claim, and a refused custom method must be typed degradation not a silent default (#1127).

### evals

- #228 https://github.com/semantica-agi/semantica/issues/228 — `semantica.evals` empty/“Coming Soon”; also asks HermiT/Pellet reasoning validation (D6 stub + simulated-reasoner wishlist).
- #570 https://github.com/semantica-agi/semantica/issues/570 — 35-track real-world benchmark epic closed by moving the suite to a new repo; in-tree evals remain unshipped (pillars #571–#575).
- #607 https://github.com/semantica-agi/semantica/pull/607 — core `benchmarks/` extracted to semantica-benchmarks; brief in-repo infra #588/#589 then deleted.
- #1090 https://github.com/semantica-agi/semantica/pull/1090 — open: replaces the “Coming Soon” stub with a runner + 10 evaluators.
- #1091 https://github.com/semantica-agi/semantica/issues/1091 — open: AIP-style maximize/minimize+threshold objectives (PR #1092).
- #1133 https://github.com/semantica-agi/semantica/issues/1133 — open: evals PR treated as complete but unwired; users want record-time evaluation on the decision lifecycle.
- #414 https://github.com/semantica-agi/semantica/issues/414 — benches measure latency, not semantic effectiveness of reasoning/provenance/conflicts.
- #1143 https://github.com/semantica-agi/semantica/pull/1143 — temporal `stability` appended a constant `1  # Placeholder` and always reported 1.0.
- #231 https://github.com/semantica-agi/semantica/issues/231 — splits “how correct” (#228) from “how fast”; MAP `EvalReport` must keep that split.

MAP implication: Goal 1 `EvalReport` (G-structure/entity/relation, replay identity, gold-proposer ≠ extractor) is the in-tree harness they relocated (#570/#607) then started rewriting (#1090); do not wait on #1090, and do not accept success-shaped dummy metrics (#1143).

### Missed by the synthesis, added from the review *(review)*

- #1211 (open, mcp-integrations): `record_decision(category=...)` then `query_decisions(category=...)` returns `[]` in the same session because `find_nodes()` projects category under `metadata`. MAP implication: read models must be derived from the same schema as the write model; a projection that drops a field the query filters on is the "success-shaped empty result" class.
- #1140 (open, embeddings): decision embeddings stay `None`, `find_precedents()` always `[]`, similarity dies after save/load. MAP implication: `EmbeddingVector` with `ModelIdentity` is required on the write path, and a missing vector is a typed `DegradedEmbedding`, never `None`.
- #1159 (open, other → policy): `PolicyEngine.check_compliance()` swallows internal exceptions and returns `False`, so "evaluation failed" is indistinguishable from "non-compliant". Gate-4 exhibit in a new spot: typed errors per boundary (shared-schema law 1), never a boolean that means two things.

## Gate signals

O4 in the brief: two MAP gates, not Goal 1 promises — standalone reasoning package; publishable evals harness. Tracker evidence below; neither gate is pulled into C0–C2.

### reasoning-package

**For.** Users and maintainers independently diagnose hollow engines and ask for proof-bearing rules: SPARQLReasoner never executes (#1083, “fixed” by raising in #1087); advertised engine zoo in the CLI/guide (#578, #687); `infer_facts()` returns `[]` on a matching rule (#354); recursive Datalog requested because “none handle recursive rules” (#368); SPARQL CONSTRUCT templates so rules are data (#322); LLM-free temporal interval algebra (#398); `ExplanationGenerator` emitted empty premises until #739 plumbed `_match_rule` (#733); RETE `_matches` still `return True` and was reopened (#300) with a live fill-in (#1077); users want production-rule Assert/Retract/Call/EmitEvent plus action provenance (#1095, #1096); official docs scope explainability to a system-level trail, not CoT (#1033, #1034); SHACL `conforms: True` under RDFS entailment or wrong-namespace shapes (#1182, #1124, #1158, #1150) is constraint success masquerading as inference. #228’s evals wishlist still names HermiT/Pellet F1-up-to-0.99 while D6 found those checks simulated.

**Against.** Maintainers patch in place rather than extract a package; #1087 *refuses* SPARQL instead of emitting `InferenceEvent`s; Explorer SPARQL (#805) is an rdflib projection of the live graph, not SPARQLReasoner; overlapping open PRs (RETE catalog twins noted in the open-prs lane; SHACL-docs #1158 vs #1150) are not collapsing; NET-NEW remains a dated post-C2 spike (A6) and C2 runtime is already ρdf + EYE (S5/S8).

**Verdict: STRENGTHENED.** Community diagnosis matches D6 (hollow SPARQL/Rete/explanations) and adds live demand for proof-bearing, LLM-free, action-provenance reasoning. That strengthens O4 as a post-canary package gate; it does not reopen C2’s runtime or pull NET-NEW into Goal 1. MAP should not wait on #1077/#1096 landing.

### evals-harness

**For.** The stub is community-visible (#228 corroborates D6; #1090’s title names the “Coming Soon” replacement). A 35-track real-world suite was specified then relocated out of tree (#570–#575); maintainers extracted `benchmarks/` to semantica-benchmarks (#607) after a brief in-repo landing (#588/#589). Current benches are throughput/latency (#414); #231 already splits correctness from speed. Live demand is a runner with per-metric maximize/minimize+threshold objectives (#1091, #1092) wired into the decision lifecycle (#1133). A shipped “stability” metric was a constant 1.0 placeholder (#1143). The full CLI has no `eval` command (#578).

**Against.** #1090/#1092 are a live in-tree runner, so the hole is no longer “nobody is building this.” Relocation to semantica-benchmarks (#570, #607) records an intended destination only: as of 2026-08-24 the sidecar is not fetchable (both URLs 404, absent from the org listing; see `benchmarks-vocab.md`), so no available out-of-tree suite competes with the gate. Closed COMPLETED on #228/#570 can be misread as “evals shipped.”

**Verdict: STRENGTHENED.** Demand for reproducible, semantic-effectiveness evaluation is independently documented, in-tree evals are still a stub until #1090 lands, and even that runner is not a schema-validated `EvalReport` with gold-proposer ≠ extractor, replay identity, or G-structure/entity/relation/entailment. Uniqueness of the harness is those laws, not the idea of a runner. MAP should not wait on #1090; optionally skim semantica-benchmarks for metric names (open question below).

## Dedupe verdicts for our held drafts

Merged across all seven lanes. No lane reported `ALREADY-REPORTED` for any of the six. Inventory has 1 `dedupes-our-draft` (#518, reclassified after review) rows. Posting remains gated on Benjamin (O1/O2); recommendations are for when he chooses to post.

| Draft | Merged verdict | Lane notes | Recommendation |
| --- | --- | --- | --- |
| danklocal `fix(explorer): make ontology DELETE remove implicit graph-backed registry entries` | **PARTIAL** (#518) *(review)* | Lanes said NOT-FOUND; the skeptic found closed #518 (`[FEATURE] Registry, Loader, Entity Search, and SKOS Vocabulary Manager`) specifies `DELETE /api/ontology/{ontology_uri:path}` removing an ontology from the active session graph; it does not report implicit graph-backed entries surviving. Neighbors #517/#519/#520, #787/#823, generic retraction #955/#957. | **post as-is**, citing #518 as the spec the fix completes |
| danklocal `feat(explorer): persist ontology registry and session graph across restarts` | **PARTIAL** (#376, #518, #852, #967, #1134) *(review)* | #376 requests graph checkpoint persistence; #518 defines the registry; #967/#1134 report `SEMANTICA_KG_PATH` never saving on the MCP surface; none covers Explorer `SEMANTICA_REGISTRY_PATH` + `POST /api/session/save`. | **post as-is**, referencing #376 and #1134 as related |
| danklocal `fix(explorer): key registry entries by source URL when the ontology declares no IRI` | **NOT-FOUND** | All seven lanes NOT-FOUND. No empty-string registry-key / source-URL keying issue or PR. | **post as-is** (bundle) |
| Draft issue 1 — FAQ lists two different latest versions (`v0.6.6` vs `v0.5.0`) | **NOT-FOUND** | All seven lanes NOT-FOUND. `faq.md` is restyled or bumped (#245 Python versions; #642/#646/#648 restyle; #808 Databricks ingest; #918 0.6.5 bump; #1033 explainability entry) but never reconciles the two “latest” answers. | **post as-is** |
| Draft issue 2 — Modules page shows runnable evals API although `semantica.evals` is a placeholder | **PARTIAL** (#228, #1090) | closed-issues-a: PARTIAL (#228) records empty/“Coming Soon” but not the `docs/modules.md` vs `docs/reference/evals.md` contradiction. open-prs: PARTIAL (#1090) implements the stub and does not name `KGEvaluator` / `ExtractionEvaluator` / `PipelineEvaluator` / `RegressionTracker` or the docs contradiction. Other lanes NOT-FOUND (#570–#575 want a suite, then moved it out of repo). | **post as comment on #1090** (cross-cite #228): the stub is already tracked; the unique docs contradiction belongs on the PR that claims to replace it. If #1090 never lands, reopen as a standalone docs issue |
| Draft issue 3 — three docs pages absent from `docs.json` navigation (`storage-backends.md`, `migration/kg-provenance-tracker.md`, `changelog.md`) | **PARTIAL** (#658, #899/#888) *(review)* | Merged #658 added `docs/changelog.md` AND a Changelog tab to `docs/docs.json`, so the changelog case is a navigation regression, not a never-wired page; #899 adds only `storage-backends.md`, #888 is adjacent. | **rewrite** as two never-wired pages + one changelog-navigation regression, citing #658 and #899 |

## Corroborated D6 findings

D6 set (grounding sweep + lane prompt): random-vector embedding fallback shaped like success; “parallel” pipeline engine runs sequentially; `SPARQLReasoner.execute_query` always raises; simulated HermiT/Pellet consistency checks; fourteen bare-pass ontology facade methods; stub evals module; packaged-vs-root MCP tool drift (12 vs 17 tools); explorer ontology-registry keying/persistence/DELETE defects.

| D6 finding | Community independently reported | Unique to us (unreported as that defect) |
| --- | --- | --- |
| Random-vector / hash embedding fallback shaped like success | **Yes.** #994 (exit 0 + corrupt file after fallback); #1006 (doctor green while hash fallback). Same class in the cluster: #1005 self-recursive embed wrappers, #433 silent FAISS 768 drop, #738 swallowed `AttributeError`, #885 stale scores, #1139 `save()` with `vectors: {}`. | The exact in-source `vector_store` random-vector path and unreachable `LlamaStore` placeholder are not named as issues; the *class* is public. |
| “Parallel” pipeline engine runs sequentially | **No (advertised only).** #683 and #578 document `set_parallelism` / `run --parallel` / `ExecutionEngine(max_workers=...)`; no tracker item reports the engine executing sequentially. #683 reclassified to map-evidence after review. | Unique to us: the sequential-execution defect is source-derived (D6) and unreported. |
| `SPARQLReasoner.execute_query` always raises / empty bindings | **Yes.** #1083 (empty bindings look like no matches); #1087 (raise `NotImplementedError` rather than implement); #687 (onboarding lists SPARQLReasoner as a verified engine with no caveat). | None — this is fully public, and they chose refuse-over-implement. |
| Simulated HermiT/Pellet consistency checks | **No as a bug.** #228’s evals wishlist asks for “Reasoning Validation (HermiT/Pellet, F1 up to 0.99)” while D6 found those checks simulated. Zero title hits for simulated/HermiT/Pellet as a defect. | **Yes — unique.** Packet-only unless Benjamin files it. |
| Fourteen bare-pass ontology facade methods | **Partial.** #831 (open cookbook) documents stub `OntologyValidator`; inventory tagged it as this D6 finding. #1186: documented SHACL path is private `_run_pyshacl`; `OntologyValidator` is structure-only. | The fourteen empty `ontology/methods.py` declarations are not filed. Unique as a count/location. |
| Stub evals module | **Yes.** #228 (`Coming Soon`); #1090 (open replacement). Supporting: #570–#575 relocated suite, #607 extracted `benchmarks/`, #578 no eval CLI, #1143 placeholder 1.0 metric. | The `docs/modules.md` runnable-API vs `docs/reference/evals.md` placeholder contradiction (draft issue 2) is still unreported as a docs bug. |
| Packaged-vs-root MCP tool drift (the 12-vs-17 split is our source-derived D6 count; the tracker establishes two surfaces with documented behavioral drift, not the exact split *(review)*) | **Yes, as drift.** #870 (dual surfaces both reported stale 0.4.0); #1134 (root `mcp/` 17 tools; packaged `semantica-mcp` persistence also broken; `SEMANTICA_KG_PATH` never saves); #967, #1151, #1157 (export/tool-surface split); #541 (packaged `semantica.mcp_server` missing after pipx). | None as a class. Charter parks MCP editor targets (D10); do not let this set lab shape. |
| Explorer ontology-registry DELETE / persist / URL-key | **No** for DELETE and URL-key (all lanes NOT-FOUND). **Cousin only** for persist (#1134/#967 MCP path, not Explorer `SEMANTICA_REGISTRY_PATH`). | **Yes — unique.** The three danklocal commits are still ours to post or hold. |

## Port hazards the shared schema forbids

Counts are inventory `port-hazard` rows grouped by the lane `finding` label (88 rows). Example #s are from lane reports.

| Class | # examples | Law (shared-schema v1.2) | Count |
| --- | --- | --- | ---: |
| Success-shaped failure (empty list, `success=True/added=0`, `conforms: True` on zero matches, exit 0, populated entry not persisted, doctor green) | #149, #757, #994, #1020/#1021, #1124/#1104, #815/#820, #1127, #1006, #970, #1139, #1082/#1084, #1129 | Typed degradation (`DegradedEmbedding` / tagged error); never `[]` / empty graph / HTTP 200 shaped like success | 44 `typed degradation` + 1 `typed errors / typed degradation` + 1 `typed degradation / span fidelity` = **46** |
| Plain strings in IRI/literal/query positions (URI-wrap literals, surface text as IRI, unescaped Turtle, collapsed datatype/lang, entity names interpolated into SPARQL) | #448, #447, #755, #911, #1099, #1109/#1120, #1125, #1148/#1166/#1122, #1098 | `RdfTerm` = `Iri \| Literal {lexical, datatype, lang?} \| BlankNode`; IRIs minted `https` | **19** |
| Hard-delete / in-place overwrite of audit history (`clear()`, re-track mutates parent, archive-then-overwrite `{id}`, retract/purge erase, `purge_node()` True while other stores retain) | #825, #743, #816, #957, #1027, #783 | Append-only `ProvenanceEvent`; corrections are `Invalidated` / `ConflictResolved`, not UPDATE/DELETE | 8 `append-only events` + 1 `append-only events / branded ids` = **9** |
| Non-stable identity (process `hash()`, wall-clock `@id`, size-derived vector ids reused after delete, string ids vs store `id(n)`) | #1101, #1147/#1181, #1029, #1136/#1173 | Branded content-addressed ids (full digest, never truncated); document/graph ids are content hashes | 5 `branded ids` + 1 `content-addressed identity` = **6** (the +1 append-only/branded is already in the append-only row) |
| Span / qualifier dropped with no lossy declaration (temporal signals discarded; scanned PDF empty text; cache alias mutates `start_char`) | #400, #1020, #1074 | `CanonicalText` owns UTF-16 spans; every stage maps spans or declares itself lossy in the type | 2 `span fidelity` (the mixed typed-degradation/span row is in the first class) |
| Unrelated entities folded into one winner; structured conflict values hashed as dict keys | #1137, #1149, #700/#701, #1207/#1208 | Conflicting claims stay separate nodes joined by `ConflictWitness` | 2 `ConflictWitness / claims stay separate` + 1 `ConflictWitness (do not fold conflicts)` = **3** |
| Vector/metadata silently dropped; multi-model gateways make model identity load-bearing *(review: #1075 adds OrcaRouter as a named provider with caller-chosen `provider/model`; it does not demonstrate a hidden swap)* | #433, #835/#841, #885 (#1075 as context only) | A vector without `ModelIdentity` is unrepresentable; provider swap is a new identity, never a hidden retry | 1 `model identity` (sibling drops live under typed degradation) |
| Provenance refs stored as unused JSON or dropped on some serializers | #741, #1165, #401 | Provenance refs survive every stage or the stage is typed lossy | 1 `provenance refs survive` |
| `@id` beside `@graph` names the graph; re-parse keeps 2 of 21 quads | #1145 | Named graph = provenance partition, not a document label | 1 `named graph provenance partition` |

46+19+9+6+2+3+1+1+1 = 88.

These are the bug classes C0–C2 probes must tripwire: empty `CanonicalText` is not `completed`; `conforms: True` on zero matches is not SHACL; rebuild identity, not a persistence flag, proves Oxigraph; `DegradedEmbedding` is the only legal miss.

## Upstream direction

Visible from merged + open PRs (issue-only shards used only where a maintainer-filed COMPLETED feature is the trail):

- **Polyglot graph storage as the product claim, not one SoR.** RDF triplet stores plus LPG, named graphs, CONSTRUCT templates per backend (#749, #752, #755, #757), documented RDF/LPG matrix (#899, #888), embedded Oxigraph in v0.6.5 (#838, #918), Anzo as another SPARQL-HTTP backend (#814), RDF4J `repository_id` actually honored (#1192).
- **Provenance is being promoted from missing in-memory side effect to a SQLite + PROV-O audit.** Global default path (#802), WAL/atomic transactions (#812), Explorer prefers `ProvenanceManager` and tags `source: audit|graph_traversal` (#809), tombstones / hash-chain / typed Agent/Activity (#827) — while in-place overwrite and hard-delete are still being patched (#743, #816, #825, #957).
- **VectorStore was an in-memory dict facade; a multi-PR cluster makes persistent backends callable.** sqlite-vec optional disk (#726); canonical search row still untyped (#853); `self.vectors` crashes off the inmemory path (#837, #847, #854); metadata dropped (#835, #841). No `ModelIdentity`. CLI doctor still lied green on hash fallback until open #1006.
- **RDF/OWL/SHACL is a correctness campaign, not a redesign.** Vocabulary + deterministic IRIs (#1109), JSON-LD minting (#1120), typed confidence (#1125), SHACL target namespaces (#1124), OWL generator round-trip (#1123), default-graph JSON-LD (#1145), metadata passthrough (#1165), content-derived `@id` (#1181), public SHACL API (#1189), SKOS cycle reject at write (#819). Vacuous validation is now *documented* (#1182) more than engine-fixed.
- **Reasoning is patched and advertised, not extracted.** Empty premises (#739), duplicate rules (#740), SPARQL execute refused (#1087), engine zoo in CLI/docs (#578, #687), explainability scoped to a system-level trail (#1033, #1034). Contributors — not a package plan — are filling RETE `return True` (#1077 / #300) and adding rule actions with an action log (#1096 / #1095).
- **Evals is leaving the stub after the suite left the repo.** 35-track epic relocated (#570–#575); `benchmarks/` extracted (#607); open runner + objectives (#1090, #1092); placeholder metric patched (#1143). Correctness-vs-speed split is old (#231, #414).
- **Ingest surface expands (Arrow, Databricks, Docling) rather than naming span-faithful parse.** #705, #748, #124, #808. Scanned-PDF empty-success is still open (#1020, #1021).
- **Entity-resolution is tightening after silent over-merge.** Honor exact strategy (#1026), refuse cross-type merges (#1149, #1137), preserve `entity_id` aliases (#1086, #1115, #1116). Merge APIs still persist a winner (#700, #701).
- **String-into-query paths are being hardened (SSRF/injection), which is gate-6 adjacent and out of M1 ingest appetite.** SPARQL IRI validate (#911), Cypher label sanitize (#910), ingest SSRF helper (#906, #928, #905).
- **Dual MCP surfaces are patched, not unified.** Version lie (#870), missing `graph.load` / ignored `SEMANTICA_KG_PATH` (#967, #1134), `export_graph` broken every format (#1151), Explorer cannot serve RDF formats MCP already lists (#1157).
- **Explorer + agent-frameworks absorb merge volume and are outside the lab charter.** Canvas/layout (#638), CrewAI/Agno/OpenClaw (#988, #1212), LangChain twice (#1155, #968), OrcaRouter (#1075). Duplicate overlapping PRs are common (RETE catalog, SHACL RDFS docs #1158 vs #1150, Turtle escape #1148 vs #1122) and are not collapsing quickly.
- **Docs chase API drift after the fact.** README examples drifted from source (#766); 18-module README plus MCP tools table (#616); onboarding guides landed as a set (#676, then #682–#704). Public README/modules examples are not a live signature inventory.

**What this changes for the port boundary** (MAP decomposition; not a BRIEF reopen):

- Do not port the adapter zoo. `Context.Service` + one first-probe Layer remains the boundary (D8). Oxigraph-in-process (#838, #918) corroborates the C1 rebuild slate; #970/#757/#1173 are why rebuild-identity, not a persistence flag, is the pass criterion.
- Do not wait on open overlapping PRs (#1077, #1090, #1096, #1158/#1150, #1148/#1122). Maintainers are not collapsing them; C0–C2 probes are independent of any one landing.
- Construction vs consumption (D13) is reinforced: Explorer/MCP/agent-frameworks are *their* product surface; the lab owns ledger → derived projections → proof-bearing eval. Persistence-lies and success-shaped fallbacks are the anti-patterns the shared schema already forbids — MAP’s capability table should name the tripwire per contract, not a wrap-their-class plan.

## Open questions for Benjamin

1. Should MAP skim the out-of-tree `semantica-benchmarks` repo (#607, #570–#575) for EvalReport metric vocabulary, or treat the relocation as a no-go (not in-tree, not W1)?
2. Post the three danklocal Explorer registry commits as one PR (DELETE and URL-key are unreported; persist is only cousin-matched on MCP #1134/#967), or hold because Explorer is outside the M1 charter?
3. File simulated HermiT/Pellet consistency checks as an upstream issue (zero tracker hits; unique D6), or keep that finding packet-only?
4. For draft issue 2, comment the `docs/modules.md` vs `docs/reference/evals.md` contradiction onto #1090 (recommended above), or post a standalone docs issue in case #1090 never lands?
5. Should MAP add an explicit “do not wait on overlapping open PRs” rule, given RETE (#1077 vs catalog twins), SHACL-docs (#1158 vs #1150), and Turtle-escape (#1148 vs #1122) duplicates?
6. Should the O4 evals-harness gate be worded as “schema-validated `EvalReport` + gold-proposer ≠ extractor + replay identity” so it stays distinct from the live #1090 runner even if that PR merges?
