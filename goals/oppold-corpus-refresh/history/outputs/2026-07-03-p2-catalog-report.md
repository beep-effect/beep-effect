# P2 Run-Union Catalog Report (2026-07-03)

> Privacy note: this report records only aggregate counts and redacted source
> labels. Concrete source paths, filenames, directory names, user names, client
> identifiers, and corpus content remain outside the repository.

## Outcome

The run-union catalog loaded two provenance manifests: the retained base run
and the refresh run. Together they account for 16,774 records.

The base manifest contributed 8,438 records and 7,330 distinct digests. The
refresh manifest contributed 8,336 records and exactly 12 new distinct digests,
raising the union from 7,330 to 7,342 distinct digests. The distinct-digest
delta matches the copied refresh count 1:1.

## Summary Counts

| Metric | Count |
| --- | ---: |
| Manifests unioned | 2 |
| Total provenance records | 16,774 |
| Base records | 8,438 |
| Base distinct digests | 7,330 |
| Refresh records | 8,336 |
| Refresh new distinct digests | 12 |
| Union distinct digests before refresh | 7,330 |
| Union distinct digests after refresh | 7,342 |
| Cross-run duplicate sets | 7,284 |
| Redundant bytes identified-not-stored | 34,768,112,963 |

## Dedupe Accounting

The refresh run was intentionally dedupe-first. Of 8,336 walked refresh
records, 8,324 resolved to existing catalog content or to a digest already seen
within the refresh run. Those records were retained as provenance only.

The 12 copied records are the only refresh records that changed the distinct
digest set. That 12-record delta is also the storage boundary: redundant bytes
were identified and cataloged, not stored again.

## Verification

The catalog accepted both manifests and produced a stable union summary. The
base distinct count of 7,330, the refresh walk count of 8,336, and the refresh
copied count of 12 reconcile across the salvage manifest and the catalog
summary.

No extraction, organization, enrichment, downstream ingestion, or content
inspection occurred in this phase.

