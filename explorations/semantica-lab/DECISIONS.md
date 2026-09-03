# Decisions

<!-- Stage 2. Dated Question -> Answer -> Rationale log, rejected options included. -->

## Current law (2026-08-24)

The sections below are the dated log. Later entries amend earlier ones. This table is what
holds now; when a log entry disagrees with it, the table wins.

| Topic | Holds now | Supersedes |
| --- | --- | --- |
| Next work | Decompose the C2-fired `semantica-storage-inversion` gate; `semantica-reasoning-spike` also needs its `G-entailment/rules` fixture committed before it fires (MAP Sequencing 5); `semantica-atlas-sync` re-enters on the atlas-edit need its unblocked positive row values create (O3/M4). | P5 close |
| Stop rule | Probe-denominated circuit breaker (S1): first-probe candidate, one retry, then the family parks and the packet drops to decompose; wall-clock is `EvalRunTelemetry` sidecar telemetry (R1), never a gate. Re-entry is bounded (E8): one decompose re-entry candidate per family per stage; a second park is terminal absent an explicit operator ratification recorded in this file | BRIEF v0.1 "two weeks, C0 in four days"; contract v1.2 two-week falsifier; unbounded slate re-entry |
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
| Graduation | M5/M6: three PRs — fix → docs-only ceremony → lab mint; both packets graduate in one ceremony; `openai-driver` scaffolds `active` with no dependency edge; `docs/ROADMAP.md` funnel policy gains a lab-canary slot-free clause and a Labs line | G2 "graduate this week" |

**Verdict map** (which vocabulary is legal where):

| Where | Allowed values | When written |
| --- | --- | --- |
| Family (packet) | already-have / pick-one / bundle (storage only) / park / drop | after the matching canary stage passes |
| Family (today) | park-pending-canary | packet-only; never an atlas value |
| Atlas row | adopt / adapt / already-have / park / drop | adopt = wrap as-is, adapt = wrap with changes; today only final park/drop |
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
