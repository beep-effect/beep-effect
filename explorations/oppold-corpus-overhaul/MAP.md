# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `oppold-corpus-salvage-restoration` (**promised now**) | Two separate gates in one packet: P0 preserves current T7 state (one-pass copy-while-hashing, verified archive, inherited-loss ledger seeded); then the ~3-week transformation wave restores mail first (per-store/child reconciliation, attachment type repair), reconciles all three recycle volumes, and converts distinct legacy-Word digests with originals retained. | none | Existing: recycle pairing (`packages/tooling/tool/cli/src/commands/Corpus/Corpus.recyclebin.ts` + `buildRestorationRecords` in `internal/ServicePrograms.ts`), corpus schemas/commands (`packages/tooling/tool/cli/src/commands/Corpus/`), libpff mode vocabulary + internal path-based subprocess (`packages/drivers/libpff/src/Libpff.pffexport.ts`), extraction evidence (`packages/drivers/doc-text/`, `packages/drivers/tika/`), file classification (`packages/foundation/capability/file-processing/`). NET-NEW: streaming file hasher (current helpers are in-RAM: `FsGuards.ts`, `Sha256.ts`), streaming archive runner with resume-by-hash, occurrence/derivation ledgers, public path-based `-m all` runner + corpus wiring, per-store checkpoints and child digests, byte-signature type repair + second pass, directory-`$R` tree reconciliation, DOC converter + fidelity harness. |
| `oppold-corpus-pipeline-v2` (gated) | Execute the ratified `keep\|replace\|add\|defer` decision matrix (stop condition ①) over the T7 archive + governed-corpus run union; replace the one-shot pipeline with a versioned, resumable, checkpointed DAG with per-stage manifests, cost/disk preflight, and reversible dedupe/prune last. | G1 PASS | Existing: `packages/foundation/capability/file-processing/`, `packages/drivers/tika/`, `packages/drivers/doc-text/`, `packages/drivers/exiftool/`, Corpus CLI. Inherits debt ledgers from `goals/oppold-corpus-pipeline` (285 extract failures, 3,055 `_unsorted`, recovered-mail deferral) and `goals/oppold-corpus-refresh`. NET-NEW: orchestration/checkpoint graph, occurrence/derivation ledger, shadow-mode quality/cost evaluator (stop condition ③). |
| `oppold-corpus-semantic-ingestion-v2` (gated) | Bootstrap from the version-pinned ready semantic seed, run an extract/refine/freeze loop against declared competency questions, emit a provenance-complete corpus projection. | G2; ready slices of `goals/semantic-foundation`; `goals/patent-document-schema` and `goals/folio-lynx-taxonomy-browse` as versioned gates | Existing: `packages/foundation/capability/langextract/`, `packages/drivers/nlp-mcp/`, `packages/drivers/wink/`. NET-NEW: competency suite, semantic freeze/migration contract, batch orchestration. |
| `oppold-corpus-enrichment-v2` (gated) | Apply the closed authority-source register (stop condition ④) as separately sourced assertions beside restored evidence; stop at the quality/authority/license/cost/marginal-gain gates. | G3 | Existing: incremental USPTO precedent (`goals/oppold-corpus-pipeline/history/outputs/2026-06-11-p4-enrichment-report.md`). NET-NEW: source-authority/contradiction contract, enrichment quality report. |
| `practice-kg-bundle-v2` (gate after G4) | Build and accept a new disposable bundle from the v2 projection without touching the live v1 front; must close the recorded v1 defects (AC-2 graph provenance, family contamination) before delivery. | G4 PASS | Existing: `apps/practice-kg-mcp/`, defect record in `goals/practice-kg-mcp/`. |
| `solo-practice-corpus-kit` (deferred) | Separate reusable code from practice-specific policy; prove against a practice-neutral fixture before any multi-firm product claim. | bundle v2 + an explicit productization decision | Explicitly outside the overhaul appetite (BRIEF no-go). |

## Sequencing

Scaffold G1 now; nothing else scaffolds at graduation. Inside G1:
`P0 preservation → mail vertical slice → full mail estate → recycle
reconciliation → DOC conversion`, with preservation and each transformation
family as separate acceptance gates (bar v2 clause 6). After G1 PASS the
chain is G2 → G3 → G4 → `practice-kg-bundle-v2`, but each is a MAP gate that
**reopens this exploration at decompose** — none of them spawns a goal packet
directly. `solo-practice-corpus-kit` waits for bundle v2 plus an explicit
productization decision.

## First Vertical Slice

After G1's P0 independently proves preservation: run **one metadata-selected
non-stub PST occurrence from a recycle surface** end-to-end — occurrence
mapping, public source-path libpff runner at concurrency one, `-m all`, raw
engine output, per-child SHA-256 and count reconciliation, type repair,
second-pass extraction, append-only terminal rows, atomic attempt promotion.
Corrupt/password/codepage outcomes are exercised with synthetic fixtures,
never client content. Expansion to the full mail estate is blocked until the
slice shows zero unaccounted children and its disk/time amplification is
measured.

## Open Risks Inherited From The Brief

- Inherited-loss ledger (collector errors, missing `$R`, exFAT-stripped
  metadata, mutated E-tree) is an opening balance, not restorable work.
- DOC conversion fidelity is declared-dimension verification, never strict
  losslessness.
- Format long tail is bounded by the decision matrix; unsupported families
  defer to named re-entry packets.
- Semantic inputs are versioned gates; composing unready slices re-founds
  ontology work.
- Mid-run self-improvement and unregistered enrichment are forbidden by the
  ratified stop conditions.
- Productization stays deferred; only reusable seams are preserved.
