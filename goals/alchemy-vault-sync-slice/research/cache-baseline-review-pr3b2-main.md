# Cache-policy baseline re-record for PR 3b2 after #2863 (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/vault-sync-cutover`, PR 3b part 2 of
`goals/alchemy-vault-sync-slice`).

## What changed

`main` merged PR 2b (#2863) and re-recorded the cache-policy baseline for it.
Merging main into this branch takes main's baseline, which predates the PR 3b
dependency edges of `@beep/documents-server` (now depending on
`@beep/alchemy-postgres` and `@beep/pglite`) and `@beep/documents-use-cases`
(depending on `@alchemy.run/domain` for the Model declarations).

`bun run beep cache audit` on the merged tree, before this record, reports
exactly eight blocking findings, all `configuration-drift` on the
dependency-edge digest of `#build`, `#check`, `#lint:deprecated-apis` and
`#test` for those two packages. `@beep/alchemy-postgres` matches main and is
not re-recorded. No command, input glob, output, environment key or cache flag
changes, and no qualification is granted. The previous PR 3b2 record is
[`cache-baseline-review-pr3b2.md`](cache-baseline-review-pr3b2.md).
