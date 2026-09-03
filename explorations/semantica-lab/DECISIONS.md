# Decisions

<!-- Stage 2. Dated Question -> Answer -> Rationale log, rejected options included. -->

## Current law (2026-08-24)

The sections below are the dated log. Later entries amend earlier ones. This table is what
holds now; when a log entry disagrees with it, the table wins.

| Topic | Holds now | Supersedes |
| --- | --- | --- |
| Next work | Graduated 2026-09-03: `goals/semantica-atlas-sync`, `goals/semantica-storage-inversion` and `goals/semantica-reasoning-spike` exist (materialized from the `beep goals bootstrap` plan; SPECs seeded from MAP v1.1 and this file's ratification grill); exploration status `graduated`. Execution runs in the goal packets in the ratified order (verdict lane → storage spike → reasoning spike; P-S1 before R-c and P2–P4; the v3 archive before P3). This packet reopens at `decompose` only when a MAP gate fires: the facts-lane trigger, an O4 OSS gate, the Explorer/UI milestone, or a family park. | 2026-09-03 "Graduation ceremony: scaffold …" |
| Stop rule | Probe-denominated circuit breaker (S1): each family gets its first-probe candidate; a stage failure buys exactly one more candidate, redesigned when the failure was a design fault; a second failure parks the family and the packet drops to decompose (row aligned to the S1 entry by ratification R0.a, 2026-09-03); wall-clock is `EvalRunTelemetry` sidecar telemetry (R1), never a gate. Re-entry is bounded (E8): one decompose re-entry candidate per family per stage; a second park is terminal absent an explicit operator ratification recorded in this file | BRIEF v0.1 "two weeks, C0 in four days"; contract v1.2 two-week falsifier; unbounded slate re-entry |
| Gold labels | Gold-proposer provider family ≠ extraction provider family, enforced as a schema refinement on EvalRun; spot-checked fraction committed as a number in gold/v1 (S2) | contract v1.2 "LLM-proposed and spot-checked" |
| Lab shape | `--app-kind tauri`, one local `cargo check`, `src-tauri` frozen through C0-C2, hand-written `server/main.ts` + `src/runtime/Layer.ts` as the headless proof surface (S4) | D12/G2 wording without a runtime entry |
| Storage | **bundle** (C1, 2026-08-31): authoritative file-backed PGlite ledger + dimension-keyed DuckDB exact-vector projection + Oxigraph RDF rebuild-from-ledger. The C1 G and full-W1 runs passed ordered kNN/SPARQL expectations and empty `QuadDelta` rebuild identity. PGlite adjacency/proof tables remain the C2 derived-graph component; ANN, DuckDB VSS, pgvector-on-PGlite, and persistent RDF stores stay contingent. | `park-pending-canary`; D8 one-of-three; the sheet's provisional `Bundle` verdict |
| Embeddings | **pick-one** (C1, 2026-08-31): hosted `@beep/openai` `OpenAiEmbeddingModel` using `text-embedding-3-small` revision `text-embedding-3-small@2024-01-25`, content-addressed cache replay, and `DegradedEmbedding` as the only failure state. Dimension 1,536 is frozen from C1 onward. The local Snowflake/ONNX lane remains parked for a separate same-model local-runtime probe. | `park-pending-canary`; S3 (openai-compat `/embeddings` op); G6 "via the agents slice"; the sheet's provisional local Snowflake/ONNX winner |
| Input | **pick-one** (C0, 2026-08-30): the proven C0 input stack, with `@beep/doc-text` for born-digital W1 PDFs, identity decoding for Markdown, and the lab's deterministic HTML text extraction. All 25 W1 papers parsed in R2 without the direct-`unpdf` retry; MuPDF stays parked. | `park-pending-canary`; the sheet's per-stage winners; "PDF.js/MuPDF is a tie" |
| Spans | compose, not build: the lab's `CanonicalText` = `ResolvedSourceText` (`@beep/file-processing` `SourceText`) = `@beep/provenance` `SourceTextIdentity` + text, spans = `@beep/provenance` `TextAnchor`, C0 tripwire = `verifyTextAnchor`; raw extracted text IS canonical, normalization is locator-only, no raw→canonical loss map; lab-local NET-NEW shrinks to `EvidenceBatch`, `ModelIdentity`, `ConflictWitness` (M1) | shared-schema v1.1 `CanonicalText` loss map; BRIEF rabbit hole 1 |
| Reasoning | **pick-one** (C2, 2026-08-31): lab-local declarative rho-df closure (rdfs2,3,5,7,9,11 plus SKOS broader-transitivity), naive fixpoint, content-addressed `InferenceEvent` proof DAGs, and test-only restricted EYE as the independent oracle. Full-W1/F1 live and replay reports were byte-identical; the crash restart and Tier-L gates passed without retry. `G-entailment/rules`, the v3 Rete salvage, and the proof-ledger kernel remain the queued reasoning spike at `decompose`. | `park-pending-canary`; the sheet's EYE pick-one; "RDFS-lite ~13 rules" |
| Extraction | **pick-one** (C0, 2026-08-30): the hybrid extractor contract—hosted LangExtract-shaped extraction with exact evidence-quote grounding, plus the fail-closed Wink pattern comparator and its declared unsupported losses. The candidate passed all three relation papers and full-W1 R2 without retry; the legacy relation-dropping handoff and fabricated-span adapter remain parked. | E9 `active re-entry`; `park` (S1, 2026-08-26); `park-pending-canary`; the sheet's dual verdict; BRIEF v1.0's C1 G-relation deferral |
| Canary | staged C0 then C1 then C2 (G1), each stage bounded by the probe breaker (S1), no calendar; code lives in the lab after graduation; every stage pass includes the full W1 + F1 run, live and replay, with equal digests and zero unexpected typed-degraded document failures (F1 malformed specimens decode to their declared degraded states; any W1 paper degrading fails the gate) (R2); C1 checks `G-projection` before rebuild identity (R3) | B2's monolithic offline run; G1 "C0 (days)" |
| Budgets | Tier-L hard bar: cold start <5s, p95 <100ms; 16GB bundle-RSS alarm, not a park; laptop-class numbers are Tier-D telemetry in the per-run `EvalRunTelemetry` sidecar, never in the report digest (R1) | B5/A8 2GB/250MB/600MB as gates |
| Offline | replay-offline, hosted-live: cache every provider result content-addressed; re-run must reproduce the `EvalReport` digest with network off; Tier-L/Tier-D numbers live in a per-run `EvalRunTelemetry` sidecar outside the digest (R1) | A8's fully-offline M1; "byte-identical EvalReports" |
| Atlas writes | final `park` values written 2026-09-02 (six rows; `goals/semantica-canary/history/p5-atlas-sync.md`); no `drop` warranted; row-level `adopt`/`adapt`/`already-have` are unblocked by the passed canary and belong to `semantica-atlas-sync` (O3/M4) | B1 "only final park/drop today"; D3 columns as live verdicts |
| Atlas backlog | O3 verbatim (M4): template exemplars, IR row-fill and the 27 module analyses are async codex batches off the critical path, not a goal and not gated; `semantica-atlas-sync` = the D5 render/diff sync pipeline only, re-entry = semantica 0.6.7+ or atlas-edit need | MAP v0.1 "gate = C0 pass" |
| Repo defects | O1 exception (M2): the `@beep/nlp` Handoff mention/span drop is fixed now in its own PR (`nlp-ir/1.1`, required `mentions`); the relation drop stays repo-issues Draft 2, cleanup-on-touch | O1 "fixes ride cleanup-on-touch" for this one defect |
| Graduation | M5/M6: three PRs — fix → docs-only ceremony → lab mint; both packets graduate in one ceremony; `openai-driver` scaffolds `active` with no dependency edge; `docs/ROADMAP.md` funnel policy gains a lab-canary slot-free clause and a Labs line. 2026-09-03 (R4.a): the three re-entry packets graduate in one docs-only ceremony at their own weights — `semantica-atlas-sync` at template weight with the facts lane as a gated P2, the two spikes carrying their probes as phases — all `active`, with the capability edge `semantica/tombstone-law` provided by the storage spike and required by the reasoning spike | G2 "graduate this week"; 2026-09-02 "no successor packet was scaffolded" |

**Verdict map** (which vocabulary is legal where):

| Where | Allowed values | When written |
| --- | --- | --- |
| Family (packet) | already-have / pick-one / bundle (storage only) / park / drop | after the matching canary stage passes |
| Family (today) | park-pending-canary | packet-only; never an atlas value |
| Atlas row | adopt / adapt / already-have / park / drop | adopt = wrap as-is, adapt = wrap with changes; `park`/`drop` any time a sheet or dated verdict warrants; positive values only after the matching canary stage passed (B1) — unblocked 2026-09-02, written by `semantica-atlas-sync` (Atlas writes row; coherence edit 2026-09-03) |
| Sheet | none | a sheet is slate + probe order; its "winner" is not law |

**Terminology** (one meaning each; prefer sheet, probe, canary in new prose):

| Term | Means |
| --- | --- |
| Bake-off | one family research pass (`research/bakeoff-*.md`) |
| Sheet | that markdown file |
| Screen | B1's status for a sheet: slate plus probe order |
| Probe | one named measurement that can falsify a slate row |
| Canary | the staged M1 proof, C0/C1/C2 (G1) |

## 2026-08-24 — grill-with-docs session (Fable + Benjamin)

Original grilling log. Amended by the A/B/G/O sections below; read the Current law table first.

### D1. Where does pre-goal work live?
**Answer:** This packet (`explorations/semantica-lab`), opened now.
**Rationale:** Criteria rubric, deep-research outputs, decisions, and the OPPORTUNITIES ledger
need lawful repo-tracked homes; phase 2 is then a standard graduation into `goals/`.
**Rejected:** Notion-only until phase 2 (no repo truth home); straight-to-`goals/` (ceremony
before scope is settled).

### D2. Truth boundary between Notion and repo
**Answer:** The Notion `@beep/semantica` page owns atlas *facts* (component/module documentation,
catalogs, templates, glossary). This packet owns *decisions, criteria, research, findings-of-
record*. At graduation the goal packet becomes truth and the Notion page becomes its mirror.
**Rationale:** Repo law makes durable handoffs disk-first; Notion is the queryable working
surface both agent stacks (Claude + Codex, both OAuth'd to workspace Todox) can read/write.

### D3. Wheat/chaff verdicts are columns, not prose
**Answer:** Upgrade every atlas catalog database with typed columns: `Kind` (select), `Maturity`
(solid/partial/stub), `Verdict` (adopt / adapt / already-have / park / drop), `Beep counterpart`,
`Docs URL`. Phase-2 grilling fills `Verdict`; the cut list falls out of a filter.

### D4. Analysis altitude
**Answer:** Comparative analysis (relevancy to beep, better-in-beep, best-of-both) lives at the
**module** level (27 Module Index rows). Component-level sub-pages (~213 rows) carry facts:
signatures, invariants, docstring content, links, issues, effect/Schema translation sketches.
**Rationale:** 27 deep analyses beat 213 shallow essays; component pages feed them evidence.

### D5. Atlas accuracy is a sync problem, not a one-time audit
**Answer:** Build a small extraction pipeline: Python AST/griffe walk over `semantica/**`
emitting a schema-validated JSONL IR (symbol, kind, signature, params, docstring sections,
file:line, module); IR on disk is the regenerable source; agents render/diff Notion from it.
**Rationale:** Semantica moved 0.2.2→0.6.6 in seven months; hand-audits go stale immediately.
The pipeline is also proto-lab code (ingest→parse→normalize→export over the semantica repo).

### D6. Findings are first-class
**Answer:** A dedicated Findings database in the atlas, seeded now: Benjamin's three `danklocal`
fixes (explorer ontology-registry keying/persistence/DELETE) plus grounding-confirmed classes —
random-vector embedding fallback shaped like success, sequential "parallel" pipeline engine,
`SPARQLReasoner.execute_query` always raising, simulated HermiT/Pellet consistency checks,
fourteen bare-`pass` ontology facade methods, stub `evals`, packaged-vs-root MCP drift (12 vs 17
tools). Findings triple-serve: wheat/chaff evidence, upstream contributions, port spec.

### D7. Quality over incumbency
**Answer:** "Already-have" (beep/Effect capability) is a bake-off *candidate*, never a default
winner. Decisions score on best-in-class quality first.
**Rationale:** Benjamin verbatim: "I don't really want to put more value on something just
because 'we have it' … quality over all else."

### D8. Per-family three-way partition
**Answer:** Every capability family resolves to exactly one of: **already-have** (map it),
**pick-one** (single winner behind a service contract), **park** (recoverable later via Layer).
No plugin system, no adapter zoo: the port boundary is the `Context.Tag` service schema; a
second backend later = one new Layer against an existing contract. Stated as a design law for
the eventual goal packet.

### D9. Deployment envelope for bake-offs
**Answer:** Hybrid embedded-first. Default in-process/embedded (PGlite+pgvector-class, Oxigraph-
class, ONNX-class); non-embedded winners allowed only if sidecar-spawnable by the Tauri app;
server-only tech parked regardless of quality (recoverable via Layer).
**Rejected:** strict-embedded (may exclude a best-in-class spawnable binary); quality-
unconstrained (wrecks the desktop-local story).

### D10. Bake-off roster
**Answer:** Four criteria-scored deep-research bake-offs: (1) **storage substrate** (vector +
property-graph + triplet judged together, incl. pgvector-on-PGlite convergence and whether
`@beep/semantic-web` + ontology slice already cover RDF/SPARQL), (2) **embeddings runtime**,
(3) **input stack** (vs `@beep/file-processing`/`@beep/md`/`@beep/html`), (4) **reasoning
engines** — elevated: two-sided survey of the TS/WASM ecosystem (EYE/eyereasoner, Datalog
engines, N3/SHACL-AF, Rete implementations) AND the Effect-native design space (typed proof
DAGs, Rete-as-data over `effect/Graph`, bounded chaining as Streams/fibers), plus the v3
`beep-effect-logos` prior art and the ontology slice's existing bounded reasoning.
**Auto-parked** (one-line rationale each, recoverable): agent-framework integrations
(Agno/CrewAI/OpenClaw), MCP editor targets, LLM provider multiplexing (agents slice owns
providers), visualization backends (UI decision instead), deploy infra.

### D11. Criteria before candidates
**Answer:** The scoring rubric (`research/criteria-rubric.md`) is ratified — after a Sol+Grok
adversarial pass — before any bake-off launches.

### D12. Lab staging
**Answer:** Scaffold the future apps/labs/semantica lab with `--app-kind tauri --lab` from day one (D13 lab-
apps shape, portless shell). Milestone 1 proves the Document→KG chain + evals headlessly
(tests/CLI/MCP, in-process runtime); sidecar and workbench UI arrive as later milestones when
persistence and gesture-bearing UI earn them.
**Rejected:** workbench-early (slower to first end-to-end proof); Vite-first (diverges from D13
intent; conversion churn).

### D13. Charter boundary with trustgraph-workbench
**Answer:** Construction vs consumption. `semantica` lab owns knowledge construction: ingest →
parse → extract → KG build → reasoning → provenance → evals. `trustgraph-workbench` keeps
projection/retrieval/graph-UX. The ontology slice is the shared spine both consume.
**Rejected:** merging the labs (one giant lab, loses TrustGraph porting focus); deferring (the
bake-offs need to know whose requirements they serve).

### D14. Eval corpus
**Answer:** Primary: academia corpus (public papers, repo-safe by path) + small synthetic/seed
fixtures committed in the lab for determinism. Oppold corpus is a local-only secondary proving
ground, never referenced in committed artifacts.
**Rejected:** oppold-primary (redaction discipline on every artifact); synthetic-only (weak
real-world evidence).

### D15. /adhd divergence target
**Answer:** The reasoning opportunity space — what a schema-first, provenance-carrying,
Effect-native reasoning substrate could uniquely do. Run before the criteria rubric freezes the
reasoning family.
**Rejected:** lab-charter divergence (reopens settled rounds); atlas mechanics (already shaped).

### D16. Phase-2 design laws (accepted this session, to be carried into the goal packet)
- **Provenance-first substrate:** append-only provenance events as primary; graph state and
  PROV-O views derived. Decided before any module ports (it inverts storage signatures).
- **Pipeline-as-data:** serializable tagged step algebra interpreted by services; real fiber
  concurrency per ready level. No raw callables in pipeline definitions.
- **Evals as spine:** acceptance evidence defined before porting; "chain runs on corpus X
  producing eval report Y" is the lab's definition of proven.
- **Upstream lane:** in scope, opportunistic — file issues from Findings; PR the danklocal
  fixes when convenient.
- **Graduation targets named up front** in the goal packet so lab code is written
  promotion-shaped.
- **Explorer/UI scope** is a named decision in the goal packet (thin workbench vs defer),
  staged per D12.

### D17. Working method
**Answer:** Heavy fan-out via Codex (Sol xhigh) writing distilled files into `research/`;
Grok 4.6 xhigh + GPT-5.6 Sol xhigh adversarial review passes over major artifacts (rubric,
brief, bake-off verdicts); /adhd for targeted divergence; `research/OPPORTUNITIES.md` as the
live ledger, appended at the moment of insight, never saved for closeout.

### D18. Rosetta glossary
**Answer:** The atlas glossary database is a Rosetta table: semantica term → definition →
beep/Effect translation → Module Index relation. Doubles as the port's naming authority.

## 2026-08-24 (later) — Amendments A1–A9 — **RATIFIED by Benjamin 2026-08-24** (with the
`PostgreSQL` SPDX permissive-list addition ratified the same day)

Source: convergent findings of both adversarial reviews
([reconciliation](./research/reviews/2026-08-24-reconciliation.md)); rubric rebuilt as v2.

- **A1 (amends D8/D10).** Storage is a system-of-record + projections decision; a **bundle**
  verdict is legal for that family. pgvector-on-PGlite demoted from convergence-prior to
  ordinary candidate (not present in the repo today).
- **A2 (amends D9).** "In-process" = the Bun sidecar process; webview is UI-only; Rust-crate
  homes are recorded exceptions. Envelope is gate-only — dropped as a scored axis.
- **A3 (amends D10).** Input stack returns per-stage verdicts (format-by-stage matrix bounded
  to the workload contract), not a single winner. Omitted beep bricks added to seeds/SOURCES:
  `@beep/tika`, `@beep/langextract`, `@beep/nlp`, `@beep/nlp-processing`, `@beep/pandoc-ast`,
  `@beep/rdf`, `@beep/provenance`, `@beep/duckdb`.
- **A4 (extends D10).** Extraction (`semantic_extract`) becomes family sheet 5 — scored
  already-have/gap, gold-label eval; it is the KG-producing step and was unscored.
- **A5 (amends D12).** Milestone 1 is **window-optional**: the Tauri scaffold must not block
  the headless Document→KG→eval proof; Cargo checks stay local (Labs CI runs no Rust).
- **A6 (constrains D10 reasoning + D16).** The wrap is the pick-one; NET-NEW native substrate
  work is a dated spike with kill criteria + ablation. Reasoning sheet freezes only after the
  /adhd pass (D15). D16's provenance-first intent stands, but the goal packet must include a
  storage-inversion spike covering delete/compaction/desktop-storage semantics before it is
  binding.
- **A7 (new).** A shared-schema one-pager (Document/Chunk/RDF Term/Entity/ProvenanceEvent/
  InferenceEvent + spans + model identity) is bake-off INPUT; an end-to-end compatibility
  round over winning bundles precedes final verdicts.
- **A8 (new).** A workload contract (corpus subset + gold labels, target matrix with mobile
  no-go, resource/latency budgets, expected entailments, the falsifiable two-week loop) is
  bake-off INPUT. Offline/local-first is a named acceptance criterion there.
- **A9 (amends D2/D3/D8).** Single-writer refinement: decision-evidence facts live in the repo
  (IR/packet); Notion renders/annotates them. Verdict vocabularies unified: row-level
  `adopt|adapt` ⇒ family `pick-one` (wrap as-is | wrap with changes); `already-have`/`park`/
  `drop` map 1:1; `bundle` is family-level only (storage).

## 2026-08-24 (bake-off reconciliation) — B1–B6, post-D17 adversarial pass

Both reviewers (Sol REWORK ×5; Grok 2× ratify-with-edits, 3× REWORK) convergently found the
five sheets named winners before rubric §0/§4 prerequisites existed. Full reconciliation:
`research/reviews/2026-08-24-bakeoff-reconciliation.md`.

- **B1.** All five family verdicts are **park-pending-canary**; the sheets stand as candidate
  screens whose slates define probe order. No adopt/pick-one is written to the atlas until the
  canary passes; only final park/drop values sync to Notion.
- **B2.** The **canary probe is the M1 gateway** (merged from both reviews): one offline Bun
  sidecar running F1 + one W1-manifest PDF through the full chain (CanonicalText →
  EvidenceBatch → ledger → dimension-keyed vector query → RDF projection → restricted proof →
  InferenceEvent → EvalReport), twice, with crash/restart between commit and projections,
  judged on replay identity, span/content equality, verified proofs, and **aggregate** budgets.
- **B3.** Corrections applied: workload contract v1.1 (corpus reality: 76 PDFs on disk; W1 is
  defined by a committed manifest, not a directory); shared-schema v1.1 (`CanonicalText` with
  UTF-16 offsets as the single span owner; `EvidenceBatch`/`EvidenceClaim` promoted into the
  contract).
- **B4.** Single-owner law for truth maintenance: **the ledger owns invalidation**; any
  reasoning engine (EYE included) is a batch oracle behind it. Embedding dimension is frozen
  only by the joint canary; vector tables are dimension-keyed.
- **B5.** Budget accounting is **bundle-level**: gate 5 is judged against the sum of loaded
  winners, never per family (storage 1,145 MB + EYE ~1 GB stacks and 175 MB + 259 MB ORT both
  bust ceilings — the per-family passes were vacuous).
- **B6.** In-repo defects surfaced by the pass are repo-issue candidates outside this packet:
  `@beep/duckdb` has no vector surface (claimed integration score retracted), Oxigraph adapter
  fresh-store-per-request + ignored `timeoutMs`, LangExtract relation drop, WinkBackend span
  fabrication, shacl-engine violating-fixture hang.
## 2026-08-24 (reconciliation grill) — G1–G7, ratified by Benjamin in /grilling rounds

- **G1 (canary staging).** The B2 canary runs staged, not monolithic: **C0** (days) parse →
  CanonicalText+loss-map → EvidenceBatch → ledger → EvalReport, replayable; **C1** +
  dimension-keyed vector query + RDF projection rebuild; **C2** + oracle proof decode + crash
  injection + full Tier-L budgets. A stage failing falsifies its families without blocking the
  spine. (Rejected: monolithic-as-reviewed; C0-only-then-replan.)
- **G2 (code home).** Graduate fast: BRIEF → MAP (canary = Goal 1) → graduate this week;
  scaffold the future apps/labs/semantica lab via create-package (`--app-kind tauri --lab`, headless-first
  per A5); canary code lives in the lab under the goal packet. (Rejected: scratchpad-first;
  slow shape review.)
- **G3+G5 (EYE role).** EYE is the **test-time correctness oracle** (defines gold conclusions +
  proofs; runs in C2/CI), not the product-loop runtime; the runtime path is the ledger-native
  substrate. Reconfirmed after the budget-crisis leg was retracted (see G4) — the architectural
  leg (full-rerun vs incremental ledger, unbuilt proof decode) suffices alone.
- **G4 (budgets re-anchored; amends B5 + workload contract).** The 2GB/250MB/600MB ceilings
  were an artifact of a hypothetical 16GB-laptop reference machine; the actual dev machine is a
  128GB/64GB-VRAM Threadripper (verified live). **Two-tier model:** Tier-L (lab hard bar):
  cold start <5s and p95 <100ms as interactivity gates; RSS/deps/model bytes measured with a
  generous alarm (16GB bundle RSS), not park triggers. Tier-D (distribution watchpoint): the
  laptop-class numbers demoted to telemetry recorded in every EvalReport so graduation to
  professional-desktop knows the portability bill. Budget accounting stays bundle-level (B5).
- **G6 (models: hosted-first).** Benjamin verbatim: "we don't worry too much about local models
  for now if we can avoid it. This is a lab after all." Embeddings and LLM extraction run
  hosted via the agents slice for M1; local-model machinery (Snowflake/ONNX lane, GPU/ROCm)
  stays a parked candidate, not an M1 workstream.
- **G7 (offline rescoped; amends workload contract).** Offline = **replay-offline, hosted-live**:
  every API result is cached content-addressed with full provider/model identity; the
  Document→KG→eval loop must re-run byte-stably from cache with network disabled; typed
  degraded states cover API-unavailable. Fully-offline live runs are no longer an M1 criterion.
  (Rejected: fully-offline M1; dropping offline entirely.)
- **Defaults ratified unobjected:** embedding dimension frozen only by the joint canary with a
  dimension-keyed alternate fixture; Oxigraph enters the canary as rebuild-from-ledger-per-run
  (its current per-request adapter shape is compatible at canary scale); atlas `already-have`
  stays on real bricks (adapter claims were the fiction); corpus expansion (367 undownloaded
  PDFs) parked, not a canary prerequisite.

## 2026-08-24 (opportunities grill) — O1–O5, ratified by Benjamin

- **O1 (repo defects).** The four verified in-repo defects (Wink fabricated span, LangExtract
  relation drop, Oxigraph ignored `timeoutMs`, shacl-engine hang) become GitHub issues: drafts
  prepared by a codex job into `research/drafts/repo-issues.md`, Benjamin reviews before
  posting. Fixes ride cleanup-on-touch, not this packet. (Rejected: fix-PR now — mid-packet
  scope creep; ledger-only — unfiled rot.)
- **O2 (upstream lane concretized).** Draft-and-hold: local branch `upstream/explorer-registry-
  fixes` cherry-picked onto upstream main in the workstation clone + drafted PR description +
  three drafted doc issues (`research/drafts/upstream-contributions.md`). Nothing is posted or
  pushed without Benjamin. (Rejected: stay-loose; post-canary campaign.)
- **O3 (atlas backlog gated).** Canary/graduation is the critical path. Templates ratify async
  on 3-4 exemplar rows; IR row-fill + 27 module analyses run as codex batches after template
  ratification; the D5 render/diff sync pipeline is a queued MAP candidate with re-entry
  trigger (semantica 0.6.7+ or atlas-edit need). (Rejected: parallel-from-today; atlas-before-
  canary.)
- **O4 (OSS ambition named).** MAP records two queued gated goals: standalone reasoning package
  (fires if the NET-NEW spike survives kill criteria AND matches the EYE oracle) and a
  publishable evals harness (fires if EvalReport + gold suite prove reusable beyond semantica
  inputs). Neither is promised-now; both are re-entry points per the graduation contract.
- **O5 (defaults, unobjected).** Six docs-drift findings added to the Notion Findings DB
  (operator run 3); IR extractor stays in `scratchpad/semantica-ir/` unless the sync goal
  activates; `<clone>/.claude/skills/semantica/SKILL.md` gets read during shape;
  `op`-prewarm lesson to machine memory; Notion-pilot workflow lessons to basic-memory at
  session close.

## 2026-08-24 (shape grill) — S1–S5, ratified by Benjamin in /grill-with-docs rounds

Taught first (private lesson 0001-five-decisions in the untracked docs-internal teach workspace),
then grilled. The 22 fetched-and-verified primary sources behind S1–S5 are listed in
[`research/SOURCES.md`](./research/SOURCES.md) §3; the decisions:

- **S1 (stop rule; amends contract v1.2 falsifier, BRIEF appetite).** No calendar appetite.
  Benjamin: "What is the need for a timeline? I don't see a reason to delay anything if
  prerequisite work & requirements are met." Kept Shape Up's circuit breaker, denominated in
  probes: each family gets its first-probe candidate; a stage failure buys exactly one more
  candidate; a second failure parks the family and drops the packet back to decompose.
  Wall-clock is Tier-D telemetry in every EvalReport. (Rejected: no stop rule at all — the
  contract's "the bundle or the shape is wrong" could never fire; two weeks as alarm-only.)
- **S2 (gold-label separation; amends contract gold section).** Self-enhancement bias is
  measured (Zheng et al. 2023; Panickssery, Bowman, Feng 2024). The gold-proposer's provider
  family must differ from the extraction run's, enforced as a schema refinement on `EvalRun`;
  the spot-checked fraction is committed as a number in `gold/v1`. Zero new code:
  `@beep/langextract` takes an injected `LanguageModel`; anthropic/xai/venice-ai/openai-compat
  Layers exist. (Rejected: informal spot-check; same model "fine for a lab".)
- **S3 (embeddings; amends G6 wording).** Contract = `effect/unstable/ai` `EmbeddingModel`
  (effect 4.0.0-rc.111; verified in `node_modules/effect/src/unstable/ai/EmbeddingModel.ts`).
  No Layer exists in-repo. Benjamin prefers OpenAI over Venice; Anthropic has no embeddings
  API. M1 Layer = a new `POST /embeddings` operation + `makeEmbeddingModelFromProvider` in
  `@beep/openai-compat` (its client already defaults to `https://api.openai.com/v1`); Venice/
  xAI become configs later. The lab owns `EmbeddingVector` + `ModelIdentity`, borrowing
  effect-ontology's `ProviderMetadata` dimension invariant. (Rejected: Layer in `@beep/venice-ai`
  — provider preference; Voyage as a new driver — NET-NEW client; app-local — pays twice.)
- **S4 (lab shape; refines D12/G2/A5).** `--app-kind tauri`, one local `cargo check` at
  scaffold time, `src-tauri` frozen through C0-C2, plus a hand-written `server/main.ts` and
  `src/runtime/Layer.ts` on day one (Professional Desktop's split) so the headless canary has
  a real process. (Rejected: service-kind now and re-scaffold — D12 churn; sidecar wiring in
  M1 — unproven in Labs CI, violates A5.)
- **S5 (C2 runtime reasoner; refines G3/G5).** ρdf closure: five predicates, six W3C rules
  (rdfs2, 3, 5, 7, 9, 11; Muñoz, Pérez, Gutierrez 2009, sound and complete) as `RdfsRule`
  values plus one explicit SKOS broader-transitivity rule, naive fixpoint, pure and replayable,
  emitting `InferenceEvent`s. Oracle agreement is judged at (conclusion, premise-set, rule),
  never proof-tree isomorphism (EYE nests `r:Extraction`/`r:Conjunction` steps we never emit).
  G-entailment splits into `G-entailment/rdfs` (gates C2) and `G-entailment/rules` (the ~20
  production-rule cases; gates the spike, where the v3 Rete salvage and the NET-NEW kernel are
  ablated against EYE). Decisive facts: the v3 `rete` has no proof objects and no truth
  maintenance (fails gate 8 as-is), is Effect 3.18 with mutable state and a React import; SKOS
  hierarchy is not RDFS entailment. (Rejected: Rete salvage as C2 runtime — weeks of engine
  work inside the canary; EYE as runtime too — reverses G3/G5, agreement becomes vacuous.)
- **S6 (research loop, open).** `RESEARCH.md` listed the `scratchpad/effect-ontology` deep read
  as still open; Benjamin re-raised it. A mapped, adversarially verified symbol → shared-schema
  family table is in flight (`research/effect-ontology-map.md` on landing); BRIEF goes to v1.0
  only after it folds in.
- **S3-rev (supersedes S3's mechanism, same provider).** After `bash scripts/setup-agent-memory.sh`
  re-linked `.repos/effect` → `<HOME>/YeeBois/dev/effect` (`Effect-TS/effect` main, 02a5146d69; effect-smol
  is retired as the v4 reference), the checkout showed `@effect/ai-openai` 4.0.0-rc.111 already
  ships `OpenAiEmbeddingModel.layer({ model, dimensions })` (provides `EmbeddingModel` +
  `Dimensions` over `OpenAiClient`), and it is already a root dependency. No `/embeddings`
  operation is written anywhere. Doctrine home (`03-driver-boundaries.md`; desktop precedent
  composes `AnthropicLive`/`makeAnthropicLanguageModelLayer` from `@beep/anthropic`): a new
  `@beep/openai` driver via `beep create-package`, mirroring `@beep/anthropic` (typed config with
  `op://` key ref, `OpenAiLive = OpenAiClient.layerConfig(...)` + `FetchHttpClient`,
  `makeOpenAiEmbeddingModelLayer`, `makeOpenAiLanguageModelLayer`); the lab composes it in
  `src/runtime/Layer.ts`. Also supplies S2's second provider family. (Rejected: app-local
  composition of `@effect/ai-openai` — drift from the driver boundary; keeping the openai-compat
  op plan — duplicates shipped Effect code.)
- **Mission confirmed** for the private, untracked docs-internal teaching workspace.

## 2026-08-24 (PR #794 review closeout) — S7–S8, review amendments

Applied while closing the shape PR's review threads (Codex P1s, verified against the tree);
Benjamin's merge of #794 ratifies them. Both tighten the canary without changing its shape.

- **S7 (extractor tripwire timing; amends BRIEF C0/C1).** BRIEF v1.0 wrote the Extractor verdict
  at C0 but scored G-relation only at C1, so an extractor with the known LangExtract relation-drop
  defect could earn a verdict before the tripwire ran. Now C0 runs over F1 + the three G-relation
  W1 papers and scores G-structure, G-entity and G-relation; the Extractor verdict and the
  tripwire live in the same stage. C1 keeps rebuild identity and dimension keying. (Rejected:
  defer the Extractor verdict to C1 — spreads one family across two stages.)
- **S8 (oracle agreement; amends S5).** Comparing `(conclusion, premise-set, rule)` false-fails
  when an entailment has two valid derivations (two subclass paths) and EYE and the fixpoint pick
  different sound supports. The C2 gate is now closure equality on the conclusion set plus
  validation of every `InferenceEvent` against its own rule (premises present in inputs or
  closure, rule instance correct). EYE supplies the gold conclusions and is a spot-check oracle;
  its premise choice is not a spec. (Rejected: enumerate all minimal supports — spike-grade work;
  shared canonicalization first — same.)
- **Clarifications from the same review:** the D13 charter line now distinguishes construction-
  side derived projections (C1's rebuild-from-ledger proofs, lab-owned) from consumption-side
  retrieval/analytics/UX (`trustgraph-workbench`); `VerifiedSpan` lives in `@beep/langextract`
  (`@beep/langextract/VerifiedSpan`), not `@beep/nlp-processing`; the scaffold command carries the
  `--description` that `--lab` requires.

## 2026-08-24 (tracker sweep) — T1–T3, ratified by Benjamin

Source: [`research/upstream-tracker-mining.md`](./research/upstream-tracker-mining.md) (725-item
sweep, skeptic RATIFY-WITH-EDITS applied) and its six open questions; Benjamin answered in one
round.

- **T1 (evals gate wording; refines O4).** The queued evals-harness gate fires only when the lab
  proves a schema-validated `EvalReport` + gold-proposer ≠ extractor (S2) + replay identity (G7)
  reusable beyond semantica inputs. Upstream's live runner PR #1090 landing does not touch the
  gate; the gate is about the report contract, not a runner.
- **T2 (MAP rule: never wait on overlapping upstream PRs).** Duplicates are routine upstream
  (RETE #1077 vs catalog twins, SHACL docs #1158 vs #1150, Turtle escape #1148 vs #1122). The
  port decides from the shared schema; which upstream PR lands is telemetry for the atlas, not a
  MAP dependency.
- **T3 (benchmarks skim).** The relocated eval suite (#607, #570–#575, out-of-tree repo) is
  skimmed by one bounded Grok lane for `EvalReport` metric vocabulary only
  (`research/benchmarks-vocab.md`); it is not a W1 corpus change. **Landed the same day:** the
  sidecar repo is not fetchable (404 on both URLs, absent from the org), and the last in-tree
  snapshot is a pytest-benchmark throughput harness, not a correctness suite. Verdict: gold sets
  G-structure/G-entity/G-relation/G-entailment unchanged; the `EvalReport` metric vocabulary
  adopts the *names* from issue #574 (entity span F1 over CanonicalText spans, REBEL-style
  end-to-end triple F1 over Statements, pairwise F1 + B-Cubed over Entity clusters) and nothing
  else from that harness.
- **Upstream posting (extends O2).** Prepare for Benjamin's review: one upstream PR carrying the
  three danklocal Explorer fixes (dedupe: DELETE and URL-key unreported; persist cousin-matched
  #376/#1134; cite #518 as the registry spec); a new upstream issue for the simulated
  HermiT/Pellet consistency checks (zero tracker hits, unique D6 finding); a comment on #1090
  for the evals docs contradiction instead of standalone doc issue 2. Doc issue 3's rewrite is
  not chosen yet. Nothing posts without him.
- **PR vehicle.** #794 merges first (his merge); the sweep lands as a follow-up docs PR from
  `main`.

## 2026-08-24 (MAP grill) — M1–M6, ratified by Benjamin in /grill-with-docs rounds

Source: `MAP.md` v0.1's five ⚠ challenges plus one doctrine collision found while grilling; a
ten-agent fact-find (six finders, four skeptics, all verdicts held) grounded every question in
live source before it was asked. Two rounds; every answer took the recommendation.

- **M1 (PDF probe + span owner; supersedes "PDF.js/MuPDF tie", shared-schema v1.1 `CanonicalText`,
  BRIEF rabbit hole 1).** `@beep/doc-text` returns one already-normalized string (PDF.js NFKC
  of ligatures/NBSP/µ, then `unpdf` whitespace collapse) with no items, offsets or per-page text,
  so no raw→canonical loss map can be derived from it — and repo doctrine says none should be:
  `goals/citation-verified-span-substrate` constraint 4 makes the extracted raw text canonical
  and normalization locator-only; `SourceTextIdentity` (textDigest + extractor{name,version}),
  `TextAnchor` (UTF-16 half-open, width-checked) and `verifyTextAnchor` already own span
  meaning, and the product pipeline digests doc-text's exact string. **Answer:** compose, do not
  build. `CanonicalText` = `ResolvedSourceText`; spans = `TextAnchor`; C0's "every span slices
  back" tripwire = `verifyTextAnchor`. First PDF probe = `@beep/doc-text`; breaker retry =
  direct `unpdf` text items (`disableNormalization: true`) inside the lab; MuPDF parks (AGPL).
  Lab-local NET-NEW is now `EvidenceBatch`, `ModelIdentity`, `ConflictWitness`
  (`ContradictionCandidate` in `@beep/epistemic-domain` is the witness precedent; epistemic
  `Activity`/`UsageRecord` are the ledger's write-model precedents). **Rejected:** a second
  normalized text as its own derived `SourceTextIdentity` (unprovable spans, second identity per
  document); keeping the brief's NET-NEW `CanonicalText` (rebuilds three live bricks).
- **M2 (Handoff span drop; O1 exception).** Verified: `AnnotatedDocument` is
  `{chunks, entities, provenance, relations, version "nlp-ir/1.0"}`; `Entity.mentions` is bare
  `MentionId[]`; the langextract adapter mints unresolvable ids and never reads
  `extraction.span`/`matchedText`; `@beep/law-practice-use-cases` already bypasses the envelope.
  Blast radius is one producer and one test reader. **Answer:** fix the mention/span drop now in
  its own small PR (required `mentions: S.Array(Mention)`, version `nlp-ir/1.1`, `Mention.text` =
  `matchedText`, tests prove `slice(span) === text`). Relations stay repo-issues Draft 2. The lab
  does not consume the envelope either way (claims build from `GroundedExtraction` + `TextAnchor`).
  **Rejected:** fixing relations in the same PR (target kind through alignment = model change);
  leaving it for cleanup-on-touch (Benjamin: "I prefer getting ahead of things").
- **M3 (`@beep/openai` packet; corrects MAP challenge 1 and S3-rev).** The driver is justified:
  `@beep/openai-compat` is a hand-rolled `/chat/completions` protocol driver with no `@effect/ai`
  dependency and no embeddings surface, while `OpenAiEmbeddingModel`/`OpenAiLanguageModel`
  require `@effect/ai-openai`'s own `OpenAiClient` (`/responses`, `/embeddings`). The MAP's
  "every existing driver has its own goal" premise was false (`@beep/anthropic` shipped as a P1
  slice of `workspace-thread-domain`; tika/libpff/doc-text were folded). **Answer:** own packet
  anyway, for the honest reasons — the lab is ceremony-exempt while a drivers package pays
  docgen/JSDoc/coverage/changeset (folding gives Goal 1 two quality regimes), the driver PR runs
  beside C0 with no lab dependency, and the completion gate is per-packet. Template weight
  (pretext-driver precedent). SPEC: mirror anthropic's role files minus `repair.ts`; expose
  `OpenAiEmbeddingModel.model()` for `Dimensions` (`.layer` yields `EmbeddingModel` only — S3-rev
  was wrong); key-only config `AI_OPENAI_API_KEY` / `AI_OPENAI_MODEL` / `AI_OPENAI_EMBEDDING_MODEL`;
  no `apiUrl` knob (base-URL is openai-compat's role). **Rejected:** fold as a `targetPackages.drivers[]`
  slice with an `ops/handoffs/` file.
- **M4 (atlas gate; restores O3).** MAP v0.1 gated the whole atlas backlog on C0. O3 already says
  templates ratify async, row-fill and analyses run as codex batches, and only the D5 sync
  pipeline is the queued candidate. **Answer:** O3 verbatim — `semantica-atlas-sync` = the D5
  render/diff sync pipeline, re-entry "semantica 0.6.7+ or atlas-edit need"; template/row-fill
  work is async and not a goal; B1 still holds for verdict values. **Rejected:** C0 gate; C2 gate.
- **M5 (three PRs).** PR A = the Handoff fix (code, own branch, independent). PR B = docs-only
  ceremony: MAP v1.0, BRIEF v1.1 + shared-schema v1.3 amendments, both goal packets from
  `goals/_template` (`openai-driver` `active`, no dependency edge), exploration `graduated` with
  the held items logged DEFERRED, ATLAS → Graduated, goals index regenerated, ROADMAP clause,
  pdfjs attribution note. PR C = `create-package semantica --lab` mint + hand-written
  `server/main.ts` + `src/runtime/Layer.ts` = `semantica-canary` P1 step 1 (labs doctrine: a new
  lab passes its lab lane on its own PR; #742 precedent). **Rejected:** folding the fix into the
  ceremony (docs lane becomes a code PR); one PR for everything.
- **M6 (ROADMAP funnel policy drift).** `docs/ROADMAP.md` requires a free lane slot to scaffold
  a goals packet; all three NOW lanes are occupied; #773/#779/#781/#782 graduated without
  touching ROADMAP and none of their packets appear in it. **Answer:** amend the funnel policy
  in PR B — a lab-hosted canary packet (ceremony-exempt, ships no product scope) does not consume
  a lane slot and is listed under a Labs line in NOW; `openai-driver` rides as its enabling
  driver; the four unlisted graduations are recorded as drift for the next re-eval.
  **Rejected:** follow precedent silently; claim a real lane (forces a portfolio decision the
  canary does not need).

DEFERRED (Graduation Contract point 2; carried into the goal packets as re-entry items, not open
questions): upstream posting of `research/drafts/*` (O1/O2/T3 — Benjamin's call, no date);
Rosetta ratification (`research/glossary-rosetta-draft.md`, rides with the async atlas batches);
Explorer/UI milestone shape (decided inside `semantica-canary` SPEC per D16).

## 2026-08-24 (PR #802 review closeout) — R1–R3, review amendments

Source: three P1 findings from the Codex review of PR #802 on `goals/semantica-canary/SPEC.md`,
each a loophole in the ratified acceptance wording rather than a new decision.

- **R1 (report digest vs telemetry; amends G4, G7 and S1's "telemetry in every EvalReport" / "byte-stably" wording).** "Byte-identical `EvalReport`s" could not hold while the
  report carried wall-clock and other Tier-D telemetry. **Answer:** `EvalReport` is the
  replay-stable, content-addressed payload (`reportDigest` = sha256 over the canonical JSON of
  the report body with the `reportDigest` field omitted); per-run numbers move to an
  `EvalRunTelemetry` sidecar that references the digest and is never compared for identity.
  Tier-L bars are read from the live run's sidecar. Shared-schema v1.4, contract v1.4.
- **R2 (full-W1 gate per stage).** C0's gold-scored pass used three papers and no later stage
  required the 25-paper manifest, so family verdicts could rest on a biased subset. **Answer:**
  every stage pass also requires the full W1 manifest + F1 to run end-to-end live and replay
  with equal digests and zero unexpected typed-degraded document failures — the F1 malformed specimens are expected to decode to their declared degraded states; any W1 paper degrading fails the gate — before any verdict is written.
- **R3 (C1 semantic content).** Rebuild identity alone passes on empty projections. **Answer:**
  a small `G-projection` gold set (known kNN neighbour pair, non-empty SPARQL result sets over
  F1 + one W1 paper) must match before rebuild identity is checked; empty or mismatched
  projections fail C1.

## 2026-08-26 (C0 probe breaker) — Extraction parks; re-enter at decompose

Source:
[`goals/semantica-canary/history/p2-c0-probe-breaker.md`](../../goals/semantica-canary/history/p2-c0-probe-breaker.md).

- The first hosted hybrid candidate appeared to pass live/offline identity and
  non-zero relation coverage on the first two frozen G-relation papers, then
  failed `06c93f91ef3d` because its 16 semantic relation candidates contained
  no verbatim canonical relation span. Review later invalidated those apparent
  passes: repeated entity surfaces had been assigned their first occurrence,
  and none of the first paper's 6 exact relation texts had two uniquely
  grounded endpoint claims.
- The single retry required a verbatim contiguous evidence span plus exact
  endpoint surfaces. It returned 7 closer relation candidates, but still no
  exact canonical relation span; PDF line boundaries, punctuation, or wording
  remained normalized. The same typed report gate failed.
- The final unique-alignment code replayed that retry candidate on
  `057e356e94f8` live and offline. Its 9 relation candidates contained zero
  exact canonical spans, and both runs failed the same typed report gate. No
  review-safe C0 vertical slice passed.
- **Answer:** Extraction is `park`. Pattern-only cannot rescue the tripwire
  because it declares relation extraction unsupported. Input does not receive
  a verdict because C0 did not pass. The exploration returns to `decompose` to
  define a relation value/evidence contract or a bounded chunk-scoped
  candidate without weakening `TextAnchor` verification. C1, C2, and R2 did
  not run.

## 2026-08-27 (decompose) — the evidence-quote relation candidate

Source: a zero-spend forensic session replaying the three breaker cache
entries against freshly regenerated canonical text, plus hydration of the
frozen gold/v1 relation labels from their offsets. Measured findings:

- The probe's 16 relation candidates were all synthesized sentences; none
  exists in the source at any tier. The retry's 16 candidates across both
  inspected papers contained zero verbatim spans, but 10 of 16 differ from a
  true source span only by whitespace or end-of-line hyphenation. The
  first-probe response on `057e356e94f8` held 6 verbatim relation texts, all
  citation strings; 13 of its 14 candidates had at least one endpoint surface
  occurring 2 to 15 times, which is what unique alignment rejected.
- Clean-text control: the same extractor grounded relation claims on five of
  the six parseable F1 fixtures in one run. The failure class is verbatim
  grounding against PDF canonical text, not relation extraction ability.
- Gold convergence: every hydrated gold/v1 relation label on the two
  inspected papers carries an evidence quote whose subject and object spans
  sit inside it, and the predicates are document-metadata classes (authored
  by, affiliated with, located in, published in proceedings of, claim
  lineage), often grounded in author-block layout adjacency rather than
  sentences. The parked candidate hunted content relations (uses,
  outperforms, trained on), which explains a relation triple-F1 of 0 even on
  accepted claims.

Decisions, grilled and locked 2026-08-27:

- **E1 (fold alignment tier, capability).** `@beep/langextract` gains a
  fourth deterministic alignment tier beside exact, lesser, and fuzzy:
  minimal fold. Whitespace runs collapse; an end-of-line hyphen is tried both
  ways (dropped for a split word, kept for a compound); the unique-occurrence
  rule applies across all fold variants; the stored match is always the raw
  canonical slice, so `TextAnchor` verification is untouched. The lesser tier
  already implements normalize-with-offset-maps, so this is a sibling, not an
  invention. The existing fuzzy tier is disqualified for relation evidence:
  it admits citation-marker rewrites at 0.92 similarity.
- **E2 (relation evidence contract, lab-local).** A relation candidate must
  decode subject, object, and an evidence quote; the evidence quote is what
  aligns, and a malformed candidate fails typed at parse, before alignment.
  The capability stays a generic port; promotion of any relation contract
  waits for a canary pass.
- **E3 (endpoint grounding inside the evidence span).** Endpoint surfaces
  anchor at their occurrence inside the relation's aligned evidence slice.
  Identity linkage to same-batch entity claims stays surface-based for eval
  triple matching. Global uniqueness remains the rule for non-relation
  claims; the evidence span, itself globally unique under fold alignment,
  scopes the endpoint search and dissolves the frequent-surface failure.
  Clarification (review, 2026-08-27): gold's own anchor offsets sometimes sit
  outside their evidence slice (the `06c93f91ef3d` affiliations reuse the
  first `130-154` object occurrence for quotes starting at 155, 194, and
  237), and that does not constrain the model: eval triple identity compares
  endpoint surfaces and predicate strings, never anchor positions. Measured:
  all 13 frozen gold evidence quotes contain both endpoint surfaces, so
  every frozen triple is expressible under this rule.
- **E4 (target enumerates the frozen predicate vocabulary).** The relation
  extraction target names the frozen gold/v1 predicate strings verbatim: the
  13 labels use exactly `affiliated with`, `affiliated_with`, `authored by`,
  `located in`, `published in proceedings of`,
  `re-evaluates claim due to`, `selected`, and `shows`. Two of those are
  content relations and one is an underscore spelling variant, so a
  metadata-classes summary is wrong and the evaluator compares predicate
  strings exactly. The prompt names the frozen strings, never specific
  answers; predicate normalization (the underscore variant) is a candidate
  for the E6 annotation pass, and until repaired the target uses the frozen
  strings verbatim. Gold defines the task and the metric is triple F1
  against gold by design, so this is task definition, not leakage.
- **E5 (zero-spend preview gates the probe).** The three cached breaker
  responses replay through the new contract offline first. The paused packet
  resumes only if the preview grounds at least one relation on at least one
  paper. The preview is a floor, not a forecast: those responses answered the
  old prompt, and the gold-shaped affiliation candidates are absent from
  them.
- **E6 (probe waits for the operator spot-check, and the pass repairs).**
  The live probe runs only after the operator annotation pass on gold/v1.
  The pass is widened beyond the earlier c0-design spot-check contract
  (which edited only `spotCheckedFraction` and per-item `verified` flags):
  it may repair labels, meaning correct or drop invalid triples (the known
  date-as-venue label in the `057e356e94f8` relation subset) and normalize
  predicate spellings (the `affiliated_with` variant), after which label
  digests and the gold reference digest are recomputed and re-frozen. This
  supersedes the c0-design wording; scoring a new candidate against
  known-invalid gold would waste an S1 shot on annotation noise.
- **E7 (delivery order and candidate identity).** Docs PR carrying this
  entry, then a capability PR for the fold tier with its changeset, then a
  lab PR for the contract, endpoint rule, target, and preview harness. The
  candidate's identity is the extraction artifact hash over a versioned
  candidate descriptor: the rendered prompt plus the relation contract
  schema identifier, the alignment tier configuration, and the endpoint
  policy. A rendered-prompt hash alone would let a fold or contract revision
  run different semantics under the same identity and defeat slate
  accounting.
- **E8 (bounded re-entry).** S1's probe-plus-retry budget is per slate
  candidate, but re-entry is not unbounded: the evidence-quote candidate is
  the Extraction family's single decompose re-entry for C0. If it exhausts
  its probe and retry, the family parks terminally for this exploration;
  any further candidate requires an explicit operator ratification recorded
  here, not another silent slate row. This closes the loop the breaker left
  open, where a packet could park, rename a row, and pay for probes
  indefinitely.

## 2026-08-30 (evidence-quote gates) — E9

- **E9 (E5 and E6 cleared; P2 resumes).** The committed zero-spend preview
  replayed all three breaker responses through the production grounding
  boundary and grounded 10 relations on two papers. The annotation pass
  reviewed all 13 proposed relation labels and all nine proposed abstract
  labels. It dropped the date-as-venue triple, normalized
  `affiliated_with` to `affiliated with`, and standardized abstract gold on
  the exact heading span. The gold codec recomputed edited slice digests;
  the 18-file reference is refrozen at 21/377 reviewed labels with digest
  `9321c57c92402fba398ff226a178d9bc2922bb48f116f892fd8584a44ad72f29`.
  The E5/E6 gates therefore clear and `semantica-canary` returns to active
  P2. No live probe was spent by the preview or annotation pass; E8's one
  probe plus one retry remain.

## 2026-08-30 (C0 pass) — Input and Extraction verdicts

Source:
[`goals/semantica-canary/history/p2-c0-r2.md`](../../goals/semantica-canary/history/p2-c0-r2.md).

- **Input: `pick-one`.** The first-probe C0 stack parsed every F1 fixture and
  all 25 W1 papers through its declared media path. The full live and replay
  reports had zero unexpected degradation and zero failed anchors. The
  born-digital PDF winner is `@beep/doc-text`; the direct-`unpdf` retry was not
  used, and MuPDF remains parked.
- **Extraction: `pick-one`.** The selected family contract is hybrid: hosted
  LangExtract-shaped extraction uses the evidence-quote contract with exact,
  uniquely scoped endpoint grounding; Wink supplies the fail-closed pattern
  comparator and declares unsupported structure and relation losses. The
  three relation papers emitted 10, 9, and 9 hosted claims. The full 34-document
  live and offline reports were byte-identical at digest
  `7d1918096fc2ae893b9257a0a84aeb7def1cad7bf8f4d5c8add13c660faf210a`.
  The retry was not used. The legacy relation-dropping handoff and Wink's
  fabricated-span adapter remain parked; they are not the selected boundary.

## 2026-08-31 (C1 pass) — Storage and Embeddings verdicts

Source:
[`goals/semantica-canary/history/p3-c1-r2.md`](../../goals/semantica-canary/history/p3-c1-r2.md).

- **Storage: `bundle`.** The authoritative file-backed PGlite ledger rebuilt
  into dimension-keyed DuckDB exact-vector tables and a fresh Oxigraph RDF
  view. The committed G kNN and SPARQL witnesses passed before rebuild
  identity; alternate three- and four-dimensional fixtures proved keying; the
  full 34-document live and replay reports were byte-identical at digest
  `90bf21c551bb764c2e07a1985929a54c7e185ce01e7933436cc2b65c63551510`;
  and both rebuilds produced an empty `QuadDelta`. PGlite adjacency and proof
  tables remain the C2 bundle component. ANN, DuckDB VSS, pgvector-on-PGlite,
  and persistent RDF stores remain contingent rather than selected.
- **Embeddings: `pick-one`.** The selected C1 boundary is the hosted
  `@beep/openai` embedding Layer with `text-embedding-3-small` revision
  `text-embedding-3-small@2024-01-25`, content-addressed live results, and
  cache-only offline replay. `DegradedEmbedding` is the only declared failure
  state. All 4,837 full-W1/F1 chunks replayed with zero unexpected degradation,
  and dimension 1,536 is frozen from this stage onward. The local
  Snowflake/ONNX lane stays parked for its separate same-model runtime probe;
  it is not implied by this hosted-live/replay-offline verdict. The retry was
  not used.

## 2026-08-31 (C2 pass) — Reasoning verdict

Source:
[`goals/semantica-canary/history/p4-c2-r2.md`](../../goals/semantica-canary/history/p4-c2-r2.md).

- **Reasoning: `pick-one`.** The selected C2 boundary is the lab-local
  declarative rho-df fixpoint with content-addressed `InferenceEvent` proof
  DAGs and restricted EYE as a test-time oracle only. All seven committed
  conclusion/proof cases passed, every event validated against its own rule,
  the real PGlite commit/SIGKILL/fresh-process rebuild probe reproduced its
  projection digest, and the 34-document live and replay reports were
  byte-identical at digest
  `2a2089eacaa7f341649b6e1d86991fda526f5d9708e9eaa1f4e9d06e0533b5d1`.
  Live cold start was 1,183 ms and interactive p95 was 7 ms, clearing Tier-L
  (corrected 2026-09-02 from the archived sidecar; the entry originally quoted
  1 ms and 3 ms from an earlier probe); the retry was not used. EYE is not a runtime dependency. `G-entailment/rules`,
  the v3 Rete salvage, and the proof-ledger kernel remain the separately gated
  reasoning spike and re-enter at `decompose`.

## 2026-09-02 (P5 close) — packet closeout and successor re-entry

- All five family verdicts are dated entries in this file. Input and
  Extraction were recorded in the 2026-08-30 C0 entry. Storage and Embeddings
  were recorded in the 2026-08-31 C1 entry. Reasoning was recorded in the
  2026-08-31 C2 entry.
- `semantica-canary` flips to `completed-retained` in this closeout change.
  Its checksum-controlled evidence inventory and reflection remain under
  `goals/semantica-canary/history/`.
- The closeout audit found that the merged C2 archive lagged the ratified
  full-state run: the C2 entry above cites digest
  `2a2089eacaa7f341649b6e1d86991fda526f5d9708e9eaa1f4e9d06e0533b5d1`, but the
  commit archiving that run was never pushed before #938 merged, so main held
  the earlier `7fff1dc0…` run until the follow-up archive PR landed it. The
  archive, `p4-c2-r2.md`, and the verdict now agree; its telemetry records
  live cold start 1,183 ms and p95 7 ms, superseding the entry's "1 ms / 3 ms"
  figures from an earlier probe. The Reasoning verdict remains a pass.
- Per MAP Sequencing 5 and the Explore graduation contract, the C2 pass fired
  the queued `semantica-storage-inversion` gate (its only precondition) and
  satisfied the first of `semantica-reasoning-spike`'s two preconditions; that
  spike still needs a committed `G-entailment/rules` fixture, which does not
  exist yet. The exploration re-enters at `decompose` with both bounded spikes
  as its open questions. This closeout scaffolds neither successor.
- Final atlas values: six catalog rows (`sqlite-vec`, `PgVector`, `Apache AGE`, `BGE`,
  `DoclingParser`, `ml`) were set to `park` in the Notion atlas after the verdicts were
  confirmed; no `drop` was warranted. Evidence and the not-written list live in
  `goals/semantica-canary/history/p5-atlas-sync.md`. Row-level `adopt`/`adapt`/`already-have`
  values are unblocked by the passed canary and remain with `semantica-atlas-sync` (O3/M4).
- Those unblocked positive row values are the "atlas-edit need" that O3/M4 name as
  the `semantica-atlas-sync` re-entry trigger, so that gate joins the two spikes as
  the exploration's third open question. Nothing is scaffolded for it either.

## 2026-09-03 (decompose re-entry) — bounded spike proposals R1–R3 (PROPOSED, pending ratification)

Source: `MAP.md` §Re-entry Decomposition (v1.1). Every capability cell was re-verified
against the live checkout at `a1652c1923`, then a Sol (GPT-5.6, medium) adversarial pass
returned REWORK with eight P1s
([`research/reviews/2026-09-03-sol-reentry-review.md`](./research/reviews/2026-09-03-sol-reentry-review.md));
each was re-checked against source and folded (review fold below). These are proposals with
a recommended answer first; they become law only when Benjamin ratifies them here.

- **R1 (storage-inversion: tombstone ≠ erasure).** *Recommended:* keep `Invalidated` as
  claim-targeted logical retraction (the body exists in `src/schema/Provenance.ts`, emitted by
  no Layer); its reach is derived, not stored — `claimQuads` bridges a claim to the
  content-addressed `StatementId`s the reasoner consumes, and every `InferenceEvent` whose
  recorded local premises transitively include a retracted statement is removed on rebuild.
  Add two physical events: `Redacted`, targeting a `DocumentId` with a ledger-computed erasure
  closure (document, parse-outcome, chunk, batch, claim and conflict rows; provider-cache
  entries via a new reverse index; the events naming it keep `(id, prev, bodyDigest)` and drop
  `payload`), and `Compacted`, folding a chain prefix into a content-addressed snapshot that is
  the trust root. The chain property is continuity from the last checkpoint, checked by a
  NET-NEW validator (prev exists, unique head, recomputable ids after the checkpoint). Probes
  P-S0 entry check (cache-only regeneration reproduces `2a2089ea…`), P-S1 retraction, P-S2
  compaction plus erasure (compaction alone keeps the digest; erasure equals a cache-only run
  over the manifest minus the document), P-S3 desktop storage with SIGKILL mid-compaction —
  one S1 candidate, all replay-offline. *Rationale:* a desktop user's "delete" is erasure,
  which neither a tombstone nor one nulled event payload satisfies, and a redacted event's
  id cannot be recomputed, so the honest chain claim is checkpoint continuity. *Rejected:*
  in-place `DELETE`/`UPDATE` of claims (violates the ledger law and C1 rebuild identity);
  tombstone-only (leaves erasure unanswered); event-id-targeted redaction (misses the rows the
  read path actually consumes); "chain still verifies end to end" (false under the live
  `(prev, body)` preimage); a fresh hosted run as fixture.
- **R2 (reasoning spike: the fixture is P1).** *Recommended:* amend the v1.0 precondition
  "`G-entailment/rules` fixture committed" into the spike's own first phase, because no
  packet owns it (the canary is completed-retained and its SPEC constraint 11 excludes the
  suite). P1 opens with a schema-first `g-entailment-rules/v1` tagged family (case,
  expectation, witness — the rdfs/v1 classes are pinned and carry none of the needed fields),
  then twenty cases in five classes (join, recursion, retraction, budget, contradiction; four
  each) generated by extending `scripts/generate-g-entailment.ts` under the same EYE pins.
  EYE gold is separated from lab-owned expectation per class: R-c uses two EYE closures
  (with and without the retracted premise); R-d uses EYE's complete closure for the unbudgeted
  run and a deterministic truncation witness for the budgeted run; R-e uses EYE derivability
  of both statements plus a statement-level conflict witness distinct from the claim-level
  `ConflictWitness`. No negation class in `gold/v1` until restricted EYE is shown to accept
  scoped negation. The adhd first-step probes are P2–P4 with their kill criteria unchanged;
  the v3 `rete` salvage enters at P3 and needs the archived `beep-effect-logos` root located
  first (absent from the recorded workstation path on 2026-09-03). One S1 candidate.
  *Rationale:* a precondition without an owner is a deadlock, and the fixture is exactly the
  bounded, engine-free slice a spike should open with. *Rejected:* building the fixture
  inside the retained canary; reusing `GEntailmentExpectation` as-is (pinned schema version,
  no fields); "truncated equals EYE untruncated" as one expectation (incoherent); waiting for
  the archive before any fixture work (P1 and P2 do not need it).
- **R3 (atlas-sync: verdict lane now, facts lane later).** *Recommended:* split D5. The fired
  need is decision data (A9): the four rows P5 declined for lack of positive vocabulary
  (`Oxigraph (embedded)`, embedding-model `OpenAI`, `pattern`, `llm`) plus any
  `already-have` row whose counterpart is a shipped `@beep/*` package. Write them from a
  schema-validated `research/atlas/verdicts.json` (`atlas-verdicts/v1`) via the P5 method
  (render, diff, canary write, apply, read-back), carrying `Beep counterpart` with each
  positive `Verdict`, zero new rows or schema. The IR-driven facts lane stays queued on the
  0.6.7+ trigger; the extractor survives in git history (`fd560ca8e5`, deleted by #882) and
  its lawful home is that lane's question. The Verdict map's "today only final park/drop"
  cell contradicted the later Atlas-writes row; it is amended above for coherence (later
  entries win by this file's own rule). Notion access was not live-verified this session.
  *Rationale:* the Python extractor is not on the verdict path, so the bounded answer is
  hours of docs-plus-Notion work, not a pipeline. *Rejected:* rebuilding the IR pipeline
  first (M4 made it async, and nothing in the fired need reads it); writing verdicts without
  counterparts (the failure mode D3 exists to prevent).
- **Sequencing (proposed):** verdict lane → storage spike → reasoning spike, with the
  fixture's retraction class (R-c) sequenced after P-S1 because both share the tombstone
  law. Three goal packets as v1.0 named them; `semantica-atlas-sync` at template weight.
- **Review fold (Sol P1s, all verified against source before folding):** (1) `Invalidated`
  targets `ClaimId` while proof nodes use `StatementId` — bridged through `claimQuads`;
  (2) `(id, digest)` after payload removal is a commitment, not a proof — chain claim weakened
  to checkpoint continuity plus a validator; (3) one event's payload is not a document —
  `Redacted` now targets a `DocumentId` with a computed closure, and the erasure gate
  compares against a manifest-minus-one replay; (4) `CrashProjectionInput`/
  `CrashIdentityWitness` live in `Reasoning.ts`, not `Projection.ts` — cell corrected;
  (5) `GEntailmentExpectation` cannot carry the rules fixture — NET-NEW tagged family;
  (6) R-d/R-e oracle semantics split; (7) S8 permits retraction over recorded local
  premises and S1 buys one candidate, not one retry per probe — kill clause and budget
  rewritten; (8) Verdict map cell amended. Unverified and kept as named risks: PGlite
  `VACUUM FULL` reclaim under Bun, current Notion authentication, and the O3 version
  trigger.
- **Deferred:** the facts-lane extractor home (queued lane); a negation class for the rules
  fixture (typed gap until restricted EYE is checked); the O3 version trigger itself (the
  local `danklocal` checkout is 0.6.6 at `add1c006`; upstream was not polled this session).

## 2026-09-03 (ratification grill) — R1–R3 RATIFIED with amendments: round 1 (R0.a, R1.a, R1.b, R1.f, R2.a, R3.f); round 2 RATIFIED (R1.c, R1.e, R1.g, R2.b, R3.a); round 3 RATIFIED (R1.d, R2.c, R3.b, R3.c, R3.e, R3.g); round 4 RATIFIED (R2.d, R2.e, R3.d amends the packet); round 5 RATIFIED (R2.f); round 6 RATIFIED (R2.g, R1.h, R1.i: the Sol critic's additions); round 7 RATIFIED (R4.a, close) — frontier empty

Benjamin is ratifying the v1.1 re-entry proposals in a grilling session run over the teaching
lesson for R1–R3 (private artifact; teaching workspace outside the repo), one frontier round at a
time. Every settled answer lands here as Question / Answer / Rationale with the rejected options.
Sub-decision ids match the lesson and the round table there.

- **R0.a (S1 wording; amends the Current-law Stop rule row).** *Q:* the dated S1 entry says a
  stage failure "buys exactly one more candidate"; the Current-law row said "first-probe
  candidate, one retry, then the family parks", and the table wins over the log. Which is law?
  *A:* one redesigned candidate. The Stop rule row is amended above to the S1 entry's wording.
  *Rationale:* a retry of an unchanged candidate cannot answer a design-caused failure; both
  spikes budget against this wording, so it had to be settled before R1.e and R2.f. *Rejected:*
  one unchanged retry (a design fault fails twice); one retry then one redesign (enlarges the
  breaker; the inflation the Sol review struck).
- **R1.a (`Invalidated` stays claim-targeted; reach derived).** *Q:* does `Invalidated` remain a
  `ClaimId`-targeted logical retraction whose reach to `StatementId`s and `InferenceEvent`s is
  derived at rebuild through `claimQuads` and the recorded local premises, with nothing stored?
  *A:* yes. *Rationale:* the bridge is deterministic and already exists as a module-private
  const; storing reach would add a derived table that must stay identical under rebuild, and
  R-c can share the same law only if it is derived. *Rejected:* a persisted claim-to-statement
  lineage table; retargeting `Invalidated` to `StatementId` (loses the claim as the unit a user
  retracts).
- **R1.b (`Redacted` is document-targeted with a computed closure).** *Q:* is physical erasure a
  new `Redacted` event targeting a `DocumentId` whose erasure closure is computed from the ledger
  (derived rows deleted, provider-cache entries via a new reverse index, named events kept as
  `(id, prev, body_digest)`)? *A:* yes, with the closure extended to run outputs: the Sol
  verification found MAP §S lists run outputs as separately retained but omits them from the
  closure. *Rationale:* a desktop delete is erasure; one nulled event payload leaves the text in
  `parse_outcomes`, the claims in `claims`, and the rebuild reading `batches`. *Rejected:*
  rewrite into a fresh `dataDir` as the primary erasure (kept as the P-S3 redesigned candidate
  for reclaim, not as the erasure semantics); tombstone only (A6 keeps D16 non-binding).
- **R1.f (fixture = offline-regenerated C2 ledger).** *Q:* is the spike fixture the
  workstation-regenerated full-W1 C2 ledger from the untracked provider cache, gated by P-S0
  reproducing report digest `2a2089ea…` with the network off? *A:* yes; zero hosted spend, and
  no reproduction means the spike does not start. *Rationale:* the committed C2 archive holds
  reports, telemetry, checksums and a crash log, not a ledger or cache, so P-S0 is the only proof
  the fixture exists. *Rejected:* a fresh hosted C2 run (spends budget and adds provider
  nondeterminism to a storage question); committing the regenerated ledger or the ~152 MB cache
  to the public repo.
- **R2.a (the rules fixture is the spike's P1).** *Q:* does the `G-entailment/rules` fixture stop
  being an unowned precondition and become phase P1 of `semantica-reasoning-spike`? *A:* yes.
  *Rationale:* a precondition without an owner is a deadlock; the fixture is the bounded,
  engine-free slice a spike should open with, and P1 needs neither the archive nor an engine.
  *Rejected:* building it inside the retained canary (SPEC constraint 11 excludes the suite);
  a separate fixture-only goal packet (not in the packet; more ceremony than the work).
- **R3.f (Verdict map Atlas-row cell amended).** *Q:* ratify the amended Current-law cell
  ("positive values only after the matching canary stage passed (B1) — unblocked 2026-09-02,
  written by `semantica-atlas-sync`") in place of "today only final park/drop"? *A:* yes.
  *Rationale:* the Atlas-writes row already unblocked positive values and the table wins over
  log entries, so the stale cell would have forbidden the lane R3.a proposes. *Rejected:* leaving
  the cell and relying on the 2026-09-03 log entry; gating positive atlas values on the storage
  spike as well (not in the packet; delays docs work behind a spike that never reads the atlas).

Round 2:

- **R1.c (redacted events keep `(id, prev, body_digest)`; three DDL changes).** *Q:* do redacted
  events keep the commitment triple and null their payload, accepting a nullable payload, a
  `body_digest` column populated for every event, and a separate `prev` column? *A:* yes,
  including the `prev` column: the Sol verification found `prev` lives only inside the payload
  today, so dropping the payload without that column would break every continuity walk.
  *Rationale:* the triple is a commitment, not a proof, but it is the only thing that lets the
  chain be walked across an erasure. *Rejected:* deleting the redacted rows outright (the next
  event's `prev` points at nothing); a placeholder body with forward re-hashing (rewrites ids that
  reports and witnesses already reference).
- **R1.e (P-S0..3 are one stage of one S1 candidate).** *Q:* one candidate for the four ordered
  probes, a failed probe buying one redesigned candidate for that probe under R0.a, a second
  failure parking the storage family? *A:* yes. The P-S3 redesigned candidate is
  copy-to-fresh-`dataDir` compaction. *Rationale:* matches the ratified S1 and E8; every probe is
  replay-offline. *Rejected:* P-S0 outside the breaker as prerequisite evidence (the review's
  shape for fixtures; the MAP folds it in and Benjamin kept that); one candidate per probe (not
  in the packet; four times the budget).
- **R1.g (one tombstone law: P-S1 before R-c and P2–P4).** *Q:* does P-S1 ratify the retraction
  semantics before R2's R-c class and the P2–P4 probes run? *A:* yes. *Rationale:* the ledger
  defines retraction once and the fixture inherits it; R-a, R-b, R-d and R-e still build in
  parallel with the storage spike. *Rejected:* R-c and P-S1 in parallel with reconciliation after
  (two laws to reconcile); fixture-first with P-S1 conforming (the ledger would inherit
  statement-level semantics from a test suite).
- **R2.b (NET-NEW `g-entailment-rules/v1` family; widened rule and engine domains).** *Q:* does
  P1 open with a sibling tagged family (case, expectation, witness) rather than widening
  `GEntailmentExpectation`, with `RdfsRuleId` widened to a branded rule id and `InferenceEngine`
  to a domain? *A:* yes. *Rationale:* rdfs/v1 is the passed C2 gold contract and its case class
  has no slot for a rule program, an invalidated input, a diff, a budget, a truncation fact or a
  conflict; a sibling family keeps rdfs/v1 frozen. *Rejected:* optional fields on rdfs/v1 (not in
  the packet; changes the C2 fixture shape under a passed gate); `g-entailment-rdfs/v2` with a
  migration of the seven C2 cases (not in the packet; re-proves C2 gold for no reasoning gain).
- **R3.a (D5 split into a verdict lane now and a facts lane later).** *Q:* split D5 so the
  verdict lane (repo-owned verdicts file, render, diff, one canary write, apply, SQL read-back)
  runs now and the IR extractor lane stays queued on semantica 0.6.7+? *A:* yes. *Rationale:*
  under A9 the fired need is decision data; the extractor is not on its path, and M4's async
  ruling on IR work stands. *Rejected:* keeping D5 whole and rebuilding the extractor first;
  running both lanes now (not in the packet; reverses M4 and forces the extractor's home to be
  decided today).

Round 3:

- **R1.d (`Compacted` is the trust root; continuity from the checkpoint; redacted events are
  commitments only).** *Q:* is `Compacted` a content-addressed snapshot that becomes the trust
  root, with the chain property weakened to continuity from the last checkpoint under a NET-NEW
  validator? *A:* yes, with one amendment from the Sol verification: MAP §S said post-checkpoint
  ids recompute from `(prev, body)` "or `(prev, bodyDigest)` where redacted", but an existing id
  was hashed from a body that is gone and can never be recomputed from its digest. The validator
  therefore checks `prev` exists, the head is unique, every event whose body remains recomputes
  from `(prev, body)`, the fold digest matches, and redacted events only as `(id, prev,
  body_digest)` commitments. The id scheme does not change, so the C2 ledger and its
  `2a2089ea…` digest remain valid fixtures. *Rejected:* changing the id preimage to `(prev,
  bodyDigest)` for new events (not in the packet; invalidates every C2 id and the P-S0 fixture);
  keeping end-to-end verification by forbidding redaction outside a compacted prefix (erasure of a
  recent document would wait for the next compaction).
- **R2.c (twenty cases, five classes, oracle split).** *Q:* twenty cases, four per class (R-a
  join, R-b recursion, R-c retraction, R-d budget, R-e contradiction), generated by extending
  `scripts/generate-g-entailment.ts` under the same EYE pins, with EYE gold separated from
  lab-owned expectation per class? *A:* yes: R-c two EYE closures; R-d EYE's complete closure
  plus a lab-owned budgeted run emitting `InferenceTruncated`; R-e EYE derivability plus a
  statement-level conflict witness. *Rationale:* this is the ablation corpus A6 requires, and no
  class asks the oracle for something it cannot produce. *Rejected:* eight cases (join and
  recursion only; not in the packet; P3 and P4 would lack the cases their kill criteria need);
  unequal class weights (not in the packet).
- **R3.b (scope frozen; exact rows listed before any write).** *Q:* freeze the positive-write
  scope at the four P5-declined rows (`Oxigraph (embedded)`, embedding-model `OpenAI`,
  `pattern`, `llm`) plus `already-have` rows with a shipped `@beep/*` counterpart, zero new
  Notion rows or properties, and reconcile the park baseline? *A:* yes, and `verdicts.json` must
  enumerate every row it will touch before the lane is called bounded. The Sol verification found
  the MAP's "six parks" baseline is one of two dated observations: the 2026-08-24 upgrade report
  read back 13 D10 auto-parked rows (5 MCP Server Integrations, 8 LLM Providers) that P5's
  ten-catalog inventory never saw, and no packet file records clearing them; the 33-catalog read
  establishes the live count. *Rejected:* the four named rows only (drops the `already-have`
  extension); scope as written with the six-park baseline trusted (the 33-catalog diff could
  report rows the file cannot explain).
- **R3.c (`Beep counterpart` rides with every positive `Verdict`).** *Q:* must every positive
  verdict carry its counterpart text in the same Notion write? *A:* yes. *Rationale:* a positive
  verdict with no pointer to what beep has is the failure mode D3's columns were created to
  prevent. *Rejected:* verdict now and counterpart in a later pass; counterpart required only
  for `adopt`/`adapt` (not in the packet; weakens the pairing where a reader most needs it).
- **R3.e (homes; "zero schema" means zero Notion schema).** *Q:* script home
  `apps/labs/semantica/scripts/` beside the `generate-*.ts` files; data home
  `explorations/semantica-lab/research/atlas/verdicts.json` under a NET-NEW `atlas-verdicts/v1`
  schema whose `Verdict` is a `@beep/schema` `LiteralKit`; the bullet's "zero schema" read as
  zero Notion rows, properties or schema? *A:* yes. *Rationale:* the smallest lawful homes: the
  lab already hosts fixture generators and publishes no API, and A9 puts decision data in the
  packet. *Rejected:* a `bun run beep` command in `@beep/repo-cli` (not in the packet; a tooling
  home plus ceremony for an hours-scale task, though the more reusable shape if atlas syncs
  recur); verdicts as prose in `DECISIONS.md` with no validated file.
- **R3.g (facts lane stays queued; extractor home deferred; verdict lane first).** *Q:* keep
  the IR lane queued on semantica 0.6.7+, defer the extractor's lawful home to that lane
  (default: a pinned out-of-repo clone under the cache root), and sequence the verdict lane
  first? *A:* yes. *Rationale:* the extractor survives in git history at `fd560ca8e5` and
  nothing in the fired need reads it. *Rejected:* deciding the extractor's home now; retiring
  the facts lane (not in the packet; the atlas would go stale by design).

Round 4:

- **R2.d (no negation class in gold/v1; typed gap).** *Q:* omit negation from the first twenty
  cases and record it as a typed gap in the fixture rather than a silent omission? *A:* yes.
  *Rationale:* restricted EYE's acceptance of `log:notIncludes` is untested, and the rule
  language has no negated atom, so oracle acceptance alone would not make the schema support it.
  *Rejected:* a pre-P1 probe of restricted EYE (settles only the oracle half); a sixth negation
  class now (not in the packet; leaves the positive fragment the live engine implements).
- **R2.e (R-c inherits the ratified R1 tombstone law).** *Q:* does R-c reuse claim-targeted
  `Invalidated` with reach derived through `claimQuads` and recorded premises, so its lab-owned
  expectation is "the derived set shrinks by exactly the diff; retraction derived from recorded
  premises"? *A:* yes. *Rationale:* one law across ledger and fixture; R-c's EYE run over
  (asserted minus retracted) is a recomputation oracle, and incremental truth maintenance is
  tested in P4, not P1. *Rejected:* a fixture-local statement-level retraction (two laws, the
  reasoner bridging twice); dropping R-c from gold/v1 (not in the packet; P4 loses its
  retraction case).
- **R3.d (`already-have` needs a dated, row-specific entry; AMENDS the R3 proposal).** *Q:* is
  a shipped `@beep/*` counterpart alone enough to justify an `already-have` row, as MAP §A and
  the 2026-09-03 R3 block wrote, or must each such row also have a dated, row-specific entry in
  this file? *A:* the dated row-specific entry is required. Package existence never becomes a
  verdict; every `already-have` record in `verdicts.json` cites the entry that judged that row.
  *Rationale:* the record shape already demands evidence, D7 says incumbency is not quality,
  and A9 makes the repo the writer of decision evidence; the Sol review raised this as a P2 and
  it had not been folded. *Rejected:* counterpart existence suffices (the packet text as
  written); the family-level verdicts standing in as the entry for their rows (a middle ground
  Benjamin declined). MAP §A's scope sentence is amended to match.

Round 5:

- **R2.f (adhd probes are P2–P4; one S1 candidate for P1–P4).** *Q:* are P-R1, P-R2 and P-R3
  phases P2 to P4 with their kill criteria unchanged (canonicalization drift; certificate
  unsoundness; unstable identity or invalidation across re-extraction and replay), starting
  after P-S1 (R1.g), and is the whole P1–P4 run the reasoning family's one S1 candidate under
  R0.a? *A:* yes. *Clarification recorded for both spikes:* "one S1 candidate" in the MAP
  ratification bullets means the family's opening candidate; S1's exactly-one redesigned
  candidate after a stage failure still applies, and a second failure parks the family.
  *Rejected:* P1 outside the candidate as prerequisite evidence (the review's shape; differs from
  what was chosen for P-S0 in R1.e); each probe its own candidate (not in the packet).

Round 6 (the archive-phase wording conflict and two clauses the Sol completeness critic found no
question covered):

- **R2.g (the archive gates P3 = P-R2; MAP probe-table sentence amended).** *Q:* the MAP probe
  table said the rete salvage enters at P-R3 (P4 under the P2–P4 numbering) while the sequencing
  prose, the R2 block and the manifest said P3; which phase does locating `beep-effect-logos`
  gate? *A:* P3, that is P-R2, whose adhd first step is beside the v3 Rete compiler; the P4
  (P-R3) ablation inherits the gate. P1 and P2 proceed now. *Rejected:* P4 only (P-R2 would
  proceed without the compiler); naming the check on both phases (redundant).
- **R1.h (P-S2 states an atomic erasure protocol and a copy-class inventory).** *Q:* the Sol
  review asked for the complete closure and its atomic rewrite or swap protocol; the fold covered
  the closure but not atomicity or the WAL, TOAST, report and telemetry copies. Require both?
  *A:* yes: closure rows are deleted in one transaction, followed by a copy-to-fresh-`dataDir`
  or `VACUUM FULL` step to purge dead tuples; the spec lists every copy class (WAL and TOAST
  inside `dataDir`, report and telemetry files, provider-cache entries) and the gate proves each
  is gone or documented as out of scope. *Rejected:* closure rows only with remnants left to
  P-S3's byte measurement; deferring atomicity to implementation.
- **R1.i (chain order is canonical for folds and replay).** *Q:* `Ledger.read` orders events by
  `recorded_at` then `id`, a wall clock, while the R1 telemetry law keeps wall clocks out of
  digests and `CompactedSnapshot` speaks in chain-prefix order; which order is canonical? *A:*
  chain order via `prev` links, made cheap by the `prev` column from R1.c; `recorded_at` stays
  telemetry and `Ledger.read` walks `prev` from the checkpoint. *Rejected:* keeping the
  `recorded_at, id` order (fold digests would depend on the wall clock); two orders (replay
  identity could drift between them).

Round 7 (delivery and close):

- **R4.a (delivery shape).** *Q:* three goal packets as v1.0 named them, each at its own weight:
  `semantica-atlas-sync` at template weight with the facts lane as a gated P2, and the two
  spikes carrying their probes as phases (P-S0..3; P1 fixture then P2–P4), with the O4 OSS
  gates untouched? *A:* yes. *Rejected:* folding the verdict lane into a docs-only PR under this
  exploration and minting only the two spikes (not in the packet); one packet with three phases
  (not in the packet; one breaker budget shared across families, which S1 does not allow).
- **Close.** Benjamin confirmed the shared understanding with the frontier empty: every
  ratification clause, the three clauses the Sol completeness critic found uncovered (R1.h, R1.i,
  R4.a) and the wording conflicts (R0.a, R2.g, the meaning of "one S1 candidate", "zero schema")
  have a recorded answer. Closeout without scaffolding: MAP v1.1 carries the amendments inline,
  the manifest's open questions are cleared, and the graduation ceremony (three packets from
  `goals/_template`) is the next session's first step. Execution preconditions carried into the
  goal packets: P-S0 is a hard fixture gate; Notion access is re-checked before the one canary
  write; the v3 archive is located before P3.

## 2026-09-03 (graduation ceremony) — three re-entry packets scaffolded; exploration `graduated`

Definition-of-ready (explorations/README.md Graduation Contract) re-checked against the ratified
state: (1) `BRIEF.md` v1.1 is complete and unchanged; (2) the manifest's `openQuestions` is empty
and the three deferred items (facts-lane extractor home, a negation class, the O3 version trigger)
are logged DEFERRED in the 2026-09-03 decompose entry; (3) MAP v1.1 §S/§R/§A name slug, mission,
dependency edges and first slice per packet, with §Sequencing and delivery giving the order; (4)
every capability cell cites a live brick or is marked NET-NEW, re-verified at `a1652c1923` and
challenged by the Sol review. All four hold; the ceremony ran.

- **What was scaffolded.** `goals/semantica-atlas-sync` (phases P0 access check + live baseline,
  P1 verdict lane, P2 facts lane gated on semantica 0.6.7+, P3 close), `goals/semantica-storage-inversion`
  (P0 P-S0 entry check, P1 P-S1, P2 P-S2, P3 P-S3, P4 close) and `goals/semantica-reasoning-spike`
  (P1 rules fixture, P2 P-R1, P3 P-R2, P4 P-R3, P5 close). Each manifest was materialized from the
  read-only `beep goals bootstrap --plan --json` compiler (no writer exists; the nine files per
  packet were written from the plan payloads), then patched with phases, sources of truth,
  verification commands, stop conditions and provenance; every SPEC back-links MAP v1.1 and the
  ratification grill instead of restating them; each `research/SOURCES.md` mirrors the rows the
  packet composes and names this packet's ledger as primary.
- **Edges recorded as capabilities.** `semantica-storage-inversion` provides
  `semantica/tombstone-law` and `semantica/storage-semantics`; `semantica-reasoning-spike` requires
  `semantica/tombstone-law` and provides `semantica/rules-fixture` and `semantica/reasoning-kernel`;
  `semantica-atlas-sync` provides `semantica/atlas-verdicts`. P1 of the reasoning spike (minus R-c)
  is not blocked by the edge; R-c and P2–P4 are (R1.g).
- **Statuses.** All three `active`; the atlas-sync packet is set `paused` after its verdict lane
  ships if P2 is still gated (resume condition recorded in its PLAN). Exploration status
  `graduated`; `links.goals` lists five packets.
- **Execution preconditions carried into the packets** (from the ratification Close): P-S0 is a
  hard fixture gate; Notion access is re-checked with a one-catalog read before the canary write;
  the v3 archive is located and its license re-verified before P3 of the reasoning spike.
- **Review fold (Sol xhigh adversarial pass on the ceremony, verdict FIX-THEN-SHIP, 3 P1 / 3 P2 / 3 P3,
  archived as [`research/reviews/2026-09-03-sol-graduation-review.md`](./research/reviews/2026-09-03-sol-graduation-review.md);
  all nine verified against source and folded).** P1: the storage non-goal banned every claim-row
  `DELETE`, which physical erasure requires — re-scoped to "no `DELETE` as the implementation of
  retraction"; the reasoning telemetry law pushed the R-d declared budget and `InferenceTruncated`
  witness into the sidecar — only Tier-L/Tier-D measurements live there, the budget and witness are
  replay-stable fixture data; the atlas packet had widened the facts-lane gate to "0.6.7+ or a dated
  O3 re-fire" — the ratified gate is 0.6.7+ only (R3.g), the firing recorded in a dated entry. P2: the
  MAP gate-status cell still said three probes (now P-S0..3, R1.e); two MAP tuples omitted `prev`
  (now `(id, prev, body_digest)`); the MAP capability table gave semantica Apache-2.0 (it is MIT,
  Hawksight AI). P3: `premises` is `NonEmptyArray<StatementId>`; the ledger's `Witness` shorthand is
  `GEntailmentWitness`; the Trail's "23 sub-decisions" is 25 labelled including R0.a and R4.a.
- **Not done here.** No `docs/ROADMAP.md` change (the Labs line is slot-free, M6); no code; no
  Notion write; the queued `research/drafts/*` upstream lane is untouched (O1/O2).

## 2026-09-03 (PR #996 review closeout) — Q1–Q4, review amendments

The graduation PR's Codex review left four threads; each was checked against the ratified text
and folded into the goal packets as a review amendment (the PR #802 precedent). None changes a
ratified sub-decision; Q4 makes the storage SPEC stricter than MAP §S.

- **Q1 (atlas: the gated facts lane is inside scope once it fires).** The SPEC non-goals and the
  launcher's Out list excluded the IR extractor and its home outright, which made P2 unlawful
  under the packet's own source hierarchy. Both now exclude them only while P2 is gated (P0–P1);
  P2 brings the extractor, its home decision and one IR run into scope once semantica 0.6.7+ is
  recorded as shipped (R3.g unchanged).
- **Q2 (atlas: completion after a successful P2).** The acceptance bullet named only "paused
  while gated" and "completed-retained after retirement"; a facts lane that ran had no completion
  path. P3 now closes the packet after P2 has run or after a dated retirement entry.
- **Q3 (atlas: the pause flip lands in the P1 PR).** The launcher sequenced "Yeet to
  merge-ready, then set paused", which either leaves the state flip outside the shipped work or
  invalidates the readiness it just obtained. The flip now lands in the verdict-lane PR before
  the final monitor (AGENTS.md same-PR packet-state flips).
- **Q4 (storage: erasure recoverable across stores).** R1.h's protocol was atomic only inside
  PGlite; report and telemetry files and provider-cache entries sit outside the transaction, and
  the only crash probe was mid-compaction. The storage SPEC now journals erasure — `Redacted` is
  the durable intent, out-of-DB purges are idempotent and keyed by the event id, a restart re-runs
  any receipt-less purge, erasure is complete only with the receipt — and P-S3 adds a SIGKILL
  between the closure commit and the purge. MAP §S is unchanged; the goal constraint is stricter,
  not in conflict.
