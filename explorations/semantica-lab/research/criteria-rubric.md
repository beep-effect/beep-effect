# Bake-off Criteria Rubric — v2.0 (ratified 2026-08-24)

Status: **v2.0 — RATIFIED 2026-08-24** (Benjamin), rebuilt per the Sol (REWORK) and Grok
(RATIFY-WITH-EDITS) adversarial reviews; reconciliation in
[`reviews/2026-08-24-reconciliation.md`](./reviews/2026-08-24-reconciliation.md), amendments
A1–A9 in [`../DECISIONS.md`](../DECISIONS.md). The rubric is versioned; corrections after
ratification are dated DECISIONS entries, not silent edits.

> The five family sheets have already run under this rubric and are **candidate screens**
> (B1), not verdicts. This rubric still governs any later rescoring. §4 describes what already
> happened, not a todo. Budgets and the offline definition were re-anchored after ratification:
> read them from `workload-contract.md` v1.2 (G4/G6/G7), never from this file.

## 0. Prerequisite artifacts (bake-off INPUTS — nothing launches without them)

1. **Workload contract** (`workload-contract.md`, now v1.2): the named corpus subset with gold
   labels, machine targets, budgets, expected entailments, and the falsifiable Document→KG→eval
   loop. Budgets and the offline meaning live there (Tier-L/Tier-D, replay-offline per
   G4/G7) — do not copy ceilings from this rubric. **Mobile is out of scope.**
2. **Shared schema one-pager** (`research/shared-schema.md`): Document / Chunk (with source
   spans) / RDF Term (IRI vs literal+datatype+lang, via `@beep/rdf`) / Entity / ProvenanceEvent
   / InferenceEvent / embedding model identity. Families are scored against THIS contract; four
   locally-optimal winners that cannot compose are a failed bake-off.
3. **Runtime placement decision**: the Bun sidecar process is the default engine home (webview
   = UI only; a Rust-crate home is an exception with recorded rationale). "In-process" in this
   rubric means in the Bun sidecar process.

## 1. Hard gates (non-compensatory; fail ⇒ park, with reason recorded)

1. **Envelope (D9).** Applies to ENGINES (storage, reasoning, parsing runtimes): in-process
   (Bun sidecar) or bundle-and-spawn local binary; a server-only or operator-managed engine
   parks (recoverable via Layer). Hosted MODEL APIs via the agents slice are in scope for M1
   (G6) and do not park under this gate. Each family sheet carries a **parked-SOTA appendix**
   so envelope parking stays honest.
2. **License matrix.** In-process deps: permissive (MIT/Apache-2.0/BSD/ISC/`PostgreSQL`
   — the last ratified 2026-08-24 for the pgvector case); file-level weak
   copyleft (MPL-2.0-class) admissible with a note. Copyleft sidecar binaries: admissible only
   with a written distribution analysis (conveyance in a Tauri bundle ≠ dynamic linking; WASM
   linked into JS is in-process, not a sidecar). Model weights carry licenses too — they are
   dependencies. Unverifiable license ⇒ park.
3. **Sustainability.** Releasable-or-vendorable: tagged releases we can build in CI, or a
   vendoring plan with a priced fork (a vendored C++ engine is not "trivially" forked).
   Commit-recency is NOT the test — EYE/Jena-class projects go quiet and remain the answer.
