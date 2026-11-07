# Cache-policy baseline re-record for PR 2b after #2881 (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/alchemy-postgres-views`, PR 2b of `goals/alchemy-vault-sync-slice`).

## What changed

`main` re-recorded the cache-policy baseline in #2881 for the root-package
projection inputs that #2856 moved into turbo's global configuration. Merging
that baseline into this branch drops the PR 2b record for
`@beep/alchemy-postgres`, which still declares the `@beep/postgres` workspace
dev dependency (and its tsconfig reference) for the real-Postgres integration
project. This record restores it on top of #2881's baseline.

`bun run beep quality cache-policy` on the merged tree, before this record,
reports exactly four blocking findings, all `configuration-drift` on the
dependency-edge digest of `@beep/alchemy-postgres#build`, `#check`,
`#lint:deprecated-apis` and `#test`, plus the `turbo.json` source review row.
No command, input glob, output, environment key or cache flag changes, and no
qualification is granted. The first PR 2b record is
[`cache-baseline-review-pr2b.md`](cache-baseline-review-pr2b.md).
