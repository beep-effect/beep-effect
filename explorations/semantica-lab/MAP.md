# Map — Semantica Port Atlas & Lab

<!-- Stage 4. Decomposition into candidate goal packets. This is the graduation surface: the
definition-of-ready in explorations/README.md is checked against this file. Every major
component cites an existing repo capability or is explicitly marked NET-NEW. -->

Status: **v1.0 — RATIFIED by Benjamin 2026-08-24 (MAP grill M1–M6 applied; see Dispositions).**

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
| `semantica-storage-inversion` | Spike: delete / compaction / desktop-storage semantics for the append-only `ProvenanceEvent` ledger so provenance-first (D16) can become binding; `Invalidated` tombstones, never in-place `UPDATE`. | `semantica-canary` C2 pass | `@beep/pglite`, `@beep/provenance`, shared-schema `ProvenanceEvent`; effect-ontology `Timeline` bitemporal shape (borrow-only) | queued — gate A6-storage |
| `semantica-reasoning-spike` | Dated NET-NEW spike: proof-ledger kernel + budget-certified rules + evidence-graph workspace (`research/adhd-reasoning.md`), entered through its three named first-step probes as kill criteria and ablated against the EYE oracle on `G-entailment/rules`; the v3 `rete` salvage enters here, not at C2. | `semantica-canary` C2 pass; `G-entailment/rules` fixture committed | EYE oracle wiring from Goal 1; v3 `rete` + 46-test oracle (`research/grounding-v3-logos.md`, archive out-of-repo); `@beep/rdf` `ObjectTerm`/Prov shapes | queued — gate A6-reasoning |
| `semantica-atlas-sync` | The D5 render/diff sync pipeline: regenerate the Notion `@beep/semantica` atlas from the schema-validated IR (`scratchpad/semantica-ir/`) and diff it (O3 verbatim, M4). Template exemplars, IR row-fill and the 27 module analyses are async codex batches, not this goal. | re-entry trigger: semantica 0.6.7+ ships **or** an atlas-edit need arises (O3) | `research/ir-extraction-report.md` pipeline, `research/atlas-upgrade-report*.md`, Notion MCP (Codex + Claude, both OAuth'd) | queued — gate O3 (M4) |
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