4. **No success-shaped degradation.** Any silent fallback that fabricates success-shaped output
   (semantica's random-vector embedding fallback is the canonical exhibit) ⇒ park unless the
   failure mode is representable as a typed degraded state.
5. **Resource fit.** Judged against the workload contract v1.2 Tier-L bar (cold start, p95) at
   BUNDLE level (B5), with RSS/deps/model bytes measured and recorded, not park triggers.
   "Runs in WASM" does not prove it survives a webview's memory limits; engines default to the
   sidecar per §0.3, so measure them there.
6. **Security posture.** Bounded parsing of hostile inputs (PDFs, archives, URLs), SSRF
   controls for ingest, no silent network calls, signed/pinned artifact acquisition.
7. **Determinism.** Evals (D16) require replayability: pinned models/versions, stable
   tie-breaking, reproducible index rebuilds. Non-replayable ⇒ park for eval-bearing roles.
8. **Semantic floor (per family).** A candidate that loses the shared schema's distinctions
   (RDF term identity, source spans, model identity, checkable derivations) fails regardless
   of benchmarks.

## 2. Scoring (within each family, after gates)

Four buckets, family-specific definitions of "task quality" (see sheets):
**task quality 40%** · **operational fit 25%** (peak RSS, cold start, model/artifact bytes,
spawn/init cost, rebuild cost) · **integration + migration cost 20%** (service-contract fit,
typed errors, impedance vs Effect; migration/rebuild of persisted state) · **sustainability
15%** (beyond the gate: release cadence quality, bus factor, issue latency, test depth).

Rules: EVERY score carries evidence (a measurement, a doc citation, or an explicit UNKNOWN) —
unsupported negative scores are as banned as unsupported positive ones. Report ranges, not
points, where evidence is thin. **Sensitivity check:** a winner that flips under a ±5-point
weight shift is a tie → deeper probe or bundle both forward to the compatibility round.
Verdict vocabulary (unified, A9): family-level = **already-have / pick-one / bundle / park**;
atlas row-level `adopt|adapt` map to pick-one (adopt = wrap as-is, adapt = wrap with changes),
`already-have`/`park`/`drop` map 1:1. A family verdict is written only after its canary stage
passes; until then the formal state is **park-pending-canary** (B1), a packet-only value that
never appears in the atlas. Full map: [`../DECISIONS.md`](../DECISIONS.md) Current law.

## 3. Family sheets

### 1. Storage (system of record + projections — NOT one engine decision)
Choose the **system of record** first (candidate axis: append-only event log per D16 vs
document/relational store vs native graph store), then score **projections separately**:
vector index, property graph, RDF/triplet view, provenance log. A **bundle verdict is
expected**, not a failure (A1). "Engine count" is priced inside operational fit + migration
cost, never as its own trump. Already-have traps flagged by review: `SparqlQueryService` in
`@beep/semantic-web` is an engine-agnostic *contract*, not a store; `effect/Graph` is an
in-memory algorithm structure, not durable storage; **pgvector-on-PGlite is a candidate, not
an incumbent** — it exists nowhere in the repo today (Docker-compose comments only), PGlite's
extension API is flagged unstable in its own docs. Seeds: PGlite(+pgvector), sqlite-vec,
DuckDB VSS (persistent-index recovery caveat), LanceDB, USearch, Kuzu, CozoDB, SurrealDB
(embedded), Oxigraph (embedded/WASM), quadstore, RDF/JS + Comunica, plain-file + rebuild.
Task quality: conformance (SPARQL/Cypher-subset correctness), recovery semantics, p95
query/write latency on the workload contract, update/delete behavior, index rebuild cost.

### 2. Embeddings (two linked decisions: model, then runtime)
Pick the **model** on the actual corpus first (retrieval quality, license incl. weights,
dimension/identity in schema); then the **runtime** with the model held constant: ONNX Runtime
(native in sidecar) vs ORT-web/WASM/WebGPU vs transformers.js vs spawned runtime. Task quality:
model-held-constant throughput, cold start, memory, numerical drift, CPU-only fallback,
acquisition/hash-pinning/offline-reinstall. The semantica anti-pattern (silent random-vector
fallback) is gate 4's exhibit: absence/degradation must be typed states in the schema.

### 3. Input stack (per-stage matrix — stack verdict, not single winner)
Bounded to the workload contract's formats (D14 corpus: born-digital academic PDF, HTML, MD,
plus fixtures) — NOT semantica's 23-ingestor surface. Build a format-by-stage capability
matrix (ingest → parse → normalize → split) scoring per stage; beep bricks compete as
candidates: `@beep/file-processing`, `@beep/md`, `@beep/html`, `@beep/tika` (note: default
lane is HTTP to localhost:9998 — envelope requires the bundled-JVM-sidecar analysis or a
different lane), `@beep/pandoc-ast`, `@beep/nlp`/`@beep/nlp-processing`, `@beep/langextract`.
External seeds: pdf.js/MuPDF-class, Docling (sidecar), unified/remark. Task quality: labeled
structure/text accuracy, **source-offset/provenance preservation across every stage**,
malformed-input behavior, coverage by format.

### 4. Reasoning (FROZEN 2026-08-24 after the /adhd pass — D15/A6; see `adhd-reasoning.md`)
Name the required **entailment suites** before ranking engines: RDFS/OWL-profile closure,
Datalog, N3 rules, SHACL(+AF) validation/rules, production rules (Rete), temporal, abductive.
Map engines to suites; one engine covering two suites beats two engines. Ecosystem seeds:
eyereasoner (EYE WASM), N3.js, shacl-engine/rdf-validate-shacl, TS/WASM Datalog engines,
Ascent/Datafrog (Rust Datalog — Rust-crate exception path), Trealla/SWI WASM (Prolog).
Salvage inputs: v3 `rete` (SALVAGE: topology + 46-test behavioral oracle; audit/DOT hooks as
explanation-event vocabulary), `rules`/`logos` (PATTERN), ontology slice's bounded reasoner
(RDFS-closure-class, NOT OWL-DL — an already-have candidate, not a bye). Task quality:
soundness on gold entailments, declared completeness limits, termination bounds,
incremental-update cost, **independently checkable proofs**.
**NET-NEW discipline (A6):** the wrap IS the pick-one; any native substrate work is a dated
spike with kill criteria and an ablation showing what it adds over the wrapped baseline —
research proposals and shipping candidates never share a score table.
**/adhd outcome (2026-08-24):** the NET-NEW spike candidate has a concrete shape —
proof-ledger kernel + budget-certified execution membrane + evidence-graph workspace
(`adhd-reasoning.md` §Focus/§Synthesis), with three named first-step probes as its kill
criteria (canonical proof-node hashing; certificate hash-binding + typed truncation; one
end-to-end evidence-batch→Rete→InferenceEvent fixture).

### 5. Extraction (scored already-have/gap sheet — the step that produces the KG)
`semantic_extract` is semantica-solid and was previously unscored (review catch). Sheet:
method contract (pattern/llm/ml) against the shared schema (spans, typed outputs), gold-label
extraction eval on the workload contract, provider access via the agents slice (already-have
for transport; the extraction *method* and *output schema* are what score).

## 4. Process (executed 2026-08-24; the compatibility round is the staged canary C0-C2 per G1)

One deep-research pass per family → `research/bakeoff-<family>.md`: gate table, scored buckets
with evidence, winner + runner-up (or bundle), park list with one-liners, parked-SOTA appendix,
SOURCES §3 appendix. Every bake-off output gets the Sol+Grok adversarial pass (D17);
disagreements are logged in the sheet. After family screens: an **end-to-end compatibility
round** — the winning bundle must run the workload contract's Document→KG→eval loop together
before verdicts finalize. Verdicts land as dated DECISIONS entries and sync to the Notion
atlas Verdict columns via the unified vocabulary (A9).
