# Semantica Canary Plan

## Status

Status: `completed-retained`

P1-P5 are complete. C2 passed its restricted-EYE oracle, per-event rule
validation, commit/SIGKILL/restart projection proof, Tier-L bars, and the
full-W1 R2 gate with byte-identical live/replay reports and no unexpected
degradation. P5 audited the archived evidence, added the closeout reflection,
retained the packet, and returned the fired storage gate and the still-gated reasoning spike to the
source exploration at `decompose`. Six final `park` values were synced
to the Notion atlas (`history/p5-atlas-sync.md`).

## Phases

Each phase ships as one or more PRs driven to mergeable via `/yeet`; the
completion gate binds per phase, not only at close. Phase ids match
`ops/manifest.json` `phases[]`.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P1 Scaffold | complete | Mint the lab on its own PR, then commit F1 fixtures and the W1 manifest. | Lab passes its Labs lane; one local `cargo check` recorded; headless entry and runtime layer exist; F1 + W1 manifest committed. |
| P2 C0 | complete | The spine, first vertical slice first, then all three G-relation papers. | Evidence-quote candidate passed the slice, relation extension, and full-W1 R2 gate; Input and Extraction verdicts written. |
| P3 C1 | complete | Derived projections: dimension-keyed vector table and RDF rebuild-from-ledger. | G projection, alternate-dimension keying, rebuild identity, and full-W1 R2 passed; Storage and Embeddings verdicts written. |
| P4 C2 | complete | Reasoning, crash injection, and the Tier-L bars at bundle level. | C2 pass criteria; Reasoning verdict written; all Tier-L bars green. |
| P5 Close | complete | Verdicts to DECISIONS then atlas; reflection; packet state flip in the same PR. | Closeout reflection validates; six final `park` values synced to the atlas; packet `completed-retained`. |

## P1 Scaffold

