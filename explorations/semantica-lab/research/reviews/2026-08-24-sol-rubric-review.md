# Adversarial review of the bake-off rubric

*Line citations refer to the rubric v1 draft as reviewed (see `criteria-rubric-v1-as-reviewed.md` in this directory) and to packet files relative to the packet root (`../../` from here).*

## 1. Hard gates

The envelope gate contradicts the embeddings sheet. A remote API is a server dependency, yet `../criteria-rubric.md:42-43` calls API-backed embeddings "envelope-legal" while lines 9-10 park server-only technology. Define the product invariant instead: for example, the core pipeline must work without an operator-managed service, while optional remote Layers may improve it. Otherwise two reviewers can reach opposite gate results without either misreading the rubric.

The license gate at `../criteria-rubric.md:11-13` is both too strict and too casual. It excludes file-level weak copyleft such as MPL-2.0 in-process without analysis, then treats a process boundary as sufficient comfort for any copyleft sidecar. Distribution, linking, modification, network use, notices, source offers, and model-weight licenses remain distinct obligations. "Case-by-case" is not a gate. Require an approved license matrix and review of transitive code, binaries, models, and corpora. A sidecar boundary is architecture, not legal advice.

The 12-month maintenance test at `../criteria-rubric.md:14-15` rewards noisy repositories and rejects stable, low-churn software. "Trivially vendorable" is also doing absurd amounts of work. Replace recency with release integrity, supported target artifacts, security response, bus factor, issue latency, reproducible builds, migration policy, test depth, and a priced fork plan. A vendored C++ database or inference runtime is not trivial merely because its license permits a fork.
Missing hard gates:

- A target matrix: Windows/macOS/Linux, x64/arm64, minimum OS/WebView, Bun sidecar ABI, and whether mobile is explicitly out of scope. D9 names Tauri but no supported matrix (`DECISIONS.md:60-65`).
- Resource ceilings for installer size, model download, cold start, peak RSS, disk growth, and sustained CPU. "Runs in WASM" does not prove it survives a WebView's memory and threading limits.
- A threat model for hostile PDFs, archives, URLs, models, native extensions, and sidecars. Require bounded parsing, SSRF controls, sandbox/capability limits, signed artifacts, and no silent network.
- Crash recovery, migration/export, backup, deterministic rebuild, and delete semantics. These are especially necessary before D16 makes append-only provenance the primary state model (`DECISIONS.md:112-118`).
- A minimum semantic contract per family. A storage engine that loses RDF term distinctions or a reasoner that cannot emit checkable derivations should fail, not compensate with benchmark points.

The envelope may indeed park a server product that wins a benchmark. That is defensible only if offline/local operation is a named acceptance criterion. It is not defensible as an unexplained proxy for it.

## 2. Axes and weights

"Quality" at `../criteria-rubric.md:21` combines correctness, capability breadth, benchmarks, and reputation into one 1-5 judgment. Multiplying that judgment by three multiplies reviewer taste. Worse, only scores of 4 or 5 require evidence (`../criteria-rubric.md:17`), so unsupported negative scores can eliminate a candidate. Every score needs evidence, a test, or an explicit unknown.

The rubric double-counts several preferences. Envelope fit is a gate and a weighted axis. Effect integration cost and port/wrap surface mostly price the same adapter work. Data-model loss creates integration work, so fidelity is partly counted again. Beep-concept overlap gives incumbents a systematic point advantage despite D7's quality-first rule (`DECISIONS.md:47-51`). Existing code should enter as a candidate with measured behavior, not receive a familiarity bonus.

Use non-compensatory minimums first, then score four shared buckets within each family: task quality 40%, operational fit 25%, integration plus migration cost 20%, and sustainability 15%. Keep evidence confidence separate from merit. Report score ranges and rerun the winner under plausible weight changes; a winner that flips after a five-point weight change is a tie, not a decision.

"Task quality" must be family-specific. Storage needs conformance, recovery, p95 query/write latency, update/delete behavior, and index rebuild tests. Embeddings need model-held-constant throughput, cold start, memory, numerical drift, and hardware fallback; retrieval quality belongs to the model bake-off. Input needs labeled structure/text accuracy, source-offset fidelity, malformed input behavior, and coverage by format. Reasoning needs soundness, declared completeness limits, termination bounds, incremental-update cost, and independently checkable proofs. One universal "best-in-class" scale cannot measure these four things.

## 3. Family sheets

Storage is falsely unified. Vector indexes, RDF quad stores, property graphs, and the append-only provenance log have different truth models, transactions, query languages, and rebuild strategies. `../criteria-rubric.md:33-39` turns "one engine is simpler" from a hypothesis into a scoring advantage. That preloads the PGlite convergence answer before research. Choose a system of record, then score derived RDF, property-graph, and vector projections separately. Also score compositions and the cost of rebuilding each projection. `effect/Graph` is an in-memory algorithm structure, not a durable property-graph database (`SOURCES.md:41-42`).

