# Cache-policy baseline re-record for PR 3b2 after merging PR 3c (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/vault-sync-cutover`, PR 3b part 2 of
`goals/alchemy-vault-sync-slice`).

## What changed

Merging `goals/vault-sync-api` (PR 3c) took its side of the cache-policy
baseline, which records the PR 3c dependency edges but not this branch's.
This branch also adds a `@beep/shared-tables` workspace dependency to
`@beep/db-admin`, so the `shared_membership` table the vault-sync sessions read
is generated into the drizzle migrations and the desktop bundle.

`bun run beep cache audit` on the merged tree, before this record, reports
exactly thirteen blocking findings, all `configuration-drift` on dependency-edge
digests: `@beep/db-admin#build`, `#check`, `#lint:deprecated-apis`, `#test`
and `#test:property`, plus `#build`, `#check`, `#lint:deprecated-apis` and
`#test` for `@beep/documents-server` and `@beep/documents-use-cases`. No
command, input glob, output, environment key or cache flag changes, and no
qualification is granted. The previous record for this branch is
[`cache-baseline-review-pr3b2-main.md`](cache-baseline-review-pr3b2-main.md).