Step 1 is the lab mint **on its own PR** (labs doctrine: a new lab passes its
lab lane alone; #742 precedent; M5 "PR C").

1. Mint:
   `bun run beep create-package semantica --type app --app-kind tauri --lab --description "Semantica port canary: headless Document→KG→eval chain over F1 + W1"`
   (`--lab` refuses an empty description).
2. Run one local `cargo check` inside the generated `src-tauri`; record the
   result under `history/`. Labs CI runs no Cargo, so this is the only Rust
   proof the packet ever takes (A5, S4).
3. Freeze `src-tauri` through C2: no edits, no sidecar, no IPC (S4, rabbit
   hole 12).
4. Hand-write the headless entry (server/main.ts) and the runtime layer
   (src/runtime/Layer.ts) following Professional Desktop's split
   ([`apps/professional-desktop/server/main.ts`](../../apps/professional-desktop/server/main.ts),
   [`apps/professional-desktop/src/runtime/Layer.ts`](../../apps/professional-desktop/src/runtime/Layer.ts))
   — borrow the shape, never import its internals.
5. Publish through Yeet; the PR is done when the Labs lane is green and
   `merge-ready: yes`.

Step 2, after the mint is mergeable (may share a PR with the first C0 slice):

6. Commit F1: about ten small synthetic documents (MD, HTML, born-digital
   PDF, one malformed specimen per format) for deterministic tests
   ([`workload-contract.md` §Corpus](../../explorations/semantica-lab/research/workload-contract.md#corpus)).
7. Commit the W1 manifest: the first 25 of the 76 on-disk academia-corpus
   PDFs by corpus id sort, one row per paper with id, sha256, and byte length.
   The manifest defines W1, never a directory (B3); the corpus itself stays
   out-of-repo and is never committed. No Oppold reference anywhere (D14).
8. Commit `gold/v1` as it is proposed: G-structure (10 papers), G-entity
   (5), G-relation (3), each proposed by a provider family different from the
   extractor's (S2), with the spot-checked fraction as a number.

## P2 C0

First vertical slice first
([`MAP.md` §First Vertical Slice](../../explorations/semantica-lab/MAP.md#first-vertical-slice)):
C0 on F1 + one G-relation W1 paper, then the same over all three G-relation
papers.

1. Design first: [`research/c0-design.md`](./research/c0-design.md) (D-C0-1..10,
   schema table, contracts, Layers, proof plan, open items O-1..O-4).
   Define the lab-local schemas before any service: `SourceDocument`,
   `Chunk`, `EvidenceBatch`/`EvidenceClaim`/`ConflictWitness`,
   `ProvenanceEvent`, `ModelIdentity`, the `ProviderCache` key, `EvalRun`
   (with the S2 refinement), `EvalReport` with its `reportDigest` (sha256 over
   the canonical JSON of the report body with the `reportDigest` field
   omitted), and the `EvalRunTelemetry` sidecar that references it (R1)
   ([`shared-schema.md`](../../explorations/semantica-lab/research/shared-schema.md)
   v1.4). `CanonicalText` is composed from `ResolvedSourceText` + `TextAnchor`,
   not built (M1).
2. Define the C0 `Context.Service` contracts (`DocumentSource`, `Parser`,
   `Canonicalizer`, `Chunker`, `Extractor`, `Ledger`, `ProviderCache`,
   `Evaluator`) and only then the first-probe Layers named in the MAP
   Capability Check.
3. Wire the CLI entry: `canary c0 --manifest w1.manifest.json --paper <id>`
   and the same with `--offline`.
4. Prove the slice as lab tests: equal report digests (telemetry sidecars excluded), `verifyTextAnchor`
   on every span, non-zero G-relation count, typed degraded states for the
   malformed specimens, report fields present.
5. Extend to all three G-relation papers; run hybrid (LangExtract shape) and
   pattern-only (Wink) under the same gold probe (S7).
6. Full-manifest gate (R2): `canary c0` over the full W1 manifest (25 papers)
   + F1 live, then `--offline`; equal `reportDigest`s and zero unexpected
   typed-degraded document failures (the F1 malformed specimens decode to
   their declared degraded states; any W1 paper degrading fails the gate).
7. On pass: write the Extractor and Input family verdicts to the exploration's
   `DECISIONS.md` as a dated entry. On failure: apply the breaker (one retry
   from the sheet's slate, then park and drop to `decompose`).

## P3 C1

**Dependency edge:** C1 needs the sibling `openai-driver` packet merged (the
`EmbeddingModel` Layer; MAP Sequencing 3). This is the only phase with that
edge; do not let it block P1 or P2.

1. Compose the OpenAI embedding Layer in the runtime layer; wrap responses in
   `EmbeddingVector` + `ModelIdentity`; `DegradedEmbedding` is the only
   degraded state.
2. Dimension-keyed vector table with exact kNN in SQL over `@beep/duckdb`
   (no DDL names a dimension); alternate-dimension fixture proves the keying.
3. RDF projection rebuilt from the ledger into Oxigraph per run under an
   Effect-level timeout; `QuadDelta`-shaped rebuild-identity witness.
4. `canary c1` live and `--offline`; `G-projection` expectations first, then the rebuild identity test
   (drop, rebuild, identical query results); rebuild cost recorded as telemetry.
5. Full-manifest gate (R2): `canary c1` over the full W1 + F1 live, then
   `--offline`; equal `reportDigest`s and zero unexpected typed-degraded
   document failures (F1 malformed specimens decode to their declared degraded
   states; any W1 paper degrading fails the gate).
6. On pass: Storage and Embeddings verdicts to `DECISIONS.md`; the embedding
   dimension is frozen from here.

## P4 C2

1. ρdf closure as `RdfsRule` values (rdfs2, 3, 5, 7, 9, 11) plus one SKOS
   broader-transitivity rule, naive fixpoint, emitting `InferenceEvent`s with
   proof DAGs (S5).
2. EYE WASM wired as the test-time oracle under `--restricted` with host
   byte/time caps; `G-entailment/rdfs` gold conclusions and proofs committed.
3. Gate: closure equality on conclusions plus per-`InferenceEvent` rule
   validation (S8); never premise-set identity.
4. Crash injection: kill after ledger commit, before projection rebuild;
   restart; identical rebuild (rabbit hole 10).
5. Tier-L bars at bundle level: cold start < 5 s, p95 < 100 ms, read from
   the live run's `EvalRunTelemetry` sidecar; Tier-D telemetry recorded there
   too, never in the report digest (G4, B5, R1).
6. Full-manifest gate (R2): `canary c2` over the full W1 + F1 live, then
   `--offline`; equal `reportDigest`s and zero unexpected typed-degraded
   document failures (F1 malformed specimens decode to their declared degraded
   states; any W1 paper degrading fails the gate).
7. On pass: Reasoning verdict to `DECISIONS.md`; the queued
   `semantica-storage-inversion` and `semantica-reasoning-spike` gates become
   eligible (re-entry at `decompose`, not scaffolded from here).

## P5 Close

1. Confirm every family verdict is a dated `DECISIONS.md` entry; only then
   sync final park/drop values to the Notion atlas (B1, A9).
2. Write the closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; run
   `bun run beep lint reflection-artifacts`.
3. Archive stage evidence (`EvalReport`s and their `EvalRunTelemetry`
   sidecars, replay diffs, crash-identity logs,
   the `cargo check` record) under `history/`.
4. Flip `README.md`, this plan, and `ops/manifest.json` to
   `completed-retained` in the same final PR.
5. Route fired successor gates back through
   [`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
   at `decompose`; do not scaffold a queued MAP row from here.

## Execution Notes

- Design order is schema → `Context.Service` contract → Layer; never
  helpers-first.
- Verify every Effect v4 API against the reference checkout before writing.
- The lab is ceremony-exempt (docgen, coverage, changeset, Storybook) but
  obeys full code law; do not add ceremony to earn a green lane.
- Attribute failures as introduced, inherited, unrelated, or environment-only
  before repairing; a failed probe is a breaker event, not a bug to hide.
- Record friction in the exploration's `research/OPPORTUNITIES.md` at the
  moment it happens.

## Verification Commands

```sh
test "$(wc -m < goals/semantica-canary/GOAL.md)" -le 4000
jq . goals/semantica-canary/ops/manifest.json
rg -n "semantica-canary|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantica-canary
git diff --check -- goals/semantica-canary explorations/semantica-lab
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
