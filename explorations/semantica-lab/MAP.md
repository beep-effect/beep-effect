# Map — Semantica Port Atlas & Lab

<!-- Stage 4. Decomposition into candidate goal packets. This is the graduation surface: the
definition-of-ready in explorations/README.md is checked against this file. Every major
component cites an existing repo capability or is explicitly marked NET-NEW. -->

Status: **v1.0 — RATIFIED by Benjamin 2026-08-24 (MAP grill M1–M6 applied; see Dispositions). v1.1 re-entry section (2026-09-03) RATIFIED 2026-09-03 in a grilling session (DECISIONS.md "ratification grill", rounds 1–7); amendments R0.a, R1.b, R1.c, R1.d, R1.h, R1.i, R2.g, R3.b, R3.d are applied inline below and tagged with their sub-decision ids. Graduated 2026-09-03: `goals/semantica-atlas-sync`, `goals/semantica-storage-inversion` and `goals/semantica-reasoning-spike` scaffolded (R4.a).**

> **2026-08-27 amendment (historical, not a re-ratification):** C0 fired the
> Extraction probe breaker on 2026-08-26 and paused `semantica-canary` at P2.
> The evidence-quote replacement in DECISIONS E1-E8 later passed C0, followed
> by C1 and C2. On 2026-09-02, MAP Sequencing 5 reopened this exploration at
> `decompose` for the C2-fired storage gate and the fixture-gated reasoning spike. The PR A/B/C delivery
> vehicle below is historical. Where extractor prose disagrees with the
> DECISIONS Current law table, the table wins. Derived from `BRIEF.md`
v1.1, the `DECISIONS.md` Current law table (D1–D18, A1–A9, B1–B6, G1–G7, O1–O5, S1–S8, T1–T3),
`research/shared-schema.md` v1.3, `research/workload-contract.md` v1.3, and
`research/upstream-tracker-mining.md`. Every capability cell below was re-verified against the
live checkout on 2026-08-24 (paths are relative to the repo root). The five ⚠ challenges of v0.1
and one doctrine collision were settled in `DECISIONS.md` M1–M6; their dispositions close this file.

## Candidate Goal Packets

Promised-now packets graduate at stage 5. Queued packets are re-entry points: a fired gate reopens
this exploration at `decompose`; nothing queued holds the packet open (Graduation Contract).

