# Cache-policy baseline re-record for PR 3c on main after #2894 (2026-11-07)

Reviewer: Claude Opus 5.5 (orchestrator, `goals/vault-sync-api-pr`).

PR 3b part 1 merged as #2894, which recorded its `@beep/documents-server` edges on main.
PR 3c still adds two workspace dependencies to `@beep/documents-server`, `@beep/mcp-kit`
(Views-only MCP registration) and `@beep/shared-tables` (live `shared_membership` grant
reads), with the matching tsconfig references; see
[`cache-baseline-review-pr3c-saga.md`](cache-baseline-review-pr3c-saga.md).

On this branch merged with main, `bun run beep quality cache-policy` reports exactly four
blocking findings, all `configuration-drift` on the dependency-edge digest of
`@beep/documents-server#build`, `#check`, `#lint:deprecated-apis` and `#test`. No command,
input glob, output, environment key or cache flag changes, and no qualification is granted.
This record covers `@beep/documents-server` only.
