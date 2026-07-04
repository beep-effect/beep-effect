# Decision Log

## 2026-07-03 - Packet creation (grilling session)

1. **Mission: refresh the governed corpus home.** This packet consolidates
   post-June exports/downloads from the user's data-home boundary into the
   existing outside-repo corpus root at `<CORPUS_ROOT>`, then archive-moves the
   verified originals. Scope is salvage, catalog, dedupe, and archive-move only.
   Extraction, organization, enrichment, and downstream ingestion are explicitly
   deferred to a follow-up packet/run.
2. **Four source labels, no repo-side path mapping.** The in-scope sources are
   referenced only as `source-a`, `source-b`, `source-c`, and `source-d` in repo
   files. They represent two new email-export directories, one standalone PST
   file, and one June-era recovery directory. The concrete mapping lives outside
   the repo at `<CORPUS_ROOT>/ops/refresh-source-map.json`.
3. **Supersession: `raw/` is append-only by run.** This deliberately supersedes
   the retained `goals/oppold-corpus-pipeline/SPEC.md` statement that `raw/` is
   immutable after salvage. The 2026-06 raw content remains immutable and
   untouched; this run writes only to
   `<CORPUS_ROOT>/raw/2026-07-refresh/` with its own `provenance.jsonl`. The
   catalog unions provenance across runs.
4. **Hash-first dedupe.** Salvage computes content digests before copying. If a
   digest is already present in the catalog or was seen earlier in this run, the
   run writes a provenance-only record from the origin to the existing raw
   artifact and does not copy the bytes again.
5. **Supersession: verified originals are archive-moved.** This deliberately
   supersedes the retained `goals/oppold-corpus-pipeline/SPEC.md` statement that
   sources are never modified and retirement is manual. After verified salvage,
   original source files are moved, not copied and not deleted, to the data-home
   archive named `pre-consolidation-2026-07`, preserving relative directory
   structure. Nothing is ever deleted.
6. **Tooling surface.** Extend the `beep corpus` CLI with a dedupe-aware salvage
   subcommand that takes a run label and an archive-move subcommand. Manifests
   reuse the existing `CorpusProvenanceRecord` shapes from the retained packet;
   no parallel schema is introduced. Repo quality gates run through Yeet:
   `bun run beep yeet repair`, `bun run beep yeet verify`, and publish/monitor
   when requested.
7. **Execution model.** Codex agents are orchestrated by dynamic workflows. All
   processing is local-only. Agents may handle paths, hashes, counts, and names,
   but must never see or log document content.
8. **Acceptance posture.** The verification matrix is modeled on the retained
   packet and scoped down to salvage, catalog, dedupe, and archive-move. Required
   checks include provenance row count vs file-walk count, content-equal
   spot-check for a copied manifest entry, catalog distinct-digest before/after
   delta, move-manifest zero uncovered files, `GOAL.md` size, jq-valid manifest,
   privacy scan, and scope-only git status.

## 2026-07-03 - P1-P3 execution closeout

1. **Dedupe-aware salvage completed.** Four redacted sources (`source-a`
   through `source-d`) were walked for 8,336 records, exactly matching the
   pre-scan count. The run copied 12 new artifacts totaling 59,699,992,463
   bytes and wrote 8,324 provenance-only rows. Verification re-hashed all 12
   copied files as `origin = copy = manifest` and sampled 150 provenance-only
   records successfully.
2. **Run-union catalog reconciled copied count to digest delta.** The union
   catalog loaded 16,774 records across two manifests. The retained base run
   remained 8,438 records / 7,330 distinct digests; the refresh contributed
   exactly 12 new distinct digests, moving the union to 7,342 and matching the
   copied count 1:1. The catalog identified 7,284 cross-run duplicate sets and
   34,768,112,963 redundant bytes not stored again.
3. **Archive move executed after coverage proof.** Coverage was proved over all
   8,336 walked files before mutation, then all four sources were moved into
   the archive root as an all-or-nothing operation. The move manifest contains
   4 valid records. A post-move raw sample re-hashed 4/4 successfully. The
   data-home boundary now contains the corpus root, archive root, and
   explicitly out-of-scope directories only. Nothing was deleted.
4. **Incident: manifest writer first-record corruption.** The manifest writer
   exited 0 while corrupting record 1 into a NUL block. The record was
   reconstructed from origin and hash-verified; the pre-fix manifest was
   archived beside the corpus data. Root cause was whole-buffer append through
   `writeFileString` with flag `a`, producing a sparse first-chunk hole. The
   fix uses a scoped append handle, ordered writes, and sync, with regression
   coverage.
5. **Incident: valid filename handling.** Two path-handling bugs hit real
   refresh data: valid POSIX filenames with semicolons or backslashes were
   rejected by `fs.realPath` in salvage and archive-move paths. Both flows now
   have weird-filename regression tests.
6. **Scope retained.** Extraction, organization, enrichment, downstream
   ingestion, cloud sync, and content inspection remain deferred to a follow-up
   packet/run per `SPEC.md`.
