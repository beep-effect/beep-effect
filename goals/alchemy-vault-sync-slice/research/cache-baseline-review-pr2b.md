# Cache-policy baseline re-record for PR 2b (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/alchemy-postgres-views`, PR 2b of `goals/alchemy-vault-sync-slice`).

## What changed

`@beep/alchemy-postgres` gained one workspace dev dependency, `@beep/postgres`,
for its real-Postgres integration project (`test/integration`, gated on
`DB_PG_URL`). `bun run beep tsconfig-sync` adds the matching project
reference, which moves the dependency-edge digest of the package's `build`,
`check`, `lint:deprecated-apis` and `test` computations (the four
`configuration-drift` rows). No command, input glob, output, environment key
or cache flag changes, and no qualification is granted.

The record also re-stamps the `configuration-source-drift` review rows for
`packages/foundation/modeling/identity/turbo.json`,
`packages/foundation/primitive/types/turbo.json` and the root `turbo.json`.
That drift is inherited from `main`: this branch edits none of those files.

## Evidence

- `bun run beep quality cache-policy` before this record: 4 blocking
  findings, all `configuration-drift` on `@beep/alchemy-postgres#*`.
- Conformance: 79 tests on `Domain.InMemory` and PGlite; 32 integration
  scenarios on a throwaway Postgres 17 container.
