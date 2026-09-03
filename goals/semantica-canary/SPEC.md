# Semantica Canary Spec

## Objective

Scaffold the headless-first Tauri lab at the future apps/labs/semantica and run
the staged canary C0 → C1 → C2 over F1 + W1 under the probe breaker (S1),
emitting replay-identical `EvalReport`s. Each passing stage flips its capability
families from park-pending-canary to a real verdict in the exploration's
`DECISIONS.md`, and only then in the Notion atlas (B1).

Scope is defined by reference, not restated here:

- **The chain, staged** —
  [`BRIEF.md` §Solution Sketch, "The chain, staged"](../../explorations/semantica-lab/BRIEF.md#the-chain-staged):
  C0 proves the spine (parse → `CanonicalText` → chunk → extract → ledger →
  `EvalReport`), C1 adds the two derived projections (dimension-keyed vector
  table, RDF rebuild-from-ledger), C2 adds reasoning, crash injection, and the
  Tier-L bars.
- **Service roster** —
  [`BRIEF.md` §Solution Sketch, "Service boundaries (D8 made concrete)"](../../explorations/semantica-lab/BRIEF.md#service-boundaries-d8-made-concrete)
  and the re-verified
  [`MAP.md` §Capability Check](../../explorations/semantica-lab/MAP.md#capability-check-goal-1--semantica-canary):
  thirteen lab-local, promotion-shaped `Context.Service` contracts; nine compose
  live bricks, four are NET-NEW lab-local schema/wiring (`ProviderCache`,
  `EvalReport`, ρdf `Reasoner`, EYE oracle wiring) plus the lab-local write
  models (`EvidenceBatch`, `ModelIdentity`, `ConflictWitness`).
- **Lab charter** —
  [`BRIEF.md` §Solution Sketch, "The lab and its charter"](../../explorations/semantica-lab/BRIEF.md#the-lab-and-its-charter):
  construction side only; `trustgraph-workbench` keeps consumption (D13); full
  code law, ceremony-exempt, exports nothing reusable
  ([`standards/architecture/15-lab-apps.md`](../../standards/architecture/15-lab-apps.md)).
- **What "done" looks like** —
  [`BRIEF.md` §"What 'done' looks like for Goal 1"](../../explorations/semantica-lab/BRIEF.md#what-done-looks-like-for-goal-1).

Provenance: graduated 2026-08-24 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md).

## Non-Goals

Each line is one item of
[`BRIEF.md` §No-Gos](../../explorations/semantica-lab/BRIEF.md#no-gos); the
brief carries the rationale.

- No plugin system, adapter zoo, or multi-driver support; a second backend is
  one new Layer against an existing contract, later (D8).
- No local models, ONNX runtimes, GPU/ROCm lanes, or model downloads in M1 (G6).
- No fully-offline live inference as an M1 criterion; offline means replay from
  the provider cache (G7).
- No consumption-side retrieval, GraphRAG, hybrid search, graph analytics, or
  graph UX; that is `trustgraph-workbench`'s charter (D13). C1's projections
  are construction proofs, not retrieval features.
- No window, sidecar/IPC bridge, packaging matrix, or explorer UI in M1
  (A5, D12, D16). Mobile is a permanent no-go.
- No OCR, DOCX, email, or archive ingestion; no URL ingest before a gate-6 SSRF
  policy exists.
- No agent-framework integrations, MCP editor targets, LLM provider
  multiplexing, visualization backends, or deploy infrastructure (D10).
- No server-only or operator-managed engines (FalkorDB, Neo4j, hosted Qdrant,
  Jena server); recoverable via Layer (D9).
- No `adopt`/`pick-one` values written to the Notion atlas before the matching
  canary stage passes; no atlas backlog work inside Goal 1 (B1, O3).
- No NET-NEW reasoning substrate as the M1 runtime; it is a dated post-C2
  spike (A6).
- No reusable `@beep/*` export, root barrel, export map, docgen surface, or
  tables migration from the lab (labs law); no imports of
  `apps/professional-desktop` internals.
- No Oppold corpus references in any committed artifact (D14).
- No posting or pushing of the exploration's `research/drafts/*` without
  Benjamin (O1, O2).

## Source Hierarchy

1. User decisions recorded in the source exploration:
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) Current law
   table and M1-M6.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development, yeet, reflect).
3. `standards/ARCHITECTURE.md` with
   [`standards/architecture/15-lab-apps.md`](../../standards/architecture/15-lab-apps.md)
   (lab law) and
   [`standards/architecture/03-driver-boundaries.md`](../../standards/architecture/03-driver-boundaries.md)
   (the driver boundary the lab composes but never crosses).
4. The exploration contracts in force:
   [`BRIEF.md`](../../explorations/semantica-lab/BRIEF.md) v1.1,
   [`MAP.md`](../../explorations/semantica-lab/MAP.md) v1.0,
   [`research/shared-schema.md`](../../explorations/semantica-lab/research/shared-schema.md)
   v1.4,
   [`research/workload-contract.md`](../../explorations/semantica-lab/research/workload-contract.md)
   v1.4.
5. The sibling `openai-driver` packet's SPEC, for the C1 embeddings Layer.
6. This `SPEC.md`.
7. `PLAN.md`.
8. `GOAL.md`.
9. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. Where this SPEC and
the exploration's Current law table disagree, the table wins until a dated
DECISIONS entry amends it.

## Target Surfaces

- The future apps/labs/semantica lab (minted by P1 step 1): fixtures, the W1
  manifest, lab-local schemas, services, Layers, tests, the headless entry
  (server/main.ts) and runtime layer (src/runtime/Layer.ts), and the lab
  manifest. `src-tauri` is frozen after the one local `cargo check`.
- `goals/semantica-canary/` - contract, stage evidence, verification records,
  and the closeout reflection.
- [`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md)
  - family verdicts, written only after the matching stage passes.
- The Notion `@beep/semantica` atlas - final park/drop values only, after
  DECISIONS (B1, A9).
- No other package changes. Brick defects ride cleanup-on-touch in their owning
  packages (O1); the Handoff fix is its own PR (M2) and is not this packet's
  work.

## Constraints

Each line is one item of
[`MAP.md` §Open Risks Inherited From The Brief](../../explorations/semantica-lab/MAP.md#open-risks-inherited-from-the-brief);
numbers 1-15 match the brief's rabbit holes, 16-17 were added by the
capability check.

1. Span meaning is owned by `SourceTextIdentity` + `TextAnchor`; raw extracted
   text is canonical, no loss map; every stage maps spans as `TextAnchor`s or
   is lossy in its type (M1).
2. Brick defects (Wink span fabrication, langextract relation-drop, Oxigraph
   `timeoutMs`, shacl hang) are decoded at the boundary into typed degraded
   states; fixes ride cleanup-on-touch (O1).
3. `gold.proposer.provider !== extractor.provider` is a schema refinement on
   `EvalRun`; the spot-checked fraction is a committed number (S2).
4. The embeddings Layer comes from the sibling `openai-driver` packet; no
   engine code in the lab; Anthropic has no embeddings API (S3-rev, M3).
5. The provider cache is the determinism; its key schema is shared schema,
   not implementation (G7).
6. Vector tables are dimension-keyed; the dimension freezes only at C1 with an
   alternate-dimension fixture (B4).
7. Budgets are bundle-level; Tier-L (cold start < 5 s, p95 < 100 ms) are the
   only hard gates; RSS/deps/bytes are alarms (B5, G4).
8. Every Oxigraph call runs under an Effect-level timeout; a persistent triple
   store is post-canary.
9. C1's exact kNN is not an index verdict; ANN and pgvector-on-PGlite stay
   contingent.
10. Crash injection = kill after ledger commit, before projection rebuild;
    restart; identical rebuild. Delete/compaction belong to the queued
    `semantica-storage-inversion` spike (A6).
11. C2's gate is closure equality + per-event rule validation, never proof
    isomorphism or premise-set identity; `G-entailment/rules` gates the spike,
    not C2 (S5, S8).
12. `src-tauri` is frozen through C2; the headless proof surface is the
    hand-written server/main.ts + src/runtime/Layer.ts (S4).
13. W1 is a committed manifest over the 76 on-disk papers; the 367
    undownloaded papers are parked (B3).
14. No id brand truncates; no DDL names a dimension (S6).
15. `DegradedEmbedding` is the only legal degraded state; a provider swap is a
    new `ModelIdentity` (S6).
16. The `@beep/nlp` `Handoff` envelope is never on the span path; claims build
    from `GroundedExtraction` + `TextAnchor` (M2).
17. The lab's PDF parser is `@beep/doc-text` first, direct `unpdf` text items
    as the breaker's single retry, MuPDF parked (M1).

Cross-cutting laws every contract obeys
([`BRIEF.md` §Service boundaries](../../explorations/semantica-lab/BRIEF.md#service-boundaries-d8-made-concrete)):
branded ids; spans + model identity + provenance refs survive every stage or
the stage declares itself lossy in its type; typed degraded states instead of
success-shaped fallbacks; `HashSet`/`HashMap`, never native; decode at
boundaries; `Effect.fn`/`Effect.fnUntraced` for generators; Effect v4 APIs
verified against the reference checkout before writing.

## Decision Log

Binding decisions live in
[`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md).
The Current law table wins over any log entry; the rows below are the ones
Goal 1 executes against, cited by row and amendment id, one line each.

| Row / id | Holds for Goal 1 |
| --- | --- |
| Stop rule (S1) | Probe-denominated breaker: first-probe candidate, one retry, then the family parks and the exploration drops to `decompose`; wall-clock is telemetry, never a gate. |
| Gold labels (S2) | Gold-proposer provider family ≠ extraction provider family as a schema refinement on `EvalRun`; spot-checked fraction committed in `gold/v1`. |
| Lab shape (S4) | `--app-kind tauri`, one local `cargo check`, `src-tauri` frozen through C0-C2, hand-written headless entry + runtime layer. |
| Storage (B1, A1) | park-pending-canary; first probe bundle = PGlite ledger SoR + DuckDB exact vector + derived graph tables + Oxigraph rebuild-from-ledger. |
| Embeddings (S3-rev, M3) | Contract `effect/unstable/ai` `EmbeddingModel`; Layer = `@effect/ai-openai` `OpenAiEmbeddingModel` through the `openai-driver` packet; `.model()` where `Dimensions` is needed. |
| Input (M1) | PDF first probe = `@beep/doc-text`; breaker retry = direct `unpdf` text items with `disableNormalization: true`; MuPDF parked. |
| Spans (M1) | Compose, not build: `CanonicalText` = `ResolvedSourceText`; spans = `TextAnchor`; tripwire = `verifyTextAnchor`; NET-NEW shrinks to `EvidenceBatch`, `ModelIdentity`, `ConflictWitness`. |
| Reasoning (S5, S8, G3/G5) | EYE is the C2 oracle, not the runtime; runtime = ρdf closure (rdfs2, 3, 5, 7, 9, 11) + one SKOS broader-transitivity rule; gate = closure equality + per-`InferenceEvent` rule validation. |
| Extraction (S7) | Hybrid and pattern-only run the same gold probe; one family verdict at C0, where G-relation scores. |
| Canary (G1) | Staged C0 then C1 then C2, each bounded by the breaker; code lives in the lab. |
| Budgets (G4, B5) | Tier-L hard bar: cold start < 5 s, p95 < 100 ms; 16 GB bundle-RSS alarm; laptop-class numbers are Tier-D telemetry. |
| Offline (G7) | Replay-offline, hosted-live: every provider result cached content-addressed; the network-off re-run reproduces the `EvalReport` `reportDigest`; the `EvalRunTelemetry` sidecar is excluded (R1). |
| Atlas writes (B1, A9) | Only final park/drop today; `adopt`/`pick-one` wait for a passed stage. |
| Repo defects (O1, M2) | Handoff mention/span drop fixed in its own PR (`nlp-ir/1.1`); the relation drop stays a draft issue, cleanup-on-touch. |
| Graduation (M5, M6) | Three PRs: fix → docs-only ceremony → lab mint; the canary is slot-free on the ROADMAP Labs line. |
| D8 | Port boundary is the `Context.Service` contract; one Layer per backend. |
| D13 | Construction (this lab) vs consumption (`trustgraph-workbench`); the ontology slice is the shared spine. |
| D14 | Eval corpus = public academia papers + committed fixtures; Oppold is local-only and never cited. |
| D16 | Provenance-first, pipeline-as-data, evals as spine, graduation targets named so lab code is promotion-shaped. |
| M1 | PDF probe + span owner (compose `ResolvedSourceText` + `TextAnchor`; no loss map). |
| M2 | Handoff span drop fixed now in its own PR; the lab does not consume the envelope. |
| M3 | `@beep/openai` is its own packet at template weight; the lab composes it in the runtime layer. |
| M4 | Atlas gate restored to O3 verbatim; no atlas work in this packet. |
| M5 | Both packets graduate in one ceremony PR; the lab mint is its own PR. |
| M6 | ROADMAP funnel: lab canaries are slot-free; drift recorded. |
| R1 (PR #802 review) | `EvalReport` = content-addressed replay-stable payload (`reportDigest` = sha256 over the canonical JSON of the report body with the `reportDigest` field omitted); per-run Tier-L/Tier-D numbers live in an `EvalRunTelemetry` sidecar never compared for identity. |
| R2 (PR #802 review) | Every stage pass includes the full W1 manifest + F1 run, live and replay, with equal digests and zero unexpected typed-degraded document failures — the F1 malformed specimens are expected to decode to their declared degraded states; any W1 paper degrading fails the gate — before any verdict. |
| R3 (PR #802 review) | C1 checks committed `G-projection` expectations (known kNN neighbour pair, non-empty SPARQL results) before rebuild identity; empty projections fail. |

### Explorer/UI milestone (D16, A5, D12)

**Decision: defer.** No window in M1; a thin workbench is a post-C2 milestone
decided by re-entry into the exploration at `decompose`, not inside this packet.

Rationale: A5 makes M1 window-optional and D12 stages the workbench behind
persistence and gesture-bearing UI that earn it; the canary's proof surface is
tests, the CLI entry, and Tier-L/Tier-D numbers, so a window adds a browser-QA
gate without adding evidence. `src-tauri` stays frozen (S4), which keeps the
Labs lane honest (no Cargo) and keeps the first day of lab code on a real
paper. Anything the workbench would show (ledger, projections, proof DAGs) is
already data in the `EvalReport`; a UI decision made before C2 would be made
against families that are still park-pending-canary (B1).

## Acceptance Criteria

Stage pass criteria are quoted verbatim from
[`BRIEF.md` §"The chain, staged"](../../explorations/semantica-lab/BRIEF.md#the-chain-staged);
the mechanism behind "every span slices back" is `verifyTextAnchor` (M1,
[`MAP.md` §Capability Check](../../explorations/semantica-lab/MAP.md#capability-check-goal-1--semantica-canary),
Canonicalizer row).

- [x] **First vertical slice**
      ([`MAP.md` §First Vertical Slice](../../explorations/semantica-lab/MAP.md#first-vertical-slice)):
      C0 on F1 + one G-relation W1 paper, run live and then with the network
      off; the two `EvalReport`s have equal `reportDigest`s (telemetry sidecars excluded,
      R1); every span in every claim
      passes `verifyTextAnchor`; the hosted extractor's G-relation count on the
      paper is non-zero; the F1 malformed specimens decode to typed degraded
      states; the report carries corpus hash, `gold/v1`, `ModelIdentity` for
      every hosted call; the `EvalRunTelemetry` sidecar carries Tier-L results and
      Tier-D telemetry (R1). Passing the slice does not pass C0.
- [x] **C0 pass** over F1 + all three G-relation W1 papers — "second run with
      the network disabled reproduces the `EvalReport` digest from the provider
      cache (G7; telemetry sidecar excluded, R1); every span slices back to its text; relation count on the
      G-relation papers is non-zero." Scoring covers G-structure, G-entity,
      and G-relation (S7); "every span slices back" is proven by
      `verifyTextAnchor` succeeding for every span. The full W1 manifest + F1 runs
      end-to-end live and replay with equal digests and zero unexpected typed-degraded document failures — the F1 malformed specimens are expected to decode to their declared degraded states; any W1 paper degrading fails the gate — before the Extractor/Input verdicts are written (R2).
- [x] **C1 pass** — projections match the committed `G-projection` expectations
      first (a known kNN neighbour pair and non-empty SPARQL result sets; empty or
      mismatched projections fail, R3), then "rebuild identity (drop projections,
      rebuild, identical query results); embedding dimension is frozen by this stage with an
      alternate-dimension fixture proving the keying (B4 defaults)." The full W1 manifest + F1
      runs end-to-end live and replay with equal `reportDigest`s and zero unexpected typed-degraded document failures — the F1 malformed specimens are expected to decode to their declared degraded states; any W1 paper degrading fails the gate — before the Storage/Embeddings verdicts are written (R2).
- [x] **C2 pass** (S8) — "the derived conclusion set equals EYE's on every
      gold case (closure equality), AND every `InferenceEvent` validates
      against its own rule (premises present in inputs-or-closure, rule
      instance correct); crash identity; cold start <5 s; p95 <100 ms.
      Matching EYE's particular premise set is not required — an entailment
      with two valid derivations must not fail C2." Tier-L numbers are read from the
      live run's `EvalRunTelemetry` (R1). The full W1 manifest + F1 runs end-to-end live and replay with equal `reportDigest`s and zero unexpected typed-degraded document failures — the F1 malformed specimens are expected to decode to their declared degraded states; any W1 paper degrading fails the gate — before the Reasoning verdict is written (R2).
- [x] Each stage's pass writes its families' verdicts into the exploration's
      `DECISIONS.md` as a dated entry before any atlas value changes (B1).
- [x] The lab is minted by `bun run beep create-package` with `--lab`, passes
      its Labs lane on its own PR, carries the one local `cargo check` result
      in `history/`, and never exports a reusable surface (labs law).
- [x] Every `EvalReport` is schema-validated and carries corpus hash,
      `gold/v1` version, per-call `ModelIdentity` + provider-cache keys, and
      per-metric scores (metric names from upstream #574, T3) — nothing
      time-dependent. Every run also writes an `EvalRunTelemetry` sidecar
      referencing the `reportDigest`; the Tier-L measurements and the Tier-D
      telemetry including wall-clock are required solely there and never enter
      the report digest (R1).
- [x] Base packet checks and `bun run beep yeet verify` are green; each stage
      ships as a PR driven to mergeable; P5 records a valid closeout
      reflection.
- [x] No unrelated refactors or formatting churn.

## Verification Surface

Proof is a lab test or a CLI run, never a screenshot (A5, S4).

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/semantica-canary/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/semantica-canary/ops/manifest.json` | Passes |
| Packet references | `rg -n "semantica-canary\|GOAL.md\|agentLaunchers\|packetAnchorDocument" goals/semantica-canary` | Required surfaces present |
| Whitespace | `git diff --check -- goals/semantica-canary explorations/semantica-lab` | Passes |
| Portfolio index | `bun run beep goals index --check` | Generated index current |
| Goal contracts | `bun run beep goals doctor` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at closeout |
| Repo quality | `bun run beep yeet verify` | Green |
| Lab tests | the lab's `test` script (vitest) in the Labs lane | Green per stage |
| Canary CLI | the headless entry (server/main.ts) run as `canary c0`, `canary c1`, `canary c2`, each live then `--offline`; reports archived under `history/` | Equal `reportDigest`s per stage; telemetry sidecars excluded (R1) |
| Tier-L bars | cold start and p95 recorded in the live run's `EvalRunTelemetry` sidecar, never in the report digest (R1) | < 5 s and < 100 ms (hard gates at C2) |
| Tier-D telemetry | wall-clock, RSS, disk growth, dependency and model bytes in every `EvalRunTelemetry` sidecar, never in the report digest (R1) | Recorded; alarms only, never a park |
| Hosted completion | `bun run beep yeet monitor` after each stage's publication | `merge-ready: yes`; zero unresolved threads |

## Stop Conditions

- **The probe breaker (S1), never a calendar.** A family enters a stage with
  its first-probe candidate; a stage failure buys that family exactly one more
  candidate from its sheet's slate; a second failure parks the family, records
  the park in the exploration's `DECISIONS.md`, and drops the exploration back
  to `decompose`. Wall-clock never triggers this.
- C1 cannot start until the sibling `openai-driver` packet has merged
  (completion gate satisfied and the PR landed on `main`); C0 and the scaffold
  never wait on it.
- A proposed change would cross into a No-Go (window, sidecar, local models,
  consumption-side retrieval, atlas backlog, NET-NEW reasoning runtime,
  reusable lab export), or would touch a brick outside cleanup-on-touch.
- A stage's pass criterion cannot be measured as a test or CLI run (for
  example, the EYE oracle cannot be wired under the host byte/time caps).
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named here (hosted provider keys are `op://` references
  already used by the existing driver Layers; new provider families need
  Benjamin).
- An `adopt`/`pick-one` value would be written to the atlas before its stage
  passes.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