The storage census is too narrow. At minimum screen LanceDB, DuckDB VSS, USearch, RDF/JS plus Comunica, and embedded property/multimodel options such as LadybugDB, CozoDB, and SurrealDB. Screening does not imply passing the gates. It exposes their consequences. Current primary docs, for example, show [PGlite pgvector support](https://pglite.dev/extensions/) while its [extension API is not stable](https://pglite.dev/extensions/development), and [DuckDB VSS](https://duckdb.org/docs/lts/core_extensions/vss) still warns about persistent-index recovery. Those facts matter more than an "engine count" point. Freeze exact repositories, versions, artifacts, and target modes; "-class" and "equivalents" are not reproducible candidates.

Embeddings conflates model selection, inference runtime, and orchestration (`../criteria-rubric.md:41-45`). Transformers.js is not comparable to an ONNX execution provider, and runtime speed says nothing about a model's retrieval quality. Run two linked decisions: model and license on the actual corpus; then runtime with that model held constant across ORT Web/WASM/WebGPU, native ORT, and any sidecar. Test model acquisition, hash pinning, quantization, cache eviction, offline reinstall, and CPU-only fallback. The current sheet's "offline story" is prose, not a measurement.

Input is a stack by definition, so D8's single winner is the wrong cardinality. PDF layout, OCR, HTML, Markdown, DOCX, email, archives, normalization, and chunking do not share a credible one-library winner. Build a format-by-stage capability matrix around the actual corpus, retain the existing beep packages where they win, and choose bounded gap fillers. Include PDF.js, MuPDF, Apache Tika, Docling, Pandoc, OCR runtimes, and native schema-first splitting as distinct probes. Record offset/provenance preservation across every stage, not only final text quality.

Reasoning is several semantics disguised as one family. N3 entailment, Datalog, RDFS/OWL profiles, SHACL rules, Rete production rules, temporal inference, and abduction cannot be ranked until the required entailments are named. SHACL-AF is a W3C Note, not a generic synonym for reasoning. N3.js, EYE, and Souffle also expose different proof, built-in, and compilation contracts. Separate semantic suites first, then decide whether one engine covers more than one suite.

The "pick-one + NET-NEW hybrid" clause at `../criteria-rubric.md:58-60` is scope-creep permission. It has no trigger, budget, or falsification test, and it lets a favored native design bypass the same quality evidence demanded of incumbents. Permit a hybrid only when a named acceptance case has no passing candidate, cap it to one interface and milestone, keep the external baseline independently usable, and require an ablation showing what the new part adds. Research proposals and shipping candidates must not share a score table.

## 4. Decision-set risks

1. **D8, exact one-of-three per family (`DECISIONS.md:53-58`).** Failure scenario: the input winner parses born-digital PDFs but loses HTML structure and OCR; the team either ships known loss or quietly creates the adapter set D8 forbids. A Layer makes a second implementation possible. It does not erase data migration, duplicated indexes, or semantic divergence.
2. **D2, split truth between Notion and repo (`DECISIONS.md:14-19`).** Capability "facts" are the evidence for decisions, so they cannot have an independent owner. D3 and the rubric then require verdicts in both places (`DECISIONS.md:21-24`; `../criteria-rubric.md:64-67`). Failure scenario: an atlas fact changes, the bake-off citation stays stale, and one agent reads `adapt` while another reads `pick-one`. D5's sync pipeline automates more state without establishing one writer.
3. **D12, Tauri scaffold from day one (`DECISIONS.md:84-90`).** The stated first milestone is headless and needs neither a window nor Rust. The grounding says the scaffold supplies only a minimal shell and hosted Labs CI does not run Cargo (`../grounding-beep-labs.md:30-31,56-58`). Failure scenario: the Document-to-KG proof works in Bun, while signing, sidecar shutdown, native artifacts, or installer size fails only after the rubric has parked alternatives around a fictional package.

D16 is the close fourth. Append-only-first can collide with privacy deletion, compaction, schema evolution, and bounded desktop storage. It needs a workload and failure-recovery spike before it is allowed to invert every storage signature.

## 5. What's missing entirely

The unasked question is: what exact workload must win on what machine, and what failure is unacceptable? D14 names an academia corpus plus fixtures (`DECISIONS.md:99-104`) but no gold labels, scale, redistribution proof, update mix, latency budget, memory ceiling, or expected entailments. Without that contract, "quality" is marketing filtered through reviewer preference.

The four bake-offs are also treated as independent even though parser offsets affect provenance, chunking and model choice affect retrieval, storage terms constrain reasoning, and proof storage affects the data model. Require an end-to-end compatibility round over candidate bundles after the family screens. Local optima can compose into a pipeline that does not run.

No process rule covers rubric amendments, score disagreement, unknown evidence, ties, failed native spikes, or a winner that passes research but not packaging. D11 should freeze a versioned rubric, not prohibit evidence-driven correction. Require primary-source snapshots, an executable smoke adapter on every target, two independent scorers, a reconciliation record, and a minimum passing score. Also reconcile D3's `adopt/adapt/already-have/park/drop` vocabulary with D8's `already-have/pick-one/park`; the current sync has no lossless mapping.

Verdict: REWORK. Mandatory edits: define workloads and target budgets; replace the gates; split false-unified families; use family-specific non-compensatory scoring with evidence for every score; constrain hybrids; add integration spikes, sensitivity/tie rules, and one verdict vocabulary.
