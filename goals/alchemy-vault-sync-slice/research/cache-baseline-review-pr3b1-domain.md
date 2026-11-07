# Cache-policy baseline re-record for PR 3b part 1 after #2886 (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/vs-saga`, PR 3b part 1 of `goals/alchemy-vault-sync-slice`).

## What changed

This branch merged `origin/goals/vault-sync-domain` (#2886), whose baseline carries
#2881's re-recorded root projection inputs and the PR 2b `@beep/alchemy-postgres` edge
record. PR 3b part 1's own dependency changes to `@beep/documents-server` (the pinned
`@alchemy.run/domain` dependency, the workspace `@beep/alchemy-postgres` driver and the
workspace `@beep/pglite` development dependency, plus the three regenerated tsconfig
reference lists) were never recorded: the first request
([`cache-baseline-request-pr3b1.json`](cache-baseline-request-pr3b1.json)) was prepared
but not applied while the root drift was open.

`bun run beep quality cache-policy` on the merged tree, before this record, reports
exactly four blocking findings, all `configuration-drift` on the dependency-edge digest
of `@beep/documents-server#build`, `#check`, `#lint:deprecated-apis` and `#test`. No
command, input glob, output, environment key or cache flag changes, and no
qualification is granted. This record covers `@beep/documents-server` only.