| Slug | Mission | Depends on | Capabilities cited | Disposition |
| --- | --- | --- | --- | --- |
| `semantica-canary` | Scaffold the headless-first Tauri lab at apps/labs/semantica and run the staged canary C0 → C1 → C2 over F1 + W1 under the probe breaker (S1), emitting replay-identical `EvalReport`s; each passing stage flips its families from park-pending-canary to a verdict (B1). | `openai-driver` before C1 (not before C0) | Full table in the Capability Check below; NET-NEW is lab-local: `ProviderCache`, ρdf `Reasoner`, EYE oracle wiring, `EvalReport`, plus the write-model schemas `EvidenceBatch`/`ModelIdentity`/`ConflictWitness`; `CanonicalText` is composed, never rebuilt (M1) | **promised-now — Goal 1** |
| `openai-driver` | Ship `@beep/openai` (a new packages/drivers/openai workspace), a thin driver mirroring `@beep/anthropic` that composes `@effect/ai-openai`'s shipped `OpenAiLanguageModel` and `OpenAiEmbeddingModel.layer` (rc.111) behind config + typed errors; no engine code (S3-rev); `OpenAiEmbeddingModel.model()` where `Dimensions` is needed, key-only config (M3). | none | `packages/drivers/anthropic/src` — `Anthropic.config.ts`, `Anthropic.errors.ts`, `Anthropic.repair.ts`, `Anthropic.service.ts` (shape), `@effect/ai-openai` 4.0.0-rc.111 (root dep; `OpenAiEmbeddingModel.layer` verified in the Effect reference checkout), `effect/unstable/ai/EmbeddingModel` (contract) | **promised-now — pre-C1**, own packet at template weight (M3) |
| `semantica-storage-inversion` | Spike: delete / compaction / desktop-storage semantics for the append-only `ProvenanceEvent` ledger so provenance-first (D16) can become binding; `Invalidated` tombstones, never in-place `UPDATE`. | `semantica-canary` C2 pass | `@beep/pglite`, `@beep/provenance`, shared-schema `ProvenanceEvent`; effect-ontology `Timeline` bitemporal shape (borrow-only) | **graduated 2026-09-03** (v1.1 §S; was queued — gate A6-storage, fired by the C2 pass) |
| `semantica-reasoning-spike` | Dated NET-NEW spike: proof-ledger kernel + budget-certified rules + evidence-graph workspace (`research/adhd-reasoning.md`), entered through its three named first-step probes as kill criteria and ablated against the EYE oracle on `G-entailment/rules`; the v3 `rete` salvage enters here, not at C2. | `semantica-canary` C2 pass; `G-entailment/rules` fixture committed | EYE oracle wiring from Goal 1; v3 `rete` + 46-test oracle (`research/grounding-v3-logos.md`, archive out-of-repo); `@beep/rdf` `ObjectTerm`/Prov shapes | **graduated 2026-09-03** (v1.1 §R; was queued — gate A6-reasoning; the fixture precondition became the packet's own P1, R2.a) |
| `semantica-atlas-sync` | The D5 render/diff sync pipeline: regenerate the Notion `@beep/semantica` atlas from the schema-validated IR (`scratchpad/semantica-ir/`) and diff it (O3 verbatim, M4). Template exemplars, IR row-fill and the 27 module analyses are async codex batches, not this goal. | re-entry trigger: semantica 0.6.7+ ships **or** an atlas-edit need arises (O3) | `research/ir-extraction-report.md` pipeline, `research/atlas-upgrade-report*.md`, Notion MCP (Codex + Claude, both OAuth'd) | **graduated 2026-09-03** (v1.1 §A, verdict lane; the facts lane stays gated inside the packet as P2; was queued — gate O3 (M4)) |
| *(OSS gate)* `reasoning-package` | Extract the runtime reasoner + `InferenceEvent` + proof-DAG schemas into a standalone `@beep/*` package. Tracker verdict STRENGTHENED (demand for proof-bearing, LLM-free reasoning) but never pulled into C0–C2. | `semantica-reasoning-spike` survives ablation | Goal 1 `Reasoner`, `InferenceEvent`; `packages/drivers/n3`, `packages/drivers/oxigraph`, `packages/drivers/shacl`, `packages/drivers/rdf-canonize` neighbours | queued — gate O4-reasoning |
| *(OSS gate)* `evals-harness` | Publish the eval harness once the lab proves a schema-validated `EvalReport` + gold-proposer ≠ extractor (S2) + replay identity (G7) reusable beyond semantica inputs (T1 wording). Upstream #1090 landing does not touch this gate. | `semantica-canary` C2 pass + one non-semantica corpus proves reuse | Goal 1 `Evaluator`; `beep qa` inventory discipline (`packages/tooling/tool/cli/src/commands/Qa` — `JudgeCheck.ts`, `JudgeLint.ts`, `Qa.render.ts`) | queued — gate O4-evals |

**Not goal packets** (named so nobody scaffolds them): the Explorer/UI milestone is a decision
inside `semantica-canary`'s `SPEC.md` (thin workbench vs defer — D16, A5, D12); the upstream lane
(`research/drafts/*`: repo issues, danklocal PR, HermiT/Pellet issue, #1090 comment) is a held
track that posts only with Benjamin (O1/O2/T3); three of the four in-repo brick defects
ride cleanup-on-touch in their owning packages (O1); the `@beep/nlp` Handoff mention/span drop is
fixed now in its own PR (M2, O1 exception); the atlas template exemplars, IR row-fill and module
analyses are async codex batches off the critical path (O3, M4) and the Rosetta glossary ratification
(`research/glossary-rosetta-draft.md`) rides with them — B1 still forbids `adopt`/`pick-one` atlas
values before the matching canary stage passes.

## Capability Check (Goal 1 — `semantica-canary`)

Every contract row is a `Context.Service` the lab defines locally, promotion-shaped (D8, D16). A
second backend is one more Layer against the same contract, later. Tripwire = the schema law that
makes the tracker's matching failure class unrepresentable (`research/upstream-tracker-mining.md`
§"What a MAP author must see").

| Contract | Stage | First-probe Layer | Live brick (verified 2026-08-24) | NET-NEW | Tripwire |
| --- | --- | --- | --- | --- | --- |
| Lab shell | day 1 | `bun run beep create-package semantica --type app --app-kind tauri --lab --description "..."`; one local `cargo check`; `src-tauri` frozen through C2; hand-written `server/main.ts` + `src/runtime/Layer.ts` (S4) | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` (`--lab` refusals at 963–986), `apps/labs/README.md` (line 8), `standards/architecture/15-lab-apps.md`, `apps/labs/trustgraph-workbench/lab.manifest.json` (`lab-manifest/v1` shape), `apps/professional-desktop/server/main.ts` + `apps/professional-desktop/src/runtime/Layer.ts` (the split being borrowed; no imports of its internals) | the two hand-written runtime files | Labs CI has no Cargo; the crate is dead weight by design (rabbit hole 12) |
| `DocumentSource` | C0 | local file + committed fixture | `@beep/file-processing` (`packages/foundation/capability/file-processing/src` — `Artifact`, `SourceText`, `PathSafety`, `Service`) | — | W1 = committed manifest (id + sha256 + bytes), never a directory (B3) |
| `Parser` (per media type) | C0 | **PDF: `@beep/doc-text` (`unpdf` = PDF.js)**; MD: `@beep/md`; HTML: `@beep/html`; fallback `@beep/tika`; `@beep/pandoc-ast` for AST needs | `packages/drivers/doc-text` (`unpdf` catalog dep; root `unpdf ^1.8.1`), `packages/foundation/modeling/md`, `packages/foundation/modeling/html`, `packages/foundation/modeling/pandoc-ast`, `packages/drivers/tika` | — (breaker retry = direct `unpdf` text items with `disableNormalization: true` inside the lab, same MIT dep, if G-structure needs page/font structure; MuPDF parked — AGPL subprocess) (M1) | doc-text's `empty-text-layer` failure is the fail-closed path (#1020/#1021); NFKC/whitespace normalization happens before the string exists and is pinned by `textDigest`; OCR/DOCX/URL out of appetite |
| `Canonicalizer` → `CanonicalText` | C0 | **compose (M1):** `CanonicalText` = `ResolvedSourceText` (`@beep/file-processing` `SourceText`) = `@beep/provenance` `SourceTextIdentity` (textDigest, extractor{name,version}) + text; spans = `@beep/provenance` `TextAnchor` (UTF-16 half-open, width-checked); raw extracted text IS canonical, normalization is locator-only, no loss map | `packages/foundation/capability/file-processing/src/SourceText` (`ResolvedSourceText`, `SourceTextResolver`), `packages/foundation/modeling/provenance/src` (`SourceTextIdentity`, `SourceTextExtractor`, `TextAnchor`, `VerifiedTextAnchor`, `verifyTextAnchor`), `@beep/langextract/VerifiedSpan` locators; same law as active goal `citation-verified-span-substrate` constraint 4 | — | `verifyTextAnchor` proves digest + UTF-16 boundary + raw-slice equality for every span (C0 pass) |
| `Chunker` | C0 | span-preserving sentence/section splitter | `@beep/nlp` `Core/Sentence.ts` (`Sentence`, `SentenceIndex`), `Graph/Schema.ts` (`Span`); `@beep/nlp-processing` `Tools/ChunkBySentences.ts`, `Core/Tokenization.ts` | — | the lab builds claims from `GroundedExtraction` spans + `TextAnchor`, never from the `@beep/nlp` `Handoff` envelope (it dropped mentions until PR A made `mentions` required in `nlp-ir/1.1`, M2); a `Chunk` without a span is unrepresentable |
| `Extractor` → `EvidenceBatch` | C0 | hosted LLM (LangExtract shape) **and** pattern (Wink) under one gold probe; one family verdict at C0 (S7) | `@beep/langextract` (`Extraction`, `Handoff`, `Service`, `Target`), `@beep/nlp-processing` `Backend` (Wink); hosted `LanguageModel` Layers: `@beep/anthropic`, `@beep/xai` (`XAiLanguageModel.service.ts`), `@beep/openai-compat` (`OpenAiCompatLanguageModel.service.ts`), `@beep/venice-ai` | — (`EvidenceBatch`/`EvidenceClaim`/`ConflictWitness` are lab-local schema, shared-schema v1.3; `ContradictionCandidate` in `packages/epistemic/domain/src/entities/Contradiction` is the witness precedent, `EvidenceClaim` spreads `TextAnchorFields` + `Confidence` like epistemic `EvidenceSpan`) | relation count 0 on the G-relation papers is a failure not a score (langextract handoff relation-drop); a span that does not slice back (Wink `indexOf`-miss fabrication); claims stay separate nodes (#1074, merge-winner APIs) |
| `Ledger` (SoR) | C0 | PGlite, append-only `ProvenanceEvent` + `EvidenceBatch` in one transaction | `@beep/pglite` (`packages/drivers/pglite/src` — `PgliteClient.service.ts`, `Pglite.test-layer.ts`), `@beep/postgres`; anchors `@beep/provenance` `TextAnchor`, `@beep/rdf` Prov `ObjectRef`/`ProvBundle`/`Activity`/`Entity` (`packages/foundation/modeling/rdf/src/Rdf.ts`), `@beep/epistemic-domain` `Confidence` (`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`, line 47), `@beep/schema` `UnitInterval` | DDL lives in the lab (labs law forbids a `tables` migration package from a lab) | persistence-lies (#970, #757, #1173) are what C1 rebuild identity catches; `Invalidated` tombstones, never `clear()` (#827 vs #825) |
| `ProviderCache` | C0 | content-addressed on-disk cache, key = `sha256(ModelIdentity ⊕ prompt/config hash ⊕ input hash)`, immutable, no TTL | — | **yes** (small; key schema is part of the shared schema, rabbit hole 5) | replay run with network off reproduces the `EvalReport` `reportDigest` (G7; the `EvalRunTelemetry` sidecar is excluded, R1); API-unavailable is a typed degraded state |
| `Evaluator` → `EvalReport` | C0 | schema-validated, content-addressed report (corpus hash, `gold/v1`, per-call `ModelIdentity`, per-metric scores) + a per-run `EvalRunTelemetry` sidecar (Tier-L, Tier-D) that is never in the digest (R1); metric *names* from upstream #574 (T3) | `beep qa` inventory discipline (`qa-inventory/v1` in `packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts`) | **yes** — lab-local `EvalReport`/`EvalRun` schemas with the `gold.proposer.provider !== extractor.provider` refinement (S2) | keep "how correct" split from "how fast" (#228/#231); no success-shaped dummy metrics (#1143) |
| `EmbeddingModel` → `EmbeddingVector` | C1 | `OpenAiEmbeddingModel.layer` via `@beep/openai` | `effect/unstable/ai/EmbeddingModel.ts` (Effect reference checkout, rc.111), `@effect/ai-openai` root dep 4.0.0-rc.111 | the driver = `openai-driver` packet; lab-local `ModelIdentity` wrapper (`taskType`, revision, artifactHash) | a vector without `ModelIdentity` is unrepresentable; `DegradedEmbedding` is the only degraded state (random/hash fallback, #1140) |
| `VectorIndex` | C1 | DuckDB exact kNN over dimension-keyed tables | `@beep/duckdb` (`packages/drivers/duckdb/src` — `DuckDb.service.ts`, `DuckDbSqlClient.service.ts`) — **no vector surface**; SQL kNN is app-local | — (SQL in the lab) | no DDL names a dimension (B4, rabbit hole 14); alternate-dimension fixture proves keying |
| `RdfProjection` | C1 | Oxigraph rebuild-from-ledger per run, SPARQL | `packages/drivers/oxigraph/src` — `Oxigraph.sparql.ts`, `Oxigraph.errors.ts`, `@beep/rdf`, `@beep/semantic-web` (`ShaclValidationResult` at `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`) | — | adapter ignores `timeoutMs` → every call under an Effect-level timeout (rabbit hole 8); `QuadDelta`-shaped witness for rebuild identity |
| `Reasoner` (runtime) → `InferenceEvent` | C2 | ρdf closure (rdfs2, 3, 5, 7, 9, 11 as `RdfsRule` values) + one SKOS broader-transitivity rule, naive fixpoint (S5) | v3 `rete` audit vocabulary as seed (`research/grounding-v3-logos.md`); SKOS schemes from active goal `semantic-foundation` (`packages/ontology`, `packages/foundation/modeling/ontology` — the shared spine, D13) | **yes** (small) | closure equality + per-`InferenceEvent` rule validation, never premise-set identity (S8); vacuous `conforms: True` (#1124, #1082, #1182) unrepresentable |
| `ProofOracle` (test-time) | C2 | EYE WASM decoding gold proofs | none in `packages/drivers` (`n3`, `oxigraph`, `shacl`, `rdf-canonize` exist; no EYE); npm `eyereasoner` (MIT, `research/SOURCES.md`) not yet a dependency | **yes** — wiring only; `--restricted`, host byte/time caps | oracle, never runtime; proofs are gold *conclusions* + spot-check, not a shape to match (rabbit hole 11) |

Capability-check verdicts (post-M1): 13 contracts; 9 compose existing bricks outright; 4 are NET-NEW
and all four are lab-local schema/wiring (`ProviderCache`, `EvalReport`, ρdf `Reasoner`, EYE wiring),
plus the lab-local write-model schemas (`EvidenceBatch`, `ModelIdentity`, `ConflictWitness`) and one
NET-NEW package (`@beep/openai`, its own packet). No NET-NEW row duplicates a live brick:
`CanonicalText` composes `ResolvedSourceText` + `TextAnchor` (M1) instead of rebuilding them;
`ConflictWitness` mirrors `ContradictionCandidate`; `EvidenceClaim` spreads `TextAnchorFields` +
`Confidence` like epistemic `EvidenceSpan`; `ModelIdentity` has no carrier anywhere in-repo
(epistemic `UsageRecord` holds provider/model only) and stays NET-NEW.

## Sequencing

1. **Scaffold the lab (day one, inside `semantica-canary`)** — `create-package … --lab`, one
   `cargo check`, freeze `src-tauri`, hand-write `server/main.ts` + `src/runtime/Layer.ts`, commit
   F1 fixtures and the W1 manifest (id + sha256 + bytes over the first 25 of the 76 on-disk PDFs).
   Why first: everything downstream is a test or CLI entry in this shell; nothing runs before it.
2. **C0 = the first vertical slice** (below). Why: it is the spine every family probe hangs on and
   the only stage with zero external dependencies beyond hosted `LanguageModel` Layers that
   already exist.
3. **`openai-driver` in parallel with C0** — a small driver-family PR with full ceremony (docgen,
   changeset, new-package governance gates). Why now: C1 cannot start without an `EmbeddingModel`
   Layer, and the driver has no dependency on C0; running it beside C0 means C1 never waits.
4. **C1 → C2** in order under the breaker (S1): first-probe candidate, one retry, then park + drop
   back to `decompose`. C2 is the last stage of Goal 1; its pass writes the family verdicts into
   `DECISIONS.md` and only then into the atlas (B1).
5. **Post-C2 (queued, reopen here at `decompose` when a gate fires):** `semantica-storage-inversion`
   and `semantica-reasoning-spike` become eligible together at C2 pass; the reasoning spike also
   needs the `G-entailment/rules` fixture. `semantica-atlas-sync` re-enters only on its O3 trigger
   (semantica 0.6.7+ ships or an atlas-edit need arises — never a canary stage, M4). The two O4 OSS gates sit behind the spike and behind a non-semantica reuse
   proof respectively.
6. **T2 rule, standing:** never wait on overlapping upstream PRs (RETE #1077 vs catalog twins,
   SHACL docs #1158/#1150, Turtle escape #1148/#1122). The port decides from the shared schema;
   upstream landings are atlas telemetry.

7. **Delivery vehicle (M5/M6):** PR A = the `@beep/nlp` Handoff mentions fix (code, own branch,
   independent); PR B = the docs-only graduation ceremony (this map at v1.0, both goal packets,
   exploration flipped `graduated`, ATLAS/INDEX, the ROADMAP lab-canary funnel clause); PR C = the
   lab mint — `semantica-canary` P1 step 1 on its own PR per labs doctrine (#742 precedent).

Optional / never: Explorer window, sidecar/IPC bridge, packaging matrix — later milestones inside
Goal 1's SPEC, not packets here (A5, D12, D16).

## First Vertical Slice

**C0 on F1 + one W1 paper** (law table: "first vertical slice = C0 on F1 + one W1 paper"). The
paper is one of the three G-relation papers, chosen because it carries all three gold sets
(G-structure, G-entity, G-relation) at once.

What an agent can do when it lands:

```text
bun run --cwd apps/labs/semantica server/main.ts canary c0 --manifest w1.manifest.json --paper <id>
bun run --cwd apps/labs/semantica server/main.ts canary c0 --manifest w1.manifest.json --paper <id> --offline
```

The first run parses F1 + the paper to `CanonicalText`, chunks with spans, extracts an
`EvidenceBatch` through a hosted `LanguageModel` (and the Wink pattern backend under the same
probe), appends it with its `ProvenanceEvent`s to the PGlite ledger in one transaction, and scores
an `EvalReport` over G-structure / G-entity / G-relation with `gold/v1` proposed by a different
provider family (S2). The second run, with the network off, replays from the `ProviderCache`.

How we verify (a lab test, not a screenshot):

- the two `EvalReport`s have equal `reportDigest`s (replay identity, G7); their `EvalRunTelemetry`
  sidecars differ and are excluded (R1);
- every span in every claim slices back to exactly its `CanonicalText` text (rabbit hole 1);
- G-relation count on the paper is non-zero for the hosted extractor (S7 tripwire);
- the F1 malformed specimens decode to typed degraded states, never success-shaped output;
- the report carries corpus hash, `gold/v1`, `ModelIdentity` for every hosted call; the sidecar
  carries Tier-L results (cold start, p95) and Tier-D telemetry.

Passing the slice does not pass C0; C0 completes when the same holds over F1 + all three
G-relation papers and the full W1 manifest + F1 has run end-to-end live and replay with equal
digests (R2). The slice exists so that the first day of lab code hits a real paper.

## Open Risks Inherited From The Brief

Rabbit holes that graduate as `SPEC.md` constraints, one line each (numbers = `BRIEF.md`):

1. Span meaning is owned by `SourceTextIdentity` + `TextAnchor` (raw extracted text is canonical, no loss map); every stage maps spans as `TextAnchor`s or is lossy in its type (M1).
2. Brick defects (Wink span fabrication, langextract relation-drop, Oxigraph `timeoutMs`, shacl hang) are decoded at the boundary into degraded states; fixes ride cleanup-on-touch (O1).
3. `gold.proposer.provider !== extractor.provider` is a schema refinement on `EvalRun`; the spot-checked fraction is a committed number.
4. Embeddings Layer comes from `openai-driver`; no engine code in the lab; Anthropic has no embeddings API.
5. The provider cache is the determinism; its key schema is shared schema, not implementation.
6. Vector tables are dimension-keyed; the dimension freezes only at C1 with an alternate-dimension fixture.
7. Budgets are bundle-level; Tier-L (cold start <5 s, p95 <100 ms) are the only hard gates; RSS/deps/bytes are alarms.
8. Every Oxigraph call runs under an Effect-level timeout; a persistent triple store is post-canary.
9. C1's exact kNN is not an index verdict; ANN and pgvector-on-PGlite stay contingent.
10. Crash injection = kill after ledger commit, before projection rebuild; restart; identical rebuild. Delete/compaction belong to `semantica-storage-inversion`.
11. C2's gate is closure equality + per-event rule validation, never proof isomorphism or premise-set identity; `G-entailment/rules` gates the spike, not C2.
12. `src-tauri` is frozen through C2; the headless proof surface is `server/main.ts` + `src/runtime/Layer.ts`.
13. W1 is a committed manifest over the 76 on-disk papers; the 367 undownloaded papers are parked.
14. No id brand truncates; no DDL names a dimension.
15. `DegradedEmbedding` is the only legal degraded state; a provider swap is a new `ModelIdentity`.

Plus two the capability check adds: (16) the `@beep/nlp` `Handoff` envelope is never on the span
path — claims build from `GroundedExtraction` + `TextAnchor` (PR A makes the envelope span-bearing
regardless, M2); (17) the lab's PDF parser is `@beep/doc-text` first, direct `unpdf` text items as
the breaker's single retry, MuPDF parked (M1). PR #802's review added three more: (18) the `EvalReport` digest excludes
telemetry, which lives in an `EvalRunTelemetry` sidecar (R1); (19) every stage pass includes the
full W1 + F1 run, live and replay, with equal digests and zero unexpected typed-degraded document failures — the F1 malformed specimens are expected to decode to their declared degraded states; any W1 paper degrading fails the gate (R2); (20) C1 checks `G-projection` expectations before
rebuild identity (R3).

## Re-entry Decomposition (2026-09-03 — v1.1 RATIFIED 2026-09-03; graduated 2026-09-03)

Sequencing 5 said a fired gate reopens this file at `decompose`. The C2 pass (2026-08-31) fired
`semantica-storage-inversion`, satisfied one of `semantica-reasoning-spike`'s two preconditions,
and the P5 closeout (2026-09-02) fired the O3 atlas-edit trigger for `semantica-atlas-sync`. This
section decomposes those three queued candidates into bounded spikes. Every capability cell was
re-verified against the live checkout at `a1652c1923` (2026-09-03) and then challenged by a Sol
adversarial review (`research/reviews/2026-09-03-sol-reentry-review.md`, verdict REWORK, eight
P1s); every P1 is folded below and dispositioned in `DECISIONS.md` 2026-09-03. Ratified 2026-09-03
(grill rounds 1–7) and graduated the same day: `goals/semantica-atlas-sync`,
`goals/semantica-storage-inversion` and `goals/semantica-reasoning-spike` carry §A, §S and §R as
their SPECs' source (R4.a).

### Gate status

| Queued candidate | Preconditions (v1.0) | Status 2026-09-03 | What re-enters |
| --- | --- | --- | --- |
| `semantica-storage-inversion` | C2 pass | fired | one candidate with four ordered probes (P-S0..3; R1.e) |
| `semantica-reasoning-spike` | C2 pass **and** `G-entailment/rules` fixture committed | half-fired; nobody owns the fixture | the fixture becomes the spike's own P1 (R2) |
| `semantica-atlas-sync` | semantica 0.6.7+ **or** an atlas-edit need | need fired (positive row values unblocked); the version trigger is unverified (local `danklocal` checkout is still 0.6.6 at `add1c006`) | the verdict lane only (R3) |

### S. `semantica-storage-inversion` — what "delete" and "compaction" must mean

**Problem the spike answers.** D16 makes provenance-first binding only after delete, compaction and
desktop-storage semantics exist (A6). Today the lab's ledger is seven PGlite tables of digest-checked JSON payload rows (`payload TEXT NOT NULL`, `digest` = sha256 of the canonical encoded payload; not every primary key is the digest of its row, `parse_outcomes.id` is the document id) with a `prev`-linked `ProvenanceEvent` hash chain whose id hashes `(prev, body)`
(`apps/labs/semantica/src/layers/LedgerLive.ts` lines 49–56, 80–86, 92–100;
`src/schema/Provenance.ts` lines 136–183). The schema already carries an
`Invalidated { claim, reason }` body ("a reasoned tombstone … without deleting it"), but no Layer
emits it (`test/Schema.test.ts` is its only user) and no `DELETE` or `UPDATE` exists anywhere in
the lab. Rabbit hole 10 proved only that projections are derived. Two facts the review surfaced shape everything below: the RDF rebuild consumes `batches` only, never the `Parsed`/`Chunked` event bodies, and `Ledger.read` selects `batches`, `parse_outcomes` and `events` as independent rows, so nulling an event payload removes nothing a document left in the other tables (`LedgerLive.ts` lines 205–230, `src/layers/RdfProjectionLive.ts` lines 67–73); and `appendEvent` checks only its own stored
digest, never that `prev` exists or that the head is unique.

**The split the packet has been eliding.** "Delete" names two different needs and one word cannot
carry both in an append-only ledger:

1. *Logical retraction* — a claim is wrong or superseded. The ledger keeps the bytes; projections and
   every downstream `InferenceEvent` that depends on it must disappear on rebuild. This is the
   existing `Invalidated` body plus support-set retraction.
2. *Physical erasure* — a desktop user removes a document and expects its bytes gone. A tombstone
   does not satisfy this, and neither does dropping one event's payload: the document's text,
   chunks, batches, claims, provider-cache entries and run outputs are all separately retained.

Proposal, corrected after review:

- `Invalidated` stays a `ClaimId`-targeted logical retraction. Its downstream reach is derived, not
  stored: `claimQuads(batch, claim)` (`RdfProjectionLive.ts`) is the deterministic bridge from a
  claim to the content-addressed `StatementId`s the reasoner consumes, so retraction recomputes
  that bridge and removes every `InferenceEvent` whose recorded local `premises` (`ProofDag`
  nodes, `src/schema/Reasoning.ts` lines 273–357) transitively include a retracted statement.
- `Redacted` targets a `DocumentId` and carries its *erasure closure*: the document, parse outcome, chunk, batch and claim rows keyed by that document, the conflict rows reached through those claim ids (`conflicts` has no document column), the run outputs and report copies derived from the document (R1.b), the provider-cache entries whose input hash derives from its chunks (a reverse index the spike must add), and the event ids whose bodies name it. P-S2's spec states the atomic protocol (closure rows deleted in one transaction, then a copy-to-fresh-`dataDir` or `VACUUM FULL` purge) and inventories every copy class it covers: WAL and TOAST inside `dataDir`, report and telemetry files, provider-cache entries; the gate proves each is gone or documented as out of scope (R1.h). The closure's derived rows are physically deleted as the
  event's effect; the named `events` rows keep `(id, prev, body_digest)` and drop `payload`
  (DDL change: nullable payload, a `body_digest` column populated for every event, and a `prev` column, since `prev` lives only inside the payload today; R1.c).
- `Compacted` folds a chain prefix into a content-addressed snapshot (`CompactedSnapshot`: event
  range, fold digest, projection digests) and becomes the trust root for everything before it.
- **Chain law, weakened honestly.** A redacted event's id cannot be recomputed once its body is
  gone; `(id, prev, body_digest)` is a commitment, not a proof. The verifiable property is therefore
  *continuity from the last compacted checkpoint*: every event after the snapshot whose body remains recomputes its id from `(prev, body)`; redacted events are checked only as `(id, prev, body_digest)` commitments, because an id hashed from a vanished body can never be recomputed from its digest and the id scheme does not change (R1.d); `prev` exists, the head is unique, and the snapshot's fold digest matches. Folds and replay walk chain order via `prev` links; `recorded_at` stays telemetry and `Ledger.read` walks `prev` from the checkpoint (R1.i). That needs a chain validator the lab does not
  have; it is NET-NEW.

**Probes, under S1 as one candidate.** S1 grants a family its first-probe candidate; a stage failure
buys exactly one more candidate; a second failure parks the family. The three probes below are one stage of one candidate, run in order (R1.e; "one S1 candidate" means the family's opening candidate, and S1's exactly-one redesigned candidate after a stage failure still applies, R0.a). A failed probe is the stage failure and buys one redesigned
candidate for that probe; a second failure parks the family and drops back here.

| Probe | Fixture | Gate | Kill |
| --- | --- | --- | --- |
| P-S0 entry check | the workstation-local provider cache (`SEMANTICA_PROVIDER_CACHE_DIR`, ~152 MB, untracked) | `c2 --offline` regenerates the full-W1 ledger and reproduces report digest `2a2089ea…` (last proven 2026-09-03 02:40Z) | no reproduction ⇒ the spike has no fixture and does not start |
| P-S1 retraction | that ledger plus `Invalidated` events for a committed claim subset that feeds C2 inferences | rebuild-from-ledger digests of all three projections (DuckDB kNN, Oxigraph, PGlite adjacency/proof) equal the incremental-apply digests; every `InferenceEvent` whose recorded premise closure includes a retracted statement is absent; a `QuadDelta`-shaped witness lists exactly the removed quads and statements | retraction cannot be derived from the recorded local premises (S8 permits exactly those; oracle premise choice is never consulted), or any in-place `UPDATE`/`DELETE` of a claim row |
| P-S2 compaction + erasure | same ledger; `Compacted` over the prefix up to the last `Chunked` event; `Redacted` over one W1 document | after compaction alone, replay from snapshot + tail reproduces `2a2089ea…` byte-for-byte (R1 sidecar excluded); after erasure, the rebuilt projections and a fresh replay equal a cache-only run over the W1 manifest minus that document; continuity from the checkpoint verifies | any digest drift after compaction alone; the snapshot must retain a redacted payload; any closure row survives erasure |
| P-S3 desktop storage | file-backed `dataDir` under an app-data-shaped root (`@beep/pglite` `makeLayer({ dataDir })`); SIGKILL mid-compaction via the existing `CrashProbeChild` pattern | on-disk bytes decrease after compaction and erasure (measured, recorded in the sidecar); after the crash the restarted ledger verifies as exactly the pre- or post-compaction chain, never a torn one | bytes never reclaimable in PGlite WASM (`VACUUM FULL` under Bun/NodeFS is unverified; the redesigned candidate is copy-to-fresh-`dataDir` compaction) |

All probes are replay-offline, so the spike spends nothing on hosted calls. Tier-L bars are
re-measured after compaction as a regression check, not a new gate.

**Capability check.**

| Contract | Live brick (verified 2026-09-03; re-checked by the Sol review) | NET-NEW | Tripwire |
| --- | --- | --- | --- |
| `Invalidated` tombstone | `src/schema/Provenance.ts` `InvalidatedEventBody` (`ClaimId`), `EventKind` LiteralKit | emission path in `LedgerLive.appendBatch`; claim→statement bridge via `claimQuads`; support-set retraction over `InferenceEvent.premises` | a retraction that cannot name the statements and events it removes is unrepresentable |
| `Redacted` / `Compacted` events | `ProvenanceEvent` hash chain (`prev`, `makeProvenanceEventId`), `contentDigestSync`, row `digest` | **yes** — two event bodies, `CompactedSnapshot`, erasure closure, provider-cache reverse index, `body_digest` column + nullable payload, chain validator (prev exists, unique head, checkpoint continuity) | `Redacted` targets a `DocumentId`; its closure is computed from the ledger, never hand-listed |
| Rebuild identity witness | `src/schema/Projection.ts` `QuadDelta`; `src/schema/Reasoning.ts` `CrashProjectionInput`, `CrashIdentityWitness`; `test/helpers/CrashProbeChild.ts` | extend the witness with removed statements and events | empty-delta rebuild identity from C1 stays the regression |
| File-backed ledger | `packages/drivers/pglite/src/PgliteClient.service.ts` `makeLayer({ dataDir })`, `LedgerLive` `ledgerRoot/runId/mode` layout, `src/schema/Telemetry.ts` sidecar | size accounting (bytes before/after) in `EvalRunTelemetry` | no dimension, no wall clock in the digest (R1) |
| Bitemporal / lifecycle shapes | effect-ontology `ClaimWithRank` transactionTime split, `CurationAction`/`CurationEvent` command-vs-event split, `ConflictTransition` (borrow-shape only, `research/effect-ontology-map.md` rows 102, 105, 148); `@beep/rdf` Prov `invalidatedAtTime` (`Prov.ts` line 283) for the PROV-O projection | — | effect-ontology's in-place `deprecateClaim` UPDATE is the anti-pattern (map row 27) |
| Upstream shape being inverted | semantica `ProvenanceEntry` invalidation fields + checksum chain, `change_management` snapshot/rollback (`research/grounding-semantica-repo.md` lines 76–79) | — | reference only (MIT, Hawksight AI; `research/SOURCES.md`) |

**First slice.** P-S0, then P-S1 on one W1 paper: invalidate two claims that feed a C2 inference,
rebuild, and assert the witness. Passing the slice does not pass the spike; the spike completes
when P-S1..3 hold over the full C2 ledger.

### R. `semantica-reasoning-spike` — the fixture is the spike's first slice, not its gate

**Deadlock in v1.0.** The spike's second precondition, "`G-entailment/rules` fixture committed",
names no owner. `semantica-canary` is completed-retained and its SPEC excludes the rules suite
(constraint 11); nothing else builds fixtures. Proposal (R2): the fixture is the spike goal's P1,
and the three adhd first-step probes are P2–P4, each ablated against EYE on that fixture.

**What exists to build on, and what does not.** `scripts/generate-g-entailment.ts` already drives
the restricted EYE oracle (`test/helpers/EyeOracleChild.ts`, 64 KiB input / 1 MiB output caps)
and writes `fixtures/gold/v1/g-entailment-rdfs.{json,n3}` (`g-entailment-rdfs/v1`, EYE 11.24.5
via `eyereasoner` 21.1.18, per-case `eyeProofDigest`). `StatementPattern` admits variable
predicates, so Datalog-style production rules over user vocabulary need no new pattern language;
`RdfsRuleId` (a seven-member LiteralKit) must widen to a branded rule id and `InferenceEngine`
(`S.Literal("semantica-rhodf/1")`) to a domain. The case-runner shapes do **not** carry over:
`GEntailmentExpectation` is pinned to `g-entailment-rdfs/v1` and its case/witness classes have no
place for a rule program, an invalidated input, a before/after diff, a budget, a truncation fact
or a conflict expectation (`src/schema/Reasoning.ts` lines 478–545), and `ConflictWitness` pairs
`ClaimId`s while reasoner conclusions are `StatementId`s (`src/schema/Evidence.ts` lines 847–858).
P1 therefore opens with a schema-first `g-entailment-rules/v1` tagged family (case, expectation,
witness) before any case is written.

**P1 — the `G-entailment/rules` fixture (docs + fixtures + generator, no engine).** Twenty cases in
five classes, generated under the same oracle pins. Each class names what EYE can independently
establish and what is lab-owned expectation:

| Class | Cases | What it forces | EYE gold | Lab-owned expectation |
| --- | --- | --- | --- | --- |
| R-a join | 4 | 2–3-premise production rules over user vocabulary with shared variables | closure + proof digest | closure equality, per-event rule validation (S8) |
| R-b recursion | 4 | linear and non-linear transitive closure, depth 3–6 | closure + proof digest | same |
| R-c retraction | 4 | asserted set minus one `Invalidated` premise | two closures: with and without the retracted premise | the derived set shrinks by exactly the diff; retraction derived from recorded premises |
| R-d budget | 4 | finite instances with large closures (chain 50, product 10×10) plus a declared depth or fan-out budget | complete closure of the finite instance | *two* runs: unbudgeted equals EYE; budgeted emits an `InferenceTruncated` fact at the declared boundary carrying the last complete proof node and a deterministic budget-prefix witness |
| R-e contradiction | 4 | two rules deriving statements the lab classifies as conflicting | both statements derivable | a statement-level conflict witness (new, distinct from the claim-level `ConflictWitness`) and two surviving nodes, never a merge |

Fixture risks named up front: `--restricted` EYE may reject `log:notIncludes`, so stratified
negation is *not* in the twenty; if a negation class is wanted it is a typed gap recorded in the
fixture, not a silent omission. R-c reuses the same `Invalidated` semantics as P-S1, so the two
spikes share one tombstone law and R-c sequences after P-S1 lands.

**P2–P4 — the adhd probes as kill criteria** (`research/adhd-reasoning.md`, unchanged):

| Probe | First step | Already-have from C2 | Kill |
| --- | --- | --- | --- |
| P-R1 proof-ledger kernel | `CanonicalProofNodeV1` + deterministic encoder + hash; stable across premise-order permutations and cold replays | `ProofDag`, content-addressed `InferenceEvent` ids (`Reasoning.ts` lines 342–425), replay-identical C2 reports | canonicalization drift |
| P-R2 budget-certified rules | `RuleCertificate` + pure `compileRuleCertificate`; R-d cases produce the proof-linked `InferenceTruncated` fact | `RdfsRule` as data (`Reasoning.ts` lines 107–116); naive fixpoint Layer (`src/layers/ReasonerLive.ts` lines 247–315) | certificate unsoundness (unsound admission or bounds that reject real rules) |
| P-R3 evidence-graph workspace | `EvidenceBatch` → kernel → `InferenceEvent` end to end on R-c/R-e with retraction | `EvidenceBatch`/`ConflictWitness` schemas (`Evidence.ts`), `LedgerLive.appendBatch` (lines 151–195) | unstable identity/invalidation across re-extraction and replay |

The v3 `rete` salvage enters at P3 (P-R2, whose adhd first step is beside the v3 Rete compiler) and is ablated in P4 (P-R3) as the match-engine candidate: its 46 behavioral tests are ported first as the oracle for match semantics, then rete-port vs naive fixpoint vs EYE are ablated on the rules fixture (R2.g; this sentence previously said P-R3, which is P4). **Precondition surfaced this session:** the archived `beep-effect-logos`
root is absent from the workstation path `research/SOURCES.md` records
(`projects/beep-effect-logos`; searched `~/YeeBois`, `~/data-home`, `~/.cache/beep` to depth 4 on
2026-09-03); locating or restoring it is a P3 entry condition, and `research/SOURCES.md` keeps it
reference-only until then. The spike is one S1 candidate: P1–P4 are its stage, a failed probe buys
one redesigned candidate, a second failure parks the family.

### A. `semantica-atlas-sync` — split D5 into a verdict lane and a facts lane

**What actually fired.** The passed canary unblocked positive row values. P5 wrote six `park` rows
and explicitly declined four rows that need positive vocabulary — `Oxigraph (embedded)`,
embedding-model `OpenAI`, `pattern`, `llm` (`goals/semantica-canary/history/p5-atlas-sync.md`,
"Not written"). That is the atlas-edit need. It is *decision* data (A9: the repo is the single
writer of decision facts), not IR facts, so the Python extractor is not on its path at all. The
Current-law Atlas-writes row already says these values are unblocked; the Verdict map's "today
only final park/drop" cell lagged it and is corrected in the 2026-09-03 `DECISIONS.md` entry.

**Verdict lane (now, bounded — R3).** A schema-validated verdicts file in this packet
(`research/atlas/verdicts.json`, `atlas-verdicts/v1`: catalog, row title, `Verdict` from the D3
LiteralKit `adopt | adapt | already-have | park | drop`, `Beep counterpart` text, evidence = the
dated `DECISIONS.md` entry + sheet section). Render → diff (Notion SQL read of `Verdict` across the
33 catalogs against the file) → one canary write → apply → SQL read-back, exactly the P5 method.
Scope: the live park rows as baseline (the 2026-08-24 upgrade read back 13 D10 auto-parks and P5 wrote six; the 33-catalog read establishes the count, and `verdicts.json` lists every row it touches before the lane is called bounded, R3.b) plus the positive rows the verdicts justify — at most the four named above and any `already-have` row that has a dated, row-specific `DECISIONS.md` entry naming its shipped `@beep/*` counterpart (R3.d; package existence is never a verdict, D7); zero new Notion rows, properties, or schema (the repo's `atlas-verdicts/v1` is NET-NEW, R3.e). `Beep counterpart` rides with the verdict because a
positive verdict without its counterpart is the atlas failure mode D3 was written to prevent. B1
forbids nothing here: row values are written only after the matching canary stage passed, and
family vocabulary (`pick-one`, `bundle`, `park-pending-canary`) never reaches the atlas.

**Facts lane (stays queued on O3's version trigger).** IR → component rows. The extractor
(`scratchpad/semantica-ir/extract.py`, 559 lines, `ir-schema.json`) was committed in #790
(`fd560ca8e5`) and deleted by #882 to clear quality diagnostics; it survives in git history and in
several stale sibling checkouts. Its lawful home is an open question for the lane, not for this
re-entry: a pinned out-of-repo tool clone under `~/.cache/beep/` is the AGENTS-conformant default.

**Capability check.**

| Contract | Live brick (verified 2026-09-03) | NET-NEW | Tripwire |
| --- | --- | --- | --- |
| Notion read/write | Claude Notion plugin (present in this session's tool roster, not exercised) + Codex Notion MCP (`codex mcp login notion` after the 2026-09-02 revocation; writes need `--approve-for-me`) — **not live-verified this session**; P5 proves the method and the previous writes, not current authentication | — | check `codex mcp list` auth before delegating; one canary write before any batch |
| Sync method | `goals/semantica-canary/history/p5-atlas-sync.md` (proposal → inventory → canary write → apply → read-back) | render/diff script (small TS; recommended home `apps/labs/semantica/scripts/`, beside `generate-*.ts`) | never adds rows or schema |
| Verdict domain | D3 column values; `@beep/schema` `LiteralKit` | `atlas-verdicts/v1` schema + `verdicts.json` | family vocabulary is never an atlas value (Verdict map) |
| Tracked evidence data in a packet | `research/tracker/inventory.jsonl` precedent (725 rows) | — | redact Notion ids and home paths (review-loop law, 2026-08-24) |
| IR extractor (facts lane) | git history `fd560ca8e5:scratchpad/semantica-ir/{extract.py,ir-schema.json,README.md}` (all three verified present) | home decision | fails closed on any parse failure; output SHA-256 recorded in `research/ir-extraction-report.md` |

### Sequencing and delivery

1. **Verdict lane first** (hours; docs + Notion; no code risk). It also settles the atlas
   vocabulary the storage and reasoning packets will later write into.
2. **Storage spike second** (zero hosted spend; unblocks D16 becoming binding). P-S1 lands before
   R-c because they share the tombstone law.
3. **Reasoning spike third**, P1 fixture in parallel with the storage spike except R-c; P2–P4 after
   P-S1 ratifies the retraction semantics.
4. Delivery: three goal packets as v1.0 named them, each at its own weight — `semantica-atlas-sync`
   at template weight with the facts lane as a gated P2; the two spikes carry their probes as
   phases. The O4 OSS gates are untouched: `reasoning-package` still waits on the spike surviving
   ablation, `evals-harness` on a non-semantica reuse proof.

### Ratification items (RATIFIED 2026-09-03 — grill rounds 1–7 in `DECISIONS.md`; the amendments named below are applied inline above)

- **R1 (storage):** tombstone ≠ erasure; `Invalidated` stays logical (claim-targeted, reach derived
  through `claimQuads` and recorded premises); `Redacted` is document-targeted with a computed
  erasure closure; `Compacted` is the trust root and the chain property is continuity from the
  checkpoint; P-S0..3 as one S1 candidate on the workstation-regenerated C2 ledger. Ratified with amendments: the closure includes run outputs and P-S2 states an atomic protocol with a copy-class inventory (R1.b, R1.h); redacted events keep `(id, prev, body_digest)` with a `prev` column (R1.c); redacted ids are commitments only and the id scheme does not change (R1.d); folds and replay use chain order (R1.i); the S1 breaker wording is the dated entry's, now also in the Current-law row (R0.a).
- **R2 (reasoning):** the `G-entailment/rules` fixture is the spike's P1, opening with a NET-NEW
  `g-entailment-rules/v1` tagged family (twenty cases in five classes, EYE gold separated from
  lab-owned expectations, no negation class in `gold/v1`); adhd probes are P2–P4; the v3 archive must be located before P3, which is P-R2 (the probe-table sentence amended from P-R3, R2.g); one S1 candidate, meaning the opening candidate with S1's one redesigned candidate still available (R0.a, R2.f).
- **R3 (atlas):** D5 splits into a verdict lane (now, `Verdict` + `Beep counterpart` on at most the
  named rows, zero schema) and a facts lane (queued on 0.6.7+); script home = lab `scripts/`, data
  home = this packet's `research/atlas/`; the Verdict map cell is amended for coherence. Ratified with amendments: `already-have` rows need a dated, row-specific entry (R3.d); exact rows are listed and the park baseline is taken from a live 33-catalog read (R3.b); "zero schema" means zero Notion schema (R3.e).

## Dispositions (ratified 2026-08-24 — `DECISIONS.md` M1–M6)

1. **`openai-driver` is its own packet** at template weight (M3). v0.1's premise "every existing
   driver has its own goal" was false (`@beep/anthropic` shipped as a slice of
   `workspace-thread-domain`; tika/libpff/doc-text were folded); the reasons that hold are the
   quality-regime split (lab ceremony-exempt vs driver ceremony), the parallel PR beside C0, and the
   per-packet completion gate. Precedent: `pretext-driver`.
2. **PDF parser is `@beep/doc-text` first**, direct `unpdf` text items as the breaker's single retry,
   MuPDF parked (M1). `CanonicalText` is composed from `ResolvedSourceText` + `TextAnchor`; the
   loss map is dropped because raw extracted text is canonical (`citation-verified-span-substrate`).
3. **`@beep/nlp` Handoff mention/span drop is fixed now** in its own PR (M2, O1 exception);
   the lab still builds claims from `GroundedExtraction` + `TextAnchor`.
4. **Atlas gate restored to O3 verbatim** (M4): only the D5 sync pipeline is the queued goal;
   templates, row-fill and analyses are async codex batches.
5. **Both packets graduate in one docs-only ceremony PR**; the lab mint is its own PR (M5).
6. **ROADMAP funnel policy amended**: lab canaries are slot-free; four unlisted graduations
   recorded as drift (M6).
