# Cache-policy baseline re-record for PR 3c after the PR 3b part 1 merge (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/vs-api`, PR 3c of `goals/alchemy-vault-sync-slice`).

## What changed

This branch merged `goals/vs-saga`, which recorded PR 3b part 1's
`@beep/documents-server` dependency edges on top of #2886's baseline
([`cache-baseline-review-pr3b1-domain.md`](cache-baseline-review-pr3b1-domain.md)).
That clears the "Unreviewed: //, @beep/documents-use-cases" refusal that held the
earlier PR 3c request ([`cache-baseline-request-pr3c.json`](cache-baseline-request-pr3c.json)).

PR 3c adds two workspace dependencies to `@beep/documents-server`: `@beep/mcp-kit` for
the Views-only MCP registration, and `@beep/shared-tables` for the live
`shared_membership` grant reads. It also regenerates the matching tsconfig
references. `bun run beep quality cache-policy` on the merged tree, before this
record, reports exactly four blocking findings, all `configuration-drift` on the
dependency-edge digest of `@beep/documents-server#build`, `#check`,
`#lint:deprecated-apis` and `#test`. No command, input glob, output, environment key
or cache flag changes, and no qualification is granted. This record covers
`@beep/documents-server` only.
