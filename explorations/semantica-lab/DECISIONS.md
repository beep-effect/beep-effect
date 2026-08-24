# Decisions

<!-- Stage 2. Dated Question -> Answer -> Rationale log, rejected options included. -->

## Current law (2026-08-24)

The sections below are the dated log. Later entries amend earlier ones. This table is what
holds now; when a log entry disagrees with it, the table wins.

| Topic | Holds now | Supersedes |
| --- | --- | --- |
| Next work | Draft BRIEF (enter shape); canary C0-C2 is Goal 1; graduate fast; scaffold the lab via create-package | "awaiting reconciliation review" |
| Storage | park-pending-canary; first probe bundle = PGlite ledger SoR + DuckDB exact vector + derived graph tables + Oxigraph rebuild-from-ledger | D8 one-of-three; the sheet's `Bundle` verdict |
| Embeddings | park-pending-canary; M1 uses hosted models via the agents slice; local Snowflake/ONNX lane parked | the sheet's Snowflake+ORT pick-one |
| Input | park-pending-canary; per-stage slate is probe order; PDF.js/MuPDF is a tie | the sheet's per-stage winners |
| Reasoning | park-pending-canary; EYE is the C2/CI correctness oracle, not the product runtime; runtime path is ledger-native; NET-NEW is a dated spike with kill criteria | the sheet's EYE pick-one |
| Extraction | park-pending-canary; hybrid and pattern-only run the same gold probe; one family verdict | the sheet's dual verdict |
| Canary | staged C0 (days) then C1 then C2 (G1); code lives in the lab after graduation | B2's monolithic offline run |
| Budgets | Tier-L hard bar: cold start <5s, p95 <100ms; 16GB bundle-RSS alarm, not a park; laptop-class numbers are EvalReport telemetry (Tier-D) | B5/A8 2GB/250MB/600MB as gates |
| Offline | replay-offline, hosted-live: cache every provider result content-addressed; re-run must reproduce the EvalReport with network off | A8's fully-offline M1 |
| Atlas writes | only final `park`/`drop` today; `adopt`/`pick-one` values wait for a passed canary stage | D3 columns as live verdicts |

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
**Answer:** Scaffold `apps/labs/semantica` with `--app-kind tauri --lab` from day one (D13 lab-
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
  scaffold `apps/labs/semantica` via create-package (`--app-kind tauri --lab`, headless-first
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
  activates; `.claude/skills/semantica/SKILL.md` in the clone gets read during shape;
  `op`-prewarm lesson to machine memory; Notion-pilot workflow lessons to basic-memory at
  session close.
