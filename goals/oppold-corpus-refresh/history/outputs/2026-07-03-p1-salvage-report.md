# P1 Dedupe-Aware Salvage Report (2026-07-03)

> Privacy note: source locations, filenames, directory names, user names, and
> client identifiers are intentionally omitted. The only source identifiers in
> this report are `source-a`, `source-b`, `source-c`, and `source-d`. Concrete
> paths and machine-readable manifests live beside the corpus data outside this
> repository.

## Outcome

Dedupe-aware salvage completed over all four refresh sources. The run walked
8,336 records, exactly matching the pre-scan count. It copied 12 new artifacts
for 59,699,992,463 bytes and wrote 8,324 provenance-only rows for content that
was already present in the retained corpus catalog or already seen earlier in
this refresh run.

The copied set is intentionally small and high-value: two large PST archives
filled the known year-series gap, with the remaining copied artifacts made up
of curated archive bundles, mailbox CSV exports, and one truncated
partial-export stub retained for provenance.

## Method

The runner resolved only the redacted labels, then processed each file in this
order: hash origin, compare the digest against the retained catalog and this
run's seen-digest set, copy only unseen digests into the refresh raw subtree,
and append a provenance record for every walked origin. Duplicate records point
at the existing raw artifact and do not store bytes a second time.

Run isolation held: new bytes were written only under the refresh raw subtree,
and the retained June raw tree was read for catalog comparison only.

## Counts

| Metric | Count |
| --- | ---: |
| Sources walked | 4 |
| Records walked | 8,336 |
| Pre-scan records | 8,336 |
| Copied records | 12 |
| Copied bytes | 59,699,992,463 |
| Provenance-only records | 8,324 |

## Verification

All 12 copied files were re-hashed after the run and matched
`origin = copy = manifest`: PASS.

A 150-record sample from the provenance-only rows was checked against the
cataloged target digest and redacted-label provenance: PASS.

## Incident: Manifest First-Record Corruption

The manifest writer exited 0 while corrupting record 1 into a NUL block. The
record was reconstructed from the origin file and hash-verified before the
manifest was accepted. The pre-fix manifest was archived beside the corpus data
for auditability.

Root cause: the writer used whole-buffer append through `writeFileString` with
flag `a`, which could produce a sparse first-chunk hole. The fix replaced that
path with a scoped append handle, ordered writes, and an explicit sync. A
regression test now covers the first-record corruption case.

## Incident: Valid POSIX Filename Handling

Two path-resolution bugs hit real refresh data: `fs.realPath` rejected valid
POSIX filenames containing semicolons or backslashes during salvage and again
during archive-move preparation. Both cases were fixed by routing the affected
operations through filename-safe path handling, with weird-filename regression
tests covering semicolon and backslash names.
